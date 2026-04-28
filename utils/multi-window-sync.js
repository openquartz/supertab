/**
 * MultiWindowSync - 跨窗口同步管理器
 * 
 * 解决多窗口标签页跨窗口分组联动难题，实现：
 * - 跨窗口实时同步分组状态
 * - 窗口间事件广播与监听
 * - 标签页移动同步
 * - 分组操作同步
 * - 冲突检测与解决
 */

class MultiWindowSync {
  constructor(storageManager, eventBus, options = {}) {
    this.storageManager = storageManager;
    this.eventBus = eventBus;
    
    this.windowId = options.windowId || this.generateWindowId();
    this.sessionId = options.sessionId || this.generateSessionId();
    
    this.messageChannel = 'tabflow:multi_window_sync';
    this.heartbeatInterval = options.heartbeatInterval || 5000;
    this.staleWindowThreshold = options.staleWindowThreshold || 15000;
    
    this.windows = new Map();
    this.currentWindowInfo = {
      windowId: this.windowId,
      sessionId: this.sessionId,
      tabCount: 0,
      activeTabId: null,
      lastHeartbeat: Date.now(),
      isFocused: false,
      createdAt: Date.now()
    };
    
    this.heartbeatTimer = null;
    this.cleanupTimer = null;
    
    this.listeners = new Map();
    this.pendingMessages = [];
    
    this.isInitialized = false;
    this.isListening = false;
    
    console.log('🪟 MultiWindowSync initialized, windowId:', this.windowId);
  }

