# TabFlow Chrome Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete TabFlow Chrome extension with smart grouping, notes, batch operations, and privacy features using Manifest V3 architecture.

**Architecture:** Monolithic implementation following modular design - service worker for Chrome API integration, side panel UI with macOS glassmorphism design, local storage with privacy controls, and real-time event synchronization.

**Tech Stack:** Chrome Extensions API (Manifest V3), JavaScript (ES6+), HTML5/CSS3, chrome.storage API, Web Crypto API for encryption

---

## File Structure Mapping

```
tabflow/
├── manifest.json                    # Extension configuration & permissions
├── background/                      # Service worker & core logic
│   ├── service-worker.js           # Entry point & lifecycle
│   ├── tab-manager.js             # Chrome tabs API integration
│   ├── storage-manager.js         # Data persistence & privacy
│   └── event-bus.js               # Event system
├── ui/                            # User interface (side panel)
│   ├── sidebar/                   # Main UI
│   │   ├── sidebar.html
│   │   ├── sidebar.js
│   │   └── sidebar.css
│   └── components/                # Web Components
│       ├── tab-item.js
│       ├── group-item.js
│       ├── search-bar.js
│       └── context-menu.js
├── utils/                        # Utilities
│   ├── grouping-engine.js       # Smart grouping algorithms
│   ├── privacy-manager.js       # Encryption & privacy controls
│   └── performance-monitor.js   # Performance optimization
└── assets/                      # Static resources
    ├── icons/
    │   ├── icon-16.png
    │   ├── icon-32.png
    │   ├── icon-48.png
    │   └── icon-128.png
    └── images/
        └── default-favicon.png
```

## Implementation Tasks

### Task 1: Project Setup and Manifest Configuration

**Files:**
- Create: `manifest.json`
- Create: `assets/icons/icon-16.png`
- Create: `assets/icons/icon-32.png`
- Create: `assets/icons/icon-48.png`
- Create: `assets/icons/icon-128.png`

- [ ] **Step 1: Create manifest.json with Manifest V3 configuration**

```json
{
  "manifest_version": 3,
  "name": "TabFlow",
  "version": "1.0.0",
  "description": "Professional Chrome tab management with smart grouping, notes, and batch operations",
  "permissions": [
    "tabs",
    "storage",
    "sidePanel",
    "contextMenus"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "background/service-worker.js"
  },
  "side_panel": {
    "default_path": "ui/sidebar/sidebar.html"
  },
  "action": {
    "default_title": "Open TabFlow",
    "default_icon": {
      "16": "assets/icons/icon-16.png",
      "32": "assets/icons/icon-32.png",
      "48": "assets/icons/icon-48.png",
      "128": "assets/icons/icon-128.png"
    }
  },
  "icons": {
    "16": "assets/icons/icon-16.png",
    "32": "assets/icons/icon-32.png",
    "48": "assets/icons/icon-48.png",
    "128": "assets/icons/icon-128.png"
  }
}
```

- [ ] **Step 2: Create placeholder icon files**

```bash
# Create icon directory structure
mkdir -p assets/icons
# For now, create placeholder files - will replace with actual icons later
touch assets/icons/icon-{16,32,48,128}.png
echo "Icon files created as placeholders"
```

- [ ] **Step 3: Verify manifest loads in Chrome**

```bash
# Load extension in Chrome for testing
# 1. Open chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the tabflow directory
# Expected: Extension loads without errors
```

- [ ] **Step 4: Commit initial project structure**

```bash
git add manifest.json assets/
git commit -m "feat: add manifest and basic project structure"
```

### Task 2: Event Bus System

**Files:**
- Create: `background/event-bus.js`
- Test: `tests/unit/event-bus.test.js`

- [ ] **Step 1: Write failing test for event bus**

```javascript
// tests/unit/event-bus.test.js
describe('EventBus', () => {
  let eventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  test('should register and emit events', () => {
    const callback = jest.fn();
    eventBus.on('test-event', callback);
    eventBus.emit('test-event', { data: 'test' });
    expect(callback).toHaveBeenCalledWith({ data: 'test' });
  });

  test('should handle multiple listeners for same event', () => {
    const callback1 = jest.fn();
    const callback2 = jest.fn();
    eventBus.on('multi-event', callback1);
    eventBus.on('multi-event', callback2);
    eventBus.emit('multi-event');
    expect(callback1).toHaveBeenCalled();
    expect(callback2).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
# Create test directory
mkdir -p tests/unit
# Run test (will fail since EventBus doesn't exist yet)
npm test tests/unit/event-bus.test.js
# Expected: FAIL - EventBus is not defined
```

- [ ] **Step 3: Implement EventBus class**

```javascript
// background/event-bus.js
class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;

    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  emit(event, data) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }

  removeAllListeners(event) {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EventBus;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test tests/unit/event-bus.test.js
# Expected: PASS - All tests should pass
```

- [ ] **Step 5: Commit EventBus implementation**

```bash
git add background/event-bus.js tests/unit/event-bus.test.js
git commit -m "feat: implement event bus system for inter-component communication"
```

### Task 3: Privacy Manager with Encryption

**Files:**
- Create: `utils/privacy-manager.js`
- Test: `tests/unit/privacy-manager.test.js`

- [ ] **Step 1: Write failing test for privacy manager**

```javascript
// tests/unit/privacy-manager.test.js
describe('PrivacyManager', () => {
  let privacyManager;

  beforeEach(() => {
    privacyManager = new PrivacyManager();
  });

  test('should encrypt and decrypt notes', async () => {
    const originalNote = 'This is a sensitive note';
    const encrypted = await privacyManager.encryptNote(originalNote);
    const decrypted = await privacyManager.decryptNote(encrypted);
    expect(decrypted).toBe(originalNote);
    expect(encrypted).not.toBe(originalNote);
  });

  test('should detect excluded domains', () => {
    const excludeDomains = ['bank.com', 'health.gov'];
    expect(privacyManager.shouldExcludeTab('https://my.bank.com/account', excludeDomains)).toBe(true);
    expect(privacyManager.shouldExcludeTab('https://github.com/user/repo', excludeDomains)).toBe(false);
  });

  test('should extract domain from URL correctly', () => {
    expect(privacyManager.extractDomain('https://github.com/user/repo')).toBe('github.com');
    expect(privacyManager.extractDomain('https://sub.domain.example.com/path')).toBe('sub.domain.example.com');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test tests/unit/privacy-manager.test.js
# Expected: FAIL - PrivacyManager is not defined
```

