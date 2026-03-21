// Tab Manager - Core tab management logic

class TabManager {
  constructor(eventBus, storageManager, privacyManager) {
    this.eventBus = eventBus;
    this.storageManager = storageManager;
    this.privacyManager = privacyManager;
    this.groupingEngine = new GroupingEngine();
    this.activeTabs = new Map();
    this.tabMetrics = {
      totalTabs: 0,
      lastSync: Date.now(),
      operationsCount: 0
    };
  }

  async initialize() {
    console.log('🔧 TabManager initializing...');

    // Setup event listeners
    this.setupEventListeners();

    // Load existing tabs from storage
    await this.loadExistingTabs();

    console.log('✅ TabManager initialized');
  }

  setupEventListeners() {
    // Listen for storage changes
    this.eventBus.on('storage_changed', this.handleStorageChange.bind(this));

    // Listen for tab events
    this.eventBus.on('tab_created', this.handleTabCreatedEvent.bind(this));
    this.eventBus.on('tab_removed', this.handleTabRemovedEvent.bind(this));
    this.eventBus.on('tab_updated', this.handleTabUpdatedEvent.bind(this));
  }

  async loadExistingTabs() {
    try {
      const tabs = await this.storageManager.getAllTabs();
      const tabArray = Object.values(tabs);

      this.tabMetrics.totalTabs = tabArray.length;
      this.tabMetrics.lastSync = Date.now();

      // Update active tabs cache
      for (const tab of tabArray) {
        this.activeTabs.set(tab.id, tab);
      }

      console.log(`📊 Loaded ${tabArray.length} existing tabs`);
    } catch (error) {
      console.error('Failed to load existing tabs:', error);
    }
  }

  // Tab event handlers
  async handleTabCreated(tab) {
    try {
      this.tabMetrics.operationsCount++;

      const existingTab = this.activeTabs.get(tab.id);
      if (existingTab) {
        return await this.handleTabUpdated(tab);
      }

      // Check if tab should be excluded based on privacy settings
      if (this.privacyManager.shouldExcludeUrl(tab.url)) {
        console.log('🚫 Tab excluded due to privacy settings:', tab.url);
        return;
      }

      // Generate unique UUID for the tab
      const tabUuid = this.groupingEngine.generateTabUuid(tab);

      // Create tab data object
      const tabData = {
        id: tab.id,
        uuid: tabUuid,
        title: tab.title || 'New Tab',
        alias: '',
        url: tab.url,
        favicon: tab.favIconUrl,
        groupId: 'ungrouped', // Default group
        windowId: tab.windowId,
        index: tab.index,
        pinned: tab.pinned || false,
        openedAt: Date.now(),
        lastAccessed: Date.now(),
        visitCount: 1
      };

      // Process tab data through privacy manager
      const processedTabData = await this.privacyManager.processTabData(tabData);
      if (!processedTabData) {
        console.log('🚫 Tab excluded by privacy manager');
        return;
      }

      // Save to storage
      const saved = await this.storageManager.saveTab(processedTabData);
      if (saved) {
        // Update cache
        this.activeTabs.set(tab.id, processedTabData);
        this.tabMetrics.totalTabs++;

        // Emit event
        this.eventBus.emit('tab_created', processedTabData);

        console.log('✅ Tab created and saved:', tabData.title);
        return processedTabData;
      }

      return null;
    } catch (error) {
      console.error('Error creating tab:', error);
      return null;
    }
  }

  async handleTabUpdated(tab) {
    try {
      this.tabMetrics.operationsCount++;

      // Find existing tab
      const existingTab = this.activeTabs.get(tab.id);
      if (!existingTab) {
        // Tab not in our system, treat as new
        return await this.handleTabCreated(tab);
      }

      // Check if URL changed and should be excluded
      if (this.privacyManager.shouldExcludeUrl(tab.url)) {
        // Remove from our system if it was previously tracked
        if (existingTab) {
          await this.handleTabRemoved(tab.id, {});
        }
        return;
      }

      // Update tab data
      const updatedTabData = {
        ...existingTab,
        title: tab.title || existingTab.title,
        url: tab.url || existingTab.url,
        favicon: tab.favIconUrl || existingTab.favicon,
        lastAccessed: Date.now(),
        visitCount: (existingTab.visitCount || 1) + 1
      };

      // Process through privacy manager
      const processedTabData = await this.privacyManager.processTabData(updatedTabData);

      // Save to storage
      const saved = await this.storageManager.saveTab(processedTabData);
      if (saved) {
        // Update cache
        this.activeTabs.set(tab.id, processedTabData);

        // Emit event
        this.eventBus.emit('tab_updated', processedTabData);

        console.log('✅ Tab updated:', updatedTabData.title);
        return processedTabData;
      }

      return null;
    } catch (error) {
      console.error('Error updating tab:', error);
      return null;
    }
  }

