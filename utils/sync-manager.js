/**
 * SyncManager - 同步管理器
 * 
 * 实现功能：
 * - 分组规则导出/导入
 * - 多设备同步
 * - 跨窗口分组联动
 * - 冲突解决
 * - 增量同步
 */

class SyncManager {
  constructor(storageManager, eventBus, options = {}) {
    this.storageManager = storageManager;
    this.eventBus = eventBus;
    
    this.syncStorageKey = 'tabflow:sync_data';
    this.lastSyncKey = 'tabflow:last_sync';
    this.conflictsKey = 'tabflow:sync_conflicts';
    
    this.syncInterval = options.syncInterval || 30 * 1000;
    this.maxSyncRetries = options.maxSyncRetries || 3;
    this.conflictResolutionStrategy = options.conflictResolutionStrategy || 'latest-wins';
    
    this.isSyncing = false;
    this.syncTimer = null;
    this.pendingChanges = [];
    this.conflicts = [];
    
    this.deviceId = this.generateDeviceId();
    this.sessionId = this.generateSessionId();
    
    this.listeners = {
      syncStarted: [],
      syncCompleted: [],
      syncFailed: [],
      conflictDetected: [],
      conflictResolved: [],
      dataExported: [],
      dataImported: []
    };
    
    this.initialized = false;
    
    console.log('🔄 SyncManager initialized, deviceId:', this.deviceId);
  }