- [ ] **Step 3: Implement PrivacyManager class**

```javascript
// utils/privacy-manager.js
class PrivacyManager {
  constructor() {
    this.encryptionKey = null;
    this.initializeEncryption();
  }

  async initializeEncryption() {
    try {
      this.encryptionKey = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );
    } catch (error) {
      console.error('Failed to initialize encryption:', error);
      throw new Error('Encryption initialization failed');
    }
  }

  async encryptNote(note) {
    if (!note) return '';

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(note);
      const iv = crypto.getRandomValues(new Uint8Array(12));

      const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        this.encryptionKey,
        data
      );

      // Combine IV and encrypted data
      const result = new Uint8Array(iv.length + encrypted.byteLength);
      result.set(iv);
      result.set(new Uint8Array(encrypted), iv.length);

      return btoa(String.fromCharCode(...result));
    } catch (error) {
      console.error('Encryption failed:', error);
      return note; // Return original if encryption fails
    }
  }

  async decryptNote(encryptedNote) {
    if (!encryptedNote) return '';

    try {
      const data = new Uint8Array(
        atob(encryptedNote).split('').map(char => char.charCodeAt(0))
      );

      const iv = data.slice(0, 12);
      const encrypted = data.slice(12);

      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        this.encryptionKey,
        encrypted
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.error('Decryption failed:', error);
      return encryptedNote; // Return original if decryption fails
    }
  }

  shouldExcludeTab(url, excludeDomains) {
    if (!url || !excludeDomains || excludeDomains.length === 0) {
      return false;
    }

    const domain = this.extractDomain(url);
    if (!domain) return false;

    return excludeDomains.some(excluded => {
      return domain === excluded || domain.endsWith(`.${excluded}`);
    });
  }

  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      console.error('Invalid URL for domain extraction:', url);
      return null;
    }
  }

  sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    // Basic XSS prevention
    return input.replace(/[<>&"']/g, char => {
      const entities = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#x27;' };
      return entities[char] || char;
    });
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PrivacyManager;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test tests/unit/privacy-manager.test.js
# Expected: PASS - All tests should pass
```

- [ ] **Step 5: Commit PrivacyManager implementation**

```bash
git add utils/privacy-manager.js tests/unit/privacy-manager.test.js
git commit -m "feat: implement privacy manager with AES encryption and domain filtering"
```

### Task 4: Storage Manager with Quota Monitoring

**Files:**
- Create: `background/storage-manager.js`
- Test: `tests/unit/storage-manager.test.js`

- [ ] **Step 1: Write failing test for storage manager**

```javascript
// tests/unit/storage-manager.test.js
describe('StorageManager', () => {
  let storageManager;
  let privacyManager;

  beforeEach(() => {
    privacyManager = { encryptNote: jest.fn(text => `encrypted:${text}`), decryptNote: jest.fn(text => text.replace('encrypted:', '')) };
    storageManager = new StorageManager(privacyManager);
  });

  test('should save and retrieve tabs', async () => {
    const testTab = {
      id: 1,
      uuid: 'test-123',
      title: 'Test Tab',
      url: 'https://example.com',
      groupId: 'group-1',
      openedAt: Date.now()
    };

    await storageManager.saveTab(testTab);
    const retrieved = await storageManager.getTab('test-123');
    expect(retrieved).toEqual(testTab);
  });

  test('should handle storage quota limits', async () => {
    // Mock chrome.storage.local.getBytesInUse
    chrome.storage.local.getBytesInUse = jest.fn().mockImplementation((callback) => {
      callback(4.8 * 1024 * 1024); // 4.8MB used
    });

    const result = await storageManager.checkStorageQuota();
    expect(result).toBe(true);
  });

  test('should perform auto cleanup of old tabs', async () => {
    const oldTab = {
      id: 1,
      uuid: 'old-123',
      title: 'Old Tab',
      url: 'https://example.com',
      openedAt: Date.now() - (31 * 24 * 60 * 60 * 1000) // 31 days ago
    };

    await storageManager.saveTab(oldTab);
    await storageManager.performAutoCleanup({ autoCleanupDays: 30 });

    const retrieved = await storageManager.getTab('old-123');
    expect(retrieved).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test tests/unit/storage-manager.test.js
# Expected: FAIL - StorageManager is not defined
```

- [ ] **Step 3: Implement StorageManager class**

```javascript
// background/storage-manager.js
class StorageManager {
  constructor(privacyManager) {
    this.privacyManager = privacyManager;
    this.STORAGE_QUOTA = 5 * 1024 * 1024; // 5MB limit
    this.QUOTA_THRESHOLD = 0.9; // 90% threshold
  }

  async saveTab(tab) {
    try {
      // Encrypt note if privacy is enabled
      if (tab.note && this.privacyManager) {
        tab.note = await this.privacyManager.encryptNote(tab.note);
      }

      const tabs = await this.getAllTabs();
      tabs[tab.uuid] = tab;

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
      const tab = tabs[uuid];

      if (tab && tab.note && this.privacyManager) {
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
      const result = await chrome.storage.local.get('tabflow:tabs');
      return result['tabflow:tabs'] || {};
    } catch (error) {
      console.error('Failed to get all tabs:', error);
      return {};
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
      const result = await chrome.storage.local.get('tabflow:groups');
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
      const result = await chrome.storage.local.get('tabflow:settings');
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
      const bytesUsed = await new Promise((resolve) => {
        chrome.storage.local.getBytesInUse((bytes) => resolve(bytes));
      });

      return bytesUsed < (this.STORAGE_QUOTA * this.QUOTA_THRESHOLD);
    } catch (error) {
      console.error('Failed to check storage quota:', error);
      return false;
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
      const result = await chrome.storage.local.get('tabflow:metadata');
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test tests/unit/storage-manager.test.js
# Expected: PASS - All tests should pass
```