  async handleTabRemoved(tabId, removeInfo) {
    try {
      this.tabMetrics.operationsCount++;

      // Find tab in cache
      const tabData = this.activeTabs.get(tabId);
      if (!tabData) {
        console.log('Tab not found in cache:', tabId);
        return;
      }

      // Remove from storage
      const removed = await this.storageManager.removeTab(tabData.uuid);
      if (removed) {
        // Remove from cache
        this.activeTabs.delete(tabId);
        this.tabMetrics.totalTabs--;

        // Emit event
        this.eventBus.emit('tab_removed', {
          tabId,
          tabData,
          removeInfo
        });

        console.log('✅ Tab removed:', tabData.title);
      }
    } catch (error) {
      console.error('Error removing tab:', error);
    }
  }

  async handleTabActivated(activeInfo) {
    try {
      const tabData = this.activeTabs.get(activeInfo.tabId);
      if (tabData) {
        // Update last accessed time
        tabData.lastAccessed = Date.now();
        await this.storageManager.saveTab(tabData);

        this.eventBus.emit('tab_activated', tabData);
        console.log('🎯 Tab activated:', tabData.title);
      }
    } catch (error) {
      console.error('Error handling tab activation:', error);
    }
  }

  async handleTabMoved(tabId, moveInfo) {
    try {
      const tabData = this.activeTabs.get(tabId);
      if (tabData) {
        tabData.index = moveInfo.toIndex;
        tabData.windowId = moveInfo.windowId;
        await this.storageManager.saveTab(tabData);

        this.eventBus.emit('tab_moved', { tabData, moveInfo });
      }
    } catch (error) {
      console.error('Error handling tab move:', error);
    }
  }

  async handleTabDetached(tabId, detachInfo) {
    try {
      const tabData = this.activeTabs.get(tabId);
      if (tabData) {
        tabData.windowId = null;
        await this.storageManager.saveTab(tabData);

        this.eventBus.emit('tab_detached', { tabData, detachInfo });
      }
    } catch (error) {
      console.error('Error handling tab detach:', error);
    }
  }

  async handleTabAttached(tabId, attachInfo) {
    try {
      const tabData = this.activeTabs.get(tabId);
      if (tabData) {
        tabData.windowId = attachInfo.newWindowId;
        tabData.index = attachInfo.newPosition;
        await this.storageManager.saveTab(tabData);

        this.eventBus.emit('tab_attached', { tabData, attachInfo });
      }
    } catch (error) {
      console.error('Error handling tab attach:', error);
    }
  }

  async handleWindowFocusChanged(windowId) {
    try {
      this.eventBus.emit('window_focus_changed', { windowId });
    } catch (error) {
      console.error('Error handling window focus change:', error);
    }
  }

  // Grouping methods
  async getTabsGrouped(groupType = 'domain') {
    try {
      const allTabs = await this.getAllTabs();

      switch (groupType) {
        case 'domain':
          return {
            groups: this.groupingEngine.groupByDomain(allTabs),
            tabs: allTabs
          };

        case 'date':
          return {
            groups: this.groupingEngine.groupByDate(allTabs),
            tabs: allTabs
          };

        case 'custom':
          return {
            groups: await this.getCustomGroups(),
            tabs: allTabs
          };

        case 'session':
          return {
            groups: this.groupingEngine.groupBySession(allTabs),
            tabs: allTabs
          };

        default:
          return {
            groups: this.groupingEngine.groupByDomain(allTabs),
            tabs: allTabs
          };
      }
    } catch (error) {
      console.error('Error getting grouped tabs:', error);
      return { groups: [], tabs: [] };
    }
  }