  generateWindowId() {
    return `win_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  generateSessionId() {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ========== 初始化 ==========

  async initialize() {
    if (this.isInitialized) return true;

    this.setupEventListeners();
    this.startHeartbeat();
    this.startCleanup();
    
    await this.registerWindow();
    await this.syncWithOtherWindows();
    
    this.isInitialized = true;
    console.log('✅ MultiWindowSync initialized');
    
    return true;
  }

  setupEventListeners() {
    if (this.isListening) return;

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        this.handleStorageChanges(changes);
      }
    });

    if (chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === this.messageChannel) {
          this.handleMessage(message.payload, sender);
          if (typeof sendResponse === 'function') {
            sendResponse({ received: true, windowId: this.windowId });
          }
        }
        return true;
      });
    }

    if (chrome.windows) {
      chrome.windows.onFocusChanged.addListener((windowId) => {
        this.handleWindowFocusChanged(windowId);
      });

      chrome.windows.onRemoved.addListener((windowId) => {
        this.handleWindowRemoved(windowId);
      });

      chrome.windows.onCreated.addListener((window) => {
        this.handleWindowCreated(window);
      });
    }

    this.isListening = true;
    console.log('📡 Event listeners setup for multi-window sync');
  }

  // ========== 心跳机制 ==========

  startHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeatInterval);

    this.sendHeartbeat();
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  async sendHeartbeat() {
    this.currentWindowInfo.lastHeartbeat = Date.now();
    
    try {
      const tabs = await this.getWindowTabs();
      this.currentWindowInfo.tabCount = tabs.length;
      
      const activeTab = await this.getActiveTab();
      this.currentWindowInfo.activeTabId = activeTab ? activeTab.id : null;
    } catch (error) {
      console.warn('⚠️ Failed to update window info:', error);
    }

    this.windows.set(this.windowId, { ...this.currentWindowInfo });
    await this.saveWindows();
  }

  // ========== 窗口管理 ==========

  async registerWindow() {
    const windowInfo = {
      windowId: this.windowId,
      sessionId: this.sessionId,
      tabCount: 0,
      activeTabId: null,
      lastHeartbeat: Date.now(),
      isFocused: false,
      createdAt: Date.now()
    };

    this.windows.set(this.windowId, windowInfo);
    await this.saveWindows();

    await this.broadcast({
      action: 'window_registered',
      windowId: this.windowId,
      windowInfo
    });

    console.log('📝 Window registered:', this.windowId);
  }

  async unregisterWindow() {
    this.windows.delete(this.windowId);
    await this.saveWindows();

    await this.broadcast({
      action: 'window_unregistered',
      windowId: this.windowId
    });

    this.stopHeartbeat();
    this.stopCleanup();

    console.log('📋 Window unregistered:', this.windowId);
  }

  async saveWindows() {
    try {
      const windowsData = Object.fromEntries(this.windows);
      await new Promise((resolve, reject) => {
        chrome.storage.local.set({ 'tabflow:windows': windowsData }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('❌ Failed to save windows:', error);
    }
  }

  async loadWindows() {
    try {
      const result = await new Promise((resolve, reject) => {
        chrome.storage.local.get('tabflow:windows', (data) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(data);
          }
        });
      });

      const windowsData = result['tabflow:windows'] || {};
      this.windows = new Map(Object.entries(windowsData));
    } catch (error) {
      console.warn('⚠️ Failed to load windows:', error);
      this.windows = new Map();
    }
  }

  // ========== 过期窗口清理 ==========

  startCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanupStaleWindows();
    }, this.staleWindowThreshold);
  }

  stopCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  async cleanupStaleWindows() {
    const now = Date.now();
    const staleWindows = [];

    for (const [windowId, windowInfo] of this.windows.entries()) {
      const timeSinceHeartbeat = now - (windowInfo.lastHeartbeat || 0);
      
      if (timeSinceHeartbeat > this.staleWindowThreshold && windowId !== this.windowId) {
        staleWindows.push(windowId);
      }
    }

    if (staleWindows.length > 0) {
      console.log('🧹 Cleaning up stale windows:', staleWindows);
      
      for (const windowId of staleWindows) {
        this.windows.delete(windowId);
      }

      await this.saveWindows();

      for (const windowId of staleWindows) {
        this.notify('window_stale', { windowId });
      }
    }
  }

  // ========== 消息广播系统 ==========

  async broadcast(payload) {
    const message = {
      type: this.messageChannel,
      payload: {
        ...payload,
        fromWindowId: this.windowId,
        fromSessionId: this.sessionId,
        timestamp: Date.now()
      }
    };

    try {
      if (chrome.runtime && chrome.runtime.sendMessage) {
        await chrome.runtime.sendMessage(message);
      }
    } catch (error) {
      console.warn('⚠️ Failed to broadcast message:', error);
    }

    try {
      const messages = await this.loadPendingMessages();
      messages.push(message.payload);
      
      if (messages.length > 100) {
        messages.splice(0, messages.length - 50);
      }

      await this.savePendingMessages(messages);
    } catch (error) {
      console.warn('⚠️ Failed to save pending message:', error);
    }

    console.log('📢 Broadcasted:', payload.action || 'message');
  }

  handleMessage(payload, sender) {
    if (payload.fromWindowId === this.windowId) {
      return;
    }

    console.log('📨 Received message from window:', payload.fromWindowId, payload.action);

    switch (payload.action) {
      case 'window_registered':
        this.handleWindowRegistered(payload);
        break;
      case 'window_unregistered':
        this.handleWindowUnregistered(payload);
        break;
      case 'tab_created':
        this.handleRemoteTabCreated(payload);
        break;
      case 'tab_removed':
        this.handleRemoteTabRemoved(payload);
        break;
      case 'tab_updated':
        this.handleRemoteTabUpdated(payload);
        break;
      case 'tab_moved_to_group':
        this.handleRemoteTabMoved(payload);
        break;
      case 'group_created':
        this.handleRemoteGroupCreated(payload);
        break;
      case 'group_updated':
        this.handleRemoteGroupUpdated(payload);
        break;
      case 'group_deleted':
        this.handleRemoteGroupDeleted(payload);
        break;
      case 'sync_request':
        this.handleSyncRequest(payload);
        break;
      case 'sync_response':
        this.handleSyncResponse(payload);
        break;
      case 'heartbeat':
        this.handleRemoteHeartbeat(payload);
        break;
      default:
        this.notify('custom_message', payload);
    }
  }

  // ========== 存储变更监听 ==========

  handleStorageChanges(changes) {
    if (changes['tabflow:windows']) {
      const oldWindows = changes['tabflow:windows'].oldValue || {};
      const newWindows = changes['tabflow:windows'].newValue || {};
      
      for (const [windowId, windowInfo] of Object.entries(newWindows)) {
        if (!oldWindows[windowId] && windowId !== this.windowId) {
          this.handleWindowRegistered({ windowId, windowInfo });
        }
      }

      for (const windowId of Object.keys(oldWindows)) {
        if (!newWindows[windowId] && windowId !== this.windowId) {
          this.handleWindowUnregistered({ windowId });
        }
      }
    }
  }

  // ========== 窗口事件处理 ==========

  handleWindowRegistered(payload) {
    const { windowId, windowInfo } = payload;
    
    if (!this.windows.has(windowId)) {
      this.windows.set(windowId, windowInfo);
    }

    this.notify('window_registered', { windowId, windowInfo });
    console.log('🪟 Window registered:', windowId);
  }

  handleWindowUnregistered(payload) {
    const { windowId } = payload;
    this.windows.delete(windowId);

    this.notify('window_unregistered', { windowId });
    console.log('🪟 Window unregistered:', windowId);
  }

  handleWindowFocusChanged(windowId) {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
      this.currentWindowInfo.isFocused = false;
      return;
    }

    this.getOwnWindowId().then(ownWindowId => {
      this.currentWindowInfo.isFocused = ownWindowId === windowId;
      
      if (this.currentWindowInfo.isFocused) {
        this.notify('window_focused', { windowId: ownWindowId });
      } else {
        this.notify('window_blurred', { windowId: ownWindowId });
      }
    });
  }

  handleWindowRemoved(windowId) {
    this.windows.delete(windowId.toString());
    this.saveWindows();
    this.notify('window_removed', { windowId });
  }

  handleWindowCreated(window) {
    this.notify('window_created', { window });
  }

  handleRemoteHeartbeat(payload) {
    const { fromWindowId } = payload;
    
    if (this.windows.has(fromWindowId)) {
      const windowInfo = this.windows.get(fromWindowId);
      windowInfo.lastHeartbeat = Date.now();
    }
  }

  // ========== 标签页事件同步 ==========

  async syncWithOtherWindows() {
    await this.loadWindows();

    const otherWindows = this.getOtherWindows();
    if (otherWindows.length > 0) {
      console.log('🔄 Syncing with', otherWindows.length, 'other windows');
      
      await this.broadcast({
        action: 'sync_request',
        requestingWindowId: this.windowId
      });
    }
  }

  handleSyncRequest(payload) {
    const { requestingWindowId } = payload;
    
    this.sendSyncResponse(requestingWindowId);
  }

  async sendSyncResponse(targetWindowId) {
    const groups = await this.storageManager.getAllGroups();
    const tabs = await this.storageManager.getAllTabs();

    await this.broadcast({
      action: 'sync_response',
      targetWindowId,
      groups,
      tabs,
      windowId: this.windowId
    });
  }

  handleSyncResponse(payload) {
    if (payload.targetWindowId !== this.windowId) {
      return;
    }

    this.notify('sync_received', {
      fromWindowId: payload.windowId,
      groups: payload.groups,
      tabs: payload.tabs
    });
  }

  // ========== 标签页操作同步 ==========

  async notifyTabCreated(tab) {
    await this.broadcast({
      action: 'tab_created',
      tab: {
        id: tab.id,
        uuid: tab.uuid,
        url: tab.url,
        title: tab.title,
        groupId: tab.groupId,
        windowId: tab.windowId
      }
    });
  }

  handleRemoteTabCreated(payload) {
    this.notify('remote_tab_created', payload);
  }

  async notifyTabRemoved(tabId, tabData) {
    await this.broadcast({
      action: 'tab_removed',
      tabId,
      tabData: tabData ? {
        id: tabData.id,
        uuid: tabData.uuid,
        groupId: tabData.groupId
      } : null
    });
  }

  handleRemoteTabRemoved(payload) {
    this.notify('remote_tab_removed', payload);
  }

  async notifyTabUpdated(tab) {
    await this.broadcast({
      action: 'tab_updated',
      tab: {
        id: tab.id,
        uuid: tab.uuid,
        url: tab.url,
        title: tab.title,
        groupId: tab.groupId,
        favicon: tab.favicon
      }
    });
  }

  handleRemoteTabUpdated(payload) {
    this.notify('remote_tab_updated', payload);
  }

  // ========== 分组操作同步 ==========

  async notifyTabMovedToGroup(tab, groupId, oldGroupId = null) {
    await this.broadcast({
      action: 'tab_moved_to_group',
      tab: {
        id: tab.id,
        uuid: tab.uuid
      },
      groupId,
      oldGroupId
    });
  }

  handleRemoteTabMoved(payload) {
    this.notify('remote_tab_moved', payload);
  }

  async notifyGroupCreated(group) {
    await this.broadcast({
      action: 'group_created',
      group: {
        id: group.id,
        name: group.name,
        type: group.type,
        color: group.color,
        createdAt: group.createdAt
      }
    });
  }

  handleRemoteGroupCreated(payload) {
    this.notify('remote_group_created', payload);
  }

  async notifyGroupUpdated(group) {
    await this.broadcast({
      action: 'group_updated',
      group: {
        id: group.id,
        name: group.name,
        color: group.color,
        collapsed: group.collapsed,
        updatedAt: Date.now()
      }
    });
  }

  handleRemoteGroupUpdated(payload) {
    this.notify('remote_group_updated', payload);
  }

  async notifyGroupDeleted(groupId, tabIds = []) {
    await this.broadcast({
      action: 'group_deleted',
      groupId,
      tabIds
    });
  }

  handleRemoteGroupDeleted(payload) {
    this.notify('remote_group_deleted', payload);
  }

  // ========== 辅助方法 ==========

  async getOwnWindowId() {
    try {
      if (chrome && chrome.windows && chrome.windows.getCurrent) {
        const window = await chrome.windows.getCurrent();
        return window.id;
      }
    } catch (error) {
      console.warn('⚠️ Failed to get current window ID:', error);
    }
    return null;
  }

  async getWindowTabs() {
    try {
      if (chrome && chrome.tabs && chrome.tabs.query) {
        const currentWindow = await chrome.windows.getCurrent();
        return await chrome.tabs.query({ windowId: currentWindow.id });
      }
    } catch (error) {
      console.warn('⚠️ Failed to get window tabs:', error);
    }
    return [];
  }

  async getActiveTab() {
    try {
      if (chrome && chrome.tabs && chrome.tabs.query) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        return tabs[0] || null;
      }
    } catch (error) {
      console.warn('⚠️ Failed to get active tab:', error);
    }
    return null;
  }

  getOtherWindows() {
    const windows = [];
    for (const [windowId, windowInfo] of this.windows.entries()) {
      if (windowId !== this.windowId) {
        windows.push({ windowId, ...windowInfo });
      }
    }
    return windows;
  }

  async loadPendingMessages() {
    try {
      const result = await new Promise((resolve, reject) => {
        chrome.storage.local.get('tabflow:pending_messages', (data) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(data);
          }
        });
      });
      return result['tabflow:pending_messages'] || [];
    } catch (error) {
      console.warn('⚠️ Failed to load pending messages:', error);
      return [];
    }
  }

  async savePendingMessages(messages) {
    try {
      await new Promise((resolve, reject) => {
        chrome.storage.local.set({ 'tabflow:pending_messages': messages }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('❌ Failed to save pending messages:', error);
    }
  }

  // ========== 事件监听系统 ==========

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    
    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  notify(event, data) {
    if (!this.listeners.has(event)) return;
    
    const callbacks = this.listeners.get(event);
    for (const callback of callbacks) {
      try {
        callback(data);
      } catch (error) {
        console.error(`❌ Error in ${event} listener:`, error);
      }
    }
  }

  // ========== 统计信息 ==========

  getStats() {
    return {
      windowId: this.windowId,
      sessionId: this.sessionId,
      initialized: this.isInitialized,
      listening: this.isListening,
      totalWindows: this.windows.size,
      otherWindows: this.getOtherWindows().length,
      currentWindowInfo: { ...this.currentWindowInfo }
    };
  }

  async shutdown() {
    this.stopHeartbeat();
    this.stopCleanup();
    await this.unregisterWindow();
    
    this.isInitialized = false;
    this.isListening = false;
    
    console.log('🔌 MultiWindowSync shutdown complete');
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MultiWindowSync;
}

if (typeof window !== 'undefined') {
  window.MultiWindowSync = MultiWindowSync;
}