- [ ] **Step 5: Commit StorageManager implementation**

```bash
git add background/storage-manager.js tests/unit/storage-manager.test.js
git commit -m "feat: implement storage manager with quota monitoring and auto-cleanup"
```

### Task 5: Tab Manager with Chrome API Integration

**Files:**
- Create: `background/tab-manager.js`
- Test: `tests/unit/tab-manager.test.js`

- [ ] **Step 1: Write failing test for tab manager**

```javascript
// tests/unit/tab-manager.test.js
describe('TabManager', () => {
  let tabManager;
  let mockEventBus;
  let mockStorageManager;

  beforeEach(() => {
    mockEventBus = {
      on: jest.fn(),
      emit: jest.fn()
    };
    mockStorageManager = {
      saveTab: jest.fn(),
      removeTab: jest.fn(),
      getAllTabs: jest.fn().mockResolvedValue({})
    };

    tabManager = new TabManager(mockEventBus, mockStorageManager);
  });

  test('should initialize and get all tabs', async () => {
    // Mock chrome.tabs.query
    chrome.tabs.query = jest.fn().mockImplementation((query, callback) => {
      callback([
        { id: 1, title: 'Test Tab', url: 'https://example.com', windowId: 1 }
      ]);
    });

    await tabManager.initialize();
    expect(chrome.tabs.query).toHaveBeenCalled();
  });

  test('should handle tab creation', async () => {
    const newTab = {
      id: 1,
      title: 'New Tab',
      url: 'https://example.com',
      windowId: 1
    };

    await tabManager.handleTabCreated(newTab);
    expect(mockStorageManager.saveTab).toHaveBeenCalled();
    expect(mockEventBus.emit).toHaveBeenCalledWith('tab:created', expect.any(Object));
  });

  test('should handle tab removal', async () => {
    await tabManager.handleTabRemoved(123, { windowId: 1, isWindowClosing: false });
    expect(mockStorageManager.removeTab).toHaveBeenCalled();
    expect(mockEventBus.emit).toHaveBeenCalledWith('tab:removed', { tabId: 123 });
  });

  test('should debounce tab updates', async () => {
    const tabUpdate = {
      tabId: 1,
      changeInfo: { title: 'Updated Title' },
      tab: { id: 1, title: 'Updated Title', url: 'https://example.com' }
    };

    // Simulate rapid updates
    tabManager.handleTabUpdated(tabUpdate.tabId, tabUpdate.changeInfo, tabUpdate.tab);
    tabManager.handleTabUpdated(tabUpdate.tabId, tabUpdate.changeInfo, tabUpdate.tab);
    tabManager.handleTabUpdated(tabUpdate.tabId, tabUpdate.changeInfo, tabUpdate.tab);

    // Wait for debounce
    await new Promise(resolve => setTimeout(resolve, 350));

    expect(mockStorageManager.saveTab).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test tests/unit/tab-manager.test.js
# Expected: FAIL - TabManager is not defined
```

- [ ] **Step 3: Implement TabManager class**

