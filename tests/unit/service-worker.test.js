describe('SuperTabServiceWorker', () => {
  let SuperTabServiceWorker;
  let mockTabManager;

  beforeEach(() => {
    jest.resetModules();

    mockTabManager = {
      initialize: jest.fn().mockResolvedValue(undefined),
      ensureCurrentTabsSynced: jest.fn().mockResolvedValue(undefined),
      getTabsGrouped: jest.fn().mockResolvedValue({ groups: [], tabs: [] }),
      getAllTabs: jest.fn().mockResolvedValue([]),
      createCustomGroup: jest.fn().mockResolvedValue(null),
      deleteGroup: jest.fn().mockResolvedValue(true),
      updateGroup: jest.fn().mockResolvedValue(true),
      updateTabAlias: jest.fn().mockResolvedValue(true),
      bookmarkTabs: jest.fn().mockResolvedValue({ success: true, successCount: 2, failedCount: 0 }),
      listBookmarkFolders: jest.fn().mockResolvedValue([{ id: '1', title: 'Bookmarks Bar', path: 'Bookmarks Bar' }]),
      updateTabNote: jest.fn().mockResolvedValue(true),
      moveTabToGroup: jest.fn().mockResolvedValue(true),
      closeTab: jest.fn().mockResolvedValue(true),
      activateTab: jest.fn().mockResolvedValue(true),
      getPerformanceMetrics: jest.fn().mockReturnValue({})
    };

    global.EventBus = jest.fn(() => ({
      emit: jest.fn(),
      on: jest.fn()
    }));
    global.PrivacyManager = jest.fn(() => ({
      initialize: jest.fn().mockResolvedValue(undefined),
      getSettings: jest.fn().mockResolvedValue({}),
      updateSettings: jest.fn().mockResolvedValue(undefined)
    }));
    global.StorageManager = jest.fn(() => ({
      initialize: jest.fn().mockResolvedValue(undefined),
      getAllTabs: jest.fn().mockResolvedValue({}),
      getAllGroups: jest.fn().mockResolvedValue({}),
      getMetadata: jest.fn().mockResolvedValue({}),
      clearAllData: jest.fn().mockResolvedValue(true),
      importData: jest.fn().mockResolvedValue(true)
    }));
    global.TabManager = jest.fn(() => mockTabManager);

    global.chrome = {
      action: {
        onClicked: {
          addListener: jest.fn()
        }
      },
      runtime: {
        lastError: null,
        sendMessage: jest.fn((payload, callback) => {
          if (typeof callback === 'function') {
            callback();
          }
        }),
        onMessage: {
          addListener: jest.fn()
        },
        onStartup: {
          addListener: jest.fn()
        },
        onInstalled: {
          addListener: jest.fn()
        },
        onConnect: {
          addListener: jest.fn()
        },
        getManifest: jest.fn(() => ({ version: '1.0.0' })),
        getURL: jest.fn((path) => path)
      },
      storage: {
        local: {
          get: jest.fn().mockResolvedValue({}),
          set: jest.fn().mockResolvedValue(undefined)
        }
      },
      tabs: {
        onCreated: { addListener: jest.fn() },
        onUpdated: { addListener: jest.fn() },
        onRemoved: { addListener: jest.fn() },
        onActivated: { addListener: jest.fn() },
        onMoved: { addListener: jest.fn() },
        onDetached: { addListener: jest.fn() },
        onAttached: { addListener: jest.fn() },
        query: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue(undefined)
      },
      windows: {
        onFocusChanged: { addListener: jest.fn() }
      },
      sidePanel: {
        setOptions: jest.fn(),
        setPanelBehavior: jest.fn().mockResolvedValue(undefined),
        open: jest.fn().mockResolvedValue(undefined),
        hide: jest.fn().mockResolvedValue(undefined)
      }
    };

    SuperTabServiceWorker = require('../../background/service-worker');
  });

  test('registers runtime message listener during construction', () => {
    expect(global.chrome.runtime.onMessage.addListener).toHaveBeenCalled();
  });

  test('enables side panel auto-open behavior when available', () => {
    new SuperTabServiceWorker();
    expect(global.chrome.sidePanel.setPanelBehavior).toHaveBeenCalledWith({
      openPanelOnActionClick: true
    });
  });

  test('accepts top-level message payload fields when grouping tabs', async () => {
    const serviceWorker = new SuperTabServiceWorker();
    const sendResponse = jest.fn();

    await serviceWorker.handleMessage({
      action: 'getTabsGrouped',
      groupType: 'session'
    }, null, sendResponse);

    expect(mockTabManager.getTabsGrouped).toHaveBeenCalledWith('session');
    expect(sendResponse).toHaveBeenCalledWith({
      success: true,
      data: { groups: [], tabs: [] }
    });
  });

  test('deletes group tabs through tab manager', async () => {
    const serviceWorker = new SuperTabServiceWorker();
    const sendResponse = jest.fn();

    await serviceWorker.handleMessage({
      action: 'deleteGroup',
      data: {
        groupId: 'domain_github_com',
        tabIds: [1, 2]
      }
    }, null, sendResponse);

    expect(mockTabManager.deleteGroup).toHaveBeenCalledWith('domain_github_com', [1, 2]);
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });

  test('updates group through tab manager', async () => {
    const serviceWorker = new SuperTabServiceWorker();
    const sendResponse = jest.fn();
    const group = {
      id: 'custom_1',
      name: 'My Group',
      collapsed: true
    };

    await serviceWorker.handleMessage({
      action: 'updateGroup',
      group
    }, null, sendResponse);

    expect(mockTabManager.updateGroup).toHaveBeenCalledWith(group);
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });

  test('normalizes deleteGroup tab ids before forwarding', async () => {
    const serviceWorker = new SuperTabServiceWorker();
    const sendResponse = jest.fn();

    await serviceWorker.handleMessage({
      action: 'deleteGroup',
      data: {
        groupId: 'domain_example_com',
        tabIds: ['10', 10, 'abc', 12]
      }
    }, null, sendResponse);

    expect(mockTabManager.deleteGroup).toHaveBeenCalledWith('domain_example_com', [10, 12]);
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });

  test('updates tab alias through tab manager', async () => {
    const serviceWorker = new SuperTabServiceWorker();
    const sendResponse = jest.fn();

    await serviceWorker.handleMessage({
      action: 'updateTabAlias',
      data: {
        tabUuid: 'tab-1',
        alias: 'Renamed Tab'
      }
    }, null, sendResponse);

    expect(mockTabManager.updateTabAlias).toHaveBeenCalledWith('tab-1', 'Renamed Tab');
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });

  test('broadcasts refresh after successful mutation', async () => {
    jest.useFakeTimers();
    const serviceWorker = new SuperTabServiceWorker();
    const sendResponse = jest.fn();

    await serviceWorker.handleMessage({
      action: 'updateTabAlias',
      data: {
        tabUuid: 'tab-1',
        alias: 'Renamed Tab'
      }
    }, null, sendResponse);

    jest.advanceTimersByTime(150);
    expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'refresh'
      }),
      expect.any(Function)
    );

    jest.useRealTimers();
  });

  test('allows empty note string when updating tab note', async () => {
    const serviceWorker = new SuperTabServiceWorker();
    const sendResponse = jest.fn();

    await serviceWorker.handleMessage({
      action: 'updateTabNote',
      data: {
        tabUuid: 'tab-1',
        note: ''
      }
    }, null, sendResponse);

    expect(mockTabManager.updateTabNote).toHaveBeenCalledWith('tab-1', '');
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });

  test('normalizes closeTab tab id from top-level payload', async () => {
    const serviceWorker = new SuperTabServiceWorker();
    const sendResponse = jest.fn();

    await serviceWorker.handleMessage({
      action: 'closeTab',
      tabId: '321'
    }, null, sendResponse);

    expect(mockTabManager.closeTab).toHaveBeenCalledWith(321);
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });

  test('normalizes activateTab tab id from top-level payload', async () => {
    const serviceWorker = new SuperTabServiceWorker();
    const sendResponse = jest.fn();

    await serviceWorker.handleMessage({
      action: 'activateTab',
      tabId: '654'
    }, null, sendResponse);

    expect(mockTabManager.activateTab).toHaveBeenCalledWith(654);
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });

  test('bookmarks selected tabs through tab manager', async () => {
    const serviceWorker = new SuperTabServiceWorker();
    const sendResponse = jest.fn();

    await serviceWorker.handleMessage({
      action: 'bookmarkTabs',
      data: {
        tabUuids: ['tab-1', 'tab-2']
      }
    }, null, sendResponse);

    expect(mockTabManager.bookmarkTabs).toHaveBeenCalledWith(['tab-1', 'tab-2']);
    expect(sendResponse).toHaveBeenCalledWith({
      success: true,
      successCount: 2,
      failedCount: 0
    });
  });

  test('bookmarks selected tabs with explicit folder options', async () => {
    const serviceWorker = new SuperTabServiceWorker();
    const sendResponse = jest.fn();

    await serviceWorker.handleMessage({
      action: 'bookmarkTabs',
      data: {
        tabUuids: ['tab-1'],
        folderId: 'folder-123'
      }
    }, null, sendResponse);

    expect(mockTabManager.bookmarkTabs).toHaveBeenCalledWith(['tab-1'], { folderId: 'folder-123' });
  });

  test('lists bookmark folders through tab manager', async () => {
    const serviceWorker = new SuperTabServiceWorker();
    const sendResponse = jest.fn();

    await serviceWorker.handleMessage({
      action: 'listBookmarkFolders'
    }, null, sendResponse);

    expect(mockTabManager.listBookmarkFolders).toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({
      success: true,
      data: [{ id: '1', title: 'Bookmarks Bar', path: 'Bookmarks Bar' }]
    });
  });
});
