/**
 * GroupCacheManager - 分组缓存管理器
 * 
 * 实现功能：
 * - 分组结果实时更新与增量同步
 * - 避免页面切换时分组错乱
 * - 缓存预热和失效策略
 * - 变更追踪和差异计算
 */

class GroupCacheManager {
  constructor(storageManager, eventBus, options = {}) {
    this.storageManager = storageManager;
    this.eventBus = eventBus;
    
    this.cache = {
      groups: new Map(),
      tabs: new Map(),
      groupToTabs: new Map(),
      tabToGroup: new Map(),
      metadata: {
        lastUpdated: 0,
        version: 0,
        hash: ''
      }
    };
    
    this.pendingUpdates = [];
    this.isSyncing = false;
    this.dirtyFlags = new Set();
    
    this.cacheTimeout = options.cacheTimeout || 5 * 60 * 1000;
    this.maxHistorySize = options.maxHistorySize || 100;
    this.changeHistory = [];
    
    this.listeners = {
      groupUpdated: [],
      tabMoved: [],
      cacheInvalidated: [],
      syncCompleted: []
    };
    
    this.initialized = false;
    
    console.log('💾 GroupCacheManager initialized');
  }

  async initialize() {
    if (this.initialized) return true;

    await this.loadFromStorage();
    this.setupEventListeners();
    
    this.initialized = true;
    console.log('✅ GroupCacheManager initialized');
    return true;
  }

  setupEventListeners() {
    if (!this.eventBus) return;

    this.eventBus.on('tab_created', (tabData) => {
      this.handleTabCreated(tabData);
    });

    this.eventBus.on('tab_removed', ({ tabId, tabData }) => {
      this.handleTabRemoved(tabData);
    });

    this.eventBus.on('tab_updated', (tabData) => {
      this.handleTabUpdated(tabData);
    });

    this.eventBus.on('tab_moved_to_group', ({ tab, groupId }) => {
      this.handleTabMoved(tab, groupId);
    });

    this.eventBus.on('group_created', (group) => {
      this.handleGroupCreated(group);
    });

    this.eventBus.on('group_updated', ({ group }) => {
      this.handleGroupUpdated(group);
    });

    this.eventBus.on('group_deleted', ({ groupId, tabIds }) => {
      this.handleGroupDeleted(groupId);
    });

    this.eventBus.on('tab_group_assigned', ({ tabData, groupId }) => {
      this.handleTabGroupAssigned(tabData, groupId);
    });
  }

  // ========== 缓存核心操作 ==========

  async getGroup(groupId) {
    await this.ensureCacheFresh();
    
    const group = this.cache.groups.get(groupId);
    if (!group) return null;

    const tabIds = this.cache.groupToTabs.get(groupId) || [];
    const tabs = tabIds
      .map(id => this.cache.tabs.get(id))
      .filter(Boolean);

    return {
      ...group,
      tabs
    };
  }