```javascript
// background/tab-manager.js
class TabManager {
  constructor(eventBus, storageManager) {
    this.eventBus = eventBus;
    this.storageManager = storageManager;
    this.debounceTimers = new Map();
    this.DEBOUNCE_DELAY = 300; // 300ms debounce

    this.setupEventListeners();
  }

  async initialize() {
    try {
      // Get all existing tabs
      const tabs = await this.getAllTabsFromChrome();

      // Process each tab
      for (const tab of tabs) {
        if (this.isValidTab(tab)) {
          await this.processTab(tab);
        }
      }

      console.log(`TabFlow initialized with ${tabs.length} tabs`);
      return true;
    } catch (error) {
      console.error('Failed to initialize TabManager:', error);
      return false;
    }
  }

  setupEventListeners() {
    // Listen for tab events from Chrome
    chrome.tabs.onCreated.addListener(this.handleTabCreated.bind(this));
    chrome.tabs.onRemoved.addListener(this.handleTabRemoved.bind(this));
    chrome.tabs.onUpdated.addListener(this.handleTabUpdated.bind(this));
    chrome.tabs.onActivated.addListener(this.handleTabActivated.bind(this));
    chrome.tabs.onMoved.addListener(this.handleTabMoved.bind(this));
    chrome.tabs.onDetached.addListener(this.handleTabDetached.bind(this));
    chrome.tabs.onAttached.addListener(this.handleTabAttached.bind(this));

    // Listen for storage cleanup events
    this.eventBus.on('memory:cleanup', this.performCleanup.bind(this));
    this.eventBus.on('storage:quota-exceeded', this.handleQuotaExceeded.bind(this));
  }

  async getAllTabsFromChrome() {
    return new Promise((resolve) => {
      chrome.tabs.query({}, (tabs) => {
        resolve(tabs || []);
      });
    });
  }

  isValidTab(tab) {
    // Filter out invalid tabs
    if (!tab || !tab.id || !tab.url) return false;

    // Filter out chrome internal pages
    const invalidProtocols = ['chrome://', 'chrome-extension://', 'about:'];
    return !invalidProtocols.some(protocol => tab.url.startsWith(protocol));
  }

  async processTab(chromeTab) {
    try {
      const existingTabs = await this.storageManager.getAllTabs();
      const existingTab = Object.values(existingTabs).find(t => t.id === chromeTab.id);

      if (existingTab) {
        // Update existing tab
        const updatedTab = this.mapChromeTabToTab(chromeTab, existingTab.uuid);
        await this.storageManager.saveTab(updatedTab);
        return updatedTab;
      } else {
        // Create new tab
        const newTab = this.mapChromeTabToTab(chromeTab);
        await this.storageManager.saveTab(newTab);
        return newTab;
      }
    } catch (error) {
      console.error('Failed to process tab:', error);
      return null;
    }
  }

  mapChromeTabToTab(chromeTab, existingUuid = null) {
    return {
      id: chromeTab.id,
      uuid: existingUuid || this.generateUUID(),
      title: chromeTab.title || 'Untitled',
      url: chromeTab.url,
      favicon: chromeTab.favIconUrl,
      groupId: 'unassigned', // Will be assigned by grouping engine
      windowId: chromeTab.windowId,
      openedAt: chromeTab.openedAt || Date.now(),
      lastAccessed: chromeTab.active ? Date.now() : undefined
    };
  }

  async handleTabCreated(chromeTab) {
    try {
      if (!this.isValidTab(chromeTab)) return;

      const tab = await this.processTab(chromeTab);
      if (tab) {
        this.eventBus.emit('tab:created', tab);
      }
    } catch (error) {
      console.error('Error handling tab creation:', error);
    }
  }

  async handleTabRemoved(tabId, removeInfo) {
    try {
      // Find tab by Chrome ID
      const tabs = await this.storageManager.getAllTabs();
      const tabUuid = Object.values(tabs).find(tab => tab.id === tabId)?.uuid;

      if (tabUuid) {
        await this.storageManager.removeTab(tabUuid);
        this.eventBus.emit('tab:removed', { tabId, tabUuid, removeInfo });
      }
    } catch (error) {
      console.error('Error handling tab removal:', error);
    }
  }

  handleTabUpdated(tabId, changeInfo, chromeTab) {
    // Debounce rapid updates
    if (this.debounceTimers.has(tabId)) {
      clearTimeout(this.debounceTimers.get(tabId));
    }

    const timer = setTimeout(async () => {
      try {
        if (!this.isValidTab(chromeTab)) return;

        const tab = await this.processTab(chromeTab);
        if (tab) {
          this.eventBus.emit('tab:updated', { tab, changeInfo });
        }
      } catch (error) {
        console.error('Error handling tab update:', error);
      } finally {
        this.debounceTimers.delete(tabId);
      }
    }, this.DEBOUNCE_DELAY);

    this.debounceTimers.set(tabId, timer);
  }

  async handleTabActivated(activeInfo) {
    try {
      // Update last accessed time for activated tab
      const tabs = await this.storageManager.getAllTabs();
      const tab = Object.values(tabs).find(t => t.id === activeInfo.tabId);

      if (tab) {
        tab.lastAccessed = Date.now();
        await this.storageManager.saveTab(tab);
        this.eventBus.emit('tab:activated', tab);
      }
    } catch (error) {
      console.error('Error handling tab activation:', error);
    }
  }

  handleTabMoved(tabId, moveInfo) {
    // Handle tab movement between positions
    this.eventBus.emit('tab:moved', { tabId, moveInfo });
  }

  handleTabDetached(tabId, detachInfo) {
    // Handle tab detachment (moving to new window)
    this.eventBus.emit('tab:detached', { tabId, detachInfo });
  }

  handleTabAttached(tabId, attachInfo) {
    // Handle tab attachment (from another window)
    this.eventBus.emit('tab:attached', { tabId, attachInfo });
  }

  async performCleanup() {
    try {
      // Remove tabs that no longer exist in Chrome
      const chromeTabs = await this.getAllTabsFromChrome();
      const chromeTabIds = new Set(chromeTabs.map(tab => tab.id));

      const storedTabs = await this.storageManager.getAllTabs();
      for (const [uuid, tab] of Object.entries(storedTabs)) {
        if (!chromeTabIds.has(tab.id)) {
          await this.storageManager.removeTab(uuid);
        }
      }

      console.log('Tab cleanup completed');
    } catch (error) {
      console.error('Error during tab cleanup:', error);
    }
  }

  async handleQuotaExceeded() {
    try {
      console.warn('Storage quota exceeded, performing emergency cleanup');

      // Remove oldest 25% of tabs
      const tabs = await this.storageManager.getAllTabs();
      const tabArray = Object.entries(tabs);

      if (tabArray.length > 0) {
        // Sort by openedAt (oldest first)
        tabArray.sort(([,a], [,b]) => a.openedAt - b.openedAt);

        // Remove oldest 25%
        const removeCount = Math.ceil(tabArray.length * 0.25);
        for (let i = 0; i < removeCount; i++) {
          const [uuid] = tabArray[i];
          await this.storageManager.removeTab(uuid);
        }

        console.log(`Emergency cleanup removed ${removeCount} tabs`);
      }
    } catch (error) {
      console.error('Error during quota exceeded handling:', error);
    }
  }

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  async getTabsByWindow(windowId) {
    try {
      const tabs = await this.storageManager.getAllTabs();
      return Object.values(tabs).filter(tab => tab.windowId === windowId);
    } catch (error) {
      console.error('Failed to get tabs by window:', error);
      return [];
    }
  }

  async getAllTabs() {
    try {
      return await this.storageManager.getAllTabs();
    } catch (error) {
      console.error('Failed to get all tabs:', error);
      return {};
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TabManager;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test tests/unit/tab-manager.test.js
# Expected: PASS - All tests should pass
```

- [ ] **Step 5: Commit TabManager implementation**

```bash
git add background/tab-manager.js tests/unit/tab-manager.test.js
git commit -m "feat: implement tab manager with Chrome API integration and real-time sync"
```

### Task 6: Grouping Engine

**Files:**
- Create: `utils/grouping-engine.js`
- Test: `tests/unit/grouping-engine.test.js`

- [ ] **Step 1: Write failing test for grouping engine**