  async getAllTabs() {
    try {
      await this.ensureCurrentTabsSynced();

      const tabs = await this.storageManager.getAllTabs();
      const tabArray = Object.values(tabs);

      // Process tabs through privacy manager for decryption
      const processedTabs = [];
      for (const tab of tabArray) {
        if (!tab || typeof tab !== 'object') {
          continue;
        }

        let processedTab = tab;
        try {
          processedTab = await this.privacyManager.processRetrievedTabData(tab);
        } catch (processError) {
          console.warn('Failed to process retrieved tab, falling back to raw tab data:', processError);
          processedTab = tab;
        }

        processedTabs.push(processedTab);
      }

      return processedTabs;
    } catch (error) {
      console.error('Error getting all tabs:', error);
      return [];
    }
  }

  async ensureCurrentTabsSynced() {
    try {
      if (!chrome?.tabs?.query) {
        return;
      }

      const currentTabs = await chrome.tabs.query({});
      if (!Array.isArray(currentTabs)) {
        console.warn('Skip tab sync: chrome.tabs.query returned non-array payload');
        return;
      }

      const observedTabIds = new Set(
        currentTabs
          .map(tab => Number.parseInt(tab?.id, 10))
          .filter(Number.isInteger)
      );

      // Defensive guard: avoid destructive cleanup when browser returns an empty snapshot.
      if (observedTabIds.size === 0) {
        console.warn('Skip tab cleanup: no observed tabs from chrome.tabs.query');
        return;
      }

      for (const tab of currentTabs) {
        const tabId = Number.parseInt(tab?.id, 10);
        const url = typeof tab?.url === 'string' ? tab.url : '';
        if (!Number.isInteger(tabId) || !url.startsWith('http://') && !url.startsWith('https://')) {
          continue;
        }

        if (this.activeTabs.has(tabId)) {
          await this.handleTabUpdated({ ...tab, id: tabId });
        } else {
          await this.handleTabCreated({ ...tab, id: tabId });
        }
      }

      const cachedTabIds = Array.from(this.activeTabs.keys());
      for (const tabId of cachedTabIds) {
        if (!observedTabIds.has(tabId)) {
          await this.handleTabRemoved(tabId, { reason: 'sync' });
        }
      }

      this.tabMetrics.lastSync = Date.now();
    } catch (error) {
      console.error('Error syncing current tabs:', error);
    }
  }

  async getCustomGroups() {
    try {
      const groups = await this.storageManager.getAllGroups();
      const groupArray = Object.values(groups);
      const allTabs = await this.getAllTabs();

      // Attach tabs to their groups
      return groupArray.map(group => ({
        ...group,
        tabs: allTabs.filter(tab => tab.groupId === group.id)
      }));
    } catch (error) {
      console.error('Error getting custom groups:', error);
      return [];
    }
  }

  // Group management
  async createCustomGroup(name, description = '') {
    try {
      const group = {
        id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name,
        description,
        type: 'custom',
        tabs: [],
        collapsed: false,
        createdAt: Date.now(),
        color: this.generateGroupColor()
      };

      const saved = await this.storageManager.saveGroup(group);
      if (saved) {
        this.eventBus.emit('group_created', group);
        console.log('✅ Group created:', group.name);
        return group;
      }

      return null;
    } catch (error) {
      console.error('Error creating group:', error);
      return null;
    }
  }