  async getAllGroups() {
    await this.ensureCacheFresh();
    
    const groups = [];
    for (const [groupId, group] of this.cache.groups.entries()) {
      const tabIds = this.cache.groupToTabs.get(groupId) || [];
      const tabs = tabIds
        .map(id => this.cache.tabs.get(id))
        .filter(Boolean);

      groups.push({
        ...group,
        tabs
      });
    }

    return groups.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  getTab(tabId) {
    return this.cache.tabs.get(tabId) || null;
  }

  getTabGroup(tabId) {
    const groupId = this.cache.tabToGroup.get(tabId);
    if (!groupId) return null;
    return this.cache.groups.get(groupId) || null;
  }

  // ========== 增量更新处理 ==========

  handleTabCreated(tabData) {
    const tabId = tabData.id;
    
    this.cache.tabs.set(tabId, { ...tabData });
    
    const groupId = tabData.groupId || 'ungrouped';
    this.cache.tabToGroup.set(tabId, groupId);
    
    if (!this.cache.groupToTabs.has(groupId)) {
      this.cache.groupToTabs.set(groupId, []);
    }
    const tabIds = this.cache.groupToTabs.get(groupId);
    if (!tabIds.includes(tabId)) {
      tabIds.push(tabId);
    }

    this.markDirty('tabs', tabId);
    this.recordChange({
      type: 'tab_created',
      tabId,
      groupId,
      timestamp: Date.now()
    });

    this.notify('groupUpdated', { groupId, tabId, action: 'add' });
  }

  handleTabRemoved(tabData) {
    if (!tabData) return;
    
    const tabId = tabData.id;
    const groupId = this.cache.tabToGroup.get(tabId);

    this.cache.tabs.delete(tabId);
    this.cache.tabToGroup.delete(tabId);

    if (groupId) {
      const tabIds = this.cache.groupToTabs.get(groupId);
      if (tabIds) {
        const index = tabIds.indexOf(tabId);
        if (index > -1) {
          tabIds.splice(index, 1);
        }
      }
    }

    this.markDirty('tabs', tabId);
    this.recordChange({
      type: 'tab_removed',
      tabId,
      groupId,
      timestamp: Date.now()
    });

    if (groupId) {
      this.notify('groupUpdated', { groupId, tabId, action: 'remove' });
    }
  }

  handleTabUpdated(tabData) {
    const tabId = tabData.id;
    const existingTab = this.cache.tabs.get(tabId);
    
    if (existingTab) {
      const oldGroupId = existingTab.groupId;
      const newGroupId = tabData.groupId || 'ungrouped';
      
      if (oldGroupId !== newGroupId) {
        this.handleTabMoved(tabData, newGroupId);
      }

      this.cache.tabs.set(tabId, { ...existingTab, ...tabData });
    } else {
      this.handleTabCreated(tabData);
    }

    this.markDirty('tabs', tabId);
  }

  handleTabMoved(tab, newGroupId) {
    const tabId = tab.id;
    const oldGroupId = this.cache.tabToGroup.get(tabId);

    if (oldGroupId && oldGroupId !== newGroupId) {
      const oldTabIds = this.cache.groupToTabs.get(oldGroupId);
      if (oldTabIds) {
        const index = oldTabIds.indexOf(tabId);
        if (index > -1) {
          oldTabIds.splice(index, 1);
        }
      }
      this.notify('groupUpdated', { groupId: oldGroupId, tabId, action: 'remove' });
    }

    this.cache.tabToGroup.set(tabId, newGroupId);
    
    if (!this.cache.groupToTabs.has(newGroupId)) {
      this.cache.groupToTabs.set(newGroupId, []);
    }
    const newTabIds = this.cache.groupToTabs.get(newGroupId);
    if (!newTabIds.includes(tabId)) {
      newTabIds.push(tabId);
    }

    this.markDirty('tabToGroup', tabId);
    this.recordChange({
      type: 'tab_moved',
      tabId,
      oldGroupId,
      newGroupId,
      timestamp: Date.now()
    });

    this.notify('tabMoved', { tabId, oldGroupId, newGroupId });
    this.notify('groupUpdated', { groupId: newGroupId, tabId, action: 'add' });
  }

  handleTabGroupAssigned(tabData, groupId) {
    this.handleTabMoved(tabData, groupId);
  }

  handleGroupCreated(group) {
    const groupId = group.id;
    
    this.cache.groups.set(groupId, { ...group });
    
    if (!this.cache.groupToTabs.has(groupId)) {
      this.cache.groupToTabs.set(groupId, []);
    }

    if (group.tabs && Array.isArray(group.tabs)) {
      for (const tab of group.tabs) {
        const tabId = tab.id;
        this.cache.tabToGroup.set(tabId, groupId);
        
        const tabIds = this.cache.groupToTabs.get(groupId);
        if (!tabIds.includes(tabId)) {
          tabIds.push(tabId);
        }
      }
    }

    this.markDirty('groups', groupId);
    this.recordChange({
      type: 'group_created',
      groupId,
      timestamp: Date.now()
    });

    this.notify('groupUpdated', { groupId, action: 'create' });
  }

  handleGroupUpdated(group) {
    const existingGroup = this.cache.groups.get(group.id);
    if (existingGroup) {
      this.cache.groups.set(group.id, { ...existingGroup, ...group });
    } else {
      this.cache.groups.set(group.id, { ...group });
    }

    this.markDirty('groups', group.id);
    this.recordChange({
      type: 'group_updated',
      groupId: group.id,
      timestamp: Date.now()
    });

    this.notify('groupUpdated', { groupId: group.id, action: 'update' });
  }

  handleGroupDeleted(groupId) {
    const tabIds = this.cache.groupToTabs.get(groupId) || [];
    
    for (const tabId of tabIds) {
      this.cache.tabToGroup.delete(tabId);
    }

    this.cache.groups.delete(groupId);
    this.cache.groupToTabs.delete(groupId);

    this.markDirty('groups', groupId);
    this.recordChange({
      type: 'group_deleted',
      groupId,
      tabIds,
      timestamp: Date.now()
    });

    this.notify('groupUpdated', { groupId, action: 'delete' });
  }

  // ========== 脏标记和同步 ==========

  markDirty(type, id) {
    this.dirtyFlags.add(`${type}:${id}`);
    this.cache.metadata.lastUpdated = Date.now();
    this.cache.metadata.version++;
    
    this.scheduleSync();
  }

  scheduleSync() {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }
    
    this.syncTimeout = setTimeout(() => {
      this.performSync();
    }, 100);
  }

