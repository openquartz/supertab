const { describe, test, expect } = require('@jest/globals');
const RuleEngine = require('../../utils/rule-engine');

describe('RuleEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new RuleEngine();
  });

  describe('matchesRule', () => {
    test('should match rule with title condition', () => {
      const rule = {
        id: 'test_rule',
        name: 'Test Rule',
        enabled: true,
        priority: 1,
        conditions: [{
          field: 'title',
          keyword: 'github',
          caseSensitive: false
        }],
        targetGroup: {
          name: 'Development',
          autoCreate: true
        }
      };

      // 测试匹配成功的情况
      const tab1 = {
        id: 1,
        title: 'GitHub - user/repo',
        url: 'https://github.com/user/repo',
        uuid: 'tab-1',
        openedAt: Date.now()
      };
      const result1 = engine.matchesRule(tab1, rule);
      expect(result1).toBe(true);

      // 测试匹配失败的情况
      const tab2 = {
        id: 2,
        title: 'Google Search',
        url: 'https://google.com',
        uuid: 'tab-2',
        openedAt: Date.now()
      };
      const result2 = engine.matchesRule(tab2, rule);
      expect(result2).toBe(false);
    });

    test('should return false for disabled rule', () => {
      const rule = {
        id: 'test_rule',
        name: 'Test Rule',
        enabled: false,
        priority: 1,
        conditions: [{
          field: 'title',
          keyword: 'github',
          caseSensitive: false
        }],
        targetGroup: {
          name: 'Development',
          autoCreate: true
        }
      };

      const tab = {
        id: 1,
        title: 'GitHub - user/repo',
        url: 'https://github.com/user/repo',
        uuid: 'tab-1',
        openedAt: Date.now()
      };
      const result = engine.matchesRule(tab, rule);
      expect(result).toBe(false);
    });

    test('should return false for rule with no conditions', () => {
      const rule = {
        id: 'test_rule',
        name: 'Test Rule',
        enabled: true,
        priority: 1,
        conditions: [],
        targetGroup: {
          name: 'Development',
          autoCreate: true
        }
      };

      const tab = {
        id: 1,
        title: 'GitHub - user/repo',
        url: 'https://github.com/user/repo',
        uuid: 'tab-1',
        openedAt: Date.now()
      };
      const result = engine.matchesRule(tab, rule);
      expect(result).toBe(false);
    });

    test('should require all conditions to match (AND logic)', () => {
      const rule = {
        id: 'test_rule',
        name: 'Test Rule',
        enabled: true,
        priority: 1,
        conditions: [
          {
            field: 'title',
            keyword: 'github',
            caseSensitive: false
          },
          {
            field: 'domain',
            keyword: 'github.com',
            caseSensitive: false
          }
        ],
        targetGroup: {
          name: 'Development',
          autoCreate: true
        }
      };

      // 满足所有条件
      const tab1 = {
        id: 1,
        title: 'GitHub - user/repo',
        url: 'https://github.com/user/repo',
        uuid: 'tab-1',
        openedAt: Date.now()
      };
      const result1 = engine.matchesRule(tab1, rule);
      expect(result1).toBe(true);

      // 只满足部分条件
      const tab2 = {
        id: 2,
        title: 'GitHub - user/repo',
        url: 'https://example.com/github',
        uuid: 'tab-2',
        openedAt: Date.now()
      };
      const result2 = engine.matchesRule(tab2, rule);
      expect(result2).toBe(false);
    });
  });

  describe('matchesCondition', () => {
    test('should match title condition case insensitive', () => {
      const tab = {
        id: 1,
        title: 'GITHUB Repository',
        url: 'https://example.com',
        uuid: 'tab-1',
        openedAt: Date.now()
      };
      const condition = {
        field: 'title',
        keyword: 'github',
        caseSensitive: false
      };

      const result = engine.matchesCondition(tab, condition);
      expect(result).toBe(true);
    });

    test('should match title condition case sensitive', () => {
      const tab = {
        id: 1,
        title: 'GITHUB Repository',
        url: 'https://example.com',
        uuid: 'tab-1',
        openedAt: Date.now()
      };

      // 大小写不匹配
      const condition1 = {
        field: 'title',
        keyword: 'github',
        caseSensitive: true
      };
      const result1 = engine.matchesCondition(tab, condition1);
      expect(result1).toBe(false);

      // 大小写匹配
      const condition2 = {
        field: 'title',
        keyword: 'GITHUB',
        caseSensitive: true
      };
      const result2 = engine.matchesCondition(tab, condition2);
      expect(result2).toBe(true);
    });

    test('should match url condition', () => {
      const tab = {
        id: 1,
        title: 'Some Page',
        url: 'https://github.com/user/repo',
        uuid: 'tab-1',
        openedAt: Date.now()
      };
      const condition = {
        field: 'url',
        keyword: 'github.com',
        caseSensitive: false
      };

      const result = engine.matchesCondition(tab, condition);
      expect(result).toBe(true);
    });

    test('should match domain condition', () => {
      const tab = {
        id: 1,
        title: 'Some Page',
        url: 'https://github.com/user/repo',
        uuid: 'tab-1',
        openedAt: Date.now()
      };
      const condition = {
        field: 'domain',
        keyword: 'github.com',
        caseSensitive: false
      };

      const result = engine.matchesCondition(tab, condition);
      expect(result).toBe(true);
    });

    test('should return false for non-matching condition', () => {
      const tab = {
        id: 1,
        title: 'Some Page',
        url: 'https://example.com',
        uuid: 'tab-1',
        openedAt: Date.now()
      };
      const condition = {
        field: 'title',
        keyword: 'github',
        caseSensitive: false
      };

      const result = engine.matchesCondition(tab, condition);
      expect(result).toBe(false);
    });

    test('should return false for empty field value', () => {
      const tab = {
        id: 1,
        title: '',
        url: 'https://example.com',
        uuid: 'tab-1',
        openedAt: Date.now()
      };
      const condition = {
        field: 'title',
        keyword: 'github',
        caseSensitive: false
      };

      const result = engine.matchesCondition(tab, condition);
      expect(result).toBe(false);
    });
  });

  describe('getFieldValue', () => {
    test('should get title field value', () => {
      const tab = {
        id: 1,
        title: 'Test Title',
        url: 'https://example.com',
        uuid: 'tab-1',
        openedAt: Date.now()
      };

      const result = engine.getFieldValue(tab, 'title');
      expect(result).toBe('Test Title');
    });

    test('should get url field value', () => {
      const tab = {
        id: 1,
        title: 'Test Title',
        url: 'https://example.com',
        uuid: 'tab-1',
        openedAt: Date.now()
      };

      const result = engine.getFieldValue(tab, 'url');
      expect(result).toBe('https://example.com');
    });

    test('should get domain field value', () => {
      const tab = {
        id: 1,
        title: 'Test Title',
        url: 'https://github.com/user/repo',
        uuid: 'tab-1',
        openedAt: Date.now()
      };

      const result = engine.getFieldValue(tab, 'domain');
      expect(result).toBe('github.com');
    });

    test('should return empty string for unknown field', () => {
      const tab = {
        id: 1,
        title: 'Test Title',
        url: 'https://example.com',
        uuid: 'tab-1',
        openedAt: Date.now()
      };

      const result = engine.getFieldValue(tab, 'unknown');
      expect(result).toBe('');
    });

    test('should return empty string for undefined field values', () => {
      const tab = {
        id: 1,
        title: undefined,
        url: undefined,
        uuid: 'tab-1',
        openedAt: Date.now()
      };

      expect(engine.getFieldValue(tab, 'title')).toBe('');
      expect(engine.getFieldValue(tab, 'url')).toBe('');
    });
  });

  describe('extractDomain', () => {
    test('should extract domain from valid URL', () => {
      const result = engine.extractDomain('https://github.com/user/repo');
      expect(result).toBe('github.com');
    });

    test('should extract domain from URL with subdomain', () => {
      const result = engine.extractDomain('https://www.example.com/path');
      expect(result).toBe('www.example.com');
    });

    test('should extract domain from URL with port', () => {
      const result = engine.extractDomain('https://localhost:3000/path');
      expect(result).toBe('localhost:3000');
    });

    test('should return empty string for invalid URL', () => {
      const result = engine.extractDomain('not-a-valid-url');
      expect(result).toBe('');
    });

    test('should return empty string for empty URL', () => {
      const result = engine.extractDomain('');
      expect(result).toBe('');
    });

    test('should handle URL without protocol', () => {
      const result = engine.extractDomain('github.com/user/repo');
      expect(result).toBe('');
    });
  });

  describe('findMatchingRule', () => {
    test('should return first matching rule by priority', () => {
      const tab = {
        id: 1,
        title: 'GitHub Repository',
        url: 'https://github.com/user/repo',
        uuid: 'tab-1',
        openedAt: Date.now()
      };

      const rules = [
        {
          id: 'rule1',
          name: 'Rule 1',
          enabled: true,
          priority: 2,
          conditions: [{
            field: 'title',
            keyword: 'github',
            caseSensitive: false
          }],
          targetGroup: { name: 'Group 1', autoCreate: true }
        },
        {
          id: 'rule2',
          name: 'Rule 2',
          enabled: true,
          priority: 1, // 更高优先级
          conditions: [{
            field: 'domain',
            keyword: 'github.com',
            caseSensitive: false
          }],
          targetGroup: { name: 'Group 2', autoCreate: true }
        }
      ];

      const result = engine.findMatchingRule(tab, rules);
      expect(result).toBe(rules[1]); // 应该返回优先级更高的规则
    });

    test('should return null when no rules match', () => {
      const tab = {
        id: 1,
        title: 'Unrelated Page',
        url: 'https://example.com',
        uuid: 'tab-1',
        openedAt: Date.now()
      };

      const rules = [
        {
          id: 'rule1',
          name: 'Rule 1',
          enabled: true,
          priority: 1,
          conditions: [{
            field: 'title',
            keyword: 'github',
            caseSensitive: false
          }],
          targetGroup: { name: 'Group 1', autoCreate: true }
        }
      ];

      const result = engine.findMatchingRule(tab, rules);
      expect(result).toBe(null);
    });

    test('should skip disabled rules', () => {
      const tab = {
        id: 1,
        title: 'GitHub Repository',
        url: 'https://github.com/user/repo',
        uuid: 'tab-1',
        openedAt: Date.now()
      };

      const rules = [
        {
          id: 'rule1',
          name: 'Rule 1',
          enabled: false, // 禁用的规则
          priority: 1,
          conditions: [{
            field: 'title',
            keyword: 'github',
            caseSensitive: false
          }],
          targetGroup: { name: 'Group 1', autoCreate: true }
        },
        {
          id: 'rule2',
          name: 'Rule 2',
          enabled: true,
          priority: 2,
          conditions: [{
            field: 'domain',
            keyword: 'github.com',
            caseSensitive: false
          }],
          targetGroup: { name: 'Group 2', autoCreate: true }
        }
      ];

      const result = engine.findMatchingRule(tab, rules);
      expect(result).toBe(rules[1]);
    });
  });

  describe('sortRulesByPriority', () => {
    test('should sort rules by priority in ascending order', () => {
      const rules = [
        {
          id: 'rule1',
          name: 'Rule 1',
          enabled: true,
          priority: 3,
          conditions: [],
          targetGroup: { name: 'Group 1', autoCreate: true }
        },
        {
          id: 'rule2',
          name: 'Rule 2',
          enabled: true,
          priority: 1,
          conditions: [],
          targetGroup: { name: 'Group 2', autoCreate: true }
        },
        {
          id: 'rule3',
          name: 'Rule 3',
          enabled: true,
          priority: 2,
          conditions: [],
          targetGroup: { name: 'Group 3', autoCreate: true }
        }
      ];

      const sorted = engine.sortRulesByPriority(rules);
      expect(sorted[0].priority).toBe(1);
      expect(sorted[1].priority).toBe(2);
      expect(sorted[2].priority).toBe(3);
    });

    test('should not modify original rules array', () => {
      const originalRules = [
        {
          id: 'rule1',
          name: 'Rule 1',
          enabled: true,
          priority: 2,
          conditions: [],
          targetGroup: { name: 'Group 1', autoCreate: true }
        },
        {
          id: 'rule2',
          name: 'Rule 2',
          enabled: true,
          priority: 1,
          conditions: [],
          targetGroup: { name: 'Group 2', autoCreate: true }
        }
      ];

      const sorted = engine.sortRulesByPriority(originalRules);
      expect(sorted).not.toBe(originalRules); // 应该是新的数组
      expect(originalRules[0].priority).toBe(2); // 原数组顺序不应改变
      expect(originalRules[1].priority).toBe(1);
    });

    test('should handle empty rules array', () => {
      const sorted = engine.sortRulesByPriority([]);
      expect(sorted).toEqual([]);
    });
  });
});