  generateDeviceId() {
    const stored = localStorage.getItem('tabflow:device_id');
    if (stored) return stored;
    
    const newId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('tabflow:device_id', newId);
    return newId;
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  // ========== 初始化 ==========

  async initialize() {
    if (this.initialized) return true;

    await this.loadConflicts();
    this.setupEventListeners();
    this.startAutoSync();
    
    this.initialized = true;
    console.log('✅ SyncManager initialized');
    return true;
  }

  setupEventListeners() {
    if (!this.eventBus) return;

    this.eventBus.on('group_created', (group) => {
      this.recordChange('create', 'group', group.id, group);
    });

    this.eventBus.on('group_updated', ({ group }) => {
      this.recordChange('update', 'group', group.id, group);
    });

    this.eventBus.on('group_deleted', ({ groupId }) => {
      this.recordChange('delete', 'group', groupId);
    });

    this.eventBus.on('tab_moved_to_group', ({ tab, groupId }) => {
      this.recordChange('update', 'tab', tab.uuid || tab.id, { 
        ...tab, 
        groupId,
        updatedAt: Date.now()
      });
    });

    this.eventBus.on('tab_note_updated', ({ tab, note }) => {
      this.recordChange('update', 'tab', tab.uuid || tab.id, {
        ...tab,
        note,
        updatedAt: Date.now()
      });
    });

    this.eventBus.on('tab_alias_updated', ({ tab, alias }) => {
      this.recordChange('update', 'tab', tab.uuid || tab.id, {
        ...tab,
        alias,
        updatedAt: Date.now()
      });
    });
  }

  // ========== 变更记录 ==========

  recordChange(operation, entityType, entityId, data = null) {
    const change = {
      id: `change_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      operation,
      entityType,
      entityId,
      data,
      deviceId: this.deviceId,
      sessionId: this.sessionId,
      timestamp: Date.now(),
      synced: false
    };

    this.pendingChanges.push(change);
    
    if (this.pendingChanges.length > 100) {
      this.pendingChanges = this.pendingChanges.slice(-50);
    }

    console.log('📝 Change recorded:', operation, entityType, entityId);
  }

  // ========== 自动同步 ==========

  startAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(() => {
      this.performSync().catch(error => {
        console.warn('⚠️ Auto-sync failed:', error);
      });
    }, this.syncInterval);

    console.log('⏰ Auto-sync started, interval:', this.syncInterval, 'ms');
  }

  stopAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      console.log('⏹️ Auto-sync stopped');
    }
  }

  async performSync(forceFull = false) {
    if (this.isSyncing) {
      console.log('⏳ Sync already in progress, skipping');
      return false;
    }

    this.isSyncing = true;
    this.notify('syncStarted', { timestamp: Date.now(), forceFull });

    try {
      const lastSync = await this.getLastSyncTime();
      const syncData = await this.collectSyncData(forceFull, lastSync);

      if (!forceFull && syncData.changes.length === 0 && syncData.removals.length === 0) {
        console.log('ℹ️ No changes to sync');
        this.notify('syncCompleted', { 
          timestamp: Date.now(), 
          changesCount: 0,
          wasFull: forceFull
        });
        return true;
      }

      const conflicts = await this.detectConflicts(syncData);
      
      if (conflicts.length > 0) {
        console.log('⚔️ Detected', conflicts.length, 'conflicts during sync');
        
        for (const conflict of conflicts) {
          const resolved = await this.resolveConflict(conflict);
          if (!resolved) {
            await this.addConflict(conflict);
          }
        }
      }

      await this.applySync(syncData);
      await this.setLastSyncTime(Date.now());

      this.pendingChanges = this.pendingChanges.filter(c => c.synced);

      console.log('✅ Sync completed');
      this.notify('syncCompleted', { 
        timestamp: Date.now(), 
        changesCount: syncData.changes.length + syncData.removals.length,
        wasFull: forceFull
      });

      return true;

    } catch (error) {
      console.error('❌ Sync failed:', error);
      this.notify('syncFailed', { 
        timestamp: Date.now(), 
        error: error.message 
      });
      throw error;

    } finally {
      this.isSyncing = false;
    }
  }

  async collectSyncData(forceFull, lastSyncTime) {
    const syncData = {
      changes: [],
      removals: [],
      metadata: {
        deviceId: this.deviceId,
        sessionId: this.sessionId,
        timestamp: Date.now(),
        lastSyncTime,
        isFullSync: forceFull
      }
    };

    if (forceFull) {
      const allGroups = await this.storageManager.getAllGroups();
      const allTabs = await this.storageManager.getAllTabs();
      
      for (const [groupId, group] of Object.entries(allGroups)) {
        syncData.changes.push({
          operation: 'create',
          entityType: 'group',
          entityId: groupId,
          data: group,
          timestamp: group.createdAt || group.updatedAt || Date.now()
        });
      }

      for (const [tabId, tab] of Object.entries(allTabs)) {
        syncData.changes.push({
          operation: 'create',
          entityType: 'tab',
          entityId: tabId,
          data: tab,
          timestamp: tab.lastAccessed || tab.openedAt || Date.now()
        });
      }
    } else {
      const unsyncedChanges = this.pendingChanges.filter(c => !c.synced);
      
      for (const change of unsyncedChanges) {
        if (change.timestamp > lastSyncTime) {
          if (change.operation === 'delete') {
            syncData.removals.push({
              entityType: change.entityType,
              entityId: change.entityId,
              timestamp: change.timestamp
            });
          } else {
            syncData.changes.push({
              operation: change.operation,
              entityType: change.entityType,
              entityId: change.entityId,
              data: change.data,
              timestamp: change.timestamp
            });
          }
        }
      }
    }

    return syncData;
  }

  async detectConflicts(syncData) {
    const conflicts = [];
    const remoteData = await this.getRemoteSyncData();

    if (!remoteData) return conflicts;

    const localChanges = new Map();
    for (const change of syncData.changes) {
      const key = `${change.entityType}:${change.entityId}`;
      localChanges.set(key, change);
    }

    const remoteChanges = new Map();
    for (const change of (remoteData.changes || [])) {
      const key = `${change.entityType}:${change.entityId}`;
      remoteChanges.set(key, change);
    }

    for (const [key, localChange] of localChanges.entries()) {
      const remoteChange = remoteChanges.get(key);
      
      if (remoteChange && remoteChange.timestamp > localChange.timestamp) {
        conflicts.push({
          key,
          entityType: localChange.entityType,
          entityId: localChange.entityId,
          localChange,
          remoteChange,
          detectedAt: Date.now()
        });
      }
    }

    return conflicts;
  }

  async resolveConflict(conflict) {
    let resolved = false;

    switch (this.conflictResolutionStrategy) {
      case 'latest-wins':
        if (conflict.remoteChange.timestamp > conflict.localChange.timestamp) {
          await this.applyRemoteChange(conflict.remoteChange);
          resolved = true;
        } else {
          await this.applyLocalChange(conflict.localChange);
          resolved = true;
        }
        break;

      case 'local-wins':
        await this.applyLocalChange(conflict.localChange);
        resolved = true;
        break;

      case 'remote-wins':
        await this.applyRemoteChange(conflict.remoteChange);
        resolved = true;
        break;

      case 'merge':
        await this.mergeChanges(conflict.localChange, conflict.remoteChange);
        resolved = true;
        break;

      default:
        resolved = false;
    }

    if (resolved) {
      this.notify('conflictResolved', { 
        conflict, 
        strategy: this.conflictResolutionStrategy 
      });
    }

    return resolved;
  }

  async applyLocalChange(change) {
    if (change.entityType === 'group') {
      if (change.operation === 'delete') {
        await this.storageManager.removeGroup(change.entityId);
      } else {
        await this.storageManager.saveGroup(change.data);
      }
    } else if (change.entityType === 'tab') {
      if (change.operation === 'delete') {
        await this.storageManager.removeTab(change.entityId);
      } else {
        await this.storageManager.saveTab(change.data);
      }
    }
  }

  async applyRemoteChange(change) {
    return this.applyLocalChange(change);
  }

  async mergeChanges(localChange, remoteChange) {
    if (!localChange.data || !remoteChange.data) {
      return this.applyLocalChange(localChange);
    }

    const mergedData = {
      ...localChange.data,
      ...remoteChange.data
    };

    if (localChange.timestamp > remoteChange.timestamp) {
      mergedData = { ...remoteChange.data, ...localChange.data };
    }

    await this.applyLocalChange({
      ...localChange,
      data: mergedData
    });
  }

  async applySync(syncData) {
    for (const change of syncData.changes) {
      await this.applyLocalChange(change);
      
      const pending = this.pendingChanges.find(
        c => c.entityId === change.entityId && c.entityType === change.entityType
      );
      if (pending) {
        pending.synced = true;
      }
    }

    for (const removal of syncData.removals) {
      if (removal.entityType === 'group') {
        await this.storageManager.removeGroup(removal.entityId);
      } else if (removal.entityType === 'tab') {
        await this.storageManager.removeTab(removal.entityId);
      }
    }
  }

  // ========== 远程数据存储（使用 chrome.storage.sync） ==========

  async getRemoteSyncData() {
    try {
      const result = await new Promise((resolve, reject) => {
        chrome.storage.sync.get(this.syncStorageKey, (data) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(data);
          }
        });
      });

      return result[this.syncStorageKey] || null;
    } catch (error) {
      console.warn('⚠️ Failed to get remote sync data:', error);
      return null;
    }
  }

  async setRemoteSyncData(syncData) {
    try {
      await new Promise((resolve, reject) => {
        chrome.storage.sync.set({ [this.syncStorageKey]: syncData }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
      return true;
    } catch (error) {
      console.error('❌ Failed to set remote sync data:', error);
      return false;
    }
  }

  async getLastSyncTime() {
    try {
      const result = await new Promise((resolve, reject) => {
        chrome.storage.local.get(this.lastSyncKey, (data) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(data);
          }
        });
      });

      return result[this.lastSyncKey] || 0;
    } catch (error) {
      console.warn('⚠️ Failed to get last sync time:', error);
      return 0;
    }
  }

  async setLastSyncTime(timestamp) {
    try {
      await new Promise((resolve, reject) => {
        chrome.storage.local.set({ [this.lastSyncKey]: timestamp }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
      return true;
    } catch (error) {
      console.error('❌ Failed to set last sync time:', error);
      return false;
    }
  }

  // ========== 冲突管理 ==========

  async addConflict(conflict) {
    this.conflicts.push({
      ...conflict,
      addedAt: Date.now(),
      resolved: false
    });
    await this.saveConflicts();
    
    this.notify('conflictDetected', { conflict });
  }

  async resolveConflictManually(conflictId, choice) {
    const conflictIndex = this.conflicts.findIndex(c => c.id === conflictId);
    if (conflictIndex === -1) return false;

    const conflict = this.conflicts[conflictIndex];
    
    if (choice === 'local') {
      await this.applyLocalChange(conflict.localChange);
    } else if (choice === 'remote') {
      await this.applyRemoteChange(conflict.remoteChange);
    } else if (choice === 'merge') {
      await this.mergeChanges(conflict.localChange, conflict.remoteChange);
    }

    conflict.resolved = true;
    conflict.resolvedAt = Date.now();
    conflict.resolution = choice;
    
    await this.saveConflicts();
    this.notify('conflictResolved', { conflict, choice });

    return true;
  }

  getUnresolvedConflicts() {
    return this.conflicts.filter(c => !c.resolved);
  }

  getAllConflicts() {
    return [...this.conflicts];
  }

  async saveConflicts() {
    try {
      await new Promise((resolve, reject) => {
        chrome.storage.local.set({ [this.conflictsKey]: this.conflicts }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('❌ Failed to save conflicts:', error);
    }
  }

  async loadConflicts() {
    try {
      const result = await new Promise((resolve, reject) => {
        chrome.storage.local.get(this.conflictsKey, (data) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(data);
          }
        });
      });

      this.conflicts = result[this.conflictsKey] || [];
    } catch (error) {
      console.warn('⚠️ Failed to load conflicts:', error);
      this.conflicts = [];
    }
  }

  // ========== 导出/导入功能 ==========

  async exportData(options = {}) {
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      exportedBy: this.deviceId,
      groups: {},
      tabs: {},
      rules: {},
      settings: null,
      metadata: {
        includeGroups: options.includeGroups !== false,
        includeTabs: options.includeTabs !== false,
        includeRules: options.includeRules !== false,
        includeSettings: options.includeSettings === true
      }
    };

    if (options.includeGroups !== false) {
      const groups = await this.storageManager.getAllGroups();
      exportData.groups = groups;
    }

    if (options.includeTabs !== false) {
      const tabs = await this.storageManager.getAllTabs();
      exportData.tabs = tabs;
    }

    if (options.includeRules !== false) {
      const rules = await this.getGroupingRules();
      exportData.rules = rules;
    }

    if (options.includeSettings === true) {
      const settings = await this.storageManager.getSettings();
      exportData.settings = settings;
    }

    const jsonString = JSON.stringify(exportData, null, 2);
    this.notify('dataExported', { exportData });

    return jsonString;
  }

  async importData(jsonString, options = {}) {
    let importData;
    try {
      importData = JSON.parse(jsonString);
    } catch (error) {
      throw new Error(`Invalid JSON format: ${error.message}`);
    }

    const validation = this.validateImportData(importData);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join('; ')}`);
    }

    if (options.clearExisting === true) {
      await this.storageManager.clearAllData();
    }

    let importedCount = 0;

    if (importData.groups && Object.keys(importData.groups).length > 0) {
      for (const [groupId, group] of Object.entries(importData.groups)) {
        if (options.mergeStrategy === 'skip') {
          const existing = await this.storageManager.getGroup(groupId);
          if (existing) continue;
        }
        await this.storageManager.saveGroup(group);
        importedCount++;
      }
    }

    if (importData.tabs && Object.keys(importData.tabs).length > 0) {
      for (const [tabId, tab] of Object.entries(importData.tabs)) {
        await this.storageManager.saveTab(tab);
        importedCount++;
      }
    }

    if (importData.rules && Object.keys(importData.rules).length > 0) {
      await this.saveGroupingRules(importData.rules);
      importedCount += Object.keys(importData.rules).length;
    }

    this.notify('dataImported', { 
      importData, 
      importedCount,
      options 
    });

    return {
      success: true,
      importedCount,
      groupsCount: Object.keys(importData.groups || {}).length,
      tabsCount: Object.keys(importData.tabs || {}).length,
      rulesCount: Object.keys(importData.rules || {}).length
    };
  }

