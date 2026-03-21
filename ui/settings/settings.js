// ui/settings/settings.js
class TabFlowSettings {
  constructor() {
    this.privacyManager = null;
    this.settings = {
      encryptNotes: false,
      excludeDomains: [],
      autoCleanupDays: 30,
      enableLogging: false
    };

    this.initializeElements();
    this.setupEventListeners();
    this.initialize();
  }

  async initialize() {
    // 从后台获取隐私管理器实例和设置
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getPrivacySettings'
      });

      if (response.success) {
        this.settings = this.normalizeSettings(response.data);
        this.updateUI();
      }
    } catch (error) {
      console.error('加载设置失败:', error);
    }
  }

  initializeElements() {
    this.elements = {
      closeBtn: document.getElementById('close-btn'),
      encryptNotes: document.getElementById('encrypt-notes'),
      excludeDomains: document.getElementById('exclude-domains'),
      autoCleanup: document.getElementById('auto-cleanup'),
      exportData: document.getElementById('export-data'),
      importData: document.getElementById('import-data'),
      importFile: document.getElementById('import-file'),
      clearData: document.getElementById('clear-data'),
      saveSettings: document.getElementById('save-settings'),
      resetSettings: document.getElementById('reset-settings'),
      version: document.getElementById('version'),
      feedbackLink: document.getElementById('feedback-link')
    };
  }

  setupEventListeners() {
    // 关闭按钮
    this.elements.closeBtn.addEventListener('click', () => {
      window.close();
    });

    // 导出数据
    this.elements.exportData.addEventListener('click', () => {
      this.exportData();
    });

    // 导入数据
    this.elements.importData.addEventListener('click', () => {
      this.elements.importFile.click();
    });

    this.elements.importFile.addEventListener('change', (e) => {
      this.importData(e.target.files[0]);
    });

    // 清除数据
    this.elements.clearData.addEventListener('click', () => {
      this.clearAllData();
    });

    // 保存设置
    this.elements.saveSettings.addEventListener('click', () => {
      this.saveSettings();
    });

    // 重置设置
    this.elements.resetSettings.addEventListener('click', () => {
      this.resetToDefault();
    });

    // 反馈链接
    this.elements.feedbackLink.addEventListener('click', (e) => {
      e.preventDefault();
      this.openFeedback();
    });
  }

  updateUI() {
    // 更新UI元素以反映当前设置
    this.elements.encryptNotes.checked = Boolean(this.settings.encryptNotes);
    this.elements.excludeDomains.value = (this.settings.excludeDomains || []).join('\n');
    this.elements.autoCleanup.value = String(this.settings.autoCleanupDays ?? 30);

    // 更新版本信息
    this.elements.version.textContent = chrome.runtime.getManifest().version;
  }

  async saveSettings() {
    try {
      // 从UI获取设置值
      const newSettings = {
        encryptNotes: this.elements.encryptNotes.checked,
        excludeDomains: this.elements.excludeDomains.value
          .split('\n')
          .map(domain => domain.trim())
          .filter(domain => domain.length > 0),
        autoCleanupDays: parseInt(this.elements.autoCleanup.value) || 0
      };

      // 保存设置
      const response = await chrome.runtime.sendMessage({
        action: 'updatePrivacySettings',
        data: {
          settings: this.toPrivacySettingsPayload(newSettings)
        }
      });

      if (response.success) {
        this.showToast('设置已保存', 'success');
        this.settings = { ...this.settings, ...newSettings };
      } else {
        throw new Error('保存设置失败');
      }
    } catch (error) {
      console.error('保存设置失败:', error);
      this.showToast('保存设置失败: ' + error.message, 'error');
    }
  }

  async exportData() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'exportAllData'
      });

      if (response.success) {
        const data = response.data;
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tabflow-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showToast('数据导出成功', 'success');
      }
    } catch (error) {
      console.error('导出数据失败:', error);
      this.showToast('导出数据失败: ' + error.message, 'error');
    }
  }

  async importData(file) {
    if (!file) return;

    if (!confirm('导入数据将覆盖当前所有设置和数据，确定要继续吗？')) {
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const response = await chrome.runtime.sendMessage({
        action: 'importAllData',
        data
      });

      if (response.success) {
        this.showToast('数据导入成功，正在重新加载...', 'success');

        // 重新加载设置
        setTimeout(() => {
          this.initialize();
        }, 1000);
      } else {
        throw new Error('导入数据失败');
      }
    } catch (error) {
      console.error('导入数据失败:', error);
      this.showToast('导入数据失败: ' + error.message, 'error');
    }
  }

  async clearAllData() {
    if (!confirm('确定要清除所有数据吗？此操作不可恢复！')) {
      return;
    }

    if (!confirm('最后确认：这将删除所有标签页数据、分组和设置，确定要继续吗？')) {
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'clearAllData'
      });

      if (response.success) {
        this.showToast('所有数据已清除', 'success');

        // 重置UI
        this.settings = {
          encryptNotes: false,
          excludeDomains: [],
          autoCleanupDays: 30,
          enableLogging: false
        };
        this.updateUI();
      }
    } catch (error) {
      console.error('清除数据失败:', error);
      this.showToast('清除数据失败: ' + error.message, 'error');
    }
  }

  resetToDefault() {
    if (!confirm('确定要重置所有设置为默认值吗？')) {
      return;
    }

    this.settings = {
      encryptNotes: false,
      excludeDomains: [],
      autoCleanupDays: 30,
      enableLogging: false
    };

    this.updateUI();
    this.saveSettings();
  }

  normalizeSettings(rawSettings) {
    const privacy = rawSettings?.privacy || rawSettings || {};
    const autoCleanupDays = Number.parseInt(privacy.autoCleanupDays, 10);

    return {
      encryptNotes: Boolean(privacy.encryptNotes),
      excludeDomains: Array.isArray(privacy.excludeDomains) ? privacy.excludeDomains : [],
      autoCleanupDays: Number.isFinite(autoCleanupDays) ? autoCleanupDays : 30,
      enableLogging: Boolean(rawSettings?.preferences?.enableLogging)
    };
  }

  toPrivacySettingsPayload(flatSettings) {
    return {
      privacy: {
        encryptNotes: Boolean(flatSettings.encryptNotes),
        excludeDomains: Array.isArray(flatSettings.excludeDomains) ? flatSettings.excludeDomains : [],
        autoCleanupDays: Number.parseInt(flatSettings.autoCleanupDays, 10) || 0
      }
    };
  }

  openFeedback() {
    // 打开反馈页面或发送邮件
    const subject = encodeURIComponent('TabFlow 插件反馈');
    const body = encodeURIComponent('请描述您遇到的问题或建议：\n\n');
    window.open(`mailto:feedback@tabflow.com?subject=${subject}&body=${body}`);
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `tf-toast tf-toast-${type}`;
    toast.textContent = message;

    // 样式
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 14px;
      z-index: 10000;
      max-width: 300px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
      color: white;
    `;

    // 根据类型设置背景色
    switch (type) {
      case 'success':
        toast.style.background = '#28a745';
        break;
      case 'error':
        toast.style.background = '#dc3545';
        break;
      case 'warning':
        toast.style.background = '#ffc107';
        toast.style.color = '#212529';
        break;
      default:
        toast.style.background = '#6c757d';
    }

    document.body.appendChild(toast);

    // 自动移除
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 3000);
  }
}

// 初始化设置页面
document.addEventListener('DOMContentLoaded', () => {
  new TabFlowSettings();
});
