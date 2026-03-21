// ui/components/tab-item.js
class TabItem extends HTMLElement {
  constructor() {
    super();
    this.tabData = null;
    this.listenersBound = false;
    this._selectionMode = false;
    this._selected = false;
    this.setupEventListeners();
  }

  set data(tabData) {
    this.tabData = tabData;
    this.render();
  }

  get data() {
    return this.tabData;
  }

  set selectionMode(value) {
    this._selectionMode = Boolean(value);
    this.render();
  }

  get selectionMode() {
    return this._selectionMode;
  }

  set selected(value) {
    this._selected = Boolean(value);
    this.render();
  }

  get selected() {
    return this._selected;
  }

  render() {
    if (!this.tabData) return;
    this.classList.add('tf-tab');
    this.dataset.tabId = this.tabData.id != null ? String(this.tabData.id) : '';
    this.dataset.tabUuid = this.tabData.uuid || '';

    const title = this.tabData.title || 'Untitled';
    const alias = (this.tabData.alias || '').trim();
    const displayTitle = alias || title;
    const url = this.tabData.url || '';

    const fallbackIcon = `
      <div class="fallback-icon">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
        </svg>
      </div>
    `;

    const hasFavicon = Boolean(this.tabData.favicon);

    this.innerHTML = `
      <label class="tf-tab-select ${this.selectionMode ? '' : 'tf-hidden'}">
        <input class="tf-tab-select-checkbox" type="checkbox" ${this.selected ? 'checked' : ''} aria-label="选择标签页">
      </label>
      <div class="tf-tab-favicon">
        ${hasFavicon ? `<img class="tf-tab-favicon-img" src="${this.tabData.favicon}" alt="">` : fallbackIcon}
      </div>
      <div class="tf-tab-content">
        <div class="tf-tab-title">${this.escapeHtml(displayTitle)}</div>
        ${alias ? `<div class="tf-tab-url">${this.escapeHtml(title)}</div>` : ''}
        ${this.tabData.note ? `<div class="tf-tab-note">${this.escapeHtml(this.tabData.note)}</div>` : ''}
        <div class="tf-tab-url">${this.escapeHtml(url)}</div>
      </div>
      <div class="tf-tab-actions">
        <button class="tf-btn tf-btn-icon tf-tab-rename-btn" title="重命名" data-action="rename-tab" aria-label="重命名">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9"/>
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>
          </svg>
        </button>
        <button class="tf-btn tf-btn-icon tf-tab-note-btn" title="添加备注" data-action="add-note" aria-label="添加备注">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="tf-btn tf-btn-icon tf-tab-close-btn" title="关闭" data-action="close-tab" aria-label="关闭">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `;

    this.bindFaviconFallback();
    this.setupTabEventListeners();
  }

  setupTabEventListeners() {
    if (this.listenersBound) return;
    this.listenersBound = true;

    this.addEventListener('click', (e) => {
      if (e.target.closest('.tf-tab-select-checkbox')) {
        e.stopPropagation();
        const checkbox = e.target.closest('.tf-tab-select-checkbox');
        this.setSelected(checkbox.checked, true);
        return;
      }

      if (e.target.closest('[data-action]')) {
        e.stopPropagation();
        const action = e.target.closest('[data-action]').dataset.action;
        this.handleAction(action);
      } else if (this.selectionMode) {
        this.setSelected(!this.selected, true);
      } else {
        this.activateTab();
      }
    });

    this.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showContextMenu(e);
    });

    // 拖拽功能
    this.draggable = true;
    this.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', this.tabData.uuid);
      e.dataTransfer.effectAllowed = 'move';
      this.classList.add('dragging');
    });

    this.addEventListener('dragend', () => {
      this.classList.remove('dragging');
    });
  }

  bindFaviconFallback() {
    const faviconImg = this.querySelector('.tf-tab-favicon-img');
    if (!faviconImg) return;

    faviconImg.addEventListener('error', () => {
      faviconImg.remove();
      const faviconContainer = this.querySelector('.tf-tab-favicon');
      if (faviconContainer && !faviconContainer.querySelector('.fallback-icon')) {
        faviconContainer.insertAdjacentHTML('beforeend', `
          <div class="fallback-icon">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
          </div>
        `);
      }
    }, { once: true });
  }

  async activateTab() {
    try {
      await chrome.runtime.sendMessage({
        action: 'activateTab',
        tabId: this.tabData.id
      });
    } catch (error) {
      console.error('激活标签页失败:', error);
    }
  }

  handleAction(action) {
    switch (action) {
      case 'rename-tab':
        this.showRenameDialog();
        break;
      case 'add-note':
        this.showNoteDialog();
        break;
      case 'close-tab':
        this.closeTab();
        break;
    }
  }

  showNoteDialog() {
    const note = prompt('请输入备注:', this.tabData.note || '');
    if (note !== null) {
      this.updateNote(note);
    }
  }

  async updateNote(note) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'updateTabNote',
        data: {
          tabUuid: this.tabData.uuid,
          note
        }
      });

      if (response.success) {
        this.tabData.note = note;
        this.render();
      }
    } catch (error) {
      console.error('更新备注失败:', error);
    }
  }

  async closeTab() {
    try {
      const tabId = Number.parseInt(this.tabData?.id, 10);
      if (!Number.isInteger(tabId)) {
        console.warn('关闭标签页失败：无效 tabId', this.tabData?.id);
        return;
      }

      const response = await chrome.runtime.sendMessage({
        action: 'closeTab',
        tabId,
        data: {
          tabId
        }
      });

      if (response?.success) {
        this.dispatchEvent(new CustomEvent('tab-closed', {
          detail: { tabId, tabUuid: this.tabData.uuid },
          bubbles: true
        }));
      } else {
        console.error('关闭标签页失败:', response?.error || 'unknown error');
      }
    } catch (error) {
      console.error('关闭标签页失败:', error);
    }
  }

  showRenameDialog() {
    const alias = prompt('请输入备注名（留空恢复原标题）:', this.tabData.alias || this.tabData.title || '');
    if (alias === null) {
      return;
    }

    this.updateAlias(alias);
  }

  async updateAlias(alias) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'updateTabAlias',
        data: {
          tabUuid: this.tabData.uuid,
          alias: alias.trim()
        }
      });

      if (response?.success) {
        this.tabData.alias = alias.trim();
        this.render();
        this.dispatchEvent(new CustomEvent('tab-renamed', {
          detail: { tabUuid: this.tabData.uuid, alias: this.tabData.alias },
          bubbles: true
        }));
      }
    } catch (error) {
      console.error('重命名标签页失败:', error);
    }
  }

  setSelected(value, emitEvent = false) {
    const nextValue = Boolean(value);
    if (this._selected === nextValue && !emitEvent) {
      return;
    }

    this._selected = nextValue;
    this.render();

    if (emitEvent) {
      this.dispatchEvent(new CustomEvent('tab-selection-changed', {
        detail: {
          tabUuid: this.tabData.uuid,
          selected: this._selected
        },
        bubbles: true
      }));
    }
  }

  showContextMenu(event) {
    // 触发自定义事件，由sidebar.js处理
    this.dispatchEvent(new CustomEvent('show-context-menu', {
      detail: { tab: this.tabData, x: event.clientX, y: event.clientY },
      bubbles: true
    }));
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  setupEventListeners() {
    // 组件通用事件监听
  }
}

// 注册自定义元素
if (!customElements.get('tab-item')) {
  customElements.define('tab-item', TabItem);
}
