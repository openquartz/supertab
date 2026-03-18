# TabFlow Implementation Design

## 1. Project Overview

**TabFlow** is a professional Chrome tab management extension built with Manifest V3 that helps users organize and manage browser tabs with smart grouping, notes, and batch operations.

### 1.1 Implementation Approach
- **Monolithic Implementation**: Complete MVP with all core features
- **macOS Glassmorphism UI**: Modern translucent design from ui-demo.html
- **Full Privacy Features**: Encryption, domain exclusion, auto-cleanup included from start
- **Manifest V3 Architecture**: Modern Chrome extension standards

## 2. Architecture Design

### 2.1 Core Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Browser                          │
│  ┌─────────────────┐    ┌─────────────────────────────┐    │
│  │   TabFlow UI    │    │    Background Service      │    │
│  │   (SidePanel)   │◄──►│     (Service Worker)       │    │
│  └─────────────────┘    └─────────────────────────────┘    │
│          │                          │                      │
│          │                          ▼                      │
│          │              ┌─────────────────────────────┐    │
│          │              │     Chrome APIs             │    │
│          │              │  ┌─ chrome.tabs            │    │
│          │              │  ├─ chrome.storage         │    │
│          └──────────────┼─►│  ├─ chrome.sidePanel      │    │
│                         │  └─ chrome.contextMenus    │    │
│                         └─────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Component Architecture

**Background Layer (Service Worker)**
- `service-worker.js`: Entry point, lifecycle management
- `tab-manager.js`: Chrome tabs API integration
- `storage-manager.js`: Data persistence and privacy
- `event-bus.js`: Inter-component communication

**UI Layer (Side Panel)**
- `sidebar.html`: Main UI structure
- `sidebar.js`: UI logic and state management
- `sidebar.css`: macOS glassmorphism styling
- Component library: `tab-item.js`, `group-item.js`, etc.

**Utility Layer**
- `grouping-engine.js`: Smart grouping algorithms
- `privacy-manager.js`: Encryption and privacy controls
- `performance-monitor.js`: Performance optimization

## 3. Data Design

### 3.1 Core Data Structures

**Tab Interface:**
```typescript
interface Tab {
  id: number;                    // Chrome tab ID
  uuid: string;                  // Unique identifier for persistence
  title: string;                 // Tab title
  url: string;                   // Full URL
  favicon?: string;              // Favicon URL
  note?: string;                 // User note (encrypted if enabled)
  groupId: string;               // Current group assignment
  windowId?: number;             // Support multi-window management
  openedAt: number;              // Timestamp for grouping
  lastAccessed?: number;         // For LRU cleanup
}
```

**Group Interface:**
```typescript
interface TabGroup {
  id: string;                    // Unique group identifier
  name: string;                  // Display name
  type: 'domain' | 'date' | 'custom'; // Group type
  tabs: Tab[];                   // Contained tabs
  collapsed: boolean;            // UI state
  createdAt: number;             // Creation timestamp
  version: number;               // Data version for migrations
  parentId?: string;             // For nested groups
  color?: string;                // Custom group color
}
```

**Privacy Settings:**
```typescript
interface PrivacySettings {
  encryptNotes: boolean;         // Enable note encryption
  excludeDomains: string[];      // Domains to exclude from tracking
  autoCleanupDays: number;       // Days before auto-cleanup (default: 30)
  encryptionKey?: string;        // Local encryption key
}
```

### 3.2 Storage Schema

**chrome.storage.local Structure:**
```javascript
{
  "tabflow:tabs": {           // All tracked tabs
    "uuid-123": { /* Tab */ },
    "uuid-456": { /* Tab */ }
  },
  "tabflow:groups": {         // All groups
    "group-123": { /* TabGroup */ },
    "group-456": { /* TabGroup */ }
  },
  "tabflow:settings": {       // User settings
    privacy: { /* PrivacySettings */ },
    ui: { collapsedGroups: [] },
    preferences: { defaultView: "domain" }
  },
  "tabflow:metadata": {       // System metadata
    version: "1.0.0",
    lastCleanup: 1679423400000,
    schemaVersion: 1
  }
}
```

## 4. Feature Implementation

### 4.1 Smart Grouping Engine