  validateImportData(data) {
    const errors = [];

    if (!data.version) {
      errors.push('Missing version field');
    }

    if (!data.exportedAt) {
      errors.push('Missing exportedAt field');
    }

    if (data.groups && typeof data.groups !== 'object') {
      errors.push('Invalid groups format');
    }

    if (data.tabs && typeof data.tabs !== 'object') {
      errors.push('Invalid tabs format');
    }

    if (data.rules && typeof data.rules !== 'object') {
      errors.push('Invalid rules format');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // ========== 规则导入导出辅助方法 ==========

  async getGroupingRules() {
    try {
      const result = await new Promise((resolve, reject) => {
        chrome.storage.local.get('tabflow:grouping_rules', (data) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(data);
          }
        });
      });
      return result['tabflow:grouping_rules'] || {};
    } catch (error) {
      console.warn('⚠️ Failed to get grouping rules:', error);
      return {};
    }
  }

  async saveGroupingRules(rules) {
    try {
      await new Promise((resolve, reject) => {
        chrome.storage.local.set({ 'tabflow:grouping_rules': rules }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
      return true;
    } catch (error) {
      console.error('❌ Failed to save grouping rules:', error);
      return false;
    }
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

  // ========== 配置 ==========

  setConflictResolutionStrategy(strategy) {
    const validStrategies = ['latest-wins', 'local-wins', 'remote-wins', 'merge', 'manual'];
    if (!validStrategies.includes(strategy)) {
      throw new Error(`Invalid strategy: ${strategy}. Must be one of: ${validStrategies.join(', ')}`);
    }
    this.conflictResolutionStrategy = strategy;
    console.log('⚙️ Conflict resolution strategy set to:', strategy);
  }

  setSyncInterval(intervalMs) {
    this.syncInterval = intervalMs;
    if (this.syncTimer) {
      this.stopAutoSync();
      this.startAutoSync();
    }
    console.log('⚙️ Sync interval set to:', intervalMs, 'ms');
  }

  // ========== 统计信息 ==========

  getStats() {
    return {
      deviceId: this.deviceId,
      sessionId: this.sessionId,
      initialized: this.initialized,
      isSyncing: this.isSyncing,
      pendingChangesCount: this.pendingChanges.length,
      unsyncedChangesCount: this.pendingChanges.filter(c => !c.synced).length,
      conflictsCount: this.conflicts.length,
      unresolvedConflictsCount: this.getUnresolvedConflicts().length,
      lastSyncTime: this.getLastSyncTime(),
      syncInterval: this.syncInterval,
      conflictResolutionStrategy: this.conflictResolutionStrategy
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SyncManager;
}

if (typeof window !== 'undefined') {
  window.SyncManager = SyncManager;
}