```javascript
// tests/unit/grouping-engine.test.js
describe('GroupingEngine', () => {
  let groupingEngine;

  beforeEach(() => {
    groupingEngine = new GroupingEngine();
  });

  const testTabs = [
    { id: 1, uuid: '1', title: 'GitHub Repo', url: 'https://github.com/user/repo', openedAt: Date.now() },
    { id: 2, uuid: '2', title: 'Stack Overflow', url: 'https://stackoverflow.com/questions/123', openedAt: Date.now() - 3600000 },
    { id: 3, uuid: '3', title: 'GitHub Issues', url: 'https://github.com/user/issues', openedAt: Date.now() - 7200000 }
  ];

  test('should group tabs by domain', () => {
    const groups = groupingEngine.groupByDomain(testTabs);
    expect(groups).toHaveLength(2);
    expect(groups.find(g => g.name === 'github.com').tabs).toHaveLength(2);
    expect(groups.find(g => g.name === 'stackoverflow.com').tabs).toHaveLength(1);
  });

  test('should group tabs by date', () => {
    const groups = groupingEngine.groupByDate(testTabs);
    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0].type).toBe('date');
  });

  test('should create custom groups', () => {
    const customGroup = groupingEngine.createCustomGroup('Work Projects', [testTabs[0], testTabs[1]]);
    expect(customGroup.name).toBe('Work Projects');
    expect(customGroup.type).toBe('custom');
    expect(customGroup.tabs).toHaveLength(2);
  });

  test('should assign tabs to existing groups', () => {
    const groups = groupingEngine.groupByDomain(testTabs.slice(0, 2));
    const updatedGroups = groupingEngine.assignTabsToGroups(groups, [testTabs[2]]);
    expect(updatedGroups.find(g => g.name === 'github.com').tabs).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test tests/unit/grouping-engine.test.js
# Expected: FAIL - GroupingEngine is not defined
```

- [ ] **Step 3: Implement GroupingEngine class**

```javascript
// utils/grouping-engine.js
class GroupingEngine {
  constructor() {
    this.groupStrategies = {
      domain: this.groupByDomain.bind(this),
      date: this.groupByDate.bind(this),
      custom: this.createCustomGroup.bind(this)
    };
  }

  groupByDomain(tabs) {
    const domainMap = new Map();

    tabs.forEach(tab => {
      const domain = this.extractDomain(tab.url);
      if (domain && !this.isExcludedDomain(domain)) {
        if (!domainMap.has(domain)) {
          domainMap.set(domain, []);
        }
        domainMap.get(domain).push(tab);
      }
    });

    return Array.from(domainMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([domain, domainTabs]) => ({
        id: `domain-${domain}`,
        name: domain,
        type: 'domain',
        tabs: domainTabs,
        collapsed: false,
        createdAt: Date.now(),
        version: 1
      }));
  }

  groupByDate(tabs) {
    const dateMap = new Map();

    tabs.forEach(tab => {
      const dateKey = this.getDateKey(tab.openedAt);
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, []);
      }
      dateMap.get(dateKey).push(tab);
    });

    return Array.from(dateMap.entries())
      .sort(([a], [b]) => b.localeCompare(a)) // Most recent first
      .map(([dateKey, dateTabs]) => ({
        id: `date-${dateKey}`,
        name: this.formatDateKey(dateKey),
        type: 'date',
        tabs: dateTabs,
        collapsed: false,
        createdAt: Date.now(),
        version: 1
      }));
  }

  createCustomGroup(name, tabs = []) {
    return {
      id: `custom-${this.generateGroupId()}`,
      name: this.sanitizeGroupName(name),
      type: 'custom',
      tabs: tabs,
      collapsed: false,
      createdAt: Date.now(),
      version: 1
    };
  }

  assignTabsToGroups(existingGroups, newTabs) {
    const groups = [...existingGroups];

    newTabs.forEach(tab => {
      let assigned = false;

      // Try to find matching group
      for (const group of groups) {
        if (this.tabBelongsToGroup(tab, group)) {
          group.tabs.push(tab);
          assigned = true;
          break;
        }
      }

      // If no matching group found, create domain group
      if (!assigned) {
        const domain = this.extractDomain(tab.url);
        if (domain && !this.isExcludedDomain(domain)) {
          const domainGroup = this.createDomainGroup(domain, [tab]);
          groups.push(domainGroup);
        }
      }
    });

    return groups;
  }

  removeTabFromGroups(groups, tabUuid) {
    return groups.map(group => {
      const filteredTabs = group.tabs.filter(tab => tab.uuid !== tabUuid);
      return {
        ...group,
        tabs: filteredTabs
      };
    }).filter(group => group.tabs.length > 0); // Remove empty groups
  }

  moveTabToGroup(groups, tabUuid, targetGroupId) {
    let movedTab = null;

    // Remove tab from all groups
    const updatedGroups = groups.map(group => {
      const tabIndex = group.tabs.findIndex(tab => tab.uuid === tabUuid);
      if (tabIndex > -1) {
        movedTab = group.tabs[tabIndex];
        return {
          ...group,
          tabs: group.tabs.filter((_, index) => index !== tabIndex)
        };
      }
      return group;
    });

    // Add tab to target group
    if (movedTab) {
      const targetGroupIndex = updatedGroups.findIndex(group => group.id === targetGroupId);
      if (targetGroupIndex > -1) {
        updatedGroups[targetGroupIndex].tabs.push(movedTab);
      }
    }

    return updatedGroups.filter(group => group.tabs.length > 0);
  }

  mergeGroups(groups, sourceGroupId, targetGroupId) {
    const sourceGroupIndex = groups.findIndex(group => group.id === sourceGroupId);
    const targetGroupIndex = groups.findIndex(group => group.id === targetGroupId);

    if (sourceGroupIndex === -1 || targetGroupIndex === -1) {
      return groups;
    }

    const sourceGroup = groups[sourceGroupIndex];
    const targetGroup = groups[targetGroupIndex];

    // Merge tabs
    targetGroup.tabs = [...targetGroup.tabs, ...sourceGroup.tabs];

    // Remove source group
    const updatedGroups = groups.filter((_, index) => index !== sourceGroupIndex);

    return updatedGroups;
  }

  sortGroups(groups, sortBy = 'name') {
    const sortedGroups = [...groups];

    switch (sortBy) {
      case 'name':
        return sortedGroups.sort((a, b) => a.name.localeCompare(b.name));
      case 'tabCount':
        return sortedGroups.sort((a, b) => b.tabs.length - a.tabs.length);
      case 'createdAt':
        return sortedGroups.sort((a, b) => b.createdAt - a.createdAt);
      default:
        return sortedGroups;
    }
  }

  filterGroups(groups, searchTerm) {
    if (!searchTerm) return groups;

    const term = searchTerm.toLowerCase();
    return groups.map(group => {
      const matchingTabs = group.tabs.filter(tab =>
        tab.title.toLowerCase().includes(term) ||
        tab.url.toLowerCase().includes(term) ||
        (tab.note && tab.note.toLowerCase().includes(term))
      );

      if (matchingTabs.length > 0 || group.name.toLowerCase().includes(term)) {
        return {
          ...group,
          tabs: matchingTabs.length > 0 ? matchingTabs : group.tabs
        };
      }

      return null;
    }).filter(group => group !== null);
  }

  private extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      return null;
    }
  }

  private isExcludedDomain(domain) {
    const excludedDomains = [
      'newtab',
      'about:blank',
      'chrome://'
    ];
    return excludedDomains.some(excluded => domain.includes(excluded));
  }

  private getDateKey(timestamp) {
    const date = new Date(timestamp);
    const today = new Date();

    // Check if it's today
    if (date.toDateString() === today.toDateString()) {
      const hours = Math.floor((today - date) / (1000 * 60 * 60));
      if (hours < 1) return 'today-recent';
      return `today-${hours}h-ago`;
    }

    // Check if it's yesterday
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'yesterday';
    }

    // Return date string for older dates
    return date.toISOString().split('T')[0];
  }

  private formatDateKey(dateKey) {
    switch (dateKey) {
      case 'today-recent':
        return 'Today (Recent)';
      case 'today-0h-ago':
      case 'today-1h-ago':
        return 'Today (Less than 1 hour ago)';
      case 'today-2h-ago':
        return 'Today (2 hours ago)';
      case 'today-3h-ago':
        return 'Today (3 hours ago)';
      case 'yesterday':
        return 'Yesterday';
      default:
        if (dateKey.includes('today-')) {
          const hours = dateKey.match(/today-(\d+)h-ago/)?.[1];
          return `Today (${hours} hours ago)`;
        }
        // Format date string
        const date = new Date(dateKey);
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
        });
    }
  }

  private createDomainGroup(domain, tabs) {
    return {
      id: `domain-${domain}`,
      name: domain,
      type: 'domain',
      tabs: tabs,
      collapsed: false,
      createdAt: Date.now(),
      version: 1
    };
  }

  private tabBelongsToGroup(tab, group) {
    switch (group.type) {
      case 'domain':
        const domain = this.extractDomain(tab.url);
        return domain && group.name === domain;
      case 'date':
        const dateKey = this.getDateKey(tab.openedAt);
        return group.id === `date-${dateKey}`;
      case 'custom':
        return group.tabs.some(existingTab => existingTab.uuid === tab.uuid);
      default:
        return false;
    }
  }

  private generateGroupId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private sanitizeGroupName(name) {
    return name.trim().substring(0, 50); // Limit name length
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GroupingEngine;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test tests/unit/grouping-engine.test.js
# Expected: PASS - All tests should pass
```

