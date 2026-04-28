// SuperTab Service Worker - Main background script
importScripts('./event-bus.js');
importScripts('../utils/privacy-manager.js');
importScripts('./storage-manager.js');
importScripts('../utils/grouping-engine.js');
importScripts('./tab-manager.js');
importScripts('../utils/rule-engine.js');
importScripts('../utils/rule-manager.js');
importScripts('./auto-grouper.js');

// New modules for enhanced functionality
importScripts('../utils/ml-classifier.js');
importScripts('../utils/user-behavior-tracker.js');
importScripts('../utils/smart-grouping-engine.js');
importScripts('../utils/content-type-classifier.js');
importScripts('../utils/scene-classifier.js');
importScripts('../utils/scene-grouper.js');
importScripts('../utils/group-cache-manager.js');
importScripts('../utils/sync-manager.js');
importScripts('../utils/multi-window-sync.js');

class SuperTabServiceWorker {
  constructor() {
    this.eventBus = new EventBus();
    this.privacyManager = new PrivacyManager();
    this.storageManager = new StorageManager(this.privacyManager);
    this.tabManager = null;
    this.ruleEngine = null;
    this.ruleManager = null;
    this.autoGrouper = null;
    
    // New module instances
    this.mlClassifier = null;
    this.userBehaviorTracker = null;
    this.smartGroupingEngine = null;
    this.contentTypeClassifier = null;
    this.sceneClassifier = null;
    this.sceneGrouper = null;
    this.groupCacheManager = null;
    this.syncManager = null;
    this.multiWindowSync = null;
    
    this.initialized = false;
    this.initializationPromise = null;
    this.tabWatcher = null;
    this.eventListenersSetup = false;
    this.messageHandlersSetup = false;
    this.sidePanelAutoOpenEnabled = false;
    this.sidebarRefreshTimer = null;
    this.pendingRefreshReason = null;

    // Register Chrome event handlers synchronously so MV3 wake-up events are not missed.
    this.setupEventListeners();
    this.setupMessageHandlers();
  }

