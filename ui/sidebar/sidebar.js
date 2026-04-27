// SuperTab Sidebar - Main UI logic

class SuperTabSidebar {
  constructor() {
    const routeParams = this.parseRouteParams();
    this.currentGroup = routeParams.groupType;
    this.focusGroupId = routeParams.groupId;
    this.singleGroupMode = routeParams.singleGroup;
    this.isStandaloneTabView = routeParams.displayMode === 'tab';
    this.groupDisplayMode = 'sidebar';
    this.searchQuery = '';
    this.tabs = [];
    this.groups = [];
    this.selectionMode = false;
    this.selectedTabUuids = new Set();
    this.isLoading = false;
    this.contextMenu = null;
    this.eventBus = new EventTarget();
    this.lastBookmarkFolderId = this.getPersistedBookmarkFolderId();
    this.bookmarkPickerResolver = null;
    this.bookmarkPickerFolders = [];
    this.bookmarkPickerTree = [];
    this.bookmarkPickerSelectedFolderId = '';
    this.bookmarkPickerCollapsedFolderIds = new Set();
    this.contextMenuContext = null;
    this.createGroupTabFilterQuery = '';
    this.createGroupSelectedTabUuids = new Set();
    // 搜索增强
    this.searchEngine = null;
    this.searchResults = [];
    this.isSearching = false;

    this.initializeElements();
    this.setupEventListeners();
    this.syncGroupTypeUI();
    this.applyStandaloneLayout();
    this.loadDisplayPreferences();
    this.loadData();
  }

  initializeElements() {
    this.elements = {
      searchInput: document.getElementById('search-input'),
      groupButtons: document.querySelectorAll('.tf-group-btn'),
      groupSelector: document.querySelector('.tf-group-selector'),
      content: document.querySelector('.tf-content'),
      groupContainers: document.querySelectorAll('.tf-group-container'),
      domainGroups: document.getElementById('domain-groups'),
      dateGroups: document.getElementById('date-groups'),
      customGroups: document.getElementById('custom-groups'),
      sessionGroups: document.getElementById('session-groups'),
      createGroupBtn: document.getElementById('create-group-btn'),
      tabCount: document.getElementById('tab-count'),
      groupCount: document.getElementById('group-count'),
      selectModeBtn: document.getElementById('select-mode-btn'),
      refreshBtn: document.getElementById('refresh-btn'),
      settingsBtn: document.getElementById('settings-btn'),
      batchFavoriteBtn: document.getElementById('batch-favorite-btn'),
      loadingOverlay: document.getElementById('loading-overlay'),
      contextMenu: document.getElementById('context-menu'),
      bookmarkFolderModal: document.getElementById('bookmark-folder-modal'),
      bookmarkFolderTree: document.getElementById('bookmark-folder-tree'),
      bookmarkModalCloseBtn: document.getElementById('bookmark-modal-close-btn'),
      bookmarkModalCancelBtn: document.getElementById('bookmark-modal-cancel-btn'),
      bookmarkModalConfirmBtn: document.getElementById('bookmark-modal-confirm-btn'),
      bookmarkFolderNameInput: document.getElementById('bookmark-folder-name-input'),
      bookmarkCreateFolderBtn: document.getElementById('bookmark-create-folder-btn'),
      createGroupModal: document.getElementById('create-group-modal'),
      createGroupModalCloseBtn: document.getElementById('create-group-modal-close-btn'),
      createGroupModalCancelBtn: document.getElementById('create-group-modal-cancel-btn'),
      createGroupModalConfirmBtn: document.getElementById('create-group-modal-confirm-btn'),
      createGroupNameInput: document.getElementById('create-group-name-input'),
      createGroupTabSearchInput: document.getElementById('create-group-tab-search-input'),
      createGroupSelectAllCheckbox: document.getElementById('create-group-select-all-checkbox'),
      createGroupSelectionSummary: document.getElementById('create-group-selection-summary'),
      createGroupTabList: document.getElementById('create-group-tab-list'),
      // 搜索增强元素
      searchClearBtn: document.getElementById('search-clear-btn'),
      searchSuggestions: document.getElementById('search-suggestions'),
      searchSuggestionsList: document.getElementById('search-suggestions-list'),
      clearHistoryBtn: document.getElementById('clear-history-btn'),
      // 批量操作增强元素
      batchActions: document.getElementById('batch-actions'),
      batchSelectAllBtn: document.getElementById('batch-select-all-btn'),
      batchCloseBtn: document.getElementById('batch-close-btn'),
      batchSleepBtn: document.getElementById('batch-sleep-btn'),
      batchMoveBtn: document.getElementById('batch-move-btn')
    };

    // Create context menu if it doesn't exist
    if (!this.elements.contextMenu) {
      this.elements.contextMenu = document.createElement('div');
      this.elements.contextMenu.id = 'context-menu';
      this.elements.contextMenu.className = 'tf-context-menu tf-hidden';
      document.body.appendChild(this.elements.contextMenu);
    }

    this.contextMenu = this.elements.contextMenu;
  }

