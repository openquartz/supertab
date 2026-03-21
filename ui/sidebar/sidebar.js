// SuperTab Sidebar - Main UI logic

class SuperTabSidebar {
  constructor() {
    this.currentGroup = 'domain';
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

    this.initializeElements();
    this.setupEventListeners();
    this.loadData();
  }

  initializeElements() {
    this.elements = {
      searchInput: document.getElementById('search-input'),
      groupButtons: document.querySelectorAll('.tf-group-btn'),
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
      bookmarkCreateFolderBtn: document.getElementById('bookmark-create-folder-btn')
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
    // Search functionality
    this.elements.searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.filterTabs();
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

    // Global event listeners
    document.addEventListener('click', (e) => {
      if (!this.contextMenu.contains(e.target)) {
        this.hideContextMenu();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
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
        this.syncSelectionWithTabs();
        this.renderGroups();
        this.updateStats();
        this.updateSelectionUI();
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
    this.contextMenu.classList.remove('visible');
    setTimeout(() => {
      this.contextMenu.classList.add('tf-hidden');
    }, 200);
  }

  getContextMenuHTML(context) {
    if (context.type === 'tab') {
      return `
        <div class="tf-menu-item" data-action="activate">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 16 16 12 12 8"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
          <span>切换到标签页</span>
        </div>
        <div class="tf-menu-item" data-action="add-note">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          <span>添加备注</span>
        </div>
        <div class="tf-menu-item" data-action="move-to-group">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <span>移动到分组</span>
        </div>
        <div class="tf-menu-item" data-action="copy-url">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          <span>复制链接</span>
        </div>
        <div class="tf-menu-divider"></div>
        <div class="tf-menu-item danger" data-action="close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          <span>关闭标签页</span>
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
    if (!query) {
      this.renderGroups();
      return;
    }

    // Filter groups based on search query
    const filteredGroups = this.groups.map(group => ({
      ...group,
      tabs: group.tabs ? group.tabs.filter(tab =>
        tab.title.toLowerCase().includes(query) ||
        ((tab.alias || '').toLowerCase().includes(query)) ||
        tab.url.toLowerCase().includes(query) ||
        (tab.note && tab.note.toLowerCase().includes(query))
      ) : []
    })).filter(group => group.tabs.length > 0);

    // Render filtered results
    const container = this.elements[`${this.currentGroup}Groups`];
    container.innerHTML = '';

    if (filteredGroups.length === 0) {
      container.innerHTML = '<div class="tf-empty-state">🔍 未找到匹配的标签页</div>';
      return;
    }

    filteredGroups.forEach(group => {
      const groupElement = document.createElement('group-item');
      groupElement.data = group;
      groupElement.selectionMode = this.selectionMode;
      groupElement.selectedTabUuids = this.selectedTabUuids;
      this.bindGroupElementEvents(groupElement);
      container.appendChild(groupElement);
    });
  }

  updateStats() {
    this.elements.tabCount.textContent = `${this.tabs.length} 个标签页`;
    this.elements.groupCount.textContent = `${this.groups.length} 个分组`;
  }

  showCreateGroupDialog() {
    const groupName = prompt('请输入分组名称:');
    if (groupName && groupName.trim()) {
      this.createGroup(groupName.trim());
    }
  }

  async createGroup(name) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'createGroup',
        name
      });

      if (response.success) {
        this.showToast('分组创建成功', 'success');
        this.refresh();
      } else {
        throw new Error(response.error || '创建分组失败');
      }
    } catch (error) {
      console.error('Failed to create group:', error);
      this.showToast('创建分组失败', 'error');
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
    this.elements.selectModeBtn.classList.toggle('active', this.selectionMode);
    this.elements.batchFavoriteBtn.classList.toggle('tf-hidden', !this.selectionMode);
    this.elements.batchFavoriteBtn.disabled = selectedCount === 0;
    this.elements.batchFavoriteBtn.querySelector('span').textContent = `转收藏选中 (${selectedCount})`;
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
    const messages = {
      domain: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg><p>暂无按域名分组的标签页</p>',
      date: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><p>暂无按时间分组的标签页</p>',
      custom: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg><p>暂无自定义分组</p><p class="hint">点击下方按钮创建分组</p>',
      session: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg><p>暂无会话分组</p>'
    };

    return `<div class="tf-empty-state">${messages[this.currentGroup] || '<p>暂无数据</p>'}</div>`;
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
