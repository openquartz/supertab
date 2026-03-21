// TabFlow Service Worker - Main background script
importScripts('./event-bus.js');
importScripts('../utils/privacy-manager.js');
importScripts('./storage-manager.js');
importScripts('../utils/grouping-engine.js');
importScripts('./tab-manager.js');

class TabFlowServiceWorker {
  constructor() {
    this.eventBus = new EventBus();
    this.privacyManager = new PrivacyManager();
    this.storageManager = new StorageManager(this.privacyManager);
    this.tabManager = null;
    this.initialized = false;
    this.initializationPromise = null;
    this.tabWatcher = null;
    this.eventListenersSetup = false;
    this.messageHandlersSetup = false;

    // Register Chrome event handlers synchronously so MV3 wake-up events are not missed.
    this.setupEventListeners();
    this.setupMessageHandlers();
  }

  async initialize() {
    if (this.initialized) return;
    if (this.initializationPromise) return this.initializationPromise;

    console.log('🔧 TabFlow Service Worker initializing...');

    this.initializationPromise = (async () => {
      try {
        // Initialize privacy manager first
        await this.privacyManager.initialize();

        // Initialize storage manager
        await this.storageManager.initialize();

        // Initialize tab manager
        this.tabManager = new TabManager(this.eventBus, this.storageManager, this.privacyManager);
        await this.tabManager.initialize();

        this.initialized = true;
        console.log('✅ TabFlow Service Worker initialized successfully');

        // Perform initial tab sync
        await this.performInitialSync();
      } catch (error) {
        console.error('❌ Failed to initialize TabFlow Service Worker:', error);
        throw error;
      } finally {
        this.initializationPromise = null;
      }
    })();

    return this.initializationPromise;
  }

  setupEventListeners() {
    if (this.eventListenersSetup) {
      return;
    }

    // Chrome tabs events
    chrome.tabs.onCreated.addListener(this.handleTabCreated.bind(this));
    chrome.tabs.onUpdated.addListener(this.handleTabUpdated.bind(this));
    chrome.tabs.onRemoved.addListener(this.handleTabRemoved.bind(this));
    chrome.tabs.onActivated.addListener(this.handleTabActivated.bind(this));
    chrome.tabs.onMoved.addListener(this.handleTabMoved.bind(this));
    chrome.tabs.onDetached.addListener(this.handleTabDetached.bind(this));
    chrome.tabs.onAttached.addListener(this.handleTabAttached.bind(this));

    // Chrome windows events
    chrome.windows.onFocusChanged.addListener(this.handleWindowFocusChanged.bind(this));

    // Chrome runtime events
    chrome.runtime.onStartup.addListener(this.handleStartup.bind(this));
    chrome.runtime.onInstalled.addListener(this.handleInstalled.bind(this));
    chrome.runtime.onConnect.addListener(this.handleConnect.bind(this));

    // Extension icon click event - Open sidebar
    chrome.action.onClicked.addListener(this.handleIconClick.bind(this));

    // Side panel events
    if (chrome.sidePanel) {
      chrome.sidePanel.setOptions({
        enabled: true,
        path: 'ui/sidebar/sidebar.html'
      });
    }

    this.eventListenersSetup = true;
    console.log('📡 Event listeners setup complete');
  }