  setupEventListeners() {
    // Search functionality - 增强版
    this.elements.searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.handleSearchInput(this.searchQuery);
    });

    this.elements.searchInput.addEventListener('focus', () => {
      this.showSearchSuggestions();
    });

    this.elements.searchInput.addEventListener('keydown', (e) => {
      this.handleSearchKeyDown(e);
    });

    // 搜索清除按钮
    if (this.elements.searchClearBtn) {
      this.elements.searchClearBtn.addEventListener('click', () => {
        this.clearSearch();
      });
    }

    // 清除历史按钮
    if (this.elements.clearHistoryBtn) {
      this.elements.clearHistoryBtn.addEventListener('click', () => {
        this.clearSearchHistory();
      });
    }

    // 点击外部关闭搜索建议
    document.addEventListener('click', (e) => {
      const searchContainer = document.querySelector('.tf-search-container');
      if (searchContainer && !searchContainer.contains(e.target)) {
        this.hideSearchSuggestions();
      }
    });

    // Group switching
    this.elements.groupButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const groupType = e.currentTarget.dataset.group;
        this.switchGroup(groupType);
      });
    });

    // Action buttons
    this.elements.createGroupBtn.addEventListener('click', () => {
      this.showCreateGroupDialog();
    });

    this.elements.refreshBtn.addEventListener('click', () => {
      this.refresh();
    });

    this.elements.selectModeBtn.addEventListener('click', () => {
      this.toggleSelectionMode();
    });

    this.elements.settingsBtn.addEventListener('click', () => {
      this.openSettings();
    });

    this.elements.batchFavoriteBtn.addEventListener('click', () => {
      this.bookmarkSelectedTabs();
    });

    // 批量操作增强按钮
    if (this.elements.batchSelectAllBtn) {
      this.elements.batchSelectAllBtn.addEventListener('click', () => {
        this.toggleSelectAll();
      });
    }

    if (this.elements.batchCloseBtn) {
      this.elements.batchCloseBtn.addEventListener('click', () => {
        this.closeSelectedTabs();
      });
    }

    if (this.elements.batchSleepBtn) {
      this.elements.batchSleepBtn.addEventListener('click', () => {
        this.sleepSelectedTabs();
      });
    }

    if (this.elements.batchMoveBtn) {
      this.elements.batchMoveBtn.addEventListener('click', () => {
        this.showMoveTabsDialog();
      });
    }

    // Global event listeners
    document.addEventListener('click', (e) => {
      if (!this.contextMenu.contains(e.target)) {
        this.hideContextMenu();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.isCreateGroupModalOpen()) {
          this.closeCreateGroupModal();
          return;
        }
        if (this.isBookmarkModalOpen()) {
          this.closeBookmarkFolderPicker(null);
          return;
        }
        this.hideContextMenu();
      }
    });

    if (this.elements.bookmarkFolderModal) {
      this.elements.bookmarkFolderModal.addEventListener('click', (e) => {
        if (e.target && e.target.dataset && e.target.dataset.action === 'close-bookmark-modal') {
          this.closeBookmarkFolderPicker(null);
        }
      });
    }

    if (this.elements.createGroupModal) {
      this.elements.createGroupModal.addEventListener('click', (e) => {
        if (e.target && e.target.dataset && e.target.dataset.action === 'close-create-group-modal') {
          this.closeCreateGroupModal();
        }
      });
    }

    if (this.elements.createGroupModalCloseBtn) {
      this.elements.createGroupModalCloseBtn.addEventListener('click', () => {
        this.closeCreateGroupModal();
      });
    }

    if (this.elements.createGroupModalCancelBtn) {
      this.elements.createGroupModalCancelBtn.addEventListener('click', () => {
        this.closeCreateGroupModal();
      });
    }

    if (this.elements.createGroupModalConfirmBtn) {
      this.elements.createGroupModalConfirmBtn.addEventListener('click', () => {
        this.submitCreateGroupFromModal();
      });
    }

    if (this.elements.createGroupNameInput) {
      this.elements.createGroupNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.submitCreateGroupFromModal();
        }
      });
    }

    if (this.elements.createGroupTabSearchInput) {
      this.elements.createGroupTabSearchInput.addEventListener('input', (e) => {
        this.createGroupTabFilterQuery = e.target.value || '';
        this.renderCreateGroupTabPicker();
      });
    }

    if (this.elements.createGroupSelectAllCheckbox) {
      this.elements.createGroupSelectAllCheckbox.addEventListener('change', (e) => {
        const shouldSelect = Boolean(e.target.checked);
        const visibleTabs = this.getFilteredCreateGroupTabs();
        visibleTabs.forEach((tab) => {
          if (tab?.uuid) {
            if (shouldSelect) {
              this.createGroupSelectedTabUuids.add(tab.uuid);
            } else {
              this.createGroupSelectedTabUuids.delete(tab.uuid);
            }
          }
        });
        this.renderCreateGroupTabPicker();
      });
    }

    if (this.elements.createGroupTabList) {
      this.elements.createGroupTabList.addEventListener('change', (e) => {
        const checkbox = e.target.closest('.tf-create-group-tab-checkbox');
        if (!checkbox) {
          return;
        }
        const tabUuid = checkbox.dataset.tabUuid;
        if (!tabUuid) {
          return;
        }
        if (checkbox.checked) {
          this.createGroupSelectedTabUuids.add(tabUuid);
        } else {
          this.createGroupSelectedTabUuids.delete(tabUuid);
        }
        this.updateCreateGroupSelectionSummary();
        this.syncCreateGroupSelectAllCheckbox();
      });
    }

    if (this.elements.bookmarkModalCloseBtn) {
      this.elements.bookmarkModalCloseBtn.addEventListener('click', () => {
        this.closeBookmarkFolderPicker(null);
      });
    }

    if (this.elements.bookmarkModalCancelBtn) {
      this.elements.bookmarkModalCancelBtn.addEventListener('click', () => {
        this.closeBookmarkFolderPicker(null);
      });
    }

    if (this.elements.bookmarkModalConfirmBtn) {
      this.elements.bookmarkModalConfirmBtn.addEventListener('click', () => {
        this.confirmBookmarkFolderSelection();
      });
    }

    if (this.elements.bookmarkCreateFolderBtn) {
      this.elements.bookmarkCreateFolderBtn.addEventListener('click', () => {
        this.createBookmarkFolderFromModal();
      });
    }

    if (this.elements.bookmarkFolderNameInput) {
      this.elements.bookmarkFolderNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.createBookmarkFolderFromModal();
        }
      });
    }

    if (this.elements.bookmarkFolderTree) {
      this.elements.bookmarkFolderTree.addEventListener('change', (e) => {
        const checkbox = e.target.closest('.tf-folder-checkbox');
        if (checkbox) {
          this.handleBookmarkFolderCheckboxChange(checkbox);
        }
      });

      this.elements.bookmarkFolderTree.addEventListener('click', (e) => {
        const toggleBtn = e.target.closest('[data-folder-toggle-id]');
        if (toggleBtn) {
          const folderId = toggleBtn.dataset.folderToggleId;
          this.toggleBookmarkFolderNode(folderId);
        }
      });
    }

    this.contextMenu.addEventListener('click', (e) => {
      const actionElement = e.target.closest('.tf-menu-item');
      if (!actionElement) {
        return;
      }
      const action = actionElement.dataset.action;
      this.handleContextMenuAction(action);
    });

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      try {
        this.handleMessage(request, sender, sendResponse);
      } catch (error) {
        console.error('Sidebar message handler error:', error);
        if (typeof sendResponse === 'function') {
          sendResponse({ success: false, error: error?.message || 'Sidebar message handling failed' });
        }
      }
      return false;
    });

    if (chrome.storage?.onChanged?.addListener) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local') {
          return;
        }
        const settingsChange = changes?.['tabflow:settings'];
        if (!settingsChange) {
          return;
        }
        this.updateDisplayPreferenceFromSettings(settingsChange.newValue);
      });
    }

    console.log('🎯 Event listeners setup complete');
  }

  async loadData() {
    this.showLoading(true);

    try {
      const response = await this.sendMessageWithRetry({
        action: 'getTabsGrouped',
        data: {
          groupType: this.currentGroup
        }
      });

      if (response.success) {
        const payload = response.data && typeof response.data === 'object' ? response.data : {};
        this.tabs = Array.isArray(payload.tabs) ? payload.tabs : [];
        this.groups = Array.isArray(payload.groups) ? payload.groups : [];
        this.applyGroupScope();
        this.syncSelectionWithTabs();
        this.renderGroups();
        this.updateStats();
        this.updateSelectionUI();
        if (this.isCreateGroupModalOpen()) {
          this.renderCreateGroupTabPicker();
        }
        console.log(`📊 Loaded ${this.tabs.length} tabs in ${this.groups.length} groups`);
      } else {
        throw new Error(response.error || 'Failed to load data');
      }
    } catch (error) {
      console.error('❌ Failed to load data:', error);
      this.showError(`加载数据失败：${error?.message || '请刷新重试'}`);
    } finally {
      this.showLoading(false);
    }
  }

  async sendMessageWithRetry(message, retries = 1) {
    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await chrome.runtime.sendMessage(message);
        if (!response || typeof response !== 'object') {
          throw new Error('Background response is empty');
        }
        return response;
      } catch (error) {
        lastError = error;
        if (attempt === retries) {
          throw lastError;
        }
        await new Promise(resolve => setTimeout(resolve, 120));
      }
    }

    throw lastError || new Error('Unknown messaging failure');
  }

  switchGroup(groupType) {
    const previousGroup = this.currentGroup;

    // Update button states
    this.elements.groupButtons.forEach(btn => {
      const isActive = btn.dataset.group === groupType;
      btn.classList.toggle('active', isActive);
    });

    // Update container states
    this.elements.groupContainers.forEach(container => {
      const isActive = container.id === `${groupType}-groups`;
      container.classList.toggle('active', isActive);
    });

    this.currentGroup = groupType;

    if (this.elements.content) {
      this.elements.content.scrollTop = 0;
    }
    const activeContainer = this.elements[`${groupType}Groups`];
    if (activeContainer) {
      activeContainer.scrollTop = 0;
    }

    // Load data for the new group type
    if (groupType !== previousGroup) {
      if (this.singleGroupMode) {
        this.focusGroupId = '';
      }
      this.loadData();
    }

    console.log(`🔄 Switched to ${groupType} grouping`);
  }

  renderGroups() {
    const container = this.elements[`${this.currentGroup}Groups`];
    if (!container) {
      console.error(`Container not found for group type: ${this.currentGroup}`);
      return;
    }

    container.innerHTML = '';

    if (this.groups.length === 0) {
      container.innerHTML = this.getEmptyStateHTML();
      return;
    }

    this.groups.forEach(group => {
      const groupElement = document.createElement('group-item');
      groupElement.data = group;
      groupElement.selectionMode = this.selectionMode;
      groupElement.selectedTabUuids = this.selectedTabUuids;
      this.bindGroupElementEvents(groupElement);

      container.appendChild(groupElement);
    });

    console.log(`🎨 Rendered ${this.groups.length} groups using custom elements`);
  }

  createGroupElement(group) {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'tf-group';
    groupDiv.dataset.groupId = group.id;
    groupDiv.dataset.groupType = group.type;

    const tabCount = group.tabs ? group.tabs.length : 0;
    const icon = group.icon || this.getGroupIcon(group.type);
    const collapsed = group.collapsed;

    groupDiv.innerHTML = `
      <div class="tf-group-header" data-action="toggle-collapse">
        <div class="tf-group-title">
          <span class="tf-group-icon">${icon}</span>
          <span class="tf-group-name">${this.escapeHtml(group.name)}</span>
          <span class="tf-group-count">${tabCount}</span>
        </div>
        <div class="tf-group-actions">
          <button class="tf-btn tf-btn-icon tf-group-collapse" title="${collapsed ? '展开' : '折叠'}" data-action="toggle-collapse" aria-label="${collapsed ? '展开' : '折叠'}">
            ${collapsed
              ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>'
              : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>'
            }
          </button>
          <button class="tf-btn tf-btn-icon tf-group-menu" title="菜单" data-action="show-menu" aria-label="菜单">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2"/>
              <circle cx="12" cy="12" r="2"/>
              <circle cx="12" cy="19" r="2"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="tf-group-content" ${group.collapsed ? 'style="display: none;"' : ''}>
        ${group.tabs ? group.tabs.map(tab => this.createTabElement(tab)).join('') : ''}
      </div>
    `;

    // Setup event listeners for the group
    this.setupGroupEventListeners(groupDiv, group);

    return groupDiv;
  }

  createTabElement(tab) {
    const fallbackIcon = `
      <div class="fallback-icon">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
        </svg>
      </div>
    `;

    const favicon = tab.favicon ?
      `<img class="tf-tab-favicon-img" src="${tab.favicon}" alt="">` :
      fallbackIcon;

    return `
      <div class="tf-tab" data-tab-id="${tab.id}" data-tab-uuid="${tab.uuid}" draggable="true">
        <div class="tf-tab-favicon">${favicon}</div>
        <div class="tf-tab-content">
          <div class="tf-tab-title">${this.escapeHtml(tab.title)}</div>
          ${tab.note ? `<div class="tf-tab-note">${this.escapeHtml(tab.note)}</div>` : ''}
          <div class="tf-tab-url">${this.escapeHtml(tab.url)}</div>
        </div>
        <div class="tf-tab-actions">
          <button class="tf-tab-action-btn" title="添加备注" data-action="add-note" aria-label="添加备注">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="tf-tab-action-btn" title="关闭" data-action="close-tab" aria-label="关闭">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  setupGroupEventListeners(groupElement, group) {
    // Group header click
    const header = groupElement.querySelector('.tf-group-header');
    header.addEventListener('click', (e) => {
      if (e.target.closest('[data-action]')) {
        e.stopPropagation();
        const action = e.target.closest('[data-action]').dataset.action;
        this.handleGroupAction(action, group, groupElement);
      } else {
        this.toggleGroupCollapse(group, groupElement);
      }
    });

    // Tab click events
    const tabs = groupElement.querySelectorAll('.tf-tab');
    tabs.forEach(tabElement => {
      const faviconImg = tabElement.querySelector('.tf-tab-favicon-img');
      if (faviconImg) {
        faviconImg.addEventListener('error', () => {
          faviconImg.style.display = 'none';
        }, { once: true });
      }

      tabElement.addEventListener('click', (e) => {
        if (e.target.closest('.tf-tab-action-btn')) {
          e.stopPropagation();
          const action = e.target.closest('.tf-tab-action-btn').dataset.action;
          this.handleTabAction(action, tabElement);
        } else {
          this.activateTab(tabElement.dataset.tabId);
        }
      });

      tabElement.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.showTabContextMenu(e, tabElement);
      });

      // Drag and drop
      tabElement.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', tabElement.dataset.tabUuid);
        e.dataTransfer.effectAllowed = 'move';
        tabElement.classList.add('dragging');
      });

      tabElement.addEventListener('dragend', () => {
        tabElement.classList.remove('dragging');
      });
    });

    // Group drag and drop
    groupElement.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      groupElement.classList.add('drag-over');
    });

    groupElement.addEventListener('dragleave', () => {
      groupElement.classList.remove('drag-over');
    });

    groupElement.addEventListener('drop', (e) => {
      e.preventDefault();
      groupElement.classList.remove('drag-over');

      const tabUuid = e.dataTransfer.getData('text/plain');
      if (tabUuid) {
        this.moveTabToGroup(tabUuid, group.id);
      }
    });
  }

  handleGroupAction(action, group, groupElement) {
    switch (action) {
      case 'toggle-collapse':
        this.toggleGroupCollapse(group, groupElement);
        break;
      case 'show-menu':
        this.showGroupContextMenu(group, groupElement);
        break;
    }
  }

  handleTabAction(action, tabElement) {
    const tabId = tabElement.dataset.tabId;
    const tabUuid = tabElement.dataset.tabUuid;

    switch (action) {
      case 'add-note':
        this.showNoteDialog(tabUuid);
        break;
      case 'close-tab':
        this.closeTab(tabId);
        break;
    }
  }

  toggleGroupCollapse(group, groupElement) {
    const content = groupElement.querySelector('.tf-group-content');
    const button = groupElement.querySelector('.tf-group-collapse');
    const isCollapsed = content.style.display === 'none';

    const chevronSvg = isCollapsed
      ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>'
      : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>';

    if (isCollapsed) {
      content.style.display = '';
    } else {
      content.style.display = 'none';
    }
    button.innerHTML = chevronSvg;
    button.setAttribute('aria-label', isCollapsed ? '折叠' : '展开');

    // Update group data
    group.collapsed = !isCollapsed;
    console.log(`📁 Group ${group.name} ${isCollapsed ? 'expanded' : 'collapsed'}`);
  }

  async activateTab(tabId) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'activateTab',
        tabId: parseInt(tabId)
      });

      if (response.success) {
        console.log(`🎯 Activated tab ${tabId}`);
      }
    } catch (error) {
      console.error('Failed to activate tab:', error);
    }
  }

  async closeTab(tabId) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'closeTab',
        tabId: parseInt(tabId)
      });

      if (response.success) {
        console.log(`🗑️ Closed tab ${tabId}`);
        this.refresh();
      }
    } catch (error) {
      console.error('Failed to close tab:', error);
    }
  }

  showTabContextMenu(event, tabElement) {
    const tabUuid = tabElement.dataset.tabUuid;
    const tabId = tabElement.dataset.tabId;

    this.showContextMenu(event.clientX, event.clientY, {
      type: 'tab',
      data: { uuid: tabUuid, id: tabId }
    });
  }

  showGroupContextMenu(group, groupElement) {
    const rect = groupElement.getBoundingClientRect();
    this.showContextMenu(rect.right - 20, rect.top + 10, {
      type: 'group',
      data: group
    });
  }

  showContextMenu(x, y, context) {
    this.contextMenuContext = context;
    this.contextMenu.innerHTML = this.getContextMenuHTML(context);
    this.contextMenu.style.left = `${x}px`;
    this.contextMenu.style.top = `${y}px`;
    this.contextMenu.classList.remove('tf-hidden');

    // Position adjustment to keep in viewport
    const rect = this.contextMenu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (rect.right > viewportWidth) {
      this.contextMenu.style.left = `${viewportWidth - rect.width - 10}px`;
    }

    if (rect.bottom > viewportHeight) {
      this.contextMenu.style.top = `${viewportHeight - rect.height - 10}px`;
    }

    this.contextMenu.classList.add('visible');
  }

  hideContextMenu() {
    this.contextMenuContext = null;
    this.contextMenu.classList.remove('visible');
    setTimeout(() => {
      this.contextMenu.classList.add('tf-hidden');
    }, 200);
  }

  async handleContextMenuAction(action) {
    const context = this.contextMenuContext;
    this.hideContextMenu();

    if (!context || !action) {
      return;
    }

    try {
      if (context.type === 'tab') {
        await this.handleTabContextMenuAction(action, context.data || {});
        return;
      }

      if (context.type === 'group') {
        await this.handleGroupContextMenuAction(action, context.data || {});
      }
    } catch (error) {
      console.error('Failed to handle context menu action:', action, error);
      this.showToast('操作失败，请重试', 'error');
    }
  }

  async handleTabContextMenuAction(action, tabData) {
    const tabId = Number.parseInt(tabData?.id ?? tabData?.tabId, 10);
    const tabUuid = tabData?.uuid || tabData?.tabUuid;

    switch (action) {
      case 'activate':
        if (Number.isInteger(tabId)) {
          await this.activateTab(tabId);
        }
        break;
      case 'add-note':
        if (tabUuid) {
          this.showNoteDialog(tabUuid);
        }
        break;
      case 'set-alias':
        if (tabUuid) {
          this.showAliasDialog(tabUuid, tabData);
        }
        break;
      case 'move-to-group':
        await this.showMoveToGroupDialog(tabUuid);
        break;
      case 'copy-url':
        await this.copyTabUrl(tabData?.url || '');
        break;
      case 'copy-title':
        await this.copyTabTitle(tabData?.title || '');
        break;
      case 'pin':
        await this.toggleTabPin(tabId, tabUuid);
        break;
      case 'mute':
        await this.toggleTabMute(tabId, tabUuid);
        break;
      case 'discard':
        await this.discardTab(tabId, tabUuid);
        break;
      case 'close-others':
        if (tabUuid) {
          await this.closeOtherTabs(tabUuid);
        }
        break;
      case 'close-to-right':
        if (tabUuid) {
          await this.closeTabsToRight(tabUuid);
        }
        break;
      case 'close':
        if (Number.isInteger(tabId)) {
          await this.closeTab(tabId);
        }
        break;
      default:
        break;
    }
  }

  async handleGroupContextMenuAction(action, groupData) {
    switch (action) {
      case 'expand-all':
        this.setAllGroupCollapsed(false);
        break;
      case 'collapse-all':
        this.setAllGroupCollapsed(true);
        break;
      case 'select-all-tabs':
        await this.selectAllTabsInGroup(groupData);
        break;
      case 'close-group-tabs':
        await this.closeAllTabsInGroup(groupData);
        break;
      case 'sleep-group-tabs':
        await this.sleepAllTabsInGroup(groupData);
        break;
      case 'rename-group':
        await this.renameGroup(groupData);
        break;
      case 'delete':
        await this.deleteGroupFromContextMenu(groupData);
        break;
      default:
        break;
    }
  }

  // ========== 新增快捷操作方法 ==========

  async copyTabTitle(title) {
    const text = typeof title === 'string' ? title.trim() : '';
    if (!text) {
      this.showToast('标题为空，无法复制', 'error');
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      this.showToast('标题已复制', 'success');
    } catch (error) {
      console.error('Failed to copy tab title:', error);
      this.showToast('复制标题失败', 'error');
    }
  }

  showAliasDialog(tabUuid, tabData) {
    if (!tabUuid) return;
    
    const currentAlias = tabData?.alias || '';
    const newAlias = prompt(
      `请输入标签页别名（留空则清除别名）：`,
      currentAlias
    );
    
    if (newAlias === null) return;
    
    this.setTabAlias(tabUuid, newAlias.trim());
  }

  async setTabAlias(tabUuid, alias) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'setTabAlias',
        data: {
          tabUuid,
          alias
        }
      });
      
      if (response?.success) {
        if (alias && alias.trim()) {
          this.showToast(`已设置别名: ${alias}`, 'success');
        } else {
          this.showToast('已清除别名', 'success');
        }
        await this.loadData();
      } else {
        throw new Error(response?.error || '设置别名失败');
      }
    } catch (error) {
      console.error('Failed to set alias:', error);
      this.showToast('设置别名失败', 'error');
    }
  }

  async toggleTabPin(tabId, tabUuid) {
    if (!Number.isInteger(tabId)) {
      this.showToast('无法固定此标签页', 'error');
      return;
    }

    try {
      // 使用 Chrome API 获取当前标签页的固定状态
      const currentTab = await chrome.tabs.get(tabId);
      const newPinnedState = !currentTab.pinned;
      
      await chrome.tabs.update(tabId, { pinned: newPinnedState });
      
      // 更新存储中的标签页数据
      await chrome.runtime.sendMessage({
        action: 'updateTabPinned',
        data: {
          tabUuid,
          pinned: newPinnedState
        }
      });
      
      this.showToast(
        newPinnedState ? '标签页已固定' : '标签页已取消固定',
        'success'
      );
      await this.loadData();
    } catch (error) {
      console.error('Failed to toggle pin:', error);
      this.showToast('操作失败', 'error');
    }
  }

  async toggleTabMute(tabId, tabUuid) {
    if (!Number.isInteger(tabId)) {
      this.showToast('无法操作此标签页', 'error');
      return;
    }

    try {
      const currentTab = await chrome.tabs.get(tabId);
      const newMutedState = !currentTab.mutedInfo?.muted;
      
      await chrome.tabs.update(tabId, { muted: newMutedState });
      
      this.showToast(
        newMutedState ? '标签页已静音' : '标签页已取消静音',
        'success'
      );
      await this.loadData();
    } catch (error) {
      console.error('Failed to toggle mute:', error);
      this.showToast('操作失败', 'error');
    }
  }

  async discardTab(tabId, tabUuid) {
    if (!Number.isInteger(tabId)) {
      this.showToast('无法休眠此标签页', 'error');
      return;
    }

    try {
      // 检查是否是当前活动标签页
      const currentTab = await chrome.tabs.get(tabId);
      
      if (currentTab.active) {
        this.showToast('无法休眠当前活动标签页', 'info');
        return;
      }
      
      // 使用 discard API 休眠标签页
      if (chrome.tabs.discard) {
        await chrome.tabs.discard(tabId);
      }
      
      // 更新存储中的标签页状态
      await chrome.runtime.sendMessage({
        action: 'updateTabDiscarded',
        data: {
          tabUuid,
          discarded: true
        }
      });
      
      this.showToast('标签页已休眠，内存已释放', 'success');
      await this.loadData();
    } catch (error) {
      console.error('Failed to discard tab:', error);
      this.showToast('休眠失败', 'error');
    }
  }

  async selectAllTabsInGroup(groupData) {
    if (!groupData) return;
    
    const groupTabs = groupData.tabs || [];
    
    if (groupTabs.length === 0) {
      this.showToast('该分组中没有标签页', 'info');
      return;
    }
    
    // 进入选择模式
    if (!this.selectionMode) {
      this.selectionMode = true;
    }
    
    // 选中该分组的所有标签页
    groupTabs.forEach(tab => {
      if (tab && tab.uuid) {
        this.selectedTabUuids.add(tab.uuid);
      }
    });
    
    this.renderGroups();
    this.updateSelectionUI();
    this.showToast(`已选中 ${groupTabs.length} 个标签页`, 'success');
  }

  async closeAllTabsInGroup(groupData) {
    if (!groupData) return;
    
    const groupTabs = groupData.tabs || [];
    const tabCount = groupTabs.length;
    
    if (tabCount === 0) {
      this.showToast('该分组中没有标签页', 'info');
      return;
    }
    
    const confirmed = confirm(`确定要关闭分组 "${groupData.name || '未命名分组'}" 中的 ${tabCount} 个标签页吗？`);
    if (!confirmed) return;
    
    try {
      const chromeTabIds = [];
      const tabUuids = [];
      
      groupTabs.forEach(tab => {
        if (Number.isInteger(tab.id)) {
          chromeTabIds.push(tab.id);
        }
        if (tab.uuid) {
          tabUuids.push(tab.uuid);
        }
      });
      
      // 使用 Chrome API 关闭标签页
      if (chromeTabIds.length > 0 && chrome.tabs) {
        await chrome.tabs.remove(chromeTabIds);
      }
      
      // 通知 background
      await chrome.runtime.sendMessage({
        action: 'closeTabs',
        data: {
          tabUuids,
          includePinned: false
        }
      });
      
      this.showToast(`已关闭 ${tabCount} 个标签页`, 'success');
      await this.loadData();
    } catch (error) {
      console.error('Failed to close group tabs:', error);
      this.showToast('关闭标签页失败', 'error');
    }
  }

  async sleepAllTabsInGroup(groupData) {
    if (!groupData) return;
    
    const groupTabs = groupData.tabs || [];
    const tabCount = groupTabs.length;
    
    if (tabCount === 0) {
      this.showToast('该分组中没有标签页', 'info');
      return;
    }
    
    const confirmed = confirm(`确定要休眠分组 "${groupData.name || '未命名分组'}" 中的 ${tabCount} 个标签页吗？`);
    if (!confirmed) return;
    
    try {
      let sleptCount = 0;
      const activeTabId = this.getCurrentActiveTabId();
      
      for (const tab of groupTabs) {
        if (tab.id === activeTabId) {
          continue; // 跳过当前活动标签页
        }
        
        try {
          if (Number.isInteger(tab.id) && chrome.tabs && chrome.tabs.discard) {
            await chrome.tabs.discard(tab.id);
            sleptCount++;
          }
        } catch (e) {
          console.warn('Failed to discard tab:', e);
        }
      }
      
      this.showToast(`已休眠 ${sleptCount} 个标签页，释放内存`, 'success');
      await this.loadData();
    } catch (error) {
      console.error('Failed to sleep group tabs:', error);
      this.showToast('休眠标签页失败', 'error');
    }
  }

  async renameGroup(groupData) {
    if (!groupData || !groupData.id) return;
    
    const currentName = groupData.name || '';
    const newName = prompt(
      `请输入新的分组名称：`,
      currentName
    );
    
    if (newName === null || !newName.trim()) {
      if (newName !== null) {
        this.showToast('分组名称不能为空', 'error');
      }
      return;
    }
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'renameGroup',
        data: {
          groupId: groupData.id,
          newName: newName.trim()
        }
      });
      
      if (response?.success) {
        this.showToast(`分组已重命名为: ${newName.trim()}`, 'success');
        await this.loadData();
      } else {
        throw new Error(response?.error || '重命名失败');
      }
    } catch (error) {
      console.error('Failed to rename group:', error);
      this.showToast('重命名失败', 'error');
    }
  }

  async deleteGroupFromContextMenu(groupData) {
    const groupId = groupData?.id;
    if (!groupId) {
      return;
    }

    const tabIds = Array.from(new Set(
      (groupData?.tabs || [])
        .map(tab => Number.parseInt(tab?.id, 10))
        .filter(Number.isInteger)
    ));
    const tabCount = tabIds.length;
    const confirmed = confirm(`确定删除分组 "${groupData.name || '未命名分组'}" 并关闭其中 ${tabCount} 个标签页吗？`);
    if (!confirmed) {
      return;
    }

    const response = await chrome.runtime.sendMessage({
      action: 'deleteGroup',
      data: {
        groupId,
        tabIds
      }
    });

    if (response?.success) {
      this.showToast(`已删除分组并关闭 ${tabCount} 个标签页`, 'success');
      await this.refresh();
    } else {
      throw new Error(response?.error || '删除分组失败');
    }
  }

  async showMoveToGroupDialog(tabUuid) {
    if (!tabUuid) {
      return;
    }

    const response = await chrome.runtime.sendMessage({
      action: 'getAllGroups'
    });
    if (!response?.success) {
      this.showToast('获取分组失败', 'error');
      return;
    }

    const groupsPayload = response.data;
    const groups = Array.isArray(groupsPayload) ? groupsPayload : Object.values(groupsPayload || {});
    if (groups.length === 0) {
      this.showToast('暂无可用分组，请先创建分组', 'info');
      return;
    }

    const groupLines = groups.map((group, index) => `${index + 1}. ${group.name}`).join('\n');
    const input = prompt(`请选择分组（输入序号）：\n${groupLines}`, '1');
    if (input === null) {
      return;
    }

    const selectedIndex = Number.parseInt(input.trim(), 10);
    if (!Number.isInteger(selectedIndex) || selectedIndex < 1 || selectedIndex > groups.length) {
      this.showToast('分组选择无效', 'error');
      return;
    }

    const selectedGroup = groups[selectedIndex - 1];
    await this.moveTabToGroup(tabUuid, selectedGroup.id);
  }

  async copyTabUrl(url) {
    const text = typeof url === 'string' ? url.trim() : '';
    if (!text) {
      this.showToast('链接为空，无法复制', 'error');
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      this.showToast('链接已复制', 'success');
    } catch (error) {
      console.error('Failed to copy tab url:', error);
      this.showToast('复制链接失败', 'error');
    }
  }

  getContextMenuHTML(context) {
    if (context.type === 'tab') {
      const tab = context.data || {};
      const hasNote = tab.note && tab.note.trim();
      const hasAlias = tab.alias && tab.alias.trim();
      
      return `
        <div class="tf-menu-item" data-action="activate">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 16 16 12 12 8"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
          <span>切换到标签页</span>
          <span class="tf-menu-shortcut">Enter</span>
        </div>
        <div class="tf-menu-divider"></div>
        <div class="tf-menu-item" data-action="add-note">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          <span>${hasNote ? '编辑备注' : '添加备注'}</span>
        </div>
        <div class="tf-menu-item" data-action="set-alias">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
          </svg>
          <span>${hasAlias ? '编辑别名' : '设置别名'}</span>
        </div>
        <div class="tf-menu-item" data-action="move-to-group">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <span>移动到分组</span>
          <span class="tf-menu-shortcut">M</span>
        </div>
        <div class="tf-menu-item" data-action="copy-url">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          <span>复制链接</span>
          <span class="tf-menu-shortcut">C</span>
        </div>
        <div class="tf-menu-item" data-action="copy-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <span>复制标题</span>
        </div>
        <div class="tf-menu-divider"></div>
        <div class="tf-menu-item" data-action="pin">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="17" x2="12" y2="22"/>
            <path d="M5 17h14v-5a7 7 0 0 0-14 0v5z"/>
            <path d="M15.13 6.29l-3.13-3.13-3.13 3.13a4 4 0 0 0 0 5.66"/>
          </svg>
          <span>${tab.pinned ? '取消固定' : '固定标签页'}</span>
          <span class="tf-menu-shortcut">P</span>
        </div>
        <div class="tf-menu-item" data-action="mute">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <line x1="15.54" y1="8.46" x2="19.07" y2="12"/>
            <line x1="19.07" y1="8.46" x2="15.54" y2="12"/>
          </svg>
          <span>${tab.muted ? '取消静音' : '静音标签页'}</span>
        </div>
        <div class="tf-menu-item" data-action="discard">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 18a5 5 0 0 0-10 0"/>
            <path d="M12 14V2"/>
            <path d="M4.93 10.93A17 17 0 0 1 12 9a17 17 0 0 1 7.07 1.93"/>
          </svg>
          <span>休眠标签页</span>
        </div>
        <div class="tf-menu-divider"></div>
        <div class="tf-menu-item" data-action="close-others">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke-dasharray="4 4"/>
          </svg>
          <span>关闭其他标签页</span>
        </div>
        <div class="tf-menu-item" data-action="close-to-right">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="13" y1="6" x2="18" y2="18"/>
            <line x1="18" y1="6" x2="13" y2="18"/>
            <line x1="12" y1="4" x2="12" y2="20"/>
          </svg>
          <span>关闭右侧标签页</span>
        </div>
        <div class="tf-menu-item danger" data-action="close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          <span>关闭标签页</span>
          <span class="tf-menu-shortcut">Del</span>
        </div>
      `;
    } else if (context.type === 'group') {
      return `
        <div class="tf-menu-item" data-action="expand-all">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 3 21 3 21 9"/>
            <polyline points="9 21 3 21 3 15"/>
            <line x1="21" y1="3" x2="14" y2="10"/>
            <line x1="3" y1="21" x2="10" y2="14"/>
          </svg>
          <span>展开所有</span>
        </div>
        <div class="tf-menu-item" data-action="collapse-all">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="4 14 10 14 10 20"/>
            <polyline points="20 10 14 10 14 4"/>
            <line x1="14" y1="10" x2="21" y2="3"/>
            <line x1="3" y1="21" x2="10" y2="14"/>
          </svg>
          <span>折叠所有</span>
        </div>
        <div class="tf-menu-divider"></div>
        <div class="tf-menu-item" data-action="select-all-tabs">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 11l3 3L22 4"/>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
          <span>选中所有标签页</span>
        </div>
        <div class="tf-menu-item" data-action="close-group-tabs">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          <span>关闭分组内标签页</span>
        </div>
        <div class="tf-menu-item" data-action="sleep-group-tabs">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 18a5 5 0 0 0-10 0"/>
            <path d="M12 14V2"/>
            <path d="M4.93 10.93A17 17 0 0 1 12 9a17 17 0 0 1 7.07 1.93"/>
          </svg>
          <span>休眠分组内标签页</span>
        </div>
        <div class="tf-menu-divider"></div>
        <div class="tf-menu-item" data-action="rename-group">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          <span>重命名分组</span>
        </div>
        <div class="tf-menu-item danger" data-action="delete">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          <span>删除分组</span>
        </div>
      `;
    }

    return '';
  }

  filterTabs() {
    const query = this.searchQuery.toLowerCase().trim();
    
    // 初始化搜索引擎（如果尚未初始化）
    if (!this.searchEngine && typeof TabSearchEngine !== 'undefined') {
      this.searchEngine = new TabSearchEngine({
        debounceDelay: 150,
        maxHistoryItems: 20
      });
    }
    
    if (!query) {
      this.hideSearchSuggestions();
      this.updateSearchClearButton(false);
      this.renderGroups();
      return;
    }
    
    this.updateSearchClearButton(true);
    
    // 使用增强的搜索引擎（如果可用）
    if (this.searchEngine) {
      this.performEnhancedSearch(query);
    } else {
      // 降级到原有搜索方式
      this.performLegacySearch(query);
    }
  }

  performEnhancedSearch(query) {
    // 获取所有标签页
    const allTabs = this.getAllTabs();
    
    // 执行增强搜索
    this.searchResults = this.searchEngine.search(allTabs, query, {
      searchFields: ['title', 'alias', 'url', 'note', 'domain'],
      sortBy: 'relevance'
    });
    
    // 按分组重新组织结果
    const filteredGroups = this.organizeResultsByGroups(this.searchResults);
    
    // 渲染过滤结果
    this.renderFilteredResults(filteredGroups);
  }

  performLegacySearch(query) {
    const filteredGroups = this.groups.map(group => ({
      ...group,
      tabs: group.tabs ? group.tabs.filter(tab =>
        tab.title.toLowerCase().includes(query) ||
        ((tab.alias || '').toLowerCase().includes(query)) ||
        tab.url.toLowerCase().includes(query) ||
        (tab.note && tab.note.toLowerCase().includes(query))
      ) : []
    })).filter(group => group.tabs.length > 0);
    
    this.renderFilteredResults(filteredGroups);
  }

  getAllTabs() {
    const tabs = [];
    for (const group of this.groups) {
      if (group.tabs && Array.isArray(group.tabs)) {
        tabs.push(...group.tabs);
      }
    }
    return tabs;
  }

  organizeResultsByGroups(searchResults) {
    if (!searchResults || searchResults.length === 0) {
      return [];
    }
    
    const groupMap = new Map();
    
    for (const result of searchResults) {
      const tab = result.tab;
      const groupId = tab.groupId || 'unknown';
      
      if (!groupMap.has(groupId)) {
        // 查找原始分组信息
        const originalGroup = this.groups.find(g => g.id === groupId);
        groupMap.set(groupId, {
          id: groupId,
          name: originalGroup ? originalGroup.name : (groupId.startsWith('domain_') ? this.getDomainGroupName(groupId) : '其他'),
          type: originalGroup ? originalGroup.type : 'search',
          tabs: []
        });
      }
      
      const group = groupMap.get(groupId);
      group.tabs.push(tab);
    }
    
    return Array.from(groupMap.values());
  }

  getDomainGroupName(groupId) {
    if (!groupId) return '其他';
    const parts = groupId.split('domain_');
    return parts.length > 1 ? parts[1] : '其他';
  }

  renderFilteredResults(filteredGroups) {
    const container = this.elements[`${this.currentGroup}Groups`];
    if (!container) return;
    
    container.innerHTML = '';

    if (filteredGroups.length === 0) {
      container.innerHTML = this.getSearchEmptyState();
      return;
    }
    
    // 显示搜索结果统计
    const totalResults = filteredGroups.reduce((sum, g) => sum + (g.tabs ? g.tabs.length : 0), 0);
    const statsHtml = `
      <div class="tf-search-stats">
        <span class="tf-search-results-count">
          🔍 找到 ${totalResults} 个匹配的标签页
        </span>
      </div>
    `;
    
    const statsContainer = document.createElement('div');
    statsContainer.innerHTML = statsHtml;
    container.appendChild(statsContainer);

    filteredGroups.forEach(group => {
      const groupElement = document.createElement('group-item');
      groupElement.data = group;
      groupElement.selectionMode = this.selectionMode;
      groupElement.selectedTabUuids = this.selectedTabUuids;
      this.bindGroupElementEvents(groupElement);
      container.appendChild(groupElement);
    });
  }

  getSearchEmptyState() {
    const query = this.searchQuery || '';
    return `
      <div class="tf-empty-state">
        <div class="tf-empty-icon">🔍</div>
        <div class="tf-empty-title">未找到匹配的标签页</div>
        <div class="tf-empty-subtitle">没有包含 "${this.escapeHtml(query)}" 的标签页</div>
        <div class="tf-empty-tips">
          <p>💡 提示：</p>
          <ul>
            <li>尝试使用更短的关键词</li>
            <li>使用引号进行精确匹配，如 "GitHub"</li>
            <li>使用 field:value 限定字段，如 title:GitHub</li>
          </ul>
        </div>
      </div>
    `;
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ========== 搜索增强方法 ==========

  handleSearchInput(query) {
    this.searchQuery = query;
    
    // 更新清除按钮状态
    this.updateSearchClearButton(query && query.length > 0);
    
    // 如果有输入内容，显示搜索建议
    if (query && query.length > 0) {
      this.showSearchSuggestions();
    }
    
    // 执行过滤（防抖处理）
    if (this.searchEngine) {
      this.searchEngine.debouncedSearch(
        (results, q) => this.onSearchComplete(results, q),
        this.getAllTabs(),
        query
      );
    } else {
      this.filterTabs();
    }
  }

  onSearchComplete(results, query) {
    // 只有当查询仍然匹配时才更新结果
    if (query === this.searchQuery) {
      this.searchResults = results;
      this.filterTabs();
    }
  }

  updateSearchClearButton(show) {
    if (!this.elements.searchClearBtn) return;
    
    if (show) {
      this.elements.searchClearBtn.classList.remove('tf-hidden');
    } else {
      this.elements.searchClearBtn.classList.add('tf-hidden');
    }
  }

  clearSearch() {
    this.searchQuery = '';
    if (this.elements.searchInput) {
      this.elements.searchInput.value = '';
    }
    this.hideSearchSuggestions();
    this.updateSearchClearButton(false);
    this.searchResults = [];
    this.renderGroups();
    
    if (this.elements.searchInput) {
      this.elements.searchInput.focus();
    }
  }

  showSearchSuggestions() {
    if (!this.elements.searchSuggestions || !this.elements.searchSuggestionsList) return;
    
    // 初始化搜索引擎
    if (!this.searchEngine && typeof TabSearchEngine !== 'undefined') {
      this.searchEngine = new TabSearchEngine({
        debounceDelay: 150,
        maxHistoryItems: 20
      });
    }
    
    if (!this.searchEngine) {
      return;
    }
    
    // 获取建议
    const suggestions = this.searchEngine.getSearchSuggestions(
      this.searchQuery || '',
      this.getAllTabs()
    );
    
    if (suggestions.length === 0 && (!this.searchQuery || this.searchQuery.trim() === '')) {
      // 如果没有输入，显示历史记录
      const history = this.searchEngine.getSearchHistory(8);
      if (history.length > 0) {
        this.renderSearchHistory(history);
        this.elements.searchSuggestions.classList.remove('tf-hidden');
      } else {
        this.hideSearchSuggestions();
      }
      return;
    }
    
    if (suggestions.length === 0) {
      this.hideSearchSuggestions();
      return;
    }
    
    this.renderSearchSuggestions(suggestions);
    this.elements.searchSuggestions.classList.remove('tf-hidden');
  }

  renderSearchHistory(history) {
    if (!this.elements.searchSuggestionsList) return;
    
    // 显示清除历史按钮
    if (this.elements.clearHistoryBtn && history.length > 0) {
      this.elements.clearHistoryBtn.classList.remove('tf-hidden');
    }
    
    this.elements.searchSuggestionsList.innerHTML = history.map((item, index) => `
      <div class="tf-search-suggestion-item" 
           data-index="${index}" 
           data-query="${this.escapeHtml(item.query)}"
           data-type="history">
        <span class="tf-suggestion-icon">🕐</span>
        <span class="tf-suggestion-text">${this.escapeHtml(item.query)}</span>
        <span class="tf-suggestion-meta">${this.formatTimestamp(item.timestamp)}</span>
      </div>
    `).join('');
    
    this.bindSuggestionEvents();
  }

  renderSearchSuggestions(suggestions) {
    if (!this.elements.searchSuggestionsList) return;
    
    // 隐藏清除历史按钮（当有输入时）
    if (this.elements.clearHistoryBtn) {
      this.elements.clearHistoryBtn.classList.add('tf-hidden');
    }
    
    this.elements.searchSuggestionsList.innerHTML = suggestions.map((suggestion, index) => {
      const icon = this.getSuggestionIcon(suggestion.type);
      const label = this.highlightSuggestionText(suggestion.label, this.searchQuery);
      
      return `
        <div class="tf-search-suggestion-item" 
             data-index="${index}" 
             data-query="${this.escapeHtml(suggestion.query)}"
             data-type="${suggestion.type}">
          <span class="tf-suggestion-icon">${icon}</span>
          <span class="tf-suggestion-text">${label}</span>
          <span class="tf-suggestion-type">${this.getSuggestionTypeLabel(suggestion.type)}</span>
        </div>
      `;
    }).join('');
    
    this.bindSuggestionEvents();
  }

  getSuggestionIcon(type) {
    const icons = {
      'history': '🕐',
      'title': '📄',
      'domain': '🌐',
      'note': '📝',
      'url': '🔗'
    };
    return icons[type] || '🔍';
  }

  getSuggestionTypeLabel(type) {
    const labels = {
      'history': '历史',
      'title': '标题',
      'domain': '域名',
      'note': '备注',
      'url': 'URL'
    };
    return labels[type] || '搜索';
  }

  highlightSuggestionText(text, query) {
    if (!query || query.trim() === '') {
      return this.escapeHtml(text);
    }
    
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    
    const index = lowerText.indexOf(lowerQuery);
    if (index === -1) {
      return this.escapeHtml(text);
    }
    
    const before = text.substring(0, index);
    const match = text.substring(index, index + query.length);
    const after = text.substring(index + query.length);
    
    return `${this.escapeHtml(before)}<span class="tf-suggestion-highlight">${this.escapeHtml(match)}</span>${this.escapeHtml(after)}`;
  }

  formatTimestamp(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  bindSuggestionEvents() {
    if (!this.elements.searchSuggestionsList) return;
    
    const items = this.elements.searchSuggestionsList.querySelectorAll('.tf-search-suggestion-item');
    items.forEach(item => {
      item.addEventListener('click', () => {
        const query = item.dataset.query;
        if (query) {
          this.applySuggestion(query);
        }
      });
      
      item.addEventListener('mouseenter', () => {
        items.forEach(i => i.classList.remove('tf-suggestion-active'));
        item.classList.add('tf-suggestion-active');
      });
    });
  }

  applySuggestion(query) {
    if (!query) return;
    
    this.searchQuery = query;
    if (this.elements.searchInput) {
      this.elements.searchInput.value = query;
    }
    
    this.hideSearchSuggestions();
    this.filterTabs();
  }

  hideSearchSuggestions() {
    if (this.elements.searchSuggestions) {
      this.elements.searchSuggestions.classList.add('tf-hidden');
    }
  }

  handleSearchKeyDown(e) {
    const suggestionsList = this.elements.searchSuggestionsList;
    const suggestions = suggestionsList ? 
      suggestionsList.querySelectorAll('.tf-search-suggestion-item') : [];
    
    if (!suggestions || suggestions.length === 0) {
      if (e.key === 'Escape') {
        this.clearSearch();
      }
      return;
    }
    
    let activeIndex = -1;
    suggestions.forEach((item, index) => {
      if (item.classList.contains('tf-suggestion-active')) {
        activeIndex = index;
      }
    });
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        suggestions.forEach(item => item.classList.remove('tf-suggestion-active'));
        if (activeIndex < suggestions.length - 1) {
          suggestions[activeIndex + 1].classList.add('tf-suggestion-active');
        } else {
          suggestions[0].classList.add('tf-suggestion-active');
        }
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        suggestions.forEach(item => item.classList.remove('tf-suggestion-active'));
        if (activeIndex > 0) {
          suggestions[activeIndex - 1].classList.add('tf-suggestion-active');
        } else {
          suggestions[suggestions.length - 1].classList.add('tf-suggestion-active');
        }
        break;
        
      case 'Enter':
        e.preventDefault();
        const activeItem = suggestionsList.querySelector('.tf-suggestion-active');
        if (activeItem && activeItem.dataset.query) {
          this.applySuggestion(activeItem.dataset.query);
        } else {
          // 如果没有选中的建议，直接使用当前输入
          this.hideSearchSuggestions();
          this.filterTabs();
        }
        break;
        
      case 'Escape':
        e.preventDefault();
        if (this.searchQuery && this.searchQuery.length > 0) {
          this.hideSearchSuggestions();
        } else {
          this.clearSearch();
        }
        break;
        
      case 'Tab':
        // Tab 键选择当前高亮的建议
        const highlightedItem = suggestionsList.querySelector('.tf-suggestion-active');
        if (highlightedItem && highlightedItem.dataset.query) {
          e.preventDefault();
          this.applySuggestion(highlightedItem.dataset.query);
        }
        break;
    }
  }

  clearSearchHistory() {
    if (this.searchEngine) {
      this.searchEngine.clearSearchHistory();
    }
    this.hideSearchSuggestions();
  }

  updateStats() {
    this.elements.tabCount.textContent = `${this.tabs.length} 个标签页`;
    this.elements.groupCount.textContent = `${this.groups.length} 个分组`;
  }

  showCreateGroupDialog() {
    if (!this.elements.createGroupModal || !this.elements.createGroupNameInput || !this.elements.createGroupTabList) {
      const groupName = prompt('请输入分组名称:');
      if (groupName && groupName.trim()) {
        this.createGroup(groupName.trim());
      }
      return;
    }

    this.createGroupTabFilterQuery = '';
    this.createGroupSelectedTabUuids = this.selectionMode
      ? new Set(Array.from(this.selectedTabUuids))
      : new Set();

    this.elements.createGroupNameInput.value = '';
    if (this.elements.createGroupTabSearchInput) {
      this.elements.createGroupTabSearchInput.value = '';
    }

    this.renderCreateGroupTabPicker();
    this.elements.createGroupModal.classList.remove('tf-hidden');
    this.elements.createGroupNameInput.focus();
  }

  isCreateGroupModalOpen() {
    return Boolean(this.elements.createGroupModal && !this.elements.createGroupModal.classList.contains('tf-hidden'));
  }

  closeCreateGroupModal() {
    if (!this.elements.createGroupModal) {
      return;
    }
    this.elements.createGroupModal.classList.add('tf-hidden');
    this.createGroupTabFilterQuery = '';
    this.createGroupSelectedTabUuids = new Set();
  }

  getCreateGroupCandidateTabs() {
    const uniqueTabs = new Map();
    (Array.isArray(this.tabs) ? this.tabs : []).forEach((tab) => {
      if (!tab || typeof tab !== 'object' || !tab.uuid) {
        return;
      }
      const groupId = typeof tab.groupId === 'string' ? tab.groupId : '';
      if (groupId.startsWith('custom_')) {
        return;
      }
      if (!uniqueTabs.has(tab.uuid)) {
        uniqueTabs.set(tab.uuid, tab);
      }
    });
    return Array.from(uniqueTabs.values());
  }

  getFilteredCreateGroupTabs() {
    const query = this.createGroupTabFilterQuery.toLowerCase().trim();
    const tabs = this.getCreateGroupCandidateTabs();
    if (!query) {
      return tabs;
    }
    return tabs.filter((tab) => {
      const title = String(tab.alias || tab.title || '').toLowerCase();
      const note = String(tab.note || '').toLowerCase();
      const url = String(tab.url || '').toLowerCase();
      return title.includes(query) || note.includes(query) || url.includes(query);
    });
  }

  renderCreateGroupTabPicker() {
    if (!this.elements.createGroupTabList) {
      return;
    }

    const tabs = this.getFilteredCreateGroupTabs();
    if (tabs.length === 0) {
      this.elements.createGroupTabList.innerHTML = '<div class="tf-create-group-tab-list-empty">暂无可选标签页</div>';
      this.updateCreateGroupSelectionSummary();
      this.syncCreateGroupSelectAllCheckbox();
      return;
    }

    this.elements.createGroupTabList.innerHTML = tabs.map((tab) => {
      const title = this.escapeHtml(tab.alias || tab.title || 'Untitled');
      const url = this.escapeHtml(tab.url || '');
      const note = tab.note ? this.escapeHtml(tab.note) : '';
      const checked = this.createGroupSelectedTabUuids.has(tab.uuid) ? 'checked' : '';

      return `
        <label class="tf-create-group-tab-item">
          <input type="checkbox" class="tf-create-group-tab-checkbox" data-tab-uuid="${this.escapeHtml(tab.uuid)}" ${checked}>
          <div class="tf-create-group-tab-text">
            <div class="tf-create-group-tab-title">${title}</div>
            ${note ? `<div class="tf-create-group-tab-meta">${note}</div>` : ''}
            <div class="tf-create-group-tab-meta">${url}</div>
          </div>
        </label>
      `;
    }).join('');

    this.updateCreateGroupSelectionSummary();
    this.syncCreateGroupSelectAllCheckbox();
  }

  updateCreateGroupSelectionSummary() {
    if (!this.elements.createGroupSelectionSummary) {
      return;
    }
    this.elements.createGroupSelectionSummary.textContent = `已选择 ${this.createGroupSelectedTabUuids.size} 个标签页`;
  }

  syncCreateGroupSelectAllCheckbox() {
    if (!this.elements.createGroupSelectAllCheckbox) {
      return;
    }

    const tabs = this.getFilteredCreateGroupTabs();
    if (tabs.length === 0) {
      this.elements.createGroupSelectAllCheckbox.checked = false;
      this.elements.createGroupSelectAllCheckbox.indeterminate = false;
      return;
    }

    const selectedVisibleCount = tabs.filter(tab => this.createGroupSelectedTabUuids.has(tab.uuid)).length;
    this.elements.createGroupSelectAllCheckbox.checked = selectedVisibleCount === tabs.length;
    this.elements.createGroupSelectAllCheckbox.indeterminate = selectedVisibleCount > 0 && selectedVisibleCount < tabs.length;
  }

  async submitCreateGroupFromModal() {
    const groupName = this.elements.createGroupNameInput?.value?.trim() || '';
    if (!groupName) {
      this.showToast('请输入分组名称', 'info');
      this.elements.createGroupNameInput?.focus();
      return;
    }

    const tabUuids = Array.from(this.createGroupSelectedTabUuids);
    const created = await this.createGroup(groupName, tabUuids);
    if (created) {
      this.closeCreateGroupModal();
    }
  }

  async createGroup(name, tabUuids = []) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'createGroup',
        data: {
          name,
          tabUuids
        }
      });

      if (response.success) {
        const assignedCount = Number.parseInt(response?.data?.assignedCount, 10) || 0;
        this.showToast(
          assignedCount > 0
            ? `分组创建成功，已加入 ${assignedCount} 个标签页`
            : '分组创建成功',
          'success'
        );
        this.refresh();
        return true;
      } else {
        throw new Error(response.error || '创建分组失败');
      }
    } catch (error) {
      console.error('Failed to create group:', error);
      this.showToast('创建分组失败', 'error');
      return false;
    }
  }

  async moveTabToGroup(tabUuid, groupId) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'moveTabToGroup',
        tabUuid,
        groupId
      });

      if (response.success) {
        console.log(`📦 Moved tab ${tabUuid} to group ${groupId}`);
        this.refresh();
      }
    } catch (error) {
      console.error('Failed to move tab:', error);
    }
  }

  showNoteDialog(tabUuid) {
    // Get current note
    const tab = this.tabs.find(t => t.uuid === tabUuid);
    const currentNote = tab ? tab.note || '' : '';

    const note = prompt('请输入备注:', currentNote);
    if (note !== null) {
      this.updateTabNote(tabUuid, note);
    }
  }

  async updateTabNote(tabUuid, note) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'updateTabNote',
        data: {
          tabUuid,
          note
        }
      });

      if (response.success) {
        this.showToast('备注已更新', 'success');
        this.refresh();
      } else {
        throw new Error(response.error || '更新备注失败');
      }
    } catch (error) {
      console.error('Failed to update note:', error);
      this.showToast('更新备注失败', 'error');
    }
  }

  async refresh() {
    await this.loadData();
  }

  toggleSelectionMode() {
    this.selectionMode = !this.selectionMode;
    if (!this.selectionMode) {
      this.selectedTabUuids.clear();
    }
    this.renderGroups();
    this.updateSelectionUI();
  }

  handleTabSelectionChanged(event) {
    const { tabUuid, selected } = event.detail || {};
    if (!tabUuid) return;

    if (selected) {
      this.selectedTabUuids.add(tabUuid);
    } else {
      this.selectedTabUuids.delete(tabUuid);
    }

    this.updateSelectionUI();
  }

  syncSelectionWithTabs() {
    const validTabUuids = new Set((this.tabs || []).map(tab => tab.uuid).filter(Boolean));
    for (const tabUuid of Array.from(this.selectedTabUuids)) {
      if (!validTabUuids.has(tabUuid)) {
        this.selectedTabUuids.delete(tabUuid);
      }
    }
  }

  updateSelectionUI() {
    const selectedCount = this.selectedTabUuids.size;
    const totalTabs = this.getAllTabs().length;
    const allSelected = totalTabs > 0 && selectedCount === totalTabs;
    const someSelected = selectedCount > 0 && selectedCount < totalTabs;
    
    this.elements.selectModeBtn.classList.toggle('active', this.selectionMode);
    
    // 更新批量操作按钮显示
    if (this.elements.batchActions) {
      this.elements.batchActions.classList.toggle('tf-hidden', !this.selectionMode);
    }
    
    // 更新全选按钮状态
    if (this.elements.batchSelectAllBtn) {
      const btnSpan = this.elements.batchSelectAllBtn.querySelector('span');
      if (btnSpan) {
        if (allSelected) {
          btnSpan.textContent = '取消全选';
          this.elements.batchSelectAllBtn.classList.add('active');
        } else {
          btnSpan.textContent = '全选';
          this.elements.batchSelectAllBtn.classList.remove('active');
        }
      }
      
      // 添加部分选中状态
      if (someSelected) {
        this.elements.batchSelectAllBtn.classList.add('partial');
      } else {
        this.elements.batchSelectAllBtn.classList.remove('partial');
      }
    }
    
    // 更新按钮禁用状态和计数
    const buttonsToUpdate = [
      { element: this.elements.batchCloseBtn, label: '关闭' },
      { element: this.elements.batchSleepBtn, label: '休眠' },
      { element: this.elements.batchMoveBtn, label: '移动' },
      { element: this.elements.batchFavoriteBtn, label: '收藏' }
    ];
    
    buttonsToUpdate.forEach(({ element, label }) => {
      if (element) {
        element.disabled = selectedCount === 0;
        const span = element.querySelector('span');
        if (span) {
          span.textContent = selectedCount > 0 ? `${label} (${selectedCount})` : label;
        }
      }
    });
  }

  // ========== 批量操作增强方法 ==========

  toggleSelectAll() {
    const allTabs = this.getAllTabs();
    const totalTabs = allTabs.length;
    const selectedCount = this.selectedTabUuids.size;
    const allSelected = totalTabs > 0 && selectedCount === totalTabs;
    
    if (allSelected) {
      // 取消全选
      this.selectedTabUuids.clear();
    } else {
      // 全选
      allTabs.forEach(tab => {
        if (tab && tab.uuid) {
          this.selectedTabUuids.add(tab.uuid);
        }
      });
    }
    
    this.renderGroups();
    this.updateSelectionUI();
  }

  async closeSelectedTabs() {
    const tabUuids = Array.from(this.selectedTabUuids);
    if (tabUuids.length === 0) {
      this.showToast('请先勾选标签页', 'info');
      return;
    }
    
    const selectedTabs = this.getAllTabs().filter(tab => tabUuids.includes(tab.uuid));
    const normalTabs = selectedTabs.filter(tab => !tab.pinned);
    const pinnedTabs = selectedTabs.filter(tab => tab.pinned);
    
    // 如果有固定标签页，询问用户
    if (pinnedTabs.length > 0) {
      const confirmed = confirm(`您选中了 ${pinnedTabs.length} 个固定标签页，确定要关闭它们吗？\n\n将同时关闭 ${normalTabs.length} 个普通标签页。`);
      if (!confirmed) {
        return;
      }
    }
    
    try {
      // 获取选中标签页的 Chrome tab ID
      const chromeTabIds = [];
      selectedTabs.forEach(tab => {
        if (tab.chromeTabId !== undefined && tab.chromeTabId !== null) {
          chromeTabIds.push(tab.chromeTabId);
        }
      });
      
      // 如果有 Chrome tab ID，直接使用 Chrome API 关闭
      if (chromeTabIds.length > 0 && typeof chrome !== 'undefined' && chrome.tabs) {
        await chrome.tabs.remove(chromeTabIds);
      }
      
      // 通过 background 关闭标签页（包含固定标签页）
      const response = await chrome.runtime.sendMessage({
        action: 'closeTabs',
        data: {
          tabUuids: tabUuids,
          includePinned: pinnedTabs.length > 0
        }
      });
      
      if (response?.success) {
        const closedCount = response.closedCount || tabUuids.length;
        this.showToast(`已关闭 ${closedCount} 个标签页`, 'success');
        
        // 清除选中状态
        this.selectedTabUuids.clear();
        
        // 刷新数据
        await this.loadData();
        this.updateSelectionUI();
      } else {
        throw new Error(response?.error || '关闭标签页失败');
      }
    } catch (error) {
      console.error('Failed to close tabs:', error);
      this.showToast('关闭标签页失败', 'error');
    }
  }

  async sleepSelectedTabs() {
    const tabUuids = Array.from(this.selectedTabUuids);
    if (tabUuids.length === 0) {
      this.showToast('请先勾选标签页', 'info');
      return;
    }
    
    const selectedTabs = this.getAllTabs().filter(tab => tabUuids.includes(tab.uuid));
    const activeTabId = this.getCurrentActiveTabId();
    
    // 过滤掉当前活动标签页（不能休眠当前活动标签页）
    const tabsToSleep = selectedTabs.filter(tab => 
      tab.chromeTabId !== activeTabId
    );
    
    if (tabsToSleep.length === 0) {
      this.showToast('无法休眠当前活动标签页', 'info');
      return;
    }
    
    try {
      // 构建 tabIds 列表
      const chromeTabIds = [];
      tabsToSleep.forEach(tab => {
        if (tab.chromeTabId !== undefined && tab.chromeTabId !== null) {
          chromeTabIds.push(tab.chromeTabId);
        }
      });
      
      // 使用 Chrome API 休眠标签页（如果可用）
      if (chromeTabIds.length > 0 && typeof chrome !== 'undefined' && chrome.tabs) {
        // 使用 discard API 释放标签页内存
        for (const tabId of chromeTabIds) {
          try {
            if (chrome.tabs.discard) {
              await chrome.tabs.discard(tabId);
            }
          } catch (e) {
            console.warn('Failed to discard tab:', e);
          }
        }
      }
      
      // 标记标签页为休眠状态
      const response = await chrome.runtime.sendMessage({
        action: 'sleepTabs',
        data: {
          tabUuids: tabsToSleep.map(t => t.uuid)
        }
      });
      
      if (response?.success) {
        const sleptCount = response.sleptCount || tabsToSleep.length;
        this.showToast(`已休眠 ${sleptCount} 个标签页，释放内存`, 'success');
        
        // 清除选中状态
        this.selectedTabUuids.clear();
        
        // 刷新数据
        await this.loadData();
        this.updateSelectionUI();
      } else {
        throw new Error(response?.error || '休眠标签页失败');
      }
    } catch (error) {
      console.error('Failed to sleep tabs:', error);
      this.showToast('休眠标签页失败', 'error');
    }
  }

  getCurrentActiveTabId() {
    // 获取所有标签页中当前活动的标签页
    const allTabs = this.getAllTabs();
    const activeTabs = allTabs.filter(tab => tab.active);
    return activeTabs.length > 0 ? activeTabs[0].chromeTabId : null;
  }

  async showMoveTabsDialog() {
    const tabUuids = Array.from(this.selectedTabUuids);
    if (tabUuids.length === 0) {
      this.showToast('请先勾选标签页', 'info');
      return;
    }
    
    try {
      // 获取所有窗口信息
      const response = await chrome.runtime.sendMessage({
        action: 'listWindows'
      });
      
      if (!response?.success) {
        throw new Error(response?.error || '无法获取窗口列表');
      }
      
      const windows = Array.isArray(response.data) ? response.data : [];
      
      if (windows.length <= 1) {
        this.showToast('只有一个窗口，无法移动标签页', 'info');
        return;
      }
      
      // 显示窗口选择对话框
      const targetWindow = await this.showWindowSelectionDialog(windows, tabUuids.length);
      
      if (targetWindow) {
        await this.moveSelectedTabsToWindow(tabUuids, targetWindow.id);
      }
    } catch (error) {
      console.error('Failed to show move dialog:', error);
      this.showToast('移动标签页失败', 'error');
    }
  }

  async showWindowSelectionDialog(windows, tabCount) {
    return new Promise((resolve) => {
      // 构建窗口选项
      let windowListHtml = windows.map((win, index) => {
        const tabCountInWindow = win.tabCount || 0;
        const isCurrentWindow = win.focused;
        const windowType = win.type === 'normal' ? '普通窗口' : win.type;
        const activeIndicator = isCurrentWindow ? ' (当前)' : '';
        
        return `
          <div class="tf-window-option ${isCurrentWindow ? 'tf-window-current' : ''}" 
               data-window-id="${win.id}"
               style="padding: 12px; border-bottom: 1px solid var(--tf-border-light); cursor: pointer;">
            <div style="font-weight: 500; color: var(--tf-text-primary);">
              窗口 ${index + 1}${activeIndicator}
            </div>
            <div style="font-size: 12px; color: var(--tf-text-muted); margin-top: 4px;">
              ${tabCountInWindow} 个标签页 · ${windowType}
            </div>
          </div>
        `;
      }).join('');
      
      // 创建对话框
      const dialogHtml = `
        <div id="move-tabs-dialog" class="tf-modal" style="z-index: 10050;">
          <div class="tf-modal-backdrop" data-action="close-move-dialog"></div>
          <div class="tf-modal-panel" style="max-height: 400px;">
            <div class="tf-modal-header">
              <h2>移动 ${tabCount} 个标签页到</h2>
              <button id="move-dialog-close-btn" class="tf-btn tf-btn-icon" type="button">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div class="tf-modal-body" style="padding: 0; overflow-y: auto;">
              ${windowListHtml}
            </div>
            <div class="tf-modal-footer" style="justify-content: flex-end;">
              <button id="move-dialog-cancel-btn" class="tf-btn tf-btn-secondary" type="button">取消</button>
            </div>
          </div>
        </div>
      `;
      
      // 插入到文档
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = dialogHtml;
      const dialog = tempDiv.firstElementChild;
      document.body.appendChild(dialog);
      
      // 绑定事件
      const closeDialog = () => {
        dialog.remove();
        resolve(null);
      };
      
      const selectWindow = (windowId) => {
        const targetWindow = windows.find(w => w.id === parseInt(windowId));
        dialog.remove();
        resolve(targetWindow);
      };
      
      // 点击窗口选项
      const windowOptions = dialog.querySelectorAll('.tf-window-option');
      windowOptions.forEach(option => {
        option.addEventListener('click', () => {
          selectWindow(option.dataset.windowId);
        });
        
        option.addEventListener('mouseenter', () => {
          option.style.background = 'var(--tf-bg-hover)';
        });
        
        option.addEventListener('mouseleave', () => {
          option.style.background = '';
        });
      });
      
      // 关闭按钮
      const closeBtn = dialog.querySelector('#move-dialog-close-btn');
      const cancelBtn = dialog.querySelector('#move-dialog-cancel-btn');
      const backdrop = dialog.querySelector('[data-action="close-move-dialog"]');
      
      if (closeBtn) closeBtn.addEventListener('click', closeDialog);
      if (cancelBtn) cancelBtn.addEventListener('click', closeDialog);
      if (backdrop) backdrop.addEventListener('click', closeDialog);
      
      // ESC 键关闭
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          document.removeEventListener('keydown', handleKeyDown);
          closeDialog();
        }
      };
      document.addEventListener('keydown', handleKeyDown);
    });
  }

  async moveSelectedTabsToWindow(tabUuids, targetWindowId) {
    try {
      const selectedTabs = this.getAllTabs().filter(tab => tabUuids.includes(tab.uuid));
      const chromeTabIds = [];
      
      selectedTabs.forEach(tab => {
        if (tab.chromeTabId !== undefined && tab.chromeTabId !== null) {
          chromeTabIds.push(tab.chromeTabId);
        }
      });
      
      if (chromeTabIds.length === 0) {
        throw new Error('没有可移动的标签页');
      }
      
      // 使用 Chrome API 移动标签页
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        await chrome.tabs.move(chromeTabIds, {
          windowId: targetWindowId,
          index: -1 // 添加到窗口末尾
        });
      }
      
      // 通知 background 更新状态
      await chrome.runtime.sendMessage({
        action: 'moveTabsToWindow',
        data: {
          tabUuids: tabUuids,
          targetWindowId: targetWindowId
        }
      });
      
      this.showToast(`已移动 ${chromeTabIds.length} 个标签页`, 'success');
      
      // 清除选中状态
      this.selectedTabUuids.clear();
      
      // 刷新数据
      await this.loadData();
      this.updateSelectionUI();
      
    } catch (error) {
      console.error('Failed to move tabs:', error);
      this.showToast('移动标签页失败: ' + error.message, 'error');
    }
  }

  // 批量关闭其他标签页（右键菜单使用）
  async closeOtherTabs(currentTabUuid) {
    try {
      const confirmed = confirm('确定要关闭除此标签页以外的所有标签页吗？');
      if (!confirmed) return;
      
      const allTabs = this.getAllTabs();
      const tabsToClose = allTabs.filter(tab => 
        tab.uuid !== currentTabUuid && !tab.pinned
      );
      
      if (tabsToClose.length === 0) {
        this.showToast('没有需要关闭的标签页', 'info');
        return;
      }
      
      const response = await chrome.runtime.sendMessage({
        action: 'closeTabs',
        data: {
          tabUuids: tabsToClose.map(t => t.uuid),
          includePinned: false
        }
      });
      
      if (response?.success) {
        const closedCount = response.closedCount || tabsToClose.length;
        this.showToast(`已关闭 ${closedCount} 个标签页`, 'success');
        await this.loadData();
      }
    } catch (error) {
      console.error('Failed to close other tabs:', error);
      this.showToast('关闭标签页失败', 'error');
    }
  }

  // 批量关闭右侧标签页（右键菜单使用）
  async closeTabsToRight(currentTabUuid) {
    try {
      const confirmed = confirm('确定要关闭此标签页右侧的所有标签页吗？');
      if (!confirmed) return;
      
      const allTabs = this.getAllTabs();
      const currentIndex = allTabs.findIndex(tab => tab.uuid === currentTabUuid);
      
      if (currentIndex === -1) {
        this.showToast('无法找到当前标签页', 'error');
        return;
      }
      
      const tabsToClose = allTabs.slice(currentIndex + 1).filter(tab => !tab.pinned);
      
      if (tabsToClose.length === 0) {
        this.showToast('右侧没有需要关闭的标签页', 'info');
        return;
      }
      
      const response = await chrome.runtime.sendMessage({
        action: 'closeTabs',
        data: {
          tabUuids: tabsToClose.map(t => t.uuid),
          includePinned: false
        }
      });
      
      if (response?.success) {
        const closedCount = response.closedCount || tabsToClose.length;
        this.showToast(`已关闭 ${closedCount} 个标签页`, 'success');
        await this.loadData();
      }
    } catch (error) {
      console.error('Failed to close tabs to right:', error);
      this.showToast('关闭标签页失败', 'error');
    }
  }

  async bookmarkSelectedTabs() {
    const tabUuids = Array.from(this.selectedTabUuids);
    if (tabUuids.length === 0) {
      this.showToast('请先勾选标签页', 'info');
      return;
    }

    try {
      const folderSelection = await this.chooseBookmarkFolder();
      if (!folderSelection) {
        return;
      }

      const response = await chrome.runtime.sendMessage({
        action: 'bookmarkTabs',
        data: {
          tabUuids,
          ...folderSelection
        }
      });

      if (response?.success) {
        const successCount = response.successCount || 0;
        const failedCount = response.failedCount || 0;
        if (response.folderId) {
          this.persistBookmarkFolderId(response.folderId);
        }
        this.showToast(`已转收藏 ${successCount} 个标签页${failedCount > 0 ? `，失败 ${failedCount} 个` : ''}`, failedCount > 0 ? 'error' : 'success');
        this.selectionMode = false;
        this.selectedTabUuids.clear();
        this.renderGroups();
        this.updateSelectionUI();
      } else {
        throw new Error(response?.error || '批量收藏失败');
      }
    } catch (error) {
      console.error('Failed to bookmark selected tabs:', error);
      this.showToast('批量收藏失败', 'error');
    }
  }

  async chooseBookmarkFolder() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'listBookmarkFolders'
      });

      if (!response?.success) {
        throw new Error(response?.error || '无法获取收藏目录');
      }

      const folders = Array.isArray(response.data) ? response.data : [];
      return await this.showBookmarkFolderPicker(folders);
    } catch (error) {
      console.error('Failed to choose bookmark folder:', error);
      this.showToast('获取收藏目录失败', 'error');
      return null;
    }
  }

  isBookmarkModalOpen() {
    return Boolean(this.elements.bookmarkFolderModal && !this.elements.bookmarkFolderModal.classList.contains('tf-hidden'));
  }

  async showBookmarkFolderPicker(folders = []) {
    if (!this.elements.bookmarkFolderModal || !this.elements.bookmarkFolderTree) {
      throw new Error('Bookmark folder modal is unavailable');
    }

    if (this.bookmarkPickerResolver) {
      const previousResolver = this.bookmarkPickerResolver;
      this.bookmarkPickerResolver = null;
      previousResolver(null);
    }

    this.bookmarkPickerFolders = Array.isArray(folders) ? folders : [];
    this.bookmarkPickerTree = this.buildBookmarkFolderTree(this.bookmarkPickerFolders);
    this.bookmarkPickerCollapsedFolderIds = new Set();

    const defaultFolder = this.bookmarkPickerFolders.find(folder => folder.id === this.lastBookmarkFolderId)
      || this.bookmarkPickerFolders[0]
      || null;
    this.bookmarkPickerSelectedFolderId = defaultFolder?.id || '';

    if (this.elements.bookmarkFolderNameInput) {
      this.elements.bookmarkFolderNameInput.value = '';
    }

    this.renderBookmarkFolderTree();
    this.elements.bookmarkFolderModal.classList.remove('tf-hidden');

    return new Promise((resolve) => {
      this.bookmarkPickerResolver = resolve;
    });
  }

  closeBookmarkFolderPicker(result = null) {
    if (this.elements.bookmarkFolderModal) {
      this.elements.bookmarkFolderModal.classList.add('tf-hidden');
    }

    const resolver = this.bookmarkPickerResolver;
    this.bookmarkPickerResolver = null;
    this.bookmarkPickerFolders = [];
    this.bookmarkPickerTree = [];
    this.bookmarkPickerSelectedFolderId = '';
    this.bookmarkPickerCollapsedFolderIds = new Set();

    if (typeof resolver === 'function') {
      resolver(result);
    }
  }

  buildBookmarkFolderTree(folders = []) {
    const nodesById = new Map();
    const orderById = new Map();

    folders.forEach((folder, index) => {
      if (!folder || typeof folder.id !== 'string') {
        return;
      }
      orderById.set(folder.id, index);
      nodesById.set(folder.id, {
        id: folder.id,
        title: typeof folder.title === 'string' && folder.title.trim() ? folder.title.trim() : '未命名文件夹',
        parentId: typeof folder.parentId === 'string' ? folder.parentId : '',
        children: []
      });
    });

    const roots = [];
    nodesById.forEach((node) => {
      if (node.parentId && nodesById.has(node.parentId)) {
        nodesById.get(node.parentId).children.push(node);
      } else {
        roots.push(node);
      }
    });

    const sortNodes = (nodes) => {
      nodes.sort((a, b) => {
        const aOrder = orderById.has(a.id) ? orderById.get(a.id) : Number.MAX_SAFE_INTEGER;
        const bOrder = orderById.has(b.id) ? orderById.get(b.id) : Number.MAX_SAFE_INTEGER;
        return aOrder - bOrder;
      });
      nodes.forEach(childNode => sortNodes(childNode.children));
    };
    sortNodes(roots);
    return roots;
  }

  renderBookmarkFolderTree() {
    if (!this.elements.bookmarkFolderTree) {
      return;
    }

    if (this.bookmarkPickerTree.length === 0) {
      this.elements.bookmarkFolderTree.innerHTML = '<div class="tf-folder-tree-empty">暂无可用目录，请新建后收藏</div>';
      if (this.elements.bookmarkModalConfirmBtn) {
        this.elements.bookmarkModalConfirmBtn.disabled = true;
      }
      return;
    }

    const html = `
      <ul class="tf-folder-tree-list">
        ${this.bookmarkPickerTree.map(node => this.renderBookmarkFolderNode(node)).join('')}
      </ul>
    `;
    this.elements.bookmarkFolderTree.innerHTML = html;

    if (this.elements.bookmarkModalConfirmBtn) {
      this.elements.bookmarkModalConfirmBtn.disabled = !this.bookmarkPickerSelectedFolderId;
    }
  }

  renderBookmarkFolderNode(node) {
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    const isCollapsed = hasChildren && this.bookmarkPickerCollapsedFolderIds.has(node.id);
    const isSelected = this.bookmarkPickerSelectedFolderId === node.id;

    return `
      <li class="tf-folder-node">
        <div class="tf-folder-row">
          <button
            type="button"
            class="tf-folder-toggle ${hasChildren ? '' : 'tf-folder-toggle-empty'} ${hasChildren && !isCollapsed ? 'expanded' : ''}"
            data-folder-toggle-id="${this.escapeHtml(node.id)}"
            ${hasChildren ? '' : 'disabled'}
            aria-label="${hasChildren ? (isCollapsed ? '展开目录' : '折叠目录') : '无子目录'}"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="8 5 16 12 8 19"></polyline>
            </svg>
          </button>
          <label class="tf-folder-label">
            <input
              type="checkbox"
              class="tf-folder-checkbox"
              data-folder-id="${this.escapeHtml(node.id)}"
              ${isSelected ? 'checked' : ''}
            >
            <span class="tf-folder-label-text">${this.escapeHtml(node.title)}</span>
          </label>
        </div>
        ${hasChildren ? `
          <ul class="tf-folder-children ${isCollapsed ? 'is-collapsed' : ''}">
            ${node.children.map(child => this.renderBookmarkFolderNode(child)).join('')}
          </ul>
        ` : ''}
      </li>
    `;
  }

  toggleBookmarkFolderNode(folderId) {
    if (!folderId) {
      return;
    }

    if (this.bookmarkPickerCollapsedFolderIds.has(folderId)) {
      this.bookmarkPickerCollapsedFolderIds.delete(folderId);
    } else {
      this.bookmarkPickerCollapsedFolderIds.add(folderId);
    }
    this.renderBookmarkFolderTree();
  }

  handleBookmarkFolderCheckboxChange(checkbox) {
    const folderId = checkbox?.dataset?.folderId;
    if (!folderId) {
      return;
    }

    this.bookmarkPickerSelectedFolderId = checkbox.checked ? folderId : '';
    this.renderBookmarkFolderTree();
  }

  confirmBookmarkFolderSelection() {
    if (!this.bookmarkPickerSelectedFolderId) {
      this.showToast('请勾选一个收藏目录', 'info');
      return;
    }

    this.closeBookmarkFolderPicker({
      folderId: this.bookmarkPickerSelectedFolderId
    });
  }

  createBookmarkFolderFromModal() {
    if (!this.elements.bookmarkFolderNameInput) {
      this.showToast('目录输入框不可用', 'error');
      return;
    }

    const folderName = this.elements.bookmarkFolderNameInput.value.trim();
    if (!folderName) {
      this.showToast('请输入新目录名称', 'info');
      return;
    }

    this.closeBookmarkFolderPicker({
      createFolderName: folderName
    });
  }

  getPersistedBookmarkFolderId() {
    try {
      return localStorage.getItem('tabflow:lastBookmarkFolderId') || '';
    } catch (error) {
      return '';
    }
  }

  persistBookmarkFolderId(folderId) {
    if (!folderId) {
      return;
    }
    this.lastBookmarkFolderId = folderId;
    try {
      localStorage.setItem('tabflow:lastBookmarkFolderId', folderId);
    } catch (error) {
      // Ignore storage exceptions.
    }
  }

  bindGroupElementEvents(groupElement) {
    groupElement.addEventListener('group-open-request', (e) => {
      const group = e?.detail?.group;
      if (!group) {
        return;
      }
      if (this.shouldOpenGroupInStandaloneTab()) {
        e.preventDefault();
        this.openGroupInStandaloneTab(group);
      }
    });

    groupElement.addEventListener('show-context-menu', (e) => {
      const detail = e?.detail || {};
      const tab = detail.tab || {};
      this.showContextMenu(detail.x || 0, detail.y || 0, {
        type: 'tab',
        data: {
          id: tab.id,
          uuid: tab.uuid,
          tabId: tab.id,
          tabUuid: tab.uuid,
          url: tab.url
        }
      });
    });

    groupElement.addEventListener('show-group-menu', (e) => {
      const group = e?.detail?.group;
      const element = e?.detail?.element;
      if (!group || !element) {
        return;
      }
      const rect = element.getBoundingClientRect();
      this.showContextMenu(rect.right - 20, rect.top + 10, {
        type: 'group',
        data: group
      });
    });

    groupElement.addEventListener('group-moved-tab', () => {
      this.refresh();
    });

    groupElement.addEventListener('tab-selection-changed', (e) => {
      this.handleTabSelectionChanged(e);
    });

    groupElement.addEventListener('group-toggle-collapse', (e) => {
      console.log('分组折叠状态改变:', e.detail);
    });

    groupElement.addEventListener('tab-closed', () => {
      this.syncSelectionWithTabs();
      this.updateSelectionUI();
      this.refresh();
    });

    groupElement.addEventListener('tab-renamed', () => {
      this.refresh();
    });

    groupElement.addEventListener('group-deleted', (e) => {
      const deletedCount = e?.detail?.tabIds?.length || 0;
      this.showToast(`已删除分组并关闭 ${deletedCount} 个标签页`, 'success');
      this.refresh();
    });
  }

  openSettings() {
    chrome.runtime.openOptionsPage();
  }

  showLoading(show) {
    this.isLoading = show;
    this.elements.loadingOverlay.classList.toggle('tf-hidden', !show);
  }

  showError(message) {
    this.showToast(message, 'error');
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `tf-toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger reflow
    toast.offsetHeight;

    // Show toast
    toast.classList.add('show');

    // Remove after delay
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  getEmptyStateHTML() {
    if (this.singleGroupMode && this.focusGroupId) {
      return '<div class="tf-empty-state"><p>未找到该分组或分组暂无标签页</p></div>';
    }

    const messages = {
      domain: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg><p>暂无按域名分组的标签页</p>',
      date: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><p>暂无按时间分组的标签页</p>',
      custom: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg><p>暂无自定义分组</p><p class="hint">点击下方按钮创建分组</p>',
      session: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg><p>暂无会话分组</p>'
    };

    return `<div class="tf-empty-state">${messages[this.currentGroup] || '<p>暂无数据</p>'}</div>`;
  }

  parseRouteParams() {
    const params = new URLSearchParams(window.location.search || '');
    const groupType = params.get('groupType');
    const validGroupTypes = new Set(['domain', 'date', 'custom', 'session']);
    const normalizedGroupType = validGroupTypes.has(groupType) ? groupType : 'domain';
    const groupId = (params.get('groupId') || '').trim();
    const singleGroupRaw = (params.get('singleGroup') || '').trim().toLowerCase();
    const displayMode = (params.get('display') || '').trim().toLowerCase();

    return {
      groupType: normalizedGroupType,
      groupId,
      singleGroup: singleGroupRaw === '1' || singleGroupRaw === 'true',
      displayMode: displayMode === 'tab' ? 'tab' : 'sidebar'
    };
  }

  syncGroupTypeUI() {
    this.elements.groupButtons.forEach(btn => {
      const isActive = btn.dataset.group === this.currentGroup;
      btn.classList.toggle('active', isActive);
    });

    this.elements.groupContainers.forEach(container => {
      const isActive = container.id === `${this.currentGroup}-groups`;
      container.classList.toggle('active', isActive);
    });
  }

  applyStandaloneLayout() {
    if (!this.singleGroupMode) {
      return;
    }

    if (this.elements.groupSelector) {
      this.elements.groupSelector.classList.add('tf-hidden');
    }
  }

  applyGroupScope() {
    if (!this.singleGroupMode || !this.focusGroupId) {
      return;
    }

    const targetGroupId = String(this.focusGroupId);
    this.groups = (Array.isArray(this.groups) ? this.groups : []).filter(
      group => String(group?.id || '') === targetGroupId
    );

    if (this.groups.length === 0) {
      this.tabs = [];
      return;
    }

    const visibleTabUuids = new Set(
      (this.groups[0].tabs || [])
        .map(tab => tab?.uuid)
        .filter(Boolean)
    );
    this.tabs = (Array.isArray(this.tabs) ? this.tabs : []).filter(tab => visibleTabUuids.has(tab?.uuid));
  }

  async loadDisplayPreferences() {
    try {
      const response = await this.sendMessageWithRetry({
        action: 'getPrivacySettings'
      });
      if (response?.success) {
        this.updateDisplayPreferenceFromSettings(response.data);
      }
    } catch (error) {
      console.warn('Failed to load display preferences, fallback to sidebar mode:', error);
    }
  }

  updateDisplayPreferenceFromSettings(rawSettings) {
    const mode = rawSettings?.preferences?.groupDisplayMode;
    this.groupDisplayMode = mode === 'tab' ? 'tab' : 'sidebar';
  }

  shouldOpenGroupInStandaloneTab() {
    return this.groupDisplayMode === 'tab' && !this.isStandaloneTabView;
  }

  async openGroupInStandaloneTab(group) {
    if (!group?.id) {
      return;
    }

    try {
      const url = new URL(chrome.runtime.getURL('ui/sidebar/sidebar.html'));
      url.searchParams.set('groupType', this.currentGroup);
      url.searchParams.set('groupId', String(group.id));
      url.searchParams.set('singleGroup', '1');
      url.searchParams.set('display', 'tab');
      await chrome.tabs.create({ url: url.toString(), active: true });
    } catch (error) {
      console.error('Failed to open group in standalone tab:', error);
      this.showToast('打开分组页失败', 'error');
    }
  }

  getGroupIcon(type) {
    const icons = {
      domain: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
      date: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
      custom: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
      session: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
      content: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
    };

    return icons[type] || icons.content;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  handleMessage(request, sender, sendResponse) {
    if (!request || typeof request !== 'object') {
      if (typeof sendResponse === 'function') {
        sendResponse({ success: false, error: 'Invalid message payload' });
      }
      return;
    }

    const { action, data } = request;

    switch (action) {
      case 'refresh':
        this.refresh();
        if (typeof sendResponse === 'function') {
          sendResponse({ success: true });
        }
        break;
      case 'show-toast':
        this.showToast(data.message, data.type);
        if (typeof sendResponse === 'function') {
          sendResponse({ success: true });
        }
        break;
      default:
        // Ignore unknown actions so runtime request/response can be handled by background.
        return;
    }
  }
}

// Initialize sidebar when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎯 SuperTab Sidebar initializing...');
  window.sidebar = new SuperTabSidebar();
  console.log('✅ SuperTab Sidebar initialized');
});

// Export for debugging
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SuperTabSidebar;
}
