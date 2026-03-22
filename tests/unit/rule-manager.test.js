const { describe, test, expect, beforeEach } = require('@jest/globals');
const RuleManager = require('../../utils/rule-manager');

describe('RuleManager', () => {
  let ruleManager;
  let mockStorageManager;

  // 模拟chrome.storage.local
  const mockChromeStorage = {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  };

  // 模拟全局chrome对象
  global.chrome = {
    runtime: {
      lastError: null
    },
    storage: mockChromeStorage
  };

  // 测试用的规则数据
  const sampleRuleData = {
    name: 'GitHub Rule',
    enabled: true,
    priority: 1,
    conditions: [
      {
        field: 'title',
        keyword: 'github',
        caseSensitive: false
      }
    ],
    targetGroup: {
      name: 'Development',
      autoCreate: true
    }
  };

  const sampleRuleData2 = {
    name: 'StackOverflow Rule',
    enabled: true,
    priority: 2,
    conditions: [
      {
        field: 'domain',
        keyword: 'stackoverflow.com',
        caseSensitive: false
      }
    ],
    targetGroup: {
      name: 'Q&A',
      autoCreate: true
    }
  };

  beforeEach(() => {
    mockStorageManager = {
      // 模拟storage manager接口
    };
    ruleManager = new RuleManager(mockStorageManager);

    // 重置模拟函数
    jest.clearAllMocks();
    chrome.runtime.lastError = null;
  });

  describe('constructor', () => {
    test('should initialize with storage manager', () => {
      expect(ruleManager).toBeDefined();
      expect(ruleManager.storageManager).toBe(mockStorageManager);
      expect(ruleManager.storageKey).toBe('tabflow:grouping_rules');
    });
  });

  describe('generateRuleId', () => {
    test('should generate unique rule IDs', () => {
      const id1 = ruleManager.generateRuleId();
      const id2 = ruleManager.generateRuleId();

      expect(id1).toMatch(/^rule_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^rule_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('validateRule', () => {
    test('should validate correct rule data', () => {
      const validation = ruleManager.validateRule(sampleRuleData);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should reject rule with empty name', () => {
      const invalidRule = { ...sampleRuleData, name: '' };
      const validation = ruleManager.validateRule(invalidRule);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('规则名称不能为空');
    });

    test('should reject rule with no conditions', () => {
      const invalidRule = { ...sampleRuleData, conditions: [] };
      const validation = ruleManager.validateRule(invalidRule);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('至少需要一个匹配条件');
    });

    test('should reject rule with invalid condition field', () => {
      const invalidRule = {
        ...sampleRuleData,
        conditions: [
          {
            field: 'invalid',
            keyword: 'test',
            caseSensitive: false
          }
        ]
      };
      const validation = ruleManager.validateRule(invalidRule);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('条件 1: 字段必须是 title、url 或 domain');
    });

    test('should reject rule with empty condition keyword', () => {
      const invalidRule = {
        ...sampleRuleData,
        conditions: [
          {
            field: 'title',
            keyword: '',
            caseSensitive: false
          }
        ]
      };
      const validation = ruleManager.validateRule(invalidRule);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('条件 1: 关键词不能为空');
    });

    test('should reject rule with invalid caseSensitive value', () => {
      const invalidRule = {
        ...sampleRuleData,
        conditions: [
          {
            field: 'title',
            keyword: 'test',
            caseSensitive: 'not boolean'
          }
        ]
      };
      const validation = ruleManager.validateRule(invalidRule);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('条件 1: caseSensitive 必须是布尔值');
    });

    test('should reject rule with empty target group name', () => {
      const invalidRule = {
        ...sampleRuleData,
        targetGroup: {
          name: '',
          autoCreate: true
        }
      };
      const validation = ruleManager.validateRule(invalidRule);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('目标分组名称不能为空');
    });

    test('should reject rule with invalid enabled value', () => {
      const invalidRule = { ...sampleRuleData, enabled: 'not boolean' };
      const validation = ruleManager.validateRule(invalidRule);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('enabled 必须是布尔值');
    });

    test('should reject rule with negative priority', () => {
      const invalidRule = { ...sampleRuleData, priority: -1 };
      const validation = ruleManager.validateRule(invalidRule);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('priority 必须是非负数');
    });
  });

  describe('getRulesFromStorage', () => {
    test('should get rules from chrome storage', async () => {
      const mockRules = {
        'rule_1': sampleRuleData,
        'rule_2': sampleRuleData2
      };

      chrome.storage.local.get.mockImplementation((key, callback) => {
        callback({ 'tabflow:grouping_rules': mockRules });
      });

      const rules = await ruleManager.getRulesFromStorage();
      expect(rules).toEqual(mockRules);
      expect(chrome.storage.local.get).toHaveBeenCalledWith(
        'tabflow:grouping_rules',
        expect.any(Function)
      );
    });

    test('should return empty object when no rules exist', async () => {
      chrome.storage.local.get.mockImplementation((key, callback) => {
        callback({});
      });

      const rules = await ruleManager.getRulesFromStorage();
      expect(rules).toEqual({});
    });

    test('should handle chrome storage error', async () => {
      chrome.runtime.lastError = { message: 'Storage error' };
      chrome.storage.local.get.mockImplementation((key, callback) => {
        callback({});
      });

      const rules = await ruleManager.getRulesFromStorage();
      expect(rules).toEqual({});
    });
  });

  describe('saveRulesToStorage', () => {
    test('should save rules to chrome storage', async () => {
      const mockRules = {
        'rule_1': sampleRuleData,
        'rule_2': sampleRuleData2
      };

      chrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      const result = await ruleManager.saveRulesToStorage(mockRules);
      expect(result).toBe(true);
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        { 'tabflow:grouping_rules': mockRules },
        expect.any(Function)
      );
    });

    test('should handle chrome storage error', async () => {
      const mockRules = { 'rule_1': sampleRuleData };

      chrome.runtime.lastError = { message: 'Storage error' };
      chrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      const result = await ruleManager.saveRulesToStorage(mockRules);
      expect(result).toBe(false);
    });
  });

  describe('createRule', () => {
    test('should create a new rule successfully', async () => {
      chrome.storage.local.get.mockImplementation((key, callback) => {
        callback({ 'tabflow:grouping_rules': {} });
      });

      chrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      const createdRule = await ruleManager.createRule(sampleRuleData);

      expect(createdRule).toBeDefined();
      expect(createdRule.name).toBe(sampleRuleData.name);
      expect(createdRule.enabled).toBe(sampleRuleData.enabled);
      expect(createdRule.priority).toBe(sampleRuleData.priority);
      expect(createdRule.conditions).toEqual(sampleRuleData.conditions);
      expect(createdRule.targetGroup).toEqual(sampleRuleData.targetGroup);
      expect(createdRule.id).toMatch(/^rule_\d+_[a-z0-9]+$/);
      expect(createdRule.createdAt).toBeDefined();
    });

    test('should reject invalid rule data', async () => {
      const invalidRuleData = { ...sampleRuleData, name: '' };

      await expect(ruleManager.createRule(invalidRuleData))
        .rejects
        .toThrow('规则验证失败');
    });

    test('should add rule to existing rules', async () => {
      const existingRules = {
        'existing_rule': {
          id: 'existing_rule',
          name: 'Existing Rule',
          enabled: true,
          priority: 1,
          conditions: [{ field: 'title', keyword: 'test', caseSensitive: false }],
          targetGroup: { name: 'Test', autoCreate: true },
          createdAt: Date.now()
        }
      };

      chrome.storage.local.get.mockImplementation((key, callback) => {
        callback({ 'tabflow:grouping_rules': existingRules });
      });

      chrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      const createdRule = await ruleManager.createRule(sampleRuleData);

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        {
          'tabflow:grouping_rules': {
            ...existingRules,
            [createdRule.id]: createdRule
          }
        },
        expect.any(Function)
      );
    });
  });

  describe('getAllRules', () => {
    test('should get all rules', async () => {
      const mockRules = {
        'rule_1': sampleRuleData,
        'rule_2': sampleRuleData2
      };

      chrome.storage.local.get.mockImplementation((key, callback) => {
        callback({ 'tabflow:grouping_rules': mockRules });
      });

      const rules = await ruleManager.getAllRules();
      expect(rules).toEqual(mockRules);
    });
  });

  describe('getRule', () => {
    test('should get specific rule by ID', async () => {
      const mockRules = {
        'rule_1': { ...sampleRuleData, id: 'rule_1' },
        'rule_2': { ...sampleRuleData2, id: 'rule_2' }
      };

      chrome.storage.local.get.mockImplementation((key, callback) => {
        callback({ 'tabflow:grouping_rules': mockRules });
      });

      const rule = await ruleManager.getRule('rule_1');
      expect(rule).toEqual(mockRules['rule_1']);
    });

    test('should return null for non-existent rule', async () => {
      const mockRules = {
        'rule_1': { ...sampleRuleData, id: 'rule_1' }
      };

      chrome.storage.local.get.mockImplementation((key, callback) => {
        callback({ 'tabflow:grouping_rules': mockRules });
      });

      const rule = await ruleManager.getRule('non_existent');
      expect(rule).toBeNull();
    });
  });

  describe('updateRule', () => {
    test('should update existing rule successfully', async () => {
      const existingRule = {
        id: 'rule_1',
        name: 'Old Name',
        enabled: false,
        priority: 5,
        conditions: [{ field: 'title', keyword: 'old', caseSensitive: false }],
        targetGroup: { name: 'Old Group', autoCreate: false },
        createdAt: 123456789
      };

      const updates = {
        name: 'New Name',
        enabled: true,
        priority: 1
      };

      const expectedUpdatedRule = {
        ...existingRule,
        ...updates
      };

      chrome.storage.local.get.mockImplementation((key, callback) => {
        callback({
          'tabflow:grouping_rules': {
            'rule_1': existingRule
          }
        });
      });

      chrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      const updatedRule = await ruleManager.updateRule('rule_1', updates);

      expect(updatedRule.name).toBe('New Name');
      expect(updatedRule.enabled).toBe(true);
      expect(updatedRule.priority).toBe(1);
      expect(updatedRule.createdAt).toBe(123456789); // 确保创建时间未变
      expect(updatedRule.id).toBe('rule_1'); // 确保ID未变
    });

    test('should reject update for non-existent rule', async () => {
      chrome.storage.local.get.mockImplementation((key, callback) => {
        callback({ 'tabflow:grouping_rules': {} });
      });

      await expect(ruleManager.updateRule('non_existent', { name: 'New Name' }))
        .rejects
        .toThrow('规则不存在: non_existent');
    });

    test('should reject update with invalid data', async () => {
      const existingRule = {
        id: 'rule_1',
        name: 'Old Name',
        enabled: false,
        priority: 5,
        conditions: [{ field: 'title', keyword: 'old', caseSensitive: false }],
        targetGroup: { name: 'Old Group', autoCreate: false },
        createdAt: 123456789
      };

      chrome.storage.local.get.mockImplementation((key, callback) => {
        callback({
          'tabflow:grouping_rules': {
            'rule_1': existingRule
          }
        });
      });

      await expect(ruleManager.updateRule('rule_1', { name: '' }))
        .rejects
        .toThrow('规则验证失败');
    });
  });

  describe('deleteRule', () => {
    test('should delete existing rule successfully', async () => {
      const existingRules = {
        'rule_1': { ...sampleRuleData, id: 'rule_1' },
        'rule_2': { ...sampleRuleData2, id: 'rule_2' }
      };

      chrome.storage.local.get.mockImplementation((key, callback) => {
        callback({ 'tabflow:grouping_rules': existingRules });
      });

      chrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      const result = await ruleManager.deleteRule('rule_1');

      expect(result).toBe(true);
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        {
          'tabflow:grouping_rules': {
            'rule_2': existingRules['rule_2']
          }
        },
        expect.any(Function)
      );
    });

    test('should return false for non-existent rule', async () => {
      chrome.storage.local.get.mockImplementation((key, callback) => {
        callback({ 'tabflow:grouping_rules': {} });
      });

      const result = await ruleManager.deleteRule('non_existent');
      expect(result).toBe(false);
    });
  });

  describe('toggleRuleEnabled', () => {
    test('should toggle rule enabled state', async () => {
      const existingRule = {
        id: 'rule_1',
        name: 'Test Rule',
        enabled: false,
        priority: 1,
        conditions: [{ field: 'title', keyword: 'test', caseSensitive: false }],
        targetGroup: { name: 'Test', autoCreate: true },
        createdAt: 123456789
      };

      chrome.storage.local.get.mockImplementation((key, callback) => {
        callback({
          'tabflow:grouping_rules': {
            'rule_1': existingRule
          }
        });
      });

      chrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      const toggledRule = await ruleManager.toggleRuleEnabled('rule_1');

      expect(toggledRule.enabled).toBe(true);
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        {
          'tabflow:grouping_rules': {
            'rule_1': {
              ...existingRule,
              enabled: true
            }
          }
        },
        expect.any(Function)
      );
    });

    test('should reject toggle for non-existent rule', async () => {
      chrome.storage.local.get.mockImplementation((key, callback) => {
        callback({ 'tabflow:grouping_rules': {} });
      });

      await expect(ruleManager.toggleRuleEnabled('non_existent'))
        .rejects
        .toThrow('规则不存在: non_existent');
    });
  });

  describe('updateRulePriority', () => {
    test('should update rule priority successfully', async () => {
      const existingRule = {
        id: 'rule_1',
        name: 'Test Rule',
        enabled: true,
        priority: 5,
        conditions: [{ field: 'title', keyword: 'test', caseSensitive: false }],
        targetGroup: { name: 'Test', autoCreate: true },
        createdAt: 123456789
      };

      chrome.storage.local.get.mockImplementation((key, callback) => {
        callback({
          'tabflow:grouping_rules': {
            'rule_1': existingRule
          }
        });
      });

      chrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      const updatedRule = await ruleManager.updateRulePriority('rule_1', 2);

      expect(updatedRule.priority).toBe(2);
    });

    test('should reject negative priority', async () => {
      await expect(ruleManager.updateRulePriority('rule_1', -1))
        .rejects
        .toThrow('优先级必须是非负数');
    });
  });

  describe('reorderRules', () => {
    test('should reorder rules successfully', async () => {
      const existingRules = {
        'rule_1': { ...sampleRuleData, id: 'rule_1', priority: 1 },
        'rule_2': { ...sampleRuleData2, id: 'rule_2', priority: 2 },
        'rule_3': { ...sampleRuleData, id: 'rule_3', name: 'Rule 3', priority: 3 }
      };

      const newOrder = ['rule_3', 'rule_1', 'rule_2']; // 新的优先级顺序

      chrome.storage.local.get.mockImplementation((key, callback) => {
        callback({ 'tabflow:grouping_rules': existingRules });
      });

      chrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      const result = await ruleManager.reorderRules(newOrder);

      expect(result).toBe(true);

      // 验证优先级更新
      const expectedRules = {
        'rule_3': { ...existingRules['rule_3'], priority: 1 },
        'rule_1': { ...existingRules['rule_1'], priority: 2 },
        'rule_2': { ...existingRules['rule_2'], priority: 3 }
      };

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        { 'tabflow:grouping_rules': expectedRules },
        expect.any(Function)
      );
    });

    test('should reject invalid ruleIds parameter', async () => {
      const result = await ruleManager.reorderRules('not an array');
      expect(result).toBe(false);
    });

    test('should reject if any rule ID does not exist', async () => {
      const existingRules = {
        'rule_1': { ...sampleRuleData, id: 'rule_1', priority: 1 }
      };

      chrome.storage.local.get.mockImplementation((key, callback) => {
        callback({ 'tabflow:grouping_rules': existingRules });
      });

      const result = await ruleManager.reorderRules(['rule_1', 'non_existent']);
      expect(result).toBe(false);
    });
  });

  describe('getRulesList', () => {
    test('should get rules list sorted by priority', async () => {
      const unsortedRules = {
        'rule_1': { ...sampleRuleData, id: 'rule_1', priority: 3, name: 'Rule 3' },
        'rule_2': { ...sampleRuleData, id: 'rule_2', priority: 1, name: 'Rule 1' },
        'rule_3': { ...sampleRuleData, id: 'rule_3', priority: 2, name: 'Rule 2' }
      };

      chrome.storage.local.get.mockImplementation((key, callback) => {
        callback({ 'tabflow:grouping_rules': unsortedRules });
      });

      const rulesList = await ruleManager.getRulesList();

      expect(rulesList).toHaveLength(3);
      expect(rulesList[0].priority).toBe(1);
      expect(rulesList[1].priority).toBe(2);
      expect(rulesList[2].priority).toBe(3);
    });

    test('should return empty array when no rules exist', async () => {
      chrome.storage.local.get.mockImplementation((key, callback) => {
        callback({ 'tabflow:grouping_rules': {} });
      });

      const rulesList = await ruleManager.getRulesList();
      expect(rulesList).toEqual([]);
    });
  });

  describe('clearAllRules', () => {
    test('should clear all rules successfully', async () => {
      chrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      const result = await ruleManager.clearAllRules();

      expect(result).toBe(true);
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        { 'tabflow:grouping_rules': {} },
        expect.any(Function)
      );
    });
  });
});