- [ ] **Step 5: Commit GroupingEngine implementation**

```bash
git add utils/grouping-engine.js tests/unit/grouping-engine.test.js
git commit -m "feat: implement grouping engine with domain, date, and custom grouping"
```

### Task 7: Service Worker (Main Background Script)

**Files:**
- Create: `background/service-worker.js`

- [ ] **Step 1: Implement main service worker**

```javascript
// background/service-worker.js
importScripts(
  './event-bus.js',
  './privacy-manager.js',
  './storage-manager.js',
  './tab-manager.js',
  '../utils/grouping-engine.js',
  '../utils/performance-monitor.js'
);

class TabFlowExtension {
  constructor() {
    this.eventBus = new EventBus();
    this.privacyManager = new PrivacyManager();
    this.storageManager = null;
    this.tabManager = null;
    this.groupingEngine = new GroupingEngine();
    this.performanceMonitor = PerformanceMonitor.getInstance();

    this.isInitialized = false;
    this.settings = null;
  }

  async initialize() {
    try {
      console.log('🚀 TabFlow Extension Starting...');

      // Initialize components in order
      await this.initializeStorage();
      await this.initializeTabManager();
      await this.loadSettings();
      await this.setupEventHandlers();
      await this.setupContextMenus();
      await this.setupCommands();

      // Perform initial cleanup if needed
      await this.performScheduledCleanup();

      this.isInitialized = true;
      console.log('✅ TabFlow Extension Initialized Successfully');

      return true;
    } catch (error) {
      console.error('❌ Failed to initialize TabFlow:', error);
      return false;
    }
  }

  async initializeStorage() {
    try {
      this.storageManager = new StorageManager(this.privacyManager);

      // Check storage quota
      const hasQuota = await this.storageManager.checkStorageQuota();
      if (!hasQuota) {
        this.eventBus.emit('storage:quota-exceeded');
      }

      console.log('💾 Storage Manager Initialized');
    } catch (error) {
      console.error('Failed to initialize storage:', error);
      throw error;
    }
  }

  async initializeTabManager() {
    try {
      this.tabManager = new TabManager(this.eventBus, this.storageManager);
      await this.tabManager.initialize();
      console.log('📋 Tab Manager Initialized');
    } catch (error) {
      console.error('Failed to initialize tab manager:', error);
      throw error;
    }
  }

  async loadSettings() {
    try {
      this.settings = await this.storageManager.getSettings();
      console.log('⚙️ Settings Loaded');
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.settings = {
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
    }
  }

  setupEventHandlers() {
    // Tab events
    this.eventBus.on('tab:created', this.handleTabCreated.bind(this));
    this.eventBus.on('tab:removed', this.handleTabRemoved.bind(this));
    this.eventBus.on('tab:updated', this.handleTabUpdated.bind(this));
    this.eventBus.on('tab:activated', this.handleTabActivated.bind(this));

    // Memory management
    this.eventBus.on('memory:cleanup', this.handleMemoryCleanup.bind(this));
    this.eventBus.on('storage:quota-exceeded', this.handleStorageQuotaExceeded.bind(this));

    // UI events
    this.eventBus.on('ui:group-tabs', this.handleGroupTabs.bind(this));
    this.eventBus.on('ui:create-group', this.handleCreateGroup.bind(this));
    this.eventBus.on('ui:delete-group', this.handleDeleteGroup.bind(this));
    this.eventBus.on('ui:move-tab', this.handleMoveTab.bind(this));
    this.eventBus.on('ui:add-note', this.handleAddNote.bind(this));
    this.eventBus.on('ui:search-tabs', this.handleSearchTabs.bind(this));

    // Performance monitoring
    setInterval(() => {
      this.performanceMonitor.checkMemoryUsage();
    }, 30000); // Check every 30 seconds

    console.log('🔗 Event Handlers Setup Complete');
  }

  async setupContextMenus() {
    try {
      // Remove existing menus
      chrome.contextMenus.removeAll();

      // Create tab context menu
      chrome.contextMenus.create({
        id: 'tabflow-add-note',
        title: '📝 Add Note to Tab',
        contexts: ['all']
      });

      chrome.contextMenus.create({
        id: 'tabflow-separator-1',
        type: 'separator',
        contexts: ['all']
      });

      chrome.contextMenus.create({
        id: 'tabflow-close-tab',
        title: '🗑️ Close Tab',
        contexts: ['all']
      });

      // Handle menu clicks
      chrome.contextMenus.onClicked.addListener(this.handleContextMenuClick.bind(this));

      console.log('📋 Context Menus Setup Complete');
    } catch (error) {
      console.error('Failed to setup context menus:', error);
    }
  }

  setupCommands() {
    try {
      // Listen for keyboard shortcuts
      chrome.commands.onCommand.addListener(this.handleCommand.bind(this));
      console.log('⌨️ Commands Setup Complete');
    } catch (error) {
      console.error('Failed to setup commands:', error);
    }
  }

  async performScheduledCleanup() {
    try {
      const metadata = await this.storageManager.getMetadata();
      const lastCleanup = metadata.lastCleanup || 0;
      const now = Date.now();
      const dayInMs = 24 * 60 * 60 * 1000;

      // Perform cleanup if it's been more than a day
      if (now - lastCleanup > dayInMs) {
        console.log('🧹 Performing scheduled cleanup...');

        const removedCount = await this.storageManager.performAutoCleanup(
          this.settings.privacy
        );

        console.log(`🧹 Cleanup complete: removed ${removedCount} old tabs`);
      }
    } catch (error) {
      console.error('Failed to perform scheduled cleanup:', error);
    }
  }

  // Event Handlers
  async handleTabCreated(tab) {
    try {
      console.log('📝 Tab created:', tab.title);
      // Additional processing if needed
    } catch (error) {
      console.error('Error handling tab creation:', error);
    }
  }

  async handleTabRemoved(data) {
    try {
      console.log('🗑️ Tab removed:', data.tabId);
      // Additional processing if needed
    } catch (error) {
      console.error('Error handling tab removal:', error);
    }
  }

  async handleTabUpdated(data) {
    try {
      // Additional processing if needed
    } catch (error) {
      console.error('Error handling tab update:', error);
    }
  }

  async handleTabActivated(tab) {
    try {
      console.log('🎯 Tab activated:', tab.title);
      // Additional processing if needed
    } catch (error) {
      console.error('Error handling tab activation:', error);
    }
  }

  async handleMemoryCleanup() {
    try {
      console.log('🧠 Memory cleanup triggered');
      await this.tabManager.performCleanup();
    } catch (error) {
      console.error('Error during memory cleanup:', error);
    }
  }

  async handleStorageQuotaExceeded() {
    try {
      console.warn('💾 Storage quota exceeded');
      await this.tabManager.handleQuotaExceeded();
    } catch (error) {
      console.error('Error handling storage quota exceeded:', error);
    }
  }

  async handleGroupTabs(data) {
    try {
      const { tabs, groupBy } = data;
      let groups;

      switch (groupBy) {
        case 'domain':
          groups = this.groupingEngine.groupByDomain(tabs);
          break;
        case 'date':
          groups = this.groupingEngine.groupByDate(tabs);
          break;
        default:
          groups = this.groupingEngine.groupByDomain(tabs);
      }

      this.eventBus.emit('ui:groups-updated', groups);
    } catch (error) {
      console.error('Error grouping tabs:', error);
    }
  }

  async handleCreateGroup(data) {
    try {
      const { name, tabs } = data;
      const group = this.groupingEngine.createCustomGroup(name, tabs);
      await this.storageManager.saveGroup(group);
      this.eventBus.emit('ui:group-created', group);
    } catch (error) {
      console.error('Error creating group:', error);
    }
  }

  async handleDeleteGroup(data) {
    try {
      const { groupId } = data;
      await this.storageManager.removeGroup(groupId);
      this.eventBus.emit('ui:group-deleted', { groupId });
    } catch (error) {
      console.error('Error deleting group:', error);
    }
  }

  async handleMoveTab(data) {
    try {
      const { tabUuid, targetGroupId } = data;
      const groups = await this.storageManager.getAllGroups();
      const updatedGroups = this.groupingEngine.moveTabToGroup(
        Object.values(groups),
        tabUuid,
        targetGroupId
      );

      // Save updated groups
      for (const group of updatedGroups) {
        await this.storageManager.saveGroup(group);
      }

      this.eventBus.emit('ui:groups-updated', updatedGroups);
    } catch (error) {
      console.error('Error moving tab:', error);
    }
  }

  async handleAddNote(data) {
    try {
      const { tabUuid, note } = data;
      const tab = await this.storageManager.getTab(tabUuid);

      if (tab) {
        tab.note = note;
        await this.storageManager.saveTab(tab);
        this.eventBus.emit('ui:tab-updated', tab);
      }
    } catch (error) {
      console.error('Error adding note:', error);
    }
  }

  async handleSearchTabs(data) {
    try {
      const { searchTerm } = data;
      const groups = await this.storageManager.getAllGroups();
      const filteredGroups = this.groupingEngine.filterGroups(
        Object.values(groups),
        searchTerm
      );
      this.eventBus.emit('ui:search-results', filteredGroups);
    } catch (error) {
      console.error('Error searching tabs:', error);
    }
  }

  async handleContextMenuClick(info, tab) {
    try {
      switch (info.menuItemId) {
        case 'tabflow-add-note':
          // Send message to UI to show note dialog
          this.eventBus.emit('ui:show-note-dialog', { tabId: tab.id });
          break;
        case 'tabflow-close-tab':
          chrome.tabs.remove(tab.id);
          break;
      }
    } catch (error) {
      console.error('Error handling context menu click:', error);
    }
  }

  async handleCommand(command) {
    try {
      switch (command) {
        case 'open-side-panel':
          // Open side panel if not already open
          chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
          break;
        case 'refresh-tabs':
          await this.tabManager.initialize();
          break;
      }
    } catch (error) {
      console.error('Error handling command:', error);
    }
  }

  // Lifecycle Management
  async shutdown() {
    console.log('🔄 TabFlow Extension Shutting Down...');

    // Cleanup resources
    if (this.tabManager) {
      // Cleanup tab manager resources
    }

    if (this.eventBus) {
      this.eventBus.removeAllListeners();
    }

    console.log('✅ TabFlow Extension Shutdown Complete');
  }
}

// Global extension instance
let tabFlowExtension = null;

// Service Worker Lifecycle Events
try {
  // Install event
  chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('🔧 TabFlow Extension Installed/Updated:', details.reason);

    if (!tabFlowExtension) {
      tabFlowExtension = new TabFlowExtension();
    }

    await tabFlowExtension.initialize();
  });

  // Startup event
  chrome.runtime.onStartup.addListener(async () => {
    console.log('🚀 TabFlow Extension Starting Up...');

    if (!tabFlowExtension) {
      tabFlowExtension = new TabFlowExtension();
    }

    await tabFlowExtension.initialize();
  });

  // Message handling
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!tabFlowExtension) {
      sendResponse({ error: 'Extension not initialized' });
      return false;
    }

    // Handle messages from UI
    tabFlowExtension.eventBus.emit('message:received', {
      message,
      sender,
      sendResponse
    });

    return true; // Keep message channel open for async response
  });

  // Side panel events
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

  // Initialize immediately if possible
  if (chrome.runtime.id) {
    tabFlowExtension = new TabFlowExtension();
    tabFlowExtension.initialize().catch(console.error);
  }

  console.log('🎯 TabFlow Service Worker Loaded');
} catch (error) {
  console.error('❌ Failed to setup TabFlow service worker:', error);
}

// Handle service worker termination
self.addEventListener('beforeunload', () => {
  if (tabFlowExtension) {
    tabFlowExtension.shutdown();
  }
});
```

