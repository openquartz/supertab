class StorageManager {
  constructor(privacyManager) {
    this.privacyManager = privacyManager;
    this.STORAGE_QUOTA = 5 * 1024 * 1024; // 5MB limit
    this.QUOTA_THRESHOLD = 0.9; // 90% threshold
  }

  async initialize() {
    console.log('StorageManager initialized');
    return true;
  }

  async importData(data) {
    // Import tabs
    if (data.tabs) {
      await this.setStorageData('tabflow:tabs', data.tabs);
    }
    // Import groups
    if (data.groups) {
      await this.setStorageData('tabflow:groups', data.groups);
    }
    return true;
  }

  async saveTab(tab) {
    try {
      const tabToSave = { ...tab };

      // Encrypt note only when privacy encryption is explicitly enabled.
      if (tabToSave.note && this.privacyManager && await this.shouldEncryptNotes()) {
        tabToSave.note = await this.privacyManager.encryptNote(tabToSave.note);
      }

      const tabs = await this.getAllTabs();
      tabs[tabToSave.uuid] = tabToSave;

      await this.setStorageData('tabflow:tabs', tabs);
      return true;
    } catch (error) {
      console.error('Failed to save tab:', error);
      return false;
    }
  }

  async getTab(uuid) {
    try {
      const tabs = await this.getAllTabs();
      const tab = tabs[uuid] ? { ...tabs[uuid] } : null;

      if (tab && tab.note && this.privacyManager && await this.shouldEncryptNotes()) {
        tab.note = await this.privacyManager.decryptNote(tab.note);
      }

      return tab || null;
    } catch (error) {
      console.error('Failed to get tab:', error);
      return null;
    }
  }

  async getAllTabs() {
    try {
      const result = await new Promise((resolve, reject) => {
        chrome.storage.local.get('tabflow:tabs', (data) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(data);
          }
        });
      });
      return result['tabflow:tabs'] || {};
    } catch (error) {
      console.error('Failed to get all tabs:', error);
      return {};
    }
  }

  async shouldEncryptNotes() {
    try {
      if (!this.privacyManager) {
        return false;
      }

      if (typeof this.privacyManager.getSettings === 'function') {
        const settings = await this.privacyManager.getSettings();
        return Boolean(settings?.privacy?.encryptNotes);
      }

      return Boolean(this.privacyManager.settings?.privacy?.encryptNotes);
    } catch (error) {
      console.warn('Failed to determine encryptNotes setting, defaulting to disabled');
      return false;
    }
  }

  async removeTab(uuid) {
    try {
      const tabs = await this.getAllTabs();
      if (tabs[uuid]) {
        delete tabs[uuid];
        await this.setStorageData('tabflow:tabs', tabs);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to remove tab:', error);
      return false;
    }
  }

  async saveGroup(group) {
    try {
      const groups = await this.getAllGroups();
      groups[group.id] = group;
      await this.setStorageData('tabflow:groups', groups);
      return true;
    } catch (error) {
      console.error('Failed to save group:', error);
      return false;
    }
  }

  async getGroup(groupId) {
    try {
      const groups = await this.getAllGroups();
      return groups[groupId] || null;
    } catch (error) {
      console.error('Failed to get group:', error);
      return null;
    }
  }

  async getAllGroups() {
    try {
      const result = await new Promise((resolve, reject) => {
        chrome.storage.local.get('tabflow:groups', (data) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(data);
          }
        });
      });
      return result['tabflow:groups'] || {};
    } catch (error) {
      console.error('Failed to get all groups:', error);
      return {};
    }
  }

  async removeGroup(groupId) {
    try {
      const groups = await this.getAllGroups();
      if (groups[groupId]) {
        delete groups[groupId];
        await this.setStorageData('tabflow:groups', groups);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to remove group:', error);
      return false;
    }
  }

  async saveSettings(settings) {
    try {
      await this.setStorageData('tabflow:settings', settings);
      return true;
    } catch (error) {
      console.error('Failed to save settings:', error);
      return false;
    }
  }

  async getSettings() {
    try {
      const result = await new Promise((resolve, reject) => {
        chrome.storage.local.get('tabflow:settings', (data) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(data);
          }
        });
      });
      return result['tabflow:settings'] || {
        privacy: {
          encryptNotes: false,
          excludeDomains: [],
          autoCleanupDays: 30
        },
        ui: {
          collapsedGroups: []
        },
        preferences: {
          defaultView: 'domain'
        }
      };
    } catch (error) {
      console.error('Failed to get settings:', error);
      return {};
    }
  }

  async checkStorageQuota() {
    try {
      const bytesUsed = await new Promise((resolve, reject) => {
        chrome.storage.local.getBytesInUse((bytes) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(bytes);
          }
        });
      });

      const quotaLimit = this.STORAGE_QUOTA * this.QUOTA_THRESHOLD;
      const isUnderQuota = bytesUsed < quotaLimit;

      if (!isUnderQuota) {
        console.warn('Storage quota exceeded:', bytesUsed, '/', quotaLimit);
      }

      return {
        isUnderQuota,
        bytesUsed,
        quotaLimit,
        usagePercentage: (bytesUsed / quotaLimit) * 100
      };
    } catch (error) {
      console.error('Failed to check storage quota:', error);
      return {
        isUnderQuota: false,
        bytesUsed: 0,
        quotaLimit: 0,
        usagePercentage: 0,
        error: error.message
      };
    }
  }

  async performAutoCleanup(privacySettings) {
    try {
      const cutoffTime = Date.now() - (privacySettings.autoCleanupDays * 24 * 60 * 60 * 1000);
      const tabs = await this.getAllTabs();

      let removedCount = 0;
      for (const [uuid, tab] of Object.entries(tabs)) {
        if (tab.openedAt < cutoffTime) {
          delete tabs[uuid];
          removedCount++;
        }
      }

      if (removedCount > 0) {
        await this.setStorageData('tabflow:tabs', tabs);
        console.log(`Auto-cleanup removed ${removedCount} old tabs`);
      }

      // Update metadata
      await this.updateMetadata({ lastCleanup: Date.now() });
      return removedCount;
    } catch (error) {
      console.error('Failed to perform auto cleanup:', error);
      return 0;
    }
  }

  async updateMetadata(metadata) {
    try {
      const currentMetadata = await this.getMetadata();
      const updatedMetadata = { ...currentMetadata, ...metadata };
      await this.setStorageData('tabflow:metadata', updatedMetadata);
      return true;
    } catch (error) {
      console.error('Failed to update metadata:', error);
      return false;
    }
  }

  async getMetadata() {
    try {
      const result = await new Promise((resolve, reject) => {
        chrome.storage.local.get('tabflow:metadata', (data) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(data);
          }
        });
      });
      return result['tabflow:metadata'] || {
        version: '1.0.0',
        schemaVersion: 1
      };
    } catch (error) {
      console.error('Failed to get metadata:', error);
      return {};
    }
  }

  async setStorageData(key, data) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: data }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  async clearAllData() {
    try {
      await chrome.storage.local.clear();
      return true;
    } catch (error) {
      console.error('Failed to clear all data:', error);
      return false;
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageManager;
}