  async updateTabNote(tabUuid, note) {
    try {
      const tab = await this.storageManager.getTab(tabUuid);
      if (!tab) {
        console.error('Tab not found for note update:', tabUuid);
        return false;
      }

      // Process note through privacy manager
      const processedNote = await this.privacyManager.processTabData({
        ...tab,
        note
      });

      tab.note = processedNote.note;
      const saved = await this.storageManager.saveTab(tab);

      if (saved) {
        // Update cache
        if (this.activeTabs.has(tab.id)) {
          this.activeTabs.get(tab.id).note = tab.note;
        }

        this.eventBus.emit('tab_note_updated', { tab, note });
        console.log('✅ Tab note updated');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error updating tab note:', error);
      return false;
    }
  }

  async updateTabAlias(tabUuid, alias) {
    try {
      const tab = await this.storageManager.getTab(tabUuid);
      if (!tab) {
        console.error('Tab not found for alias update:', tabUuid);
        return false;
      }

      const rawAlias = typeof alias === 'string' ? alias : '';
      const sanitizedAlias = this.privacyManager.sanitizeInput
        ? this.privacyManager.sanitizeInput(rawAlias)
        : rawAlias;

      tab.alias = sanitizedAlias.trim();
      const saved = await this.storageManager.saveTab(tab);

      if (saved) {
        if (this.activeTabs.has(tab.id)) {
          this.activeTabs.get(tab.id).alias = tab.alias;
        }

        this.eventBus.emit('tab_alias_updated', { tab, alias: tab.alias });
        console.log('✅ Tab alias updated');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error updating tab alias:', error);
      return false;
    }
  }

  async moveTabToGroup(tabUuid, groupId) {
    try {
      const tab = await this.storageManager.getTab(tabUuid);
      if (!tab) {
        console.error('Tab not found for move:', tabUuid);
        return false;
      }

      // Verify group exists
      const group = await this.storageManager.getGroup(groupId);
      if (!group) {
        console.error('Group not found:', groupId);
        return false;
      }

      // Update tab's group
      tab.groupId = groupId;
      const saved = await this.storageManager.saveTab(tab);

      if (saved) {
        // Update cache
        if (this.activeTabs.has(tab.id)) {
          this.activeTabs.get(tab.id).groupId = groupId;
        }

        this.eventBus.emit('tab_moved_to_group', { tab, groupId });
        console.log('✅ Tab moved to group:', tab.title, '->', group.name);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error moving tab to group:', error);
      return false;
    }
  }

  async closeTab(tabId) {
    try {
      // Close tab in Chrome
      await chrome.tabs.remove(tabId);

      // The tab removal will be handled by handleTabRemoved
      console.log('✅ Tab close requested:', tabId);
      return true;
    } catch (error) {
      console.error('Error closing tab:', error);
      return false;
    }
  }

  async closeTabs(tabIds = []) {
    try {
      const uniqueTabIds = Array.from(new Set(
        tabIds
          .map(tabId => Number.parseInt(tabId, 10))
          .filter(Number.isInteger)
      ));

      if (uniqueTabIds.length === 0) {
        return true;
      }

      await chrome.tabs.remove(uniqueTabIds);
      console.log(`✅ Batch close requested for ${uniqueTabIds.length} tabs`);
      return true;
    } catch (error) {
      console.error('Error closing tabs in batch:', error);
      return false;
    }
  }

  async deleteGroup(groupId, tabIds = []) {
    try {
      const closeSuccess = await this.closeTabs(tabIds);
      if (!closeSuccess) {
        return false;
      }

      // Custom groups are persisted, generated groups (domain/date/session) are transient.
      if (groupId && groupId.startsWith('custom_')) {
        await this.storageManager.removeGroup(groupId);
      }

      this.eventBus.emit('group_deleted', { groupId, tabIds });
      console.log(`✅ Group delete requested: ${groupId}`);
      return true;
    } catch (error) {
      console.error('Error deleting group:', error);
      return false;
    }
  }

  async bookmarkTabs(tabUuids = [], options = {}) {
    try {
      if (!chrome?.bookmarks?.create || !chrome?.bookmarks?.search) {
        return {
          success: false,
          successCount: 0,
          failedCount: tabUuids.length,
          error: 'Bookmarks API not available'
        };
      }

      const uniqueTabUuids = Array.from(new Set(
        (Array.isArray(tabUuids) ? tabUuids : [])
          .filter(uuid => typeof uuid === 'string' && uuid.length > 0)
      ));

      if (uniqueTabUuids.length === 0) {
        return { success: true, successCount: 0, failedCount: 0 };
      }

      const storedTabs = await this.storageManager.getAllTabs();
      const targetFolder = await this.resolveBookmarkFolder(options);
      const folderId = targetFolder.id;

      let successCount = 0;
      let failedCount = 0;

      for (const tabUuid of uniqueTabUuids) {
        const tab = storedTabs[tabUuid];
        const url = tab?.url || '';
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          failedCount++;
          continue;
        }

        const title = (tab.alias && tab.alias.trim()) || tab.title || url;

        try {
          await chrome.bookmarks.create({
            parentId: folderId,
            title,
            url
          });
          successCount++;
        } catch (bookmarkError) {
          console.error('Failed to bookmark tab:', tabUuid, bookmarkError);
          failedCount++;
        }
      }

      this.eventBus.emit('tabs_bookmarked', {
        tabUuids: uniqueTabUuids,
        successCount,
        failedCount
      });

      return {
        success: true,
        successCount,
        failedCount,
        folderId,
        folderTitle: targetFolder.title
      };
    } catch (error) {
      console.error('Error bookmarking tabs:', error);
      return {
        success: false,
        successCount: 0,
        failedCount: Array.isArray(tabUuids) ? tabUuids.length : 0,
        error: error.message
      };
    }
  }

  async listBookmarkFolders() {
    try {
      if (!chrome?.bookmarks?.getTree) {
        return [];
      }

      const tree = await chrome.bookmarks.getTree();
      const rootChildren = tree?.[0]?.children || [];
      const folders = [];

      rootChildren.forEach(node => {
        this.collectBookmarkFolders(node, '', folders);
      });

      return folders.sort((a, b) => a.path.localeCompare(b.path, 'zh-CN'));
    } catch (error) {
      console.error('Error listing bookmark folders:', error);
      return [];
    }
  }

  collectBookmarkFolders(node, parentPath = '', output = []) {
    if (!node || node.url) {
      return;
    }

    const nodeTitle = typeof node.title === 'string' && node.title.trim()
      ? node.title.trim()
      : '未命名文件夹';
    const path = parentPath ? `${parentPath} / ${nodeTitle}` : nodeTitle;

    output.push({
      id: node.id,
      title: nodeTitle,
      path,
      parentId: node.parentId || null
    });

    const children = Array.isArray(node.children) ? node.children : [];
    children.forEach(child => {
      this.collectBookmarkFolders(child, path, output);
    });
  }

  async resolveBookmarkFolder(options = {}) {
    const selectedFolderId = typeof options.folderId === 'string'
      ? options.folderId.trim()
      : '';

    if (selectedFolderId && chrome?.bookmarks?.get) {
      try {
        const nodes = await chrome.bookmarks.get(selectedFolderId);
        const folder = nodes?.[0];
        if (folder && !folder.url) {
          return {
            id: folder.id,
            title: folder.title || '未命名文件夹'
          };
        }
      } catch (error) {
        console.warn('Selected bookmark folder is unavailable, falling back to default folder:', error);
      }
    }

    const createFolderName = typeof options.createFolderName === 'string'
      ? options.createFolderName.trim()
      : '';
    if (createFolderName) {
      const parentId = await this.getBookmarksBarId();
      const createdFolder = await chrome.bookmarks.create({
        parentId,
        title: createFolderName
      });
      return {
        id: createdFolder.id,
        title: createdFolder.title || createFolderName
      };
    }

    return this.ensureBookmarkFolder();
  }

  async ensureBookmarkFolder() {
    const folderTitle = 'TabFlow Favorites';
    const existingItems = await chrome.bookmarks.search({ title: folderTitle });
    const existingFolder = (existingItems || []).find(item => !item.url && item.title === folderTitle);
    if (existingFolder) {
      return {
        id: existingFolder.id,
        title: existingFolder.title || folderTitle
      };
    }

    const parentId = await this.getBookmarksBarId();
    const folder = await chrome.bookmarks.create({
      parentId,
      title: folderTitle
    });

    return {
      id: folder.id,
      title: folder.title || folderTitle
    };
  }

  async getBookmarksBarId() {
    try {
      const tree = await chrome.bookmarks.getTree();
      const rootChildren = tree?.[0]?.children || [];
      const bookmarksBarNode = rootChildren.find(node => Array.isArray(node.children));
      return bookmarksBarNode?.id || '1';
    } catch (error) {
      console.error('Error getting bookmarks bar id:', error);
      return '1';
    }
  }

  async activateTab(tabId) {
    try {
      await chrome.tabs.update(tabId, { active: true });

      // Focus the window containing the tab
      const tab = await chrome.tabs.get(tabId);
      if (tab && tab.windowId) {
        await chrome.windows.update(tab.windowId, { focused: true });
      }

      console.log('✅ Tab activated:', tabId);
      return true;
    } catch (error) {
      console.error('Error activating tab:', error);
      return false;
    }
  }

  // Utility methods
  generateGroupColor() {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  getPerformanceMetrics() {
    return {
      ...this.tabMetrics,
      activeTabsCount: this.activeTabs.size,
      uptime: Date.now() - this.tabMetrics.lastSync
    };
  }

  // Event handlers for internal events
  handleStorageChange(changes) {
    console.log('💾 Storage changed:', Object.keys(changes));
    this.eventBus.emit('data_changed', changes);
  }

  handleTabCreatedEvent(tabData) {
    console.log('🎉 Tab created event:', tabData.title);
  }

  handleTabRemovedEvent({ tabId, tabData }) {
    console.log('🗑️ Tab removed event:', tabData.title);
  }

  handleTabUpdatedEvent(tabData) {
    console.log('📝 Tab updated event:', tabData.title);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TabManager;
}
