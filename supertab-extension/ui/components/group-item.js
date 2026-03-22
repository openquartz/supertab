// ui/components/group-item.js
class GroupItem extends HTMLElement {
  constructor() {
    super();
    this.groupData = null;
    this.collapsed = false;
    this._selectionMode = false;
    this._selectedTabUuids = new Set();
  }

  connectedCallback() {}

  set data(groupData) {
    this.groupData = groupData;
    this.collapsed = groupData.collapsed || false;
    this.render();
  }

  get data() {
    return this.groupData;
  }

  set selectionMode(value) {
    this._selectionMode = Boolean(value);
    this.syncTabSelectionState();
  }

  get selectionMode() {
    return this._selectionMode;
  }

  set selectedTabUuids(value) {
    this._selectedTabUuids = value instanceof Set ? value : new Set();
    this.syncTabSelectionState();
  }

  get selectedTabUuids() {
    return this._selectedTabUuids;
  }

  render() {
    if (!this.groupData) return;

    const iconSvg = this.getGroupIcon();
    const tabCount = this.groupData.tabs?.length || 0;
    const chevronSvg = this.collapsed
      ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>'
      : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>';

    this.innerHTML = `
      <div class="tf-group-header">
        <button class="tf-group-open" type="button" data-action="open-group" aria-label="查看分组">
          <span class="tf-group-title">
            <span class="tf-group-icon">${iconSvg}</span>
            <span class="tf-group-name">${this.escapeHtml(this.groupData.name)}</span>
            <span class="tf-group-count">${tabCount}</span>
          </span>
        </button>
        <div class="tf-group-actions">
          <button class="tf-btn tf-btn-icon tf-group-collapse" title="${this.collapsed ? '展开' : '折叠'}" data-action="toggle-collapse" aria-label="${this.collapsed ? '展开' : '折叠'}">
            ${chevronSvg}
          </button>
          <button class="tf-btn tf-btn-icon tf-group-delete" title="删除分组并关闭全部标签页" data-action="delete-group" aria-label="删除分组并关闭全部标签页">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
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
      <div class="tf-group-content" ${this.collapsed ? 'style="display: none;"' : ''}>
        <div class="tf-empty-state">加载中...</div>
      </div>
    `;

    this.setupEventListeners();
    this.renderTabItems();
  }

  setupEventListeners() {
    this.addEventListener('click', (e) => {
      const actionElement = e.target.closest('[data-action]');
      if (actionElement) {
        e.stopPropagation();
        const action = actionElement.dataset.action;
        this.handleAction(action);
      }
    });

    // 拖拽放置
    this.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      this.classList.add('drag-over');
    });

    this.addEventListener('dragleave', () => {
      this.classList.remove('drag-over');
    });

    this.addEventListener('drop', (e) => {
      e.preventDefault();
      this.classList.remove('drag-over');

      const tabUuid = e.dataTransfer.getData('text/plain');
      if (tabUuid) {
        this.moveTabToGroup(tabUuid);
      }
    });
  }

  renderTabItems() {
    const content = this.querySelector('.tf-group-content');
    if (!content) return;

    const tabs = Array.isArray(this.groupData.tabs)
      ? this.groupData.tabs.filter(tab => tab && typeof tab === 'object')
      : [];

    if (tabs.length === 0) {
      content.innerHTML = '<div class="tf-empty-state">暂无标签页</div>';
      return;
    }

    content.innerHTML = '';
    const fragment = document.createDocumentFragment();

    tabs.forEach(tab => {
      const tabItem = document.createElement('tab-item');
      tabItem.data = tab;
      tabItem.selectionMode = this._selectionMode;
      tabItem.selected = this._selectedTabUuids.has(tab.uuid);
      fragment.appendChild(tabItem);
    });

    content.appendChild(fragment);
  }

  syncTabSelectionState() {
    const tabItems = this.querySelectorAll('tab-item');
    tabItems.forEach(tabItem => {
      tabItem.selectionMode = this._selectionMode;
      const tabUuid = tabItem.data?.uuid;
      tabItem.selected = tabUuid ? this._selectedTabUuids.has(tabUuid) : false;
    });
  }

  handleAction(action) {
    switch (action) {
      case 'open-group':
        this.requestGroupOpen();
        break;
      case 'toggle-collapse':
        this.toggleCollapse();
        break;
      case 'delete-group':
        this.deleteGroup();
        break;
      case 'show-menu':
        this.showGroupMenu();
        break;
    }
  }

  requestGroupOpen() {
    const openEvent = new CustomEvent('group-open-request', {
      detail: {
        group: this.groupData,
        element: this
      },
      bubbles: true,
      cancelable: true
    });

    const shouldContinueDefault = this.dispatchEvent(openEvent);
    if (shouldContinueDefault) {
      this.toggleCollapse();
    }
  }

  toggleCollapse() {
    this.collapsed = !this.collapsed;

    const content = this.querySelector('.tf-group-content');
    const button = this.querySelector('.tf-group-collapse');

    const chevronSvg = this.collapsed
      ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>'
      : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>';

    if (this.collapsed) {
      content.style.display = 'none';
    } else {
      content.style.display = '';
    }
    button.innerHTML = chevronSvg;
    button.setAttribute('aria-label', this.collapsed ? '展开' : '折叠');

    // 更新数据
    this.groupData.collapsed = this.collapsed;

    // 保存到存储
    this.saveGroupData();

    // 触发事件
    this.dispatchEvent(new CustomEvent('group-toggle-collapse', {
      detail: { groupId: this.groupData.id, collapsed: this.collapsed },
      bubbles: true
    }));
  }

  async moveTabToGroup(tabUuid) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'moveTabToGroup',
        tabUuid,
        groupId: this.groupData.id
      });

      if (response.success) {
        // 触发刷新事件
        this.dispatchEvent(new CustomEvent('group-moved-tab', {
          detail: { tabUuid, groupId: this.groupData.id },
          bubbles: true
        }));
      }
    } catch (error) {
      console.error('移动标签页失败:', error);
    }
  }

  showGroupMenu() {
    this.dispatchEvent(new CustomEvent('show-group-menu', {
      detail: { group: this.groupData, element: this },
      bubbles: true
    }));
  }

  async saveGroupData() {
    try {
      await chrome.runtime.sendMessage({
        action: 'updateGroup',
        group: this.groupData
      });
    } catch (error) {
      console.error('保存分组数据失败:', error);
    }
  }

  async deleteGroup() {
    const tabIds = Array.from(new Set(
      (this.groupData.tabs || [])
        .map(tab => Number.parseInt(tab?.id, 10))
        .filter(Number.isInteger)
    ));
    const tabCount = tabIds.length;

    const confirmed = confirm(`确定删除分组 "${this.groupData.name}" 并关闭其中 ${tabCount} 个标签页吗？`);
    if (!confirmed) {
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'deleteGroup',
        data: {
          groupId: this.groupData.id,
          tabIds
        }
      });

      if (response?.success) {
        this.dispatchEvent(new CustomEvent('group-deleted', {
          detail: { groupId: this.groupData.id, tabIds },
          bubbles: true
        }));
      }
    } catch (error) {
      console.error('删除分组失败:', error);
    }
  }

  getGroupIcon() {
    switch (this.groupData.type) {
      case 'domain':
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
      case 'date':
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
      case 'custom':
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
      default:
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

if (!customElements.get('group-item')) {
  customElements.define('group-item', GroupItem);
}