  setupMessageHandlers() {
    if (this.messageHandlersSetup) {
      return;
    }

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      let responded = false;
      const timeoutMs = 15000;
      const timer = setTimeout(() => {
        safeSendResponse({ success: false, error: 'Request timed out' });
      }, timeoutMs);

      const safeSendResponse = (payload) => {
        if (responded) {
          return;
        }
        responded = true;
        clearTimeout(timer);
        try {
          sendResponse(payload);
        } catch (error) {
          console.warn('sendResponse failed (likely channel already closed):', error);
        }
      };

      Promise.resolve(this.handleMessage(request, sender, safeSendResponse))
        .catch((error) => {
          console.error('Unhandled message handler error:', error);
          const sanitizedError = this.sanitizeErrorMessage(error?.message || 'Unknown error');
          safeSendResponse({ success: false, error: sanitizedError });
        });

      return true; // Keep message channel open for async responses
    });

    this.messageHandlersSetup = true;
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      await this.initialize();

      const action = request?.action;
      const data = this.normalizeRequestData(request);

      switch (action) {
        case 'getTabsGrouped':
          const groupedTabs = await this.tabManager.getTabsGrouped(data.groupType || 'domain');
          sendResponse({ success: true, data: groupedTabs });
          break;

        case 'getAllTabs':
          const allTabs = await this.tabManager.getAllTabs();
          sendResponse({ success: true, data: allTabs });
          break;

        case 'createGroup':
          if (!data?.name) {
            sendResponse({ success: false, error: 'Group name is required' });
            break;
          }
          const group = await this.tabManager.createCustomGroup(data.name);
          sendResponse({ success: true, data: group });
          break;

        case 'updateTabNote':
          if (!data?.tabUuid || typeof data.note !== 'string') {
            sendResponse({ success: false, error: 'tabUuid is required and note must be a string' });
            break;
          }
          const success = await this.tabManager.updateTabNote(data.tabUuid, data.note);
          sendResponse({ success });
          break;

        case 'updateTabAlias':
          if (!data?.tabUuid || typeof data.alias !== 'string') {
            sendResponse({ success: false, error: 'tabUuid and alias are required' });
            break;
          }
          const aliasSuccess = await this.tabManager.updateTabAlias(data.tabUuid, data.alias);
          sendResponse({ success: aliasSuccess });
          break;

        case 'moveTabToGroup':
          if (!data?.tabUuid || !data?.groupId) {
            sendResponse({ success: false, error: 'tabUuid and groupId are required' });
            break;
          }
          const moveSuccess = await this.tabManager.moveTabToGroup(data.tabUuid, data.groupId);
          sendResponse({ success: moveSuccess });
          break;

        case 'closeTab':
          if (!data?.tabId) {
            sendResponse({ success: false, error: 'tabId is required' });
            break;
          }
          const closeSuccess = await this.tabManager.closeTab(data.tabId);
          sendResponse({ success: closeSuccess });
          break;

        case 'deleteGroup':
          if (!data?.groupId) {
            sendResponse({ success: false, error: 'groupId is required' });
            break;
          }
          const deleteGroupSuccess = await this.tabManager.deleteGroup(data.groupId, data.tabIds || []);
          sendResponse({ success: deleteGroupSuccess });
          break;

        case 'bookmarkTabs':
          if (!Array.isArray(data?.tabUuids) || data.tabUuids.length === 0) {
            sendResponse({ success: false, error: 'tabUuids are required' });
            break;
          }
          const bookmarkResult = await this.tabManager.bookmarkTabs(data.tabUuids);
          sendResponse(bookmarkResult);
          break;

        case 'activateTab':
          if (!data?.tabId) {
            sendResponse({ success: false, error: 'tabId is required' });
            break;
          }
          const activateSuccess = await this.tabManager.activateTab(data.tabId);
          sendResponse({ success: activateSuccess });
          break;

        case 'getAllGroups':
          const groups = await this.storageManager.getAllGroups();
          sendResponse({ success: true, data: groups });
          break;

        case 'getPrivacySettings':
          const settings = await this.privacyManager.getSettings();
          sendResponse({ success: true, data: settings });
          break;

        case 'updatePrivacySettings':
          if (!data?.settings) {
            sendResponse({ success: false, error: 'settings data is required' });
            break;
          }
          await this.privacyManager.updateSettings(this.normalizePrivacySettingsUpdate(data.settings));
          sendResponse({ success: true });
          break;

        case 'exportAllData':
          const exportData = await this.exportAllData();
          sendResponse({ success: true, data: exportData });
          break;

        case 'importAllData':
          if (!data) {
            sendResponse({ success: false, error: 'Import data is required' });
            break;
          }
          const importSuccess = await this.importAllData(data);
          sendResponse({ success: importSuccess });
          break;

        case 'clearAllData':
          const clearSuccess = await this.clearAllData();
          sendResponse({ success: clearSuccess });
          break;

        case 'getPerformanceMetrics':
          const metrics = this.tabManager.getPerformanceMetrics();
          sendResponse({ success: true, data: metrics });
          break;

        default:
          sendResponse({ success: false, error: `Unknown action: ${action}` });
      }
    } catch (error) {
      console.error('Message handler error:', error);
      // Sanitize error message to prevent information disclosure
      const sanitizedError = this.sanitizeErrorMessage(error.message);
      sendResponse({ success: false, error: sanitizedError });
    }
  }

  // Tab event handlers
  async handleTabCreated(tab) {
    try {
      await this.initialize();
      console.log('📄 Tab created:', tab.id, tab.url);
      await this.tabManager.handleTabCreated(tab);
    } catch (error) {
      console.error('Error handling tab creation:', error);
    }
  }

  async handleTabUpdated(tabId, changeInfo, tab) {
    try {
      await this.initialize();
      if (changeInfo.status === 'complete' && tab.url) {
        console.log('📝 Tab updated:', tabId, tab.url);
        await this.tabManager.handleTabUpdated(tab);
      }
    } catch (error) {
      console.error('Error handling tab update:', error);
    }
  }

  async handleTabRemoved(tabId, removeInfo) {
    try {
      await this.initialize();
      console.log('🗑️ Tab removed:', tabId);
      await this.tabManager.handleTabRemoved(tabId, removeInfo);
    } catch (error) {
      console.error('Error handling tab removal:', error);
    }
  }

  async handleTabActivated(activeInfo) {
    try {
      await this.initialize();
      console.log('🎯 Tab activated:', activeInfo.tabId);
      await this.tabManager.handleTabActivated(activeInfo);
    } catch (error) {
      console.error('Error handling tab activation:', error);
    }
  }

  async handleTabMoved(tabId, moveInfo) {
    try {
      await this.initialize();
      console.log('📦 Tab moved:', tabId, moveInfo);
      await this.tabManager.handleTabMoved(tabId, moveInfo);
    } catch (error) {
      console.error('Error handling tab move:', error);
    }
  }

  async handleTabDetached(tabId, detachInfo) {
    try {
      await this.initialize();
      console.log('🔓 Tab detached:', tabId);
      await this.tabManager.handleTabDetached(tabId, detachInfo);
    } catch (error) {
      console.error('Error handling tab detach:', error);
    }
  }

  async handleTabAttached(tabId, attachInfo) {
    try {
      await this.initialize();
      console.log('🔗 Tab attached:', tabId);
      await this.tabManager.handleTabAttached(tabId, attachInfo);
    } catch (error) {
      console.error('Error handling tab attach:', error);
    }
  }

  async handleWindowFocusChanged(windowId) {
    try {
      await this.initialize();
      console.log('🪟 Window focus changed:', windowId);
      await this.tabManager.handleWindowFocusChanged(windowId);
    } catch (error) {
      console.error('Error handling window focus change:', error);
    }
  }

  // Icon click handler - Open sidebar
  async handleIconClick(tab) {
    try {
      console.log('🔘 Extension icon clicked');
      if (!chrome.sidePanel) {
        console.warn('SidePanel API not available');
        return;
      }

      // Do not await any async call before sidePanel.open to preserve user gesture context.
      await chrome.sidePanel.open({ tabId: tab.id });
      console.log('📬 Sidebar opened');
    } catch (error) {
      console.error('Failed to open side panel:', error);
    }
  }

  // Runtime event handlers
  async handleStartup() {
    console.log('🚀 Chrome startup detected');
    await this.initialize();
  }

  async handleInstalled(details) {
    console.log('📦 TabFlow installed/updated:', details.reason);

    await this.initialize();

    if (details.reason === 'install') {
      // First time installation
      await this.handleFirstTimeInstall();
    } else if (details.reason === 'update') {
      // Extension update
      await this.handleExtensionUpdate(details);
    }
  }

  handleConnect(port) {
    console.log('🔌 New connection:', port.name);

    port.onMessage.addListener((msg) => {
      this.handleMessage(msg, port.sender, (response) => {
        port.postMessage(response);
      });
    });

    port.onDisconnect.addListener(() => {
      console.log('🔌 Connection closed:', port.name);
    });
  }

  // Helper methods
  async performInitialSync() {
    try {
      console.log('🔄 Performing initial tab sync...');
      await this.tabManager.ensureCurrentTabsSynced();

      console.log('✅ Initial tab sync completed');
    } catch (error) {
      console.error('Error during initial sync:', error);
    }
  }

  // Security helper method
  sanitizeErrorMessage(message) {
    // Remove sensitive information from error messages
    const sensitivePatterns = [
      /atob\(.*?\)/g,
      /btoa\(.*?\)/g,
      /[A-Za-z]:\\[^\s]*/g,  // Windows file paths
      /\/[^\s]*/g,  // Unix file paths
      /password[=:][^\s]*/gi,
      /token[=:][^\s]*/gi,
      /key[=:][^\s]*/gi
    ];

    let sanitized = message;
    sensitivePatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });

    // Limit error message length
    if (sanitized.length > 200) {
      sanitized = sanitized.substring(0, 200) + '...';
    }

    return sanitized || 'An error occurred';
  }

  normalizeRequestData(request) {
    if (!request || typeof request !== 'object') {
      return {};
    }

    if (request.data && typeof request.data === 'object') {
      return request.data;
    }

    const { action, data, ...rest } = request;
    return rest;
  }

  normalizePrivacySettingsUpdate(settings) {
    if (!settings || typeof settings !== 'object') {
      return settings;
    }

    if (settings.privacy && typeof settings.privacy === 'object') {
      return settings;
    }

    return {
      privacy: {
        encryptNotes: Boolean(settings.encryptNotes),
        excludeDomains: Array.isArray(settings.excludeDomains) ? settings.excludeDomains : [],
        autoCleanupDays: Number.parseInt(settings.autoCleanupDays, 10) || 0
      }
    };
  }

  async handleFirstTimeInstall() {
    console.log('🎉 First time installation');

    // Set default settings
    const defaultSettings = {
      privacy: {
        encryptNotes: false,
        excludeDomains: [],
        autoCleanupDays: 30
      },
      ui: {
        collapsedGroups: [],
        defaultGrouping: 'domain'
      },
      preferences: {
        showFavicons: true,
        enableNotifications: true
      }
    };

    await this.privacyManager.updateSettings(defaultSettings);

    // Show welcome page
    chrome.tabs.create({
      url: chrome.runtime.getURL('ui/welcome/welcome.html'),
      active: true
    });
  }

  async handleExtensionUpdate(details) {
    console.log('🔄 Extension updated from:', details.previousVersion);

    // Perform any necessary data migrations
    await this.performDataMigration(details.previousVersion);

    // Show what's new page
    chrome.tabs.create({
      url: chrome.runtime.getURL('ui/changelog/changelog.html'),
      active: true
    });
  }

  async performDataMigration(previousVersion) {
    // Implement data migration logic here if needed
    console.log('🔄 Data migration from version:', previousVersion);
  }

  async exportAllData() {
    try {
      const tabs = await this.storageManager.getAllTabs();
      const groups = await this.storageManager.getAllGroups();
      const settings = await this.privacyManager.getSettings();
      const metadata = await this.storageManager.getMetadata();

      return {
        tabs,
        groups,
        settings,
        metadata,
        exportedAt: new Date().toISOString(),
        version: chrome.runtime.getManifest().version
      };
    } catch (error) {
      console.error('Export error:', error);
      throw error;
    }
  }

  async importAllData(data) {
    try {
      // Validate import data
      if (!data.tabs || !data.groups || !data.settings) {
        throw new Error('Invalid import data format');
      }

      // Clear existing data
      await this.storageManager.clearAllData();

      // Import new data
      await this.storageManager.importData(data);

      // Update privacy settings
      await this.privacyManager.updateSettings(data.settings);

      console.log('✅ Data imported successfully');
      return true;
    } catch (error) {
      console.error('Import error:', error);
      throw error;
    }
  }

  async clearAllData() {
    try {
      await this.storageManager.clearAllData();
      console.log('🗑️ All data cleared');
      return true;
    } catch (error) {
      console.error('Clear data error:', error);
      return false;
    }
  }
}

// Global service worker instance
const serviceWorker = new TabFlowServiceWorker();

// Auto-initialize when script loads
serviceWorker.initialize().catch(error => {
  console.error('Failed to initialize service worker:', error);
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TabFlowServiceWorker;
}
