// ui/components/context-menu.js
class ContextMenu {
  constructor() {
    this.menu = null;
    this.currentTarget = null;
    this.setupMenu();
    this.setupGlobalListeners();
  }

  setupMenu() {
    this.menu = document.createElement('div');
    this.menu.id = 'context-menu';
    this.menu.className = 'tf-context-menu tf-hidden';
    this.menu.innerHTML = `
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
      <div class="tf-menu-item tf-menu-item-danger" data-action="delete-tab">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
        <span>关闭标签页</span>
      </div>
    `;

    document.body.appendChild(this.menu);
  }

  setupGlobalListeners() {
    // 隐藏菜单
    document.addEventListener('click', (e) => {
      if (!this.menu.contains(e.target)) {
        this.hide();
      }
    });

    document.addEventListener('scroll', () => {
      this.hide();
    });

    // 菜单项点击
    this.menu.addEventListener('click', (e) => {
      const menuItem = e.target.closest('.tf-menu-item');
      if (menuItem) {
        const action = menuItem.dataset.action;
        this.handleAction(action);
      }
    });

    // 监听显示菜单事件
    document.addEventListener('show-context-menu', (e) => {
      const { tab, x, y } = e.detail;
      this.show(x, y, { type: 'tab', data: tab });
    });

    document.addEventListener('show-group-menu', (e) => {
      const { group, element } = e.detail;
      const rect = element.getBoundingClientRect();
      this.show(rect.right, rect.top, { type: 'group', data: group });
    });
  }

  show(x, y, context) {
    this.currentTarget = context;

    // 调整菜单位置，确保在视窗内
    const menuRect = this.menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let adjustedX = x;
    let adjustedY = y;

    if (adjustedX + menuRect.width > viewportWidth) {
      adjustedX = viewportWidth - menuRect.width - 10;
    }

    if (adjustedY + menuRect.height > viewportHeight) {
      adjustedY = viewportHeight - menuRect.height - 10;
    }

    this.menu.style.left = `${adjustedX}px`;
    this.menu.style.top = `${adjustedY}px`;
    this.menu.classList.remove('tf-hidden');

    // 根据上下文调整菜单项
    this.adjustMenuItems();
  }

  hide() {
    this.menu.classList.add('tf-hidden');
    this.currentTarget = null;
  }

  adjustMenuItems() {
    const menuItems = this.menu.querySelectorAll('.tf-menu-item');

    menuItems.forEach(item => {
      const action = item.dataset.action;
      let shouldShow = true;

      // 根据上下文隐藏/显示特定菜单项
      if (this.currentTarget.type === 'tab') {
        // 标签页上下文菜单
        if (action === 'delete-group') {
          shouldShow = false;
        }
      } else if (this.currentTarget.type === 'group') {
        // 分组上下文菜单
        if (action === 'add-note' || action === 'copy-url' || action === 'delete-tab') {
          shouldShow = false;
        }
      }

      item.style.display = shouldShow ? '' : 'none';
    });
  }

  async handleAction(action) {
    if (!this.currentTarget) return;

    this.hide();

    try {
      switch (action) {
        case 'add-note':
          await this.handleAddNote();
          break;
        case 'move-to-group':
          await this.handleMoveToGroup();
          break;
        case 'copy-url':
          await this.handleCopyUrl();
          break;
        case 'delete-tab':
          await this.handleDeleteTab();
          break;
        case 'delete-group':
          await this.handleDeleteGroup();
          break;
      }
    } catch (error) {
      console.error('执行菜单操作失败:', action, error);
    }
  }

  async handleAddNote() {
    if (this.currentTarget.type !== 'tab') return;

    const { data: tab } = this.currentTarget;
    const note = prompt('请输入备注:', tab.note || '');

    if (note !== null) {
      const response = await chrome.runtime.sendMessage({
        action: 'updateTabNote',
        data: {
          tabUuid: tab.uuid,
          note
        }
      });

      if (response.success) {
        // 触发更新事件
        document.dispatchEvent(new CustomEvent('tab-note-updated', {
          detail: { tabUuid: tab.uuid, note }
        }));
      }
    }
  }

  async handleMoveToGroup() {
    if (this.currentTarget.type !== 'tab') return;

    const { data: tab } = this.currentTarget;

    // 获取所有分组
    const response = await chrome.runtime.sendMessage({
      action: 'getAllGroups'
    });

    if (response.success) {
      const groups = response.data;
      const groupNames = groups.map(g => g.name);

      if (groupNames.length === 0) {
        alert('暂无可用分组，请先创建分组');
        return;
      }

      const selectedGroupName = prompt(`选择分组:\n${groupNames.join('\n')}`);

      if (selectedGroupName) {
        const selectedGroup = groups.find(g => g.name === selectedGroupName);
        if (selectedGroup) {
          const moveResponse = await chrome.runtime.sendMessage({
            action: 'moveTabToGroup',
            tabUuid: tab.uuid,
            groupId: selectedGroup.id
          });

          if (moveResponse.success) {
            document.dispatchEvent(new CustomEvent('tab-moved', {
              detail: { tabUuid: tab.uuid, groupId: selectedGroup.id }
            }));
          }
        }
      }
    }
  }

  async handleCopyUrl() {
    if (this.currentTarget.type !== 'tab') return;

    const { data: tab } = this.currentTarget;

    try {
      await navigator.clipboard.writeText(tab.url);
      this.showToast('链接已复制到剪贴板');
    } catch (error) {
      console.error('复制链接失败:', error);
      // 降级方案
      const textArea = document.createElement('textarea');
      textArea.value = tab.url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      this.showToast('链接已复制到剪贴板');
    }
  }

  async handleDeleteTab() {
    if (this.currentTarget.type !== 'tab') return;

    const { data: tab } = this.currentTarget;

    if (confirm(`确定要关闭标签页 "${tab.title}" 吗？`)) {
      const response = await chrome.runtime.sendMessage({
        action: 'closeTab',
        tabId: tab.id
      });

      if (response.success) {
        document.dispatchEvent(new CustomEvent('tab-closed', {
          detail: { tabUuid: tab.uuid }
        }));
      }
    }
  }

  async handleDeleteGroup() {
    if (this.currentTarget.type !== 'group') return;

    const { data: group } = this.currentTarget;

    if (confirm(`确定要删除分组 "${group.name}" 吗？这将关闭分组中的所有标签页。`)) {
      const response = await chrome.runtime.sendMessage({
        action: 'deleteGroup',
        groupId: group.id
      });

      if (response.success) {
        document.dispatchEvent(new CustomEvent('group-deleted', {
          detail: { groupId: group.id }
        }));
      }
    }
  }

  showToast(message) {
    // 简单的toast提示
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 14px;
      z-index: 10000;
    `;
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
      document.body.removeChild(toast);
    }, 2000);
  }
}

// 初始化上下文菜单
let contextMenu;

document.addEventListener('DOMContentLoaded', () => {
  contextMenu = new ContextMenu();
});