**Domain Grouping Algorithm:**
```javascript
function groupByDomain(tabs: Tab[]): TabGroup[] {
  const domainMap = new Map<string, Tab[]>();

  tabs.forEach(tab => {
    const domain = extractDomain(tab.url);
    if (!domainMap.has(domain)) {
      domainMap.set(domain, []);
    }
    domainMap.get(domain)!.push(tab);
  });

  return Array.from(domainMap.entries()).map(([domain, tabs]) => ({
    id: `domain-${domain}`,
    name: domain,
    type: 'domain',
    tabs,
    collapsed: false,
    createdAt: Date.now(),
    version: 1
  }));
}
```

**Date Grouping Algorithm:**
```javascript
function groupByDate(tabs: Tab[]): TabGroup[] {
  const dateMap = new Map<string, Tab[]>();

  tabs.forEach(tab => {
    const dateKey = getDateKey(tab.openedAt);
    if (!dateMap.has(dateKey)) {
      dateMap.set(dateKey, []);
    }
    dateMap.get(dateKey)!.push(tab);
  });

  return Array.from(dateMap.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, tabs]) => ({
      id: `date-${dateKey}`,
      name: formatDateKey(dateKey),
      type: 'date',
      tabs,
      collapsed: false,
      createdAt: Date.now(),
      version: 1
    }));
}
```

### 4.2 Privacy & Security Implementation

**Note Encryption:**
```javascript
class PrivacyManager {
  private encryptionKey: string;

  constructor() {
    this.encryptionKey = this.getOrCreateEncryptionKey();
  }

  encryptNote(note: string): string {
    // AES encryption implementation
    const encoder = new TextEncoder();
    const data = encoder.encode(note);
    // ... encryption logic
    return encryptedData;
  }

  decryptNote(encryptedNote: string): string {
    // AES decryption implementation
    // ... decryption logic
    return decryptedData;
  }

  shouldExcludeTab(url: string, excludeDomains: string[]): boolean {
    const domain = extractDomain(url);
    return excludeDomains.some(excluded =>
      domain === excluded || domain.endsWith(`.${excluded}`)
    );
  }
}
```

**Auto-Cleanup System:**
```javascript
class StorageManager {
  async performAutoCleanup(settings: PrivacySettings): Promise<void> {
    const cutoffTime = Date.now() - (settings.autoCleanupDays * 24 * 60 * 60 * 1000);

    // Remove old tabs
    const tabs = await this.getAllTabs();
    const oldTabs = tabs.filter(tab => tab.openedAt < cutoffTime);

    for (const tab of oldTabs) {
      await this.removeTab(tab.uuid);
    }

    // Update metadata
    await this.updateMetadata({ lastCleanup: Date.now() });
  }
}
```

### 4.3 Real-time Synchronization

**Event System:**
```javascript
class EventBus {
  private listeners: Map<string, Function[]> = new Map();

  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  emit(event: string, data?: any): void {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(callback => callback(data));
  }
}

class TabManager {
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    chrome.tabs.onCreated.addListener((tab) => {
      this.eventBus.emit('tab:created', tab);
    });

    chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
      this.eventBus.emit('tab:removed', { tabId, removeInfo });
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      // Debounce rapid updates
      this.debounce(() => {
        this.eventBus.emit('tab:updated', { tabId, changeInfo, tab });
      }, 300);
    });
  }
}
```

## 5. UI Implementation (macOS Glassmorphism)

### 5.1 CSS Variables & Theme

```css
:root {
  /* Glassmorphism Backgrounds */
  --tf-bg-primary: rgba(255, 255, 255, 0.72);
  --tf-bg-secondary: rgba(255, 255, 255, 0.54);
  --tf-bg-tertiary: rgba(255, 255, 255, 0.36);

  /* Text Colors */
  --tf-text-primary: #1D1D1F;
  --tf-text-secondary: #86868B;
  --tf-text-muted: #A1A1A6;

  /* Primary Colors */
  --tf-primary: #007AFF;
  --tf-primary-hover: #0056CC;

  /* Borders & Shadows */
  --tf-border: rgba(0, 0, 0, 0.08);
  --tf-border-light: rgba(0, 0, 0, 0.04);
  --tf-shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.08);
  --tf-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.12);
  --tf-shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.16);

  /* Animation Curves */
  --tf-transition-liquid: cubic-bezier(0.34, 1.56, 0.64, 1);
  --tf-transition-smooth: cubic-bezier(0.25, 0.1, 0.25, 1);
}
```