  async performSync() {
    if (this.isSyncing || this.dirtyFlags.size === 0) {
      return;
    }

    this.isSyncing = true;
    
    try {
      await this.saveToStorage();
      this.dirtyFlags.clear();
      
      this.notify('syncCompleted', {
        timestamp: Date.now(),
        version: this.cache.metadata.version
      });
    } catch (error) {
      console.error('❌ Failed to sync cache:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  async ensureCacheFresh() {
    const now = Date.now();
    const age = now - this.cache.metadata.lastUpdated;
    
    if (age > this.cacheTimeout && !this.isSyncing) {
      console.log('🔄 Cache expired, refreshing...');
      await this.loadFromStorage();
    }
  }

  // ========== 持久化 ==========

  async saveToStorage() {
    const cacheData = {
      groups: Object.fromEntries(this.cache.groups),
      tabs: Object.fromEntries(this.cache.tabs),
      groupToTabs: Object.fromEntries(
        Array.from(this.cache.groupToTabs.entries()).map(([k, v]) => [k, v])
      ),
      tabToGroup: Object.fromEntries(this.cache.tabToGroup),
      metadata: {
        ...this.cache.metadata,
        hash: this.generateHash()
      }
    };

    try {
      await new Promise((resolve, reject) => {
        chrome.storage.local.set({ 'tabflow:group_cache': cacheData }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
      
      console.log('💾 Cache saved, version:', this.cache.metadata.version);
      return true;
    } catch (error) {
      console.error('❌ Failed to save cache:', error);
      return false;
    }
  }

  async loadFromStorage() {
    try {
      const result = await new Promise((resolve, reject) => {
        chrome.storage.local.get('tabflow:group_cache', (data) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(data);
          }
        });
      });

      const cacheData = result['tabflow:group_cache'];
      
      if (cacheData) {
        const currentHash = this.generateHash();
        if (cacheData.metadata && cacheData.metadata.hash === currentHash) {
          console.log('ℹ️ Cache unchanged, skipping load');
          return false;
        }

        this.cache.groups = new Map(Object.entries(cacheData.groups || {}));
        this.cache.tabs = new Map(Object.entries(cacheData.tabs || {}));
        this.cache.groupToTabs = new Map(
          Object.entries(cacheData.groupToTabs || {}).map(([k, v]) => [k, Array.isArray(v) ? v : []])
        );
        this.cache.tabToGroup = new Map(Object.entries(cacheData.tabToGroup || {}));
        this.cache.metadata = cacheData.metadata || {
          lastUpdated: Date.now(),
          version: 0,
          hash: ''
        };

        console.log('📥 Cache loaded, version:', this.cache.metadata.version);
        this.notify('cacheInvalidated', { reason: 'loaded' });
        return true;
      }
      
      return false;
    } catch (error) {
      console.warn('⚠️ Failed to load cache:', error);
      return false;
    }
  }

  generateHash() {
    let hash = 0;
    const str = `${this.cache.groups.size}-${this.cache.tabs.size}-${this.cache.metadata.version}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  // ========== 变更历史 ==========

  recordChange(change) {
    this.changeHistory.push(change);
    
    if (this.changeHistory.length > this.maxHistorySize) {
      this.changeHistory.shift();
    }
  }

  getChangeHistory(since = 0) {
    if (since === 0) {
      return [...this.changeHistory];
    }
    return this.changeHistory.filter(c => c.timestamp >= since);
  }

  clearHistory() {
    this.changeHistory = [];
  }

  // ========== 监听系统 ==========

  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  off(event, callback) {
    if (this.listeners[event]) {
      const index = this.listeners[event].indexOf(callback);
      if (index > -1) {
        this.listeners[event].splice(index, 1);
      }
    }
  }

  notify(event, data) {
    if (this.listeners[event]) {
      for (const callback of this.listeners[event]) {
        try {
          callback(data);
        } catch (error) {
          console.error(`❌ Error in ${event} listener:`, error);
        }
      }
    }
  }

  // ========== 缓存操作 ==========

  invalidateCache(reason = 'manual') {
    this.cache.groups.clear();
    this.cache.tabs.clear();
    this.cache.groupToTabs.clear();
    this.cache.tabToGroup.clear();
    this.cache.metadata = {
      lastUpdated: 0,
      version: 0,
      hash: ''
    };
    this.dirtyFlags.clear();

    console.log('🗑️ Cache invalidated, reason:', reason);
    this.notify('cacheInvalidated', { reason });
  }

  preloadFromData(tabs, groups) {
    this.invalidateCache('preload');

    for (const group of groups) {
      this.cache.groups.set(group.id, { ...group });
      this.cache.groupToTabs.set(group.id, []);
    }

    for (const tab of tabs) {
      const tabId = tab.id;
      this.cache.tabs.set(tabId, { ...tab });

      const groupId = tab.groupId || 'ungrouped';
      this.cache.tabToGroup.set(tabId, groupId);

      if (!this.cache.groupToTabs.has(groupId)) {
        this.cache.groupToTabs.set(groupId, []);
      }
      const tabIds = this.cache.groupToTabs.get(groupId);
      if (!tabIds.includes(tabId)) {
        tabIds.push(tabId);
      }
    }

    this.cache.metadata.lastUpdated = Date.now();
    this.cache.metadata.version++;

    console.log('📦 Cache preloaded with', tabs.length, 'tabs and', groups.length, 'groups');
    this.notify('cacheInvalidated', { reason: 'preloaded' });
  }

  // ========== 差异计算 ==========

  calculateDifferences(oldState, newState) {
    const differences = {
      addedGroups: [],
      removedGroups: [],
      updatedGroups: [],
      addedTabs: [],
      removedTabs: [],
      movedTabs: [],
      updatedTabs: []
    };

    const oldGroups = oldState.groups || new Map();
    const newGroups = newState.groups || new Map();

    for (const [groupId, group] of newGroups.entries()) {
      if (!oldGroups.has(groupId)) {
        differences.addedGroups.push({ groupId, group });
      } else {
        const oldGroup = oldGroups.get(groupId);
        if (JSON.stringify(oldGroup) !== JSON.stringify(group)) {
          differences.updatedGroups.push({ groupId, oldGroup, newGroup: group });
        }
      }
    }

    for (const [groupId] of oldGroups.entries()) {
      if (!newGroups.has(groupId)) {
        differences.removedGroups.push({ groupId });
      }
    }

    return differences;
  }

  getCurrentState() {
    return {
      groups: new Map(this.cache.groups),
      tabs: new Map(this.cache.tabs),
      groupToTabs: new Map(this.cache.groupToTabs),
      tabToGroup: new Map(this.cache.tabToGroup),
      metadata: { ...this.cache.metadata }
    };
  }

  // ========== 统计信息 ==========

  getStats() {
    return {
      groupCount: this.cache.groups.size,
      tabCount: this.cache.tabs.size,
      lastUpdated: this.cache.metadata.lastUpdated,
      version: this.cache.metadata.version,
      dirtyFlagCount: this.dirtyFlags.size,
      isSyncing: this.isSyncing,
      changeHistorySize: this.changeHistory.length,
      cacheAge: Date.now() - this.cache.metadata.lastUpdated
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GroupCacheManager;
}

if (typeof window !== 'undefined') {
  window.GroupCacheManager = GroupCacheManager;
}
