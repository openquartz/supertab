const AutoGrouper = require('../../background/auto-grouper');

// Make dependencies available globally
const EventBus = require('../../background/event-bus');
const RuleEngine = require('../../utils/rule-engine');
const RuleManager = require('../../utils/rule-manager');
const TabManager = require('../../background/tab-manager');
const StorageManager = require('../../background/storage-manager');

// Make classes available globally
global.EventBus = EventBus;
global.RuleEngine = RuleEngine;
global.RuleManager = RuleManager;
global.TabManager = TabManager;
global.StorageManager = StorageManager;

describe('AutoGrouper', () => {
  let autoGrouper;
  let mockTabManager;
  let mockRuleEngine;
  let mockRuleManager;
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
      saveGroup: jest.fn().mockResolvedValue(true),
      getGroup: jest.fn().mockResolvedValue(null),
      getAllGroups: jest.fn().mockResolvedValue({}),
      removeGroup: jest.fn().mockResolvedValue(true)
    };

    mockPrivacyManager = {
      shouldExcludeUrl: jest.fn().mockReturnValue(false),
      processTabData: jest.fn().mockImplementation(tab => Promise.resolve(tab)),
      processRetrievedTabData: jest.fn().mockImplementation(tab => Promise.resolve(tab)),
      getSettings: jest.fn().mockResolvedValue({ privacy: { encryptNotes: false } })
    };

    mockTabManager = {
      eventBus: mockEventBus,
      storageManager: mockStorageManager,
      activeTabs: new Map(),
      getAllTabs: jest.fn().mockResolvedValue([]),
      createCustomGroup: jest.fn().mockResolvedValue({
        id: 'custom_test_123',
        name: 'Test Group',
        type: 'custom'
      })
    };

    mockRuleEngine = {
      findMatchingRule: jest.fn().mockReturnValue(null),
      matchesRule: jest.fn().mockReturnValue(false)
    };

    mockRuleManager = {
      getAllRules: jest.fn().mockResolvedValue({}),
      getRulesList: jest.fn().mockResolvedValue([])
    };

    autoGrouper = new AutoGrouper(mockTabManager, mockRuleEngine, mockRuleManager);

    // Mock chrome API
    global.chrome = {
      storage: {
        local: {
          get: jest.fn().mockImplementation((key, callback) => {
            callback({});
          }),
          set: jest.fn().mockImplementation((data, callback) => {
            callback();
          })
        }
      }
    };
  });

  describe('constructor', () => {
    test('should initialize with default values', () => {
      expect(autoGrouper.enabled).toBe(true);
      expect(autoGrouper.initialized).toBe(false);
      expect(autoGrouper.tabManager).toBe(mockTabManager);
      expect(autoGrouper.ruleEngine).toBe(mockRuleEngine);
      expect(autoGrouper.ruleManager).toBe(mockRuleManager);
    });
  });

  describe('initialize', () => {
    test('should set up event listeners', async () => {
      await autoGrouper.initialize();

      expect(mockEventBus.on).toHaveBeenCalledWith('tab_created', expect.any(Function));
      expect(autoGrouper.initialized).toBe(true);
    });

    test('should not reinitialize if already initialized', async () => {
      await autoGrouper.initialize();
      const firstCallCount = mockEventBus.on.mock.calls.length;

      await autoGrouper.initialize();

      expect(mockEventBus.on.mock.calls.length).toBe(firstCallCount);
    });

    test('should handle initialization errors', async () => {
      mockEventBus.on.mockImplementation(() => {
        throw new Error('Event bus error');
      });

      await expect(autoGrouper.initialize()).rejects.toThrow('Event bus error');
    });
  });

  describe('handleNewTab', () => {
    beforeEach(async () => {
      await autoGrouper.initialize();
    });

    test('should skip processing when disabled', async () => {
      autoGrouper.setEnabled(false);
      const tabData = { id: 1, title: 'Test Tab', url: 'https://example.com' };

      await autoGrouper.handleNewTab(tabData);

      expect(mockRuleManager.getAllRules).not.toHaveBeenCalled();
    });

    test('should skip processing when no enabled rules', async () => {
      mockRuleManager.getAllRules.mockResolvedValue({
        'rule1': { id: 'rule1', enabled: false, conditions: [], targetGroup: { name: 'Group1', autoCreate: true } }
      });

      const tabData = { id: 1, title: 'Test Tab', url: 'https://example.com' };

      await autoGrouper.handleNewTab(tabData);

      expect(mockRuleEngine.findMatchingRule).not.toHaveBeenCalled();
    });

    test('should process tab when enabled rules exist', async () => {
      const rule = {
        id: 'rule1',
        enabled: true,
        name: 'Test Rule',
        priority: 1,
        conditions: [{ field: 'domain', keyword: 'example.com', caseSensitive: false }],
        targetGroup: { name: 'Test Group', autoCreate: true }
      };

      mockRuleManager.getAllRules.mockResolvedValue({ 'rule1': rule });
      mockRuleEngine.findMatchingRule.mockReturnValue(rule);

      const tabData = { id: 1, title: 'Test Tab', url: 'https://example.com' };

      await autoGrouper.handleNewTab(tabData);

      expect(mockRuleEngine.findMatchingRule).toHaveBeenCalledWith(tabData, [rule]);
    });

    test('should emit error event on processing error', async () => {
      const error = new Error('Processing error');
      mockRuleManager.getAllRules.mockRejectedValue(error);

      const tabData = { id: 1, title: 'Test Tab', url: 'https://example.com' };

      await autoGrouper.handleNewTab(tabData);

      expect(mockEventBus.emit).toHaveBeenCalledWith('auto_grouper_error', expect.objectContaining({
        error: 'Processing error',
        tabData
      }));
    });
  });

  describe('processNewTab', () => {
    test('should process tab and assign to matching group', async () => {
      const rule = {
        id: 'rule1',
        name: 'Test Rule',
        targetGroup: { name: 'Test Group', autoCreate: true }
      };

      const tabData = { id: 1, title: 'Test Tab', url: 'https://example.com' };

      mockRuleEngine.findMatchingRule.mockReturnValue(rule);
      mockTabManager.createCustomGroup.mockResolvedValue({
        id: 'group123',
        name: 'Test Group'
      });

      await autoGrouper.processNewTab(tabData, [rule]);

      expect(mockRuleEngine.findMatchingRule).toHaveBeenCalledWith(tabData, [rule]);
      expect(mockTabManager.createCustomGroup).toHaveBeenCalledWith('Test Group', 'Auto-created group for rule-based grouping');
    });

    test('should handle no matching rule', async () => {
      const tabData = { id: 1, title: 'Test Tab', url: 'https://example.com' };
      mockRuleEngine.findMatchingRule.mockReturnValue(null);

      await autoGrouper.processNewTab(tabData, []);

      expect(mockTabManager.createCustomGroup).not.toHaveBeenCalled();
    });
  });

  describe('getOrCreateGroup', () => {
    test('should find existing group by name', async () => {
      const existingGroup = {
        id: 'group123',
        name: 'Test Group',
        type: 'custom'
      };

      mockStorageManager.getAllGroups.mockResolvedValue({
        'group123': existingGroup
      });

      const result = await autoGrouper.getOrCreateGroup('Test Group', true);

      expect(result).toEqual(existingGroup);
      expect(mockTabManager.createCustomGroup).not.toHaveBeenCalled();
    });

    test('should find existing group case-insensitive', async () => {
      const existingGroup = {
        id: 'group123',
        name: 'Test Group',
        type: 'custom'
      };

      mockStorageManager.getAllGroups.mockResolvedValue({
        'group123': existingGroup
      });

      const result = await autoGrouper.getOrCreateGroup('test group', true);

      expect(result).toEqual(existingGroup);
      expect(mockTabManager.createCustomGroup).not.toHaveBeenCalled();
    });

    test('should create new group when not found and autoCreate enabled', async () => {
      const newGroup = {
        id: 'group456',
        name: 'New Group',
        type: 'custom'
      };

      mockStorageManager.getAllGroups.mockResolvedValue({});
      mockTabManager.createCustomGroup.mockResolvedValue(newGroup);

      const result = await autoGrouper.getOrCreateGroup('New Group', true);

      expect(result).toEqual(newGroup);
      expect(mockTabManager.createCustomGroup).toHaveBeenCalledWith('New Group', 'Auto-created group for rule-based grouping');
    });

    test('should return null when group not found and autoCreate disabled', async () => {
      mockStorageManager.getAllGroups.mockResolvedValue({});

      const result = await autoGrouper.getOrCreateGroup('Non-existent Group', false);

      expect(result).toBeNull();
      expect(mockTabManager.createCustomGroup).not.toHaveBeenCalled();
    });
  });

  describe('assignTabToGroup', () => {
    test('should update tab groupId and save', async () => {
      const tabData = {
        id: 1,
        uuid: 'tab-123',
        title: 'Test Tab',
        groupId: 'ungrouped'
      };

      const groupId = 'group123';

      await autoGrouper.assignTabToGroup(tabData, groupId);

      expect(mockStorageManager.saveTab).toHaveBeenCalledWith(expect.objectContaining({
        ...tabData,
        groupId
      }));
      expect(mockEventBus.emit).toHaveBeenCalledWith('tab_group_assigned', expect.any(Object));
    });

    test('should update activeTabs cache', async () => {
      const tabData = {
        id: 1,
        uuid: 'tab-123',
        title: 'Test Tab',
        groupId: 'ungrouped'
      };

      mockTabManager.activeTabs.set(1, { ...tabData });

      await autoGrouper.assignTabToGroup(tabData, 'group123');

      expect(mockTabManager.activeTabs.get(1).groupId).toBe('group123');
    });

    test('should handle save errors', async () => {
      const tabData = {
        id: 1,
        uuid: 'tab-123',
        title: 'Test Tab'
      };

      mockStorageManager.saveTab.mockResolvedValue(false);

      await expect(autoGrouper.assignTabToGroup(tabData, 'group123'))
        .rejects.toThrow('Failed to save tab with new group assignment');
    });
  });

  describe('processExistingTabs', () => {
    test('should skip processing when disabled', async () => {
      autoGrouper.setEnabled(false);

      const result = await autoGrouper.processExistingTabs();

      expect(result).toBe(0);
      expect(mockTabManager.getAllTabs).not.toHaveBeenCalled();
    });

    test('should process existing tabs and assign matching ones', async () => {
      const tabs = [
        { id: 1, uuid: 'tab-1', title: 'Tab 1', url: 'https://example.com', groupId: 'ungrouped' },
        { id: 2, uuid: 'tab-2', title: 'Tab 2', url: 'https://test.com', groupId: 'existing-group' }
      ];

      const rule = {
        id: 'rule1',
        enabled: true,
        name: 'Test Rule',
        priority: 1,
        conditions: [{ field: 'domain', keyword: 'example.com', caseSensitive: false }],
        targetGroup: { name: 'Test Group', autoCreate: true }
      };

      mockTabManager.getAllTabs.mockResolvedValue(tabs);
      mockRuleManager.getAllRules.mockResolvedValue({ 'rule1': rule });
      mockRuleEngine.findMatchingRule.mockImplementation((tab) =>
        tab.url.includes('example.com') ? rule : null
      );
      mockTabManager.createCustomGroup.mockResolvedValue({
        id: 'group123',
        name: 'Test Group'
      });

      const result = await autoGrouper.processExistingTabs();

      expect(result).toBe(1); // One tab assigned
      expect(mockStorageManager.saveTab).toHaveBeenCalledTimes(1);
    });

    test('should skip tabs that already have groups', async () => {
      const tabs = [
        { id: 1, uuid: 'tab-1', title: 'Tab 1', url: 'https://example.com', groupId: 'existing-group' }
      ];

      mockTabManager.getAllTabs.mockResolvedValue(tabs);
      mockRuleManager.getAllRules.mockResolvedValue({
        'rule1': {
          id: 'rule1',
          enabled: true,
          name: 'Test Rule',
          conditions: [],
          targetGroup: { name: 'Test Group', autoCreate: true }
        }
      });

      const result = await autoGrouper.processExistingTabs();

      expect(result).toBe(0); // No tabs processed
      expect(mockStorageManager.saveTab).not.toHaveBeenCalled();
    });
  });

  describe('setEnabled', () => {
    test('should enable and disable AutoGrouper', () => {
      expect(autoGrouper.enabled).toBe(true);

      autoGrouper.setEnabled(false);
      expect(autoGrouper.enabled).toBe(false);

      autoGrouper.setEnabled(true);
      expect(autoGrouper.enabled).toBe(true);
    });

    test('should emit status changed event', () => {
      autoGrouper.setEnabled(false);

      expect(mockEventBus.emit).toHaveBeenCalledWith('auto_grouper_status_changed', expect.objectContaining({
        enabled: false,
        previousStatus: true
      }));
    });
  });

  describe('getStatus', () => {
    test('should return current status', () => {
      const status = autoGrouper.getStatus();

      expect(status).toEqual(expect.objectContaining({
        enabled: true,
        initialized: false,
        hasTabManager: true,
        hasRuleEngine: true,
        hasRuleManager: true,
        timestamp: expect.any(Number)
      }));
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      await autoGrouper.initialize();
    });

    test('should remove event listeners and reset state', async () => {
      await autoGrouper.cleanup();

      expect(mockEventBus.off).toHaveBeenCalledWith('tab_created', expect.any(Function));
      expect(autoGrouper.initialized).toBe(false);
    });

    test('should handle cleanup errors gracefully', async () => {
      mockEventBus.off.mockImplementation(() => {
        throw new Error('Cleanup error');
      });

      // Should not throw
      await autoGrouper.cleanup();
    });
  });

  describe('integration with TabManager', () => {
    test('should handle tab_created event from TabManager', async () => {
      await autoGrouper.initialize();

      const tabData = { id: 1, title: 'Test Tab', url: 'https://example.com' };

      // Simulate TabManager emitting tab_created event
      const tabCreatedCallback = mockEventBus.on.mock.calls.find(call => call[0] === 'tab_created')[1];
      await tabCreatedCallback(tabData);

      expect(mockRuleManager.getAllRules).toHaveBeenCalled();
    });

    test('should emit tab_group_assigned event when tab is assigned', async () => {
      const rule = {
        id: 'rule1',
        name: 'Test Rule',
        targetGroup: { name: 'Test Group', autoCreate: true }
      };

      const tabData = { id: 1, title: 'Test Tab', url: 'https://example.com' };

      mockRuleEngine.findMatchingRule.mockReturnValue(rule);
      mockTabManager.createCustomGroup.mockResolvedValue({
        id: 'group123',
        name: 'Test Group'
      });

      await autoGrouper.processNewTab(tabData, [rule]);

      expect(mockEventBus.emit).toHaveBeenCalledWith('tab_group_assigned', expect.objectContaining({
        groupId: 'group123',
        timestamp: expect.any(Number)
      }));
    });
  });
});