### 5.2 Component Architecture

**Tab Item Component:**
```javascript
class TabItem extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  set tab(tab) {
    this._tab = tab;
    this.render();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        .tab-item {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          border-bottom: 1px solid var(--tf-border-light);
          cursor: pointer;
          transition: all 250ms var(--tf-transition-liquid);
        }
        .tab-item:hover {
          background: var(--tf-bg-tertiary);
          padding-left: 14px;
        }
        /* ... more styles */
      </style>
      <div class="tab-item">
        <div class="favicon">
          <img src="${this._tab.favicon || 'default-favicon.png'}" alt="">
        </div>
        <div class="content">
          <div class="title">${this._tab.title}</div>
          ${this._tab.note ? `<div class="note">📝 ${this._tab.note}</div>` : ''}
          <div class="url">${this._tab.url}</div>
        </div>
        <div class="actions">
          <button class="btn-note" title="Edit note">📝</button>
          <button class="btn-close" title="Close tab">✕</button>
        </div>
      </div>
    `;
  }
}

customElements.define('tab-item', TabItem);
```

## 6. Performance Optimization

### 6.1 Virtual Scrolling
```javascript
class VirtualScroller {
  private container: HTMLElement;
  private items: any[];
  private itemHeight: number = 60;
  private visibleCount: number;

  constructor(container: HTMLElement, items: any[]) {
    this.container = container;
    this.items = items;
    this.visibleCount = Math.ceil(container.clientHeight / this.itemHeight) + 2;
  }

  renderVisibleItems(scrollTop: number = 0): void {
    const startIndex = Math.floor(scrollTop / this.itemHeight);
    const endIndex = Math.min(startIndex + this.visibleCount, this.items.length);

    // Render only visible items for performance
    const fragment = document.createDocumentFragment();
    for (let i = startIndex; i < endIndex; i++) {
      const item = this.renderItem(this.items[i]);
      fragment.appendChild(item);
    }

    this.container.innerHTML = '';
    this.container.appendChild(fragment);
  }
}
```

### 6.2 Memory Management
```javascript
class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private memoryUsage: number = 0;
  private maxMemory: number = 50 * 1024 * 1024; // 50MB limit

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  checkMemoryUsage(): void {
    if ('memory' in performance) {
      const usedMemory = (performance as any).memory.usedJSHeapSize;
      this.memoryUsage = usedMemory;

      if (usedMemory > this.maxMemory) {
        this.triggerCleanup();
      }
    }
  }

  private triggerCleanup(): void {
    // Trigger garbage collection for old data
    this.eventBus.emit('memory:cleanup');
  }
}
```

## 7. Testing Strategy

### 7.1 Unit Tests
- Tab grouping algorithms
- Privacy encryption/decryption
- Storage operations
- Component rendering

### 7.2 Integration Tests
- Chrome API integration
- Real-time synchronization
- UI interaction flows
- Cross-component communication

### 7.3 Performance Tests
- Large dataset handling (500+ tabs)
- Memory usage monitoring
- Response time benchmarks

## 8. Deployment Plan

### 8.1 Development Phase
1. **Week 1-2**: Core architecture and basic functionality
2. **Week 3-4**: UI implementation and user interactions
3. **Week 5**: Privacy features and security implementation
4. **Week 6**: Performance optimization and testing

### 8.2 Testing Phase
1. **Internal Testing**: Functionality and stability
2. **Performance Testing**: Large dataset handling
3. **Security Audit**: Privacy and data protection
4. **User Acceptance Testing**: Real-world usage scenarios

### 8.3 Release Phase
1. **Chrome Web Store Submission**: Package and submit for review
2. **Documentation**: User guide and technical documentation
3. **Monitoring**: Performance and error tracking setup

---

This design document provides a comprehensive implementation guide for TabFlow. The monolithic approach ensures all features work together seamlessly while maintaining modular architecture for future extensibility.