  async initialize() {
    if (this.initialized) return;
    if (this.initializationPromise) return this.initializationPromise;

    console.log('🔧 SuperTab Service Worker initializing...');

    this.initializationPromise = (async () => {
      try {
        // Initialize privacy manager first
        await this.privacyManager.initialize();

        // Initialize storage manager
        await this.storageManager.initialize();

        // Initialize tab manager
        this.tabManager = new TabManager(this.eventBus, this.storageManager, this.privacyManager);
        await this.tabManager.initialize();

        // Reuse rule/auto-group instances created by TabManager to avoid duplicate listeners.
        this.ruleEngine = this.tabManager.ruleEngine || new RuleEngine();
        this.ruleManager = this.tabManager.ruleManager || new RuleManager(this.storageManager);
        this.autoGrouper = this.tabManager.autoGrouper || new AutoGrouper(this.tabManager, this.ruleEngine, this.ruleManager);

        // Initialize new ML and smart grouping modules
        console.log('🧠 Initializing ML and smart grouping modules...');
        
        this.mlClassifier = new MLClassifier({
          algorithm: 'naive-bayes',
          learningRate: 0.1,
          enableOnlineLearning: true
        });
        await this.mlClassifier.initialize();

        this.userBehaviorTracker = new UserBehaviorTracker(this.storageManager, this.eventBus);
        await this.userBehaviorTracker.initialize();

        this.smartGroupingEngine = new SmartGroupingEngine(
          this.storageManager,
          this.eventBus,
          {
            mlClassifier: this.mlClassifier,
            behaviorTracker: this.userBehaviorTracker,
            useMLForDomain: true,
            useMLForContent: true,
            useBehaviorData: true
          }
        );
        await this.smartGroupingEngine.initialize();

        // Initialize scene-based grouping modules
        console.log('🎬 Initializing scene-based grouping modules...');
        
        this.contentTypeClassifier = new ContentTypeClassifier();
        await this.contentTypeClassifier.initialize();

        this.sceneClassifier = new SceneClassifier();
        await this.sceneClassifier.initialize();

        this.sceneGrouper = new SceneGrouper(
          this.storageManager,
          this.eventBus,
          {
            contentTypeClassifier: this.contentTypeClassifier,
            sceneClassifier: this.sceneClassifier,
            enableKeywordRules: true,
            enableContentTypes: true,
            enableScenes: true,
            defaultGroupingPriority: ['keyword', 'custom', 'content', 'scene']
          }
        );
        await this.sceneGrouper.initialize();

        // Initialize cache and sync modules
        console.log('💾 Initializing cache and sync modules...');
        
        this.groupCacheManager = new GroupCacheManager(this.storageManager, this.eventBus);
        await this.groupCacheManager.initialize();

        this.syncManager = new SyncManager(this.storageManager, this.eventBus);
        await this.syncManager.initialize();

        this.multiWindowSync = new MultiWindowSync(this.storageManager, this.eventBus);
        await this.multiWindowSync.initialize();

        // Setup event connections between modules
        this.setupModuleInterconnections();

        this.setupDataSyncEvents();

        this.initialized = true;
        console.log('✅ SuperTab Service Worker initialized successfully with all new modules');

        // Perform initial tab sync
        await this.performInitialSync();

        // Train ML model from existing data
        await this.trainFromExistingData();
      } catch (error) {
        console.error('❌ Failed to initialize SuperTab Service Worker:', error);
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

      if (typeof chrome.sidePanel.setPanelBehavior === 'function') {
        const panelBehaviorResult = chrome.sidePanel.setPanelBehavior({
          openPanelOnActionClick: true
        });

        if (panelBehaviorResult && typeof panelBehaviorResult.then === 'function') {
          panelBehaviorResult
            .then(() => {
              this.sidePanelAutoOpenEnabled = true;
            })
            .catch((error) => {
              console.warn('Failed to enable side panel auto-open behavior:', error);
            });
        } else {
          this.sidePanelAutoOpenEnabled = true;
        }
      }
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
          const createGroupName = typeof data?.name === 'string'
            ? data.name.trim()
            : (typeof request?.name === 'string' ? request.name.trim() : '');
          if (!createGroupName) {
            sendResponse({ success: false, error: 'Group name is required' });
            break;
          }
          const createGroupTabUuids = Array.from(new Set(
            (Array.isArray(data?.tabUuids) ? data.tabUuids : [])
              .filter(tabUuid => typeof tabUuid === 'string' && tabUuid.length > 0)
          ));
          const group = await this.tabManager.createCustomGroup(createGroupName, '', createGroupTabUuids);
          if (!group) {
            sendResponse({ success: false, error: 'Failed to create group' });
            break;
          }
          sendResponse({ success: true, data: group });
          this.scheduleSidebarRefresh('group_created');
          break;

        case 'updateTabNote':
          if (!data?.tabUuid || typeof data.note !== 'string') {
            sendResponse({ success: false, error: 'tabUuid is required and note must be a string' });
            break;
          }
          const success = await this.tabManager.updateTabNote(data.tabUuid, data.note);
          sendResponse({ success });
          if (success) {
            this.scheduleSidebarRefresh('tab_note_updated');
          }
          break;

        case 'updateTabAlias':
          if (!data?.tabUuid || typeof data.alias !== 'string') {
            sendResponse({ success: false, error: 'tabUuid and alias are required' });
            break;
          }
          const aliasSuccess = await this.tabManager.updateTabAlias(data.tabUuid, data.alias);
          sendResponse({ success: aliasSuccess });
          if (aliasSuccess) {
            this.scheduleSidebarRefresh('tab_alias_updated');
          }
          break;

        case 'moveTabToGroup':
          if (!data?.tabUuid || !data?.groupId) {
            sendResponse({ success: false, error: 'tabUuid and groupId are required' });
            break;
          }
          const moveSuccess = await this.tabManager.moveTabToGroup(data.tabUuid, data.groupId);
          sendResponse({ success: moveSuccess });
          if (moveSuccess) {
            this.scheduleSidebarRefresh('tab_moved_to_group');
          }
          break;

        case 'closeTab':
          const closeTabId = Number.parseInt(data?.tabId ?? request?.tabId, 10);
          if (!Number.isInteger(closeTabId)) {
            sendResponse({ success: false, error: 'tabId is required' });
            break;
          }
          const closeSuccess = await this.tabManager.closeTab(closeTabId);
          sendResponse({ success: closeSuccess });
          if (closeSuccess) {
            this.scheduleSidebarRefresh('tab_closed');
          }
          break;

        case 'deleteGroup':
          if (!data?.groupId) {
            sendResponse({ success: false, error: 'groupId is required' });
            break;
          }
          const normalizedDeleteTabIds = Array.from(new Set(
            (Array.isArray(data.tabIds) ? data.tabIds : [])
              .map(tabId => Number.parseInt(tabId, 10))
              .filter(Number.isInteger)
          ));
          const deleteGroupSuccess = await this.tabManager.deleteGroup(data.groupId, normalizedDeleteTabIds);
          sendResponse({ success: deleteGroupSuccess });
          if (deleteGroupSuccess) {
            this.scheduleSidebarRefresh('group_deleted');
          }
          break;

        case 'updateGroup':
          if (!data?.group || typeof data.group !== 'object') {
            sendResponse({ success: false, error: 'group is required' });
            break;
          }
          if (typeof this.tabManager.updateGroup !== 'function') {
            sendResponse({ success: false, error: 'updateGroup is not supported' });
            break;
          }
          const updateGroupSuccess = await this.tabManager.updateGroup(data.group);
          sendResponse({ success: updateGroupSuccess });
          break;

        case 'bookmarkTabs':
          if (!Array.isArray(data?.tabUuids) || data.tabUuids.length === 0) {
            sendResponse({ success: false, error: 'tabUuids are required' });
            break;
          }
          const bookmarkOptions = {};
          if (typeof data?.folderId === 'string' && data.folderId.trim()) {
            bookmarkOptions.folderId = data.folderId.trim();
          }
          if (typeof data?.createFolderName === 'string' && data.createFolderName.trim()) {
            bookmarkOptions.createFolderName = data.createFolderName.trim();
          }
          const bookmarkResult = Object.keys(bookmarkOptions).length > 0
            ? await this.tabManager.bookmarkTabs(data.tabUuids, bookmarkOptions)
            : await this.tabManager.bookmarkTabs(data.tabUuids);
          sendResponse(bookmarkResult);
          if (bookmarkResult?.success) {
            this.scheduleSidebarRefresh('tabs_bookmarked');
          }
          break;

        case 'listBookmarkFolders':
          const bookmarkFolders = await this.tabManager.listBookmarkFolders();
          sendResponse({ success: true, data: bookmarkFolders });
          break;

        case 'applyRulesToExistingTabs':
          if (typeof this.tabManager.applyRulesToExistingTabs !== 'function') {
            sendResponse({ success: false, error: 'applyRulesToExistingTabs is not supported' });
            break;
          }
          const applyRulesResult = await this.tabManager.applyRulesToExistingTabs();
          sendResponse({ success: true, data: applyRulesResult });
          this.scheduleSidebarRefresh('rules_applied_to_existing_tabs');
          break;

        case 'activateTab':
          const activateTabId = Number.parseInt(data?.tabId ?? request?.tabId, 10);
          if (!Number.isInteger(activateTabId)) {
            sendResponse({ success: false, error: 'tabId is required' });
            break;
          }
          const activateSuccess = await this.tabManager.activateTab(activateTabId);
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
          if (importSuccess) {
            this.scheduleSidebarRefresh('data_imported');
          }
          break;

        case 'clearAllData':
          const clearSuccess = await this.clearAllData();
          sendResponse({ success: clearSuccess });
          if (clearSuccess) {
            this.scheduleSidebarRefresh('data_cleared');
          }
          break;

        case 'getPerformanceMetrics':
          const metrics = this.tabManager.getPerformanceMetrics();
          sendResponse({ success: true, data: metrics });
          break;

        // ========== New smart grouping actions ==========

        case 'getSmartGrouping':
          try {
            const smartTabs = data.tabs || [];
            const smartOptions = data.options || {};
            const smartGroups = await this.getSmartGrouping(smartTabs, smartOptions);
            sendResponse({ success: true, data: smartGroups });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'getSceneGrouping':
          try {
            const sceneTabs = data.tabs || [];
            const sceneOptions = data.options || {};
            const sceneGroups = await this.getSceneGrouping(sceneTabs, sceneOptions);
            sendResponse({ success: true, data: sceneGroups });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        // ========== ML classifier actions ==========

        case 'predictGroupForTab':
          try {
            if (!data?.tab) {
              sendResponse({ success: false, error: 'tab is required' });
              break;
            }
            const prediction = await this.predictGroupForTab(data.tab);
            sendResponse({ success: true, data: prediction });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'learnFromUserAction':
          try {
            if (!data?.tabs || !Array.isArray(data.tabs) || !data?.groupName) {
              sendResponse({ success: false, error: 'tabs array and groupName are required' });
              break;
            }
            const learnResult = await this.learnFromUserAction(data.tabs, data.groupName, data.isManual !== false);
            sendResponse(learnResult);
            if (learnResult.success) {
              this.scheduleSidebarRefresh('model_trained');
            }
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'getMLStats':
          try {
            const mlStats = await this.getMLStats();
            sendResponse({ success: true, data: mlStats });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'setMLAlgorithm':
          try {
            if (!data?.algorithm) {
              sendResponse({ success: false, error: 'algorithm is required' });
              break;
            }
            const algoResult = await this.setMLAlgorithm(data.algorithm);
            sendResponse(algoResult);
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'resetMLModel':
          try {
            const resetResult = await this.resetMLModel();
            sendResponse(resetResult);
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        // ========== Sync actions ==========

        case 'forceSync':
          try {
            const syncResult = await this.forceSync();
            sendResponse({ success: true, data: syncResult });
            this.scheduleSidebarRefresh('sync_completed');
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'exportGroupingRules':
          try {
            const exportOptions = data?.options || {};
            const exportData = await this.exportGroupingRules(exportOptions);
            sendResponse({ success: true, data: exportData });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'importGroupingRules':
          try {
            if (!data?.data) {
              sendResponse({ success: false, error: 'import data is required' });
              break;
            }
            const importOptions = data?.options || {};
            const importResult = await this.importGroupingRules(data.data, importOptions);
            sendResponse(importResult);
            if (importResult.success) {
              this.scheduleSidebarRefresh('rules_imported');
            }
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        // ========== Cache actions ==========

        case 'invalidateCache':
          try {
            const invalidateResult = await this.invalidateCache();
            sendResponse(invalidateResult);
            this.scheduleSidebarRefresh('cache_invalidated');
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'getCacheStats':
          try {
            const cacheStats = await this.getCacheStats();
            sendResponse({ success: true, data: cacheStats });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        // ========== Scene classifier actions ==========

        case 'getContentTypes':
          try {
            const contentTypes = await this.getContentTypes();
            sendResponse({ success: true, data: contentTypes });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'getScenes':
          try {
            const scenes = await this.getScenes();
            sendResponse({ success: true, data: scenes });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'setScenePriority':
          try {
            if (!data?.sceneName || data?.priority == null) {
              sendResponse({ success: false, error: 'sceneName and priority are required' });
              break;
            }
            const scenePriorityResult = await this.setScenePriority(data.sceneName, data.priority);
            sendResponse(scenePriorityResult);
            this.scheduleSidebarRefresh('scene_priority_updated');
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'setGroupingMode':
          try {
            if (!data?.mode || data?.enabled == null) {
              sendResponse({ success: false, error: 'mode and enabled are required' });
              break;
            }
            const modeResult = await this.setGroupingMode(data.mode, data.enabled);
            sendResponse(modeResult);
            this.scheduleSidebarRefresh('grouping_mode_updated');
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'setGroupingPriority':
          try {
            if (!data?.mode || data?.priority == null) {
              sendResponse({ success: false, error: 'mode and priority are required' });
              break;
            }
            const priorityResult = await this.setGroupingPriority(data.mode, data.priority);
            sendResponse(priorityResult);
            this.scheduleSidebarRefresh('grouping_priority_updated');
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'addKeywordRule':
          try {
            if (!data?.rule) {
              sendResponse({ success: false, error: 'rule is required' });
              break;
            }
            const keywordResult = await this.addKeywordRule(data.rule);
            sendResponse(keywordResult);
            this.scheduleSidebarRefresh('keyword_rule_added');
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;

        // ========== Multi-window actions ==========

        case 'getMultiWindowStats':
          try {
            const multiWindowStats = await this.getMultiWindowStats();
            sendResponse({ success: true, data: multiWindowStats });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
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
      this.scheduleSidebarRefresh('tab_created');
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
        this.scheduleSidebarRefresh('tab_updated');
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
      this.scheduleSidebarRefresh('tab_removed');
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
      this.scheduleSidebarRefresh('tab_moved');
    } catch (error) {
      console.error('Error handling tab move:', error);
    }
  }

  async handleTabDetached(tabId, detachInfo) {
    try {
      await this.initialize();
      console.log('🔓 Tab detached:', tabId);
      await this.tabManager.handleTabDetached(tabId, detachInfo);
      this.scheduleSidebarRefresh('tab_detached');
    } catch (error) {
      console.error('Error handling tab detach:', error);
    }
  }

  async handleTabAttached(tabId, attachInfo) {
    try {
      await this.initialize();
      console.log('🔗 Tab attached:', tabId);
      await this.tabManager.handleTabAttached(tabId, attachInfo);
      this.scheduleSidebarRefresh('tab_attached');
    } catch (error) {
      console.error('Error handling tab attach:', error);
    }
  }

  async handleWindowFocusChanged(windowId) {
    try {
      await this.initialize();
      console.log('🪟 Window focus changed:', windowId);
      await this.tabManager.handleWindowFocusChanged(windowId);
      this.scheduleSidebarRefresh('window_focus_changed');
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

      if (this.sidePanelAutoOpenEnabled) {
        return;
      }

      const tabId = Number.isInteger(tab?.id) ? tab.id : null;
      if (!tabId) {
        console.warn('Cannot open side panel: missing active tab id');
        return;
      }

      // Do not await any async call before sidePanel.open to preserve user gesture context.
      await chrome.sidePanel.open({ tabId });
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
    console.log('📦 SuperTab installed/updated:', details.reason);

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

      // Apply smart grouping rules to already-open tabs so rules take effect immediately.
      if (typeof this.tabManager.applyRulesToExistingTabs === 'function') {
        const applyResult = await this.tabManager.applyRulesToExistingTabs();
        if (applyResult?.success && applyResult.assignedCount > 0) {
          console.log(`🤖 Smart grouping applied to ${applyResult.assignedCount} existing tabs`);
        }
      }

      this.scheduleSidebarRefresh('initial_sync');

      console.log('✅ Initial tab sync completed');
    } catch (error) {
      console.error('Error during initial sync:', error);
    }
  }

  setupDataSyncEvents() {
    if (!this.eventBus || typeof this.eventBus.on !== 'function') {
      return;
    }

    if (this._dataSyncEventsBound) {
      return;
    }

    this._dataSyncEventsBound = true;
    this.eventBus.on('group_deleted', () => this.scheduleSidebarRefresh('group_deleted'));
    this.eventBus.on('tab_note_updated', () => this.scheduleSidebarRefresh('tab_note_updated'));
    this.eventBus.on('tab_alias_updated', () => this.scheduleSidebarRefresh('tab_alias_updated'));
    this.eventBus.on('tabs_bookmarked', () => this.scheduleSidebarRefresh('tabs_bookmarked'));
  }

  scheduleSidebarRefresh(reason = 'data_changed') {
    this.pendingRefreshReason = reason;
    if (this.sidebarRefreshTimer) {
      return;
    }

    this.sidebarRefreshTimer = setTimeout(() => {
      this.sidebarRefreshTimer = null;
      const refreshReason = this.pendingRefreshReason || 'data_changed';
      this.pendingRefreshReason = null;
      this.broadcastSidebarRefresh(refreshReason);
    }, 120);
  }

  broadcastSidebarRefresh(reason = 'data_changed') {
    try {
      if (!chrome?.runtime?.sendMessage) {
        return;
      }

      chrome.runtime.sendMessage({
        action: 'refresh',
        data: {
          reason,
          at: Date.now()
        }
      }, () => {
        const message = chrome.runtime?.lastError?.message || '';
        if (message && !message.includes('Receiving end does not exist')) {
          console.warn('Sidebar refresh broadcast warning:', message);
        }
      });
    } catch (error) {
      console.warn('Failed to broadcast sidebar refresh:', error);
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
        enableNotifications: true,
        groupDisplayMode: 'sidebar'
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

  // ========== New module helper methods ==========

  setupModuleInterconnections() {
    if (!this.eventBus) return;

    // Connect ML classifier with behavior tracker
    if (this.userBehaviorTracker && this.mlClassifier) {
      this.userBehaviorTracker.on('training_data_ready', (data) => {
        if (data && data.length > 0) {
          this.mlClassifier.train(data);
        }
      });
    }

    // Connect multi-window sync with cache manager
    if (this.multiWindowSync && this.groupCacheManager) {
      this.multiWindowSync.on('remote_tab_moved', (payload) => {
        this.groupCacheManager.handleTabMoved(
          { id: payload.tab?.id, ...payload.tab },
          payload.groupId
        );
      });

      this.multiWindowSync.on('remote_group_created', (payload) => {
        this.groupCacheManager.handleGroupCreated(payload.group);
      });

      this.multiWindowSync.on('remote_group_updated', (payload) => {
        this.groupCacheManager.handleGroupUpdated(payload.group);
      });

      this.multiWindowSync.on('remote_group_deleted', (payload) => {
        this.groupCacheManager.handleGroupDeleted(payload.groupId);
      });
    }

    // Connect event bus with multi-window sync
    this.eventBus.on('tab_created', (tabData) => {
      if (this.multiWindowSync) {
        this.multiWindowSync.notifyTabCreated(tabData);
      }
    });

    this.eventBus.on('tab_removed', ({ tabId, tabData }) => {
      if (this.multiWindowSync) {
        this.multiWindowSync.notifyTabRemoved(tabId, tabData);
      }
    });

    this.eventBus.on('tab_updated', (tabData) => {
      if (this.multiWindowSync) {
        this.multiWindowSync.notifyTabUpdated(tabData);
      }
    });

    this.eventBus.on('tab_moved_to_group', ({ tab, groupId, oldGroupId }) => {
      if (this.multiWindowSync) {
        this.multiWindowSync.notifyTabMovedToGroup(tab, groupId, oldGroupId);
      }
    });

    this.eventBus.on('group_created', (group) => {
      if (this.multiWindowSync) {
        this.multiWindowSync.notifyGroupCreated(group);
      }
    });

    this.eventBus.on('group_updated', ({ group }) => {
      if (this.multiWindowSync) {
        this.multiWindowSync.notifyGroupUpdated(group);
      }
    });

    this.eventBus.on('group_deleted', ({ groupId, tabIds }) => {
      if (this.multiWindowSync) {
        this.multiWindowSync.notifyGroupDeleted(groupId, tabIds);
      }
    });

    console.log('🔗 Module interconnections setup complete');
  }

  async trainFromExistingData() {
    try {
      if (!this.userBehaviorTracker || !this.mlClassifier) {
        console.log('⚠️ ML training modules not available, skipping training');
        return;
      }

      console.log('🧠 Training ML model from existing data...');

      const trainingData = await this.userBehaviorTracker.generateTrainingData();

      if (trainingData && trainingData.length > 0) {
        await this.mlClassifier.train(trainingData);
        console.log(`✅ ML model trained with ${trainingData.length} samples`);

        await this.mlClassifier.save();
        console.log('💾 ML model saved to storage');
      } else {
        console.log('ℹ️ No training data available, using default model');
      }
    } catch (error) {
      console.warn('⚠️ Failed to train ML model:', error);
    }
  }

  // ========== Smart grouping methods ==========

  async getSmartGrouping(tabs, options = {}) {
    if (!this.smartGroupingEngine) {
      throw new Error('Smart grouping engine not initialized');
    }

    const groupType = options.groupType || 'smart';
    let groups;

    switch (groupType) {
      case 'domain':
        groups = await this.smartGroupingEngine.groupByDomain(tabs, options);
        break;
      case 'date':
        groups = await this.smartGroupingEngine.groupByDate(tabs, options);
        break;
      case 'content':
        groups = await this.smartGroupingEngine.groupByContent(tabs, options);
        break;
      case 'smart':
      default:
        groups = await this.smartGroupingEngine.groupBySmartRules(tabs, [], options);
        break;
    }

    return groups;
  }

  async getSceneGrouping(tabs, options = {}) {
    if (!this.sceneGrouper) {
      throw new Error('Scene grouper not initialized');
    }

    return await this.sceneGrouper.groupTabs(tabs, options);
  }

  // ========== ML prediction methods ==========

  async predictGroupForTab(tab) {
    if (!this.mlClassifier) {
      throw new Error('ML classifier not initialized');
    }

    const prediction = this.mlClassifier.predict(tab);
    return {
      groupName: prediction.label,
      confidence: prediction.confidence,
      probabilities: prediction.probabilities
    };
  }

  async learnFromUserAction(tabs, groupName, isManual = true) {
    if (!this.userBehaviorTracker || !this.mlClassifier) {
      return { success: false, error: 'Learning modules not available' };
    }

    // Track the user action
    await this.userBehaviorTracker.learnManualPreference(tabs, groupName);

    // Update ML model if this is a manual action
    if (isManual && tabs.length > 0) {
      for (const tab of tabs) {
        await this.mlClassifier.learn(tab, groupName);
      }
      await this.mlClassifier.save();
    }

    return { success: true, learned: tabs.length };
  }

  // ========== Sync methods ==========

  async forceSync() {
    if (!this.syncManager) {
      throw new Error('Sync manager not initialized');
    }

    return await this.syncManager.performSync(true);
  }

  async exportGroupingRules(options = {}) {
    if (!this.syncManager) {
      throw new Error('Sync manager not initialized');
    }

    return await this.syncManager.exportData(options);
  }

  async importGroupingRules(data, options = {}) {
    if (!this.syncManager) {
      throw new Error('Sync manager not initialized');
    }

    return await this.syncManager.importData(data, options);
  }

  // ========== Cache methods ==========

  async invalidateCache() {
    if (!this.groupCacheManager) {
      throw new Error('Cache manager not initialized');
    }

    this.groupCacheManager.invalidateCache('manual');
    return { success: true };
  }

  async getCacheStats() {
    if (!this.groupCacheManager) {
      throw new Error('Cache manager not initialized');
    }

    return this.groupCacheManager.getStats();
  }

  // ========== Scene classifier methods ==========

  async getContentTypes() {
    if (!this.contentTypeClassifier) {
      throw new Error('Content type classifier not initialized');
    }

    return this.contentTypeClassifier.getCategories();
  }

  async getScenes() {
    if (!this.sceneClassifier) {
      throw new Error('Scene classifier not initialized');
    }

    return this.sceneClassifier.getScenes();
  }

  async setScenePriority(sceneName, priority) {
    if (!this.sceneClassifier) {
      throw new Error('Scene classifier not initialized');
    }

    this.sceneClassifier.setScenePriority(sceneName, priority);
    return { success: true };
  }

  async setGroupingMode(mode, enabled) {
    if (!this.sceneGrouper) {
      throw new Error('Scene grouper not initialized');
    }

    this.sceneGrouper.setGroupingMode(mode, enabled);
    return { success: true };
  }

  async setGroupingPriority(mode, priority) {
    if (!this.sceneGrouper) {
      throw new Error('Scene grouper not initialized');
    }

    this.sceneGrouper.setGroupingPriority(mode, priority);
    return { success: true };
  }

  async addKeywordRule(rule) {
    if (!this.sceneGrouper) {
      throw new Error('Scene grouper not initialized');
    }

    this.sceneGrouper.addKeywordRule(rule);
    return { success: true };
  }

  // ========== Multi-window methods ==========

  async getMultiWindowStats() {
    if (!this.multiWindowSync) {
      throw new Error('Multi-window sync not initialized');
    }

    return this.multiWindowSync.getStats();
  }

  // ========== ML classifier methods ==========

  async setMLAlgorithm(algorithm) {
    if (!this.mlClassifier) {
      throw new Error('ML classifier not initialized');
    }

    const validAlgorithms = ['naive-bayes', 'logistic-regression', 'decision-tree'];
    if (!validAlgorithms.includes(algorithm)) {
      throw new Error(`Invalid algorithm. Must be one of: ${validAlgorithms.join(', ')}`);
    }

    this.mlClassifier.algorithm = algorithm;
    return { success: true, algorithm };
  }

  async resetMLModel() {
    if (!this.mlClassifier) {
      throw new Error('ML classifier not initialized');
    }

    this.mlClassifier.reset();
    return { success: true };
  }

  async getMLStats() {
    if (!this.mlClassifier) {
      throw new Error('ML classifier not initialized');
    }

    return {
      algorithm: this.mlClassifier.algorithm,
      trainingCount: this.mlClassifier.trainingData?.length || 0,
      isTrained: this.mlClassifier.isTrained,
      hasModel: this.mlClassifier.hasModel
    };
  }
}

// Global service worker instance
const serviceWorker = new SuperTabServiceWorker();

// Auto-initialize when script loads
serviceWorker.initialize().catch(error => {
  console.error('Failed to initialize service worker:', error);
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SuperTabServiceWorker;
}
