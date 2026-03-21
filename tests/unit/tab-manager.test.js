const GroupingEngine = require('../../utils/grouping-engine');

// Make GroupingEngine available globally (as the service worker would)
global.GroupingEngine = GroupingEngine;

const TabManager = require('../../background/tab-manager');

describe('TabManager', () => {
  let tabManager;
  let mockEventBus;
  let mockStorageManager;
  let mockPrivacyManager;

  beforeEach(() => {
    // Create mock dependencies
    mockEventBus = {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
      removeAllListeners: jest.fn()
    };

    mockStorageManager = {
      getAllTabs: jest.fn().mockResolvedValue({}),
      saveTab: jest.fn().mockResolvedValue(true),
      getTab: jest.fn().mockResolvedValue(null),
      removeTab: jest.fn().mockResolvedValue(true),
      removeGroup: jest.fn().mockResolvedValue(true),
      saveGroup: jest.fn().mockResolvedValue(true),
      getGroup: jest.fn().mockResolvedValue(null),
      getAllGroups: jest.fn().mockResolvedValue({})
    };

    mockPrivacyManager = {
      shouldExcludeUrl: jest.fn().mockReturnValue(false),
      processTabData: jest.fn().mockImplementation(tab => Promise.resolve(tab)),
      processRetrievedTabData: jest.fn().mockImplementation(tab => Promise.resolve(tab))
    };

    tabManager = new TabManager(mockEventBus, mockStorageManager, mockPrivacyManager);
    global.chrome = {
      ...global.chrome,
      tabs: {
        ...global.chrome.tabs,
        query: jest.fn().mockResolvedValue([])
      }
    };
  });

  describe('initialize', () => {
    test('should setup event listeners during initialization', async () => {
      await tabManager.initialize();

      expect(mockEventBus.on).toHaveBeenCalledWith('storage_changed', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('tab_created', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('tab_removed', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('tab_updated', expect.any(Function));
    });

    test('should load existing tabs from storage', async () => {
      mockStorageManager.getAllTabs.mockResolvedValue({
        'tab1': { id: 1, title: 'Tab 1', url: 'https://example.com' }
      });

      await tabManager.initialize();

      expect(tabManager.tabMetrics.totalTabs).toBe(1);
    });
  });

  describe('handleTabCreated', () => {
    test('should create and save a new tab', async () => {
      const mockTab = {
        id: 1,
        title: 'New Tab',
        url: 'https://example.com',
        favIconUrl: 'https://example.com/favicon.ico',
        windowId: 1,
        index: 0,
        pinned: false
      };

      const result = await tabManager.handleTabCreated(mockTab);

      expect(result).toBeDefined();
      expect(result.title).toBe('New Tab');
      expect(mockStorageManager.saveTab).toHaveBeenCalled();
      expect(mockEventBus.emit).toHaveBeenCalledWith('tab_created', expect.any(Object));
    });

    test('should exclude tab based on privacy settings', async () => {
      mockPrivacyManager.shouldExcludeUrl.mockReturnValue(true);

      const mockTab = {
        id: 1,
        title: 'Private Tab',
        url: 'https://bank.com/account'
      };

      const result = await tabManager.handleTabCreated(mockTab);

      expect(result).toBeUndefined();
      expect(mockStorageManager.saveTab).not.toHaveBeenCalled();
    });

    test('should exclude tab when privacy manager returns null', async () => {
      mockPrivacyManager.processTabData.mockResolvedValue(null);

      const mockTab = {
        id: 1,
        title: 'Excluded Tab',
        url: 'https://example.com'
      };

      const result = await tabManager.handleTabCreated(mockTab);

      expect(result).toBeUndefined();
    });
  });

  describe('handleTabUpdated', () => {
    test('should update existing tab', async () => {
      const existingTab = {
        id: 1,
        uuid: 'tab-123',
        title: 'Original Title',
        url: 'https://original.com',
        visitCount: 1,
        lastAccessed: Date.now() - 1000
      };

      tabManager.activeTabs.set(1, existingTab);

      const updatedTab = {
        id: 1,
        title: 'New Title',
        url: 'https://new-url.com',
        favIconUrl: 'https://new-url.com/favicon.ico'
      };

      const result = await tabManager.handleTabUpdated(updatedTab);

      expect(result).toBeDefined();
      expect(result.title).toBe('New Title');
      expect(result.visitCount).toBe(2);
    });

    test('should treat non-existing tab as new tab', async () => {
      mockStorageManager.saveTab.mockResolvedValue(true);

      const newTab = {
        id: 999,
        title: 'Brand New Tab',
        url: 'https://new.com'
      };

      await tabManager.handleTabUpdated(newTab);

      expect(mockStorageManager.saveTab).toHaveBeenCalled();
    });
  });

  describe('handleTabRemoved', () => {
    test('should remove tab from storage and cache', async () => {
      const tabData = {
        id: 1,
        uuid: 'tab-123',
        title: 'To Be Removed'
      };

      tabManager.activeTabs.set(1, tabData);
      tabManager.tabMetrics.totalTabs = 1;

      await tabManager.handleTabRemoved(1, {});

      expect(mockStorageManager.removeTab).toHaveBeenCalledWith('tab-123');
      expect(tabManager.activeTabs.has(1)).toBe(false);
      expect(tabManager.tabMetrics.totalTabs).toBe(0);
      expect(mockEventBus.emit).toHaveBeenCalledWith('tab_removed', expect.any(Object));
    });

    test('should handle non-existing tab gracefully', async () => {
      await tabManager.handleTabRemoved(999, {});

      expect(mockStorageManager.removeTab).not.toHaveBeenCalled();
    });
  });

  describe('handleTabActivated', () => {
    test('should update lastAccessed time on activation', async () => {
      const tabData = {
        id: 1,
        uuid: 'tab-123',
        title: 'Activated Tab',
        lastAccessed: Date.now() - 10000
      };

      tabManager.activeTabs.set(1, tabData);

      await tabManager.handleTabActivated({ tabId: 1 });

      expect(mockStorageManager.saveTab).toHaveBeenCalled();
      expect(mockEventBus.emit).toHaveBeenCalledWith('tab_activated', expect.any(Object));
    });
  });

  describe('handleTabMoved', () => {
    test('should update tab position after move', async () => {
      const tabData = {
        id: 1,
        uuid: 'tab-123',
        index: 0,
        windowId: 1
      };

      tabManager.activeTabs.set(1, tabData);

      await tabManager.handleTabMoved(1, { toIndex: 5, windowId: 1 });

      expect(tabData.index).toBe(5);
      expect(mockStorageManager.saveTab).toHaveBeenCalled();
      expect(mockEventBus.emit).toHaveBeenCalledWith('tab_moved', expect.any(Object));
    });
  });

  describe('createCustomGroup', () => {
    test('should create a new custom group', async () => {
      const result = await tabManager.createCustomGroup('My Group', 'Test description');

      expect(result).toBeDefined();
      expect(result.name).toBe('My Group');
      expect(result.description).toBe('Test description');
      expect(result.type).toBe('custom');
      expect(result.color).toBeDefined();
      expect(mockStorageManager.saveGroup).toHaveBeenCalled();
      expect(mockEventBus.emit).toHaveBeenCalledWith('group_created', expect.any(Object));
    });
  });

  describe('updateTabNote', () => {
    test('should update tab note', async () => {
      const mockTab = {
        id: 1,
        uuid: 'tab-123',
        title: 'Tab with Note',
        note: ''
      };

      mockStorageManager.getTab.mockResolvedValue(mockTab);

      const result = await tabManager.updateTabNote('tab-123', 'This is a note');

      expect(result).toBe(true);
      expect(mockStorageManager.saveTab).toHaveBeenCalled();
      expect(mockEventBus.emit).toHaveBeenCalledWith('tab_note_updated', expect.any(Object));
    });

    test('should return false when tab not found', async () => {
      mockStorageManager.getTab.mockResolvedValue(null);

      const result = await tabManager.updateTabNote('non-existent', 'Note');

      expect(result).toBe(false);
    });
  });

  describe('updateTabAlias', () => {
    test('should update tab alias', async () => {
      const mockTab = {
        id: 1,
        uuid: 'tab-123',
        title: 'Original',
        alias: ''
      };

      mockStorageManager.getTab.mockResolvedValue(mockTab);
      mockPrivacyManager.sanitizeInput = jest.fn(text => text);

      const result = await tabManager.updateTabAlias('tab-123', 'My Alias');

      expect(result).toBe(true);
      expect(mockStorageManager.saveTab).toHaveBeenCalledWith(expect.objectContaining({
        alias: 'My Alias'
      }));
      expect(mockEventBus.emit).toHaveBeenCalledWith('tab_alias_updated', expect.any(Object));
    });
  });

  describe('moveTabToGroup', () => {
    test('should move tab to specified group', async () => {
      const mockTab = {
        id: 1,
        uuid: 'tab-123',
        title: 'Tab',
        groupId: 'old-group'
      };

      const mockGroup = {
        id: 'new-group',
        name: 'New Group'
      };

      mockStorageManager.getTab.mockResolvedValue(mockTab);
      mockStorageManager.getGroup.mockResolvedValue(mockGroup);

      const result = await tabManager.moveTabToGroup('tab-123', 'new-group');

      expect(result).toBe(true);
      expect(mockStorageManager.saveTab).toHaveBeenCalled();
    });

    test('should return false when group not found', async () => {
      const mockTab = { id: 1, uuid: 'tab-123' };

      mockStorageManager.getTab.mockResolvedValue(mockTab);
      mockStorageManager.getGroup.mockResolvedValue(null);

      const result = await tabManager.moveTabToGroup('tab-123', 'non-existent-group');

      expect(result).toBe(false);
    });
  });

  describe('getTabsGrouped', () => {
    test('should return domain grouped tabs', async () => {
      const tabs = [
        { id: 1, url: 'https://github.com/user', title: 'GitHub' },
        { id: 2, url: 'https://github.com/other', title: 'GitHub 2' },
        { id: 3, url: 'https://stackoverflow.com', title: 'SO' }
      ];

      mockStorageManager.getAllTabs.mockResolvedValue({
        '1': tabs[0],
        '2': tabs[1],
        '3': tabs[2]
      });

      mockPrivacyManager.processRetrievedTabData.mockImplementation(tab => Promise.resolve(tab));

      const result = await tabManager.getTabsGrouped('domain');

      expect(result.groups).toBeDefined();
      expect(Array.isArray(result.groups)).toBe(true);
    });

    test('should sync currently open tabs before grouping when storage is empty', async () => {
      const liveTabs = [
        {
          id: 10,
          title: 'GitHub Repo',
          url: 'https://github.com/openai/gpt-5',
          favIconUrl: 'https://github.com/favicon.ico',
          windowId: 1,
          index: 0,
          pinned: false
        }
      ];
      const storedTabs = {};

      global.chrome.tabs.query.mockResolvedValue(liveTabs);
      mockStorageManager.getAllTabs.mockImplementation(async () => ({ ...storedTabs }));
      mockStorageManager.saveTab.mockImplementation(async (tab) => {
        storedTabs[tab.uuid] = tab;
        return true;
      });

      const result = await tabManager.getTabsGrouped('domain');

      expect(global.chrome.tabs.query).toHaveBeenCalledWith({});
      expect(result.tabs).toHaveLength(1);
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0].name).toBe('github.com');
    });

    test('should return date grouped tabs', async () => {
      mockStorageManager.getAllTabs.mockResolvedValue({});
      mockPrivacyManager.processRetrievedTabData.mockImplementation(tab => Promise.resolve(tab));

      const result = await tabManager.getTabsGrouped('date');

      expect(result.groups).toBeDefined();
    });

    test('should not remove cached tabs when chrome returns an empty tab snapshot', async () => {
      tabManager.activeTabs.set(1, {
        id: 1,
        uuid: 'tab-1',
        title: 'Cached',
        url: 'https://example.com'
      });

      global.chrome.tabs.query.mockResolvedValue([]);

      await tabManager.ensureCurrentTabsSynced();

      expect(mockStorageManager.removeTab).not.toHaveBeenCalled();
      expect(tabManager.activeTabs.has(1)).toBe(true);
    });

    test('should use observed tab ids for cleanup even when a tab is non-http', async () => {
      tabManager.activeTabs.set(1, {
        id: 1,
        uuid: 'tab-1',
        title: 'Internal',
        url: 'chrome://extensions'
      });
      tabManager.activeTabs.set(2, {
        id: 2,
        uuid: 'tab-2',
        title: 'Missing',
        url: 'https://missing.com'
      });

      global.chrome.tabs.query.mockResolvedValue([
        {
          id: 1,
          title: 'Extensions',
          url: 'chrome://extensions'
        }
      ]);

      await tabManager.ensureCurrentTabsSynced();

      expect(mockStorageManager.removeTab).toHaveBeenCalledWith('tab-2');
      expect(mockStorageManager.removeTab).not.toHaveBeenCalledWith('tab-1');
    });
  });

  describe('handleTabCreated', () => {
    test('should update an existing cached tab instead of creating a duplicate', async () => {
      const existingTab = {
        id: 1,
        uuid: 'tab-existing',
        title: 'Old Title',
        url: 'https://example.com/old',
        favicon: 'https://example.com/favicon.ico',
        visitCount: 1,
        lastAccessed: Date.now() - 1000
      };

      tabManager.activeTabs.set(1, existingTab);

      const updatedTab = {
        id: 1,
        title: 'New Title',
        url: 'https://example.com/new',
        favIconUrl: 'https://example.com/favicon.ico'
      };

      await tabManager.handleTabCreated(updatedTab);

      expect(mockStorageManager.saveTab).toHaveBeenCalledTimes(1);
      expect(mockStorageManager.saveTab).toHaveBeenCalledWith(expect.objectContaining({
        uuid: 'tab-existing',
        title: 'New Title',
        url: 'https://example.com/new'
      }));
    });
  });

  describe('getPerformanceMetrics', () => {
    test('should return performance metrics', () => {
      const metrics = tabManager.getPerformanceMetrics();

      expect(metrics).toHaveProperty('totalTabs');
      expect(metrics).toHaveProperty('lastSync');
      expect(metrics).toHaveProperty('operationsCount');
      expect(metrics).toHaveProperty('activeTabsCount');
      expect(metrics).toHaveProperty('uptime');
    });
  });

  describe('generateGroupColor', () => {
    test('should generate valid hex colors', () => {
      const colors = new Set();
      for (let i = 0; i < 20; i++) {
        colors.add(tabManager.generateGroupColor());
      }

      // Should have multiple unique colors
      expect(colors.size).toBeGreaterThan(1);
    });
  });

  describe('closeTab', () => {
    test('should call chrome.tabs.remove', async () => {
      // Mock chrome.tabs
      global.chrome = {
        ...global.chrome,
        tabs: {
          remove: jest.fn().mockResolvedValue(undefined)
        }
      };

      await tabManager.closeTab(123);

      expect(global.chrome.tabs.remove).toHaveBeenCalledWith(123);
    });
  });

  describe('closeTabs', () => {
    test('should call chrome.tabs.remove with unique tab ids', async () => {
      global.chrome = {
        ...global.chrome,
        tabs: {
          ...global.chrome.tabs,
          remove: jest.fn().mockResolvedValue(undefined)
        }
      };

      await tabManager.closeTabs([123, '123', 456]);

      expect(global.chrome.tabs.remove).toHaveBeenCalledWith([123, 456]);
    });
  });

  describe('deleteGroup', () => {
    test('should close all tabs in group and remove persisted custom group', async () => {
      global.chrome = {
        ...global.chrome,
        tabs: {
          ...global.chrome.tabs,
          remove: jest.fn().mockResolvedValue(undefined)
        }
      };

      const success = await tabManager.deleteGroup('custom_abc', [1, 2, 3]);

      expect(success).toBe(true);
      expect(global.chrome.tabs.remove).toHaveBeenCalledWith([1, 2, 3]);
      expect(mockStorageManager.removeGroup).toHaveBeenCalledWith('custom_abc');
      expect(mockEventBus.emit).toHaveBeenCalledWith('group_deleted', expect.any(Object));
    });

    test('should not remove storage group for generated domain/date/session groups', async () => {
      global.chrome = {
        ...global.chrome,
        tabs: {
          ...global.chrome.tabs,
          remove: jest.fn().mockResolvedValue(undefined)
        }
      };

      const success = await tabManager.deleteGroup('domain_github_com', [10, 11]);

      expect(success).toBe(true);
      expect(mockStorageManager.removeGroup).not.toHaveBeenCalled();
    });
  });

  describe('bookmarkTabs', () => {
    test('should create bookmarks for selected tab uuids', async () => {
      mockStorageManager.getAllTabs.mockResolvedValue({
        'tab-1': { uuid: 'tab-1', title: 'A', alias: 'Alias A', url: 'https://a.com' },
        'tab-2': { uuid: 'tab-2', title: 'B', alias: '', url: 'https://b.com' }
      });

      global.chrome = {
        ...global.chrome,
        bookmarks: {
          search: jest.fn().mockResolvedValue([]),
          create: jest.fn()
            .mockResolvedValueOnce({ id: 'folder-1' })
            .mockResolvedValueOnce({ id: 'bookmark-1' })
            .mockResolvedValueOnce({ id: 'bookmark-2' }),
          getTree: jest.fn().mockResolvedValue([{ children: [{ id: '1', children: [] }] }])
        }
      };

      const result = await tabManager.bookmarkTabs(['tab-1', 'tab-2']);

      expect(result.success).toBe(true);
      expect(result.successCount).toBe(2);
      expect(global.chrome.bookmarks.create).toHaveBeenNthCalledWith(1, {
        parentId: '1',
        title: 'TabFlow Favorites'
      });
      expect(global.chrome.bookmarks.create).toHaveBeenNthCalledWith(2, {
        parentId: 'folder-1',
        title: 'Alias A',
        url: 'https://a.com'
      });
    });

    test('should bookmark tabs into selected bookmark folder', async () => {
      mockStorageManager.getAllTabs.mockResolvedValue({
        'tab-1': { uuid: 'tab-1', title: 'A', alias: '', url: 'https://a.com' }
      });

      global.chrome = {
        ...global.chrome,
        bookmarks: {
          get: jest.fn().mockResolvedValue([{ id: 'folder-picked', title: 'My Folder' }]),
          create: jest.fn().mockResolvedValue({ id: 'bookmark-1' }),
          search: jest.fn().mockResolvedValue([]),
          getTree: jest.fn().mockResolvedValue([{ children: [{ id: '1', children: [] }] }])
        }
      };

      const result = await tabManager.bookmarkTabs(['tab-1'], { folderId: 'folder-picked' });

      expect(result.success).toBe(true);
      expect(result.folderId).toBe('folder-picked');
      expect(global.chrome.bookmarks.create).toHaveBeenCalledWith({
        parentId: 'folder-picked',
        title: 'A',
        url: 'https://a.com'
      });
    });
  });

  describe('listBookmarkFolders', () => {
    test('should return flattened bookmark folder tree', async () => {
      global.chrome = {
        ...global.chrome,
        bookmarks: {
          getTree: jest.fn().mockResolvedValue([{
            id: '0',
            children: [
              {
                id: '1',
                title: 'Bookmarks Bar',
                children: [
                  { id: '11', title: 'Work', children: [] },
                  { id: '12', title: 'https://example.com', url: 'https://example.com' }
                ]
              }
            ]
          }])
        }
      };

      const folders = await tabManager.listBookmarkFolders();

      expect(folders).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: '1', title: 'Bookmarks Bar' }),
        expect.objectContaining({ id: '11', title: 'Work' })
      ]));
      expect(folders.find(folder => folder.id === '12')).toBeUndefined();
    });
  });

  describe('activateTab', () => {
    test('should activate tab and focus window', async () => {
      global.chrome = {
        ...global.chrome,
        tabs: {
          update: jest.fn().mockResolvedValue({}),
          get: jest.fn().mockResolvedValue({ windowId: 1 })
        },
        windows: {
          update: jest.fn().mockResolvedValue({})
        }
      };

      await tabManager.activateTab(123);

      expect(global.chrome.tabs.update).toHaveBeenCalledWith(123, { active: true });
      expect(global.chrome.windows.update).toHaveBeenCalledWith(1, { focused: true });
    });
  });
});