- [ ] **Step 2: Commit Service Worker implementation**

```bash
git add background/service-worker.js
git commit -m "feat: implement main service worker with lifecycle management"
```

### Task 8: Performance Monitor

**Files:**
- Create: `utils/performance-monitor.js`
- Test: `tests/unit/performance-monitor.test.js`

- [ ] **Step 1: Write failing test for performance monitor**

```javascript
// tests/unit/performance-monitor.test.js
describe('PerformanceMonitor', () => {
  let performanceMonitor;

  beforeEach(() => {
    performanceMonitor = PerformanceMonitor.getInstance();
  });

  test('should be a singleton', () => {
    const instance1 = PerformanceMonitor.getInstance();
    const instance2 = PerformanceMonitor.getInstance();
    expect(instance1).toBe(instance2);
  });

  test('should check memory usage', () => {
    // Mock performance.memory
    global.performance = {
      memory: {
        usedJSHeapSize: 25 * 1024 * 1024 // 25MB
      }
    };

    const consoleSpy = jest.spyOn(console, 'log');
    performanceMonitor.checkMemoryUsage();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Memory usage:'));
  });

  test('should trigger cleanup when memory limit exceeded', () => {
    global.performance = {
      memory: {
        usedJSHeapSize: 60 * 1024 * 1024 // 60MB (exceeds 50MB limit)
      }
    };

    const eventBus = { emit: jest.fn() };
    performanceMonitor.eventBus = eventBus;

    performanceMonitor.checkMemoryUsage();
    expect(eventBus.emit).toHaveBeenCalledWith('memory:cleanup');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test tests/unit/performance-monitor.test.js
# Expected: FAIL - PerformanceMonitor is not defined
```

- [ ] **Step 3: Implement PerformanceMonitor class**

```javascript
// utils/performance-monitor.js
class PerformanceMonitor {
  constructor() {
    this.maxMemory = 50 * 1024 * 1024; // 50MB limit
    this.eventBus = null;
    this.memoryUsage = 0;
    this.performanceMetrics = {
      tabOperations: 0,
      groupOperations: 0,
      lastCleanup: Date.now()
    };
  }

  static getInstance() {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  setEventBus(eventBus) {
    this.eventBus = eventBus;
  }

  checkMemoryUsage() {
    if ('memory' in performance) {
      const usedMemory = performance.memory.usedJSHeapSize;
