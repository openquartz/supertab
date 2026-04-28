/**
 * SceneGrouper - 场景化自动归类引擎
 * 
 * 整合内容类型分类器和场景分类器，实现多维度自动归类：
 * - 按网页内容类型自动归类（文档、视频、图片、办公工具）
 * - 按访问场景自动归类（工作、娱乐、学习）
 * - 自定义关键词匹配
 * - 用户自定义归类权重
 * - 手动调整分类优先级
 */

class SceneGrouper {
  constructor(storageManager = null, eventBus = null, options = {}) {
    this.storageManager = storageManager;
    this.eventBus = eventBus;
    
    this.contentTypeClassifier = options.contentTypeClassifier || new ContentTypeClassifier();
    this.sceneClassifier = options.sceneClassifier || new SceneClassifier();
    this.ruleEngine = options.ruleEngine || new RuleEngine();
    
    this.enableKeywordRules = options.enableKeywordRules !== false;
    this.enableContentTypes = options.enableContentTypes !== false;
    this.enableScenes = options.enableScenes !== false;
    
    this.keywordRules = new Map();
    this.groupingModes = options.groupingModes || {
      content: true,
      scene: true,
      keyword: true,
      custom: true
    };
    
    const defaultPriority = options.defaultGroupingPriority || ['keyword', 'custom', 'content', 'scene'];
    this.groupingPriorities = options.groupingPriorities || {
      keyword: 4,
      custom: 3,
      content: 2,
      scene: 1
    };
    
    for (let i = 0; i < defaultPriority.length; i++) {
      const mode = defaultPriority[i];
      if (this.groupingPriorities[mode] !== undefined) {
        this.groupingPriorities[mode] = defaultPriority.length - i;
      }
    }
    
    this.customGroupWeights = new Map();
    this.initialized = false;
    
    console.log('🎯 SceneGrouper initialized');
  }

  async initialize() {
    if (this.initialized) return true;

    await this.sceneClassifier.loadFromStorage();
    await this.loadKeywordRules();
    
    this.initialized = true;
    console.log('✅ SceneGrouper initialized');
    return true;
  }

  // ========== 关键词规则管理 ==========

  async addKeywordRule(rule) {
    const validation = this.validateKeywordRule(rule);
    if (!validation.isValid) {
      throw new Error(validation.errors.join('; '));
    }

    const ruleId = `keyword_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newRule = {
      id: ruleId,
      name: rule.name.trim(),
      enabled: rule.enabled !== false,
      priority: Number.isFinite(rule.priority) ? rule.priority : 100,
      matchType: rule.matchType || 'contains',
      keywords: Array.isArray(rule.keywords) ? rule.keywords : [],
      matchField: rule.matchField || 'all',
      caseSensitive: Boolean(rule.caseSensitive),
      targetGroup: rule.targetGroup || rule.name,
      weight: Number.isFinite(rule.weight) ? rule.weight : 1.0,
      createdAt: Date.now()
    };

    this.keywordRules.set(ruleId, newRule);
    await this.saveKeywordRules();

    console.log('➕ Added keyword rule:', newRule.name);
    return newRule;
  }

  validateKeywordRule(rule) {
    const errors = [];

    if (!rule.name || typeof rule.name !== 'string' || rule.name.trim() === '') {
      errors.push('规则名称不能为空');
    }

    if (!rule.keywords || !Array.isArray(rule.keywords) || rule.keywords.length === 0) {
      errors.push('关键词不能为空');
    }

    if (rule.matchType && !['contains', 'equals', 'startsWith', 'endsWith', 'regex'].includes(rule.matchType)) {
      errors.push('matchType 必须是 contains、equals、startsWith、endsWith 或 regex');
    }

    if (rule.matchField && !['all', 'title', 'url', 'domain', 'path'].includes(rule.matchField)) {
      errors.push('matchField 必须是 all、title、url、domain 或 path');
    }

    return { isValid: errors.length === 0, errors };
  }

  async updateKeywordRule(ruleId, updates) {
    const rule = this.keywordRules.get(ruleId);
    if (!rule) {
      throw new Error('规则不存在');
    }

    const updatedRule = {
      ...rule,
      ...updates,
      id: ruleId,
      updatedAt: Date.now()
    };

    const validation = this.validateKeywordRule(updatedRule);
    if (!validation.isValid) {
      throw new Error(validation.errors.join('; '));
    }

    this.keywordRules.set(ruleId, updatedRule);
    await this.saveKeywordRules();

    console.log('🔄 Updated keyword rule:', updatedRule.name);
    return updatedRule;
  }

  async deleteKeywordRule(ruleId) {
    const deleted = this.keywordRules.delete(ruleId);
    if (deleted) {
      await this.saveKeywordRules();
      console.log('➖ Deleted keyword rule:', ruleId);
    }
    return deleted;
  }

  async toggleKeywordRule(ruleId) {
    const rule = this.keywordRules.get(ruleId);
    if (!rule) return null;

    rule.enabled = !rule.enabled;
    rule.updatedAt = Date.now();
    await this.saveKeywordRules();

    console.log('🔄 Toggled keyword rule:', rule.name, '->', rule.enabled);
    return rule;
  }

  getKeywordRules() {
    return Array.from(this.keywordRules.values())
      .sort((a, b) => (a.priority || 0) - (b.priority || 0));
  }

  async saveKeywordRules() {
    try {
      const rulesData = Object.fromEntries(this.keywordRules);
      await new Promise((resolve, reject) => {
        chrome.storage.local.set({ 'tabflow:keyword_rules': rulesData }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
      return true;
    } catch (error) {
      console.error('❌ Failed to save keyword rules:', error);
      return false;
    }
  }

  async loadKeywordRules() {
    try {
      const result = await new Promise((resolve, reject) => {
        chrome.storage.local.get('tabflow:keyword_rules', (data) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(data);
          }
        });
      });

      const rulesData = result['tabflow:keyword_rules'];
      if (rulesData) {
        for (const [key, value] of Object.entries(rulesData)) {
          this.keywordRules.set(key, value);
        }
        console.log('📥 Loaded', this.keywordRules.size, 'keyword rules');
        return true;
      }
      return false;
    } catch (error) {
      console.warn('⚠️ Failed to load keyword rules:', error);
      return false;
    }
  }

  // ========== 分组模式和优先级管理 ==========

  setGroupingMode(mode, enabled) {
    if (['content', 'scene', 'keyword', 'custom'].includes(mode)) {
      this.groupingModes[mode] = enabled;
      console.log('⚙️ Set grouping mode:', mode, '->', enabled);
    }
  }

  setGroupingPriority(mode, priority) {
    if (['content', 'scene', 'keyword', 'custom'].includes(mode)) {
      this.groupingPriorities[mode] = Math.max(0, priority);
      console.log('⚖️ Set grouping priority:', mode, '->', priority);
    }
  }

  setCustomGroupWeight(groupName, weight) {
    this.customGroupWeights.set(groupName, Math.max(0, Math.min(2, weight)));
    console.log('📊 Set custom group weight:', groupName, '->', weight);
  }

  // ========== 匹配逻辑 ==========

  matchKeywordRule(tab, rule) {
    if (!rule.enabled) return null;

    let targetValue = '';
    
    switch (rule.matchField) {
      case 'title':
        targetValue = tab.title || '';
        break;
      case 'url':
        targetValue = tab.url || '';
        break;
      case 'domain':
        try {
          targetValue = new URL(tab.url || '').hostname;
        } catch (e) {
          targetValue = '';
        }
        break;
      case 'path':
        try {
          targetValue = new URL(tab.url || '').pathname;
        } catch (e) {
          targetValue = '';
        }
        break;
      case 'all':
      default:
        targetValue = `${tab.title || ''} ${tab.url || ''}`;
        break;
    }

    const searchValue = rule.caseSensitive ? targetValue : targetValue.toLowerCase();

    for (const keyword of rule.keywords) {
      const testKeyword = rule.caseSensitive ? keyword : keyword.toLowerCase();
      let matched = false;

      switch (rule.matchType) {
        case 'contains':
          matched = searchValue.includes(testKeyword);
          break;
        case 'equals':
          matched = searchValue === testKeyword;
          break;
        case 'startsWith':
          matched = searchValue.startsWith(testKeyword);
          break;
        case 'endsWith':
          matched = searchValue.endsWith(testKeyword);
          break;
        case 'regex':
          try {
            const flags = rule.caseSensitive ? '' : 'i';
            matched = new RegExp(keyword, flags).test(targetValue);
          } catch (e) {
            matched = false;
          }
          break;
        default:
          matched = searchValue.includes(testKeyword);
      }

      if (matched) {
        return {
          rule,
          matchedKeyword: keyword,
          score: rule.weight || 1.0
        };
      }
    }

    return null;
  }

  // ========== 核心分组方法 ==========

  classifyTab(tab, options = {}) {
    const results = {
      matches: [],
      finalGroup: null,
      scores: {}
    };

    if (this.groupingModes.keyword) {
      const keywordMatch = this.matchKeywordRules(tab);
      if (keywordMatch) {
        const priority = this.groupingPriorities.keyword + keywordMatch.score;
        results.matches.push({
          type: 'keyword',
          groupName: keywordMatch.rule.targetGroup,
          score: keywordMatch.score,
          priority,
          rule: keywordMatch.rule,
          matchedKeyword: keywordMatch.matchedKeyword
        });
        results.scores.keyword = keywordMatch.score;
      }
    }

    if (this.groupingModes.content) {
      const contentResult = this.contentTypeClassifier.classify(tab);
      if (contentResult.score > 0.3) {
        const priority = this.groupingPriorities.content;
        const groupWeight = this.customGroupWeights.get(contentResult.type) || 1;
        const adjustedPriority = priority * groupWeight;
        
        results.matches.push({
          type: 'content',
          groupName: contentResult.name,
          contentType: contentResult.type,
          score: contentResult.score,
          priority: adjustedPriority,
          icon: contentResult.icon,
          color: contentResult.color
        });
        results.scores.content = contentResult.score;
      }
    }

    if (this.groupingModes.scene) {
      const sceneResult = this.sceneClassifier.classify(tab);
      if (sceneResult.score > 0.25) {
        const priority = this.groupingPriorities.scene;
        const groupWeight = this.customGroupWeights.get(sceneResult.type) || 1;
        const adjustedPriority = priority * groupWeight;
        
        results.matches.push({
          type: 'scene',
          groupName: sceneResult.name,
          sceneType: sceneResult.type,
          score: sceneResult.score,
          priority: adjustedPriority,
          icon: sceneResult.icon,
          color: sceneResult.color
        });
        results.scores.scene = sceneResult.score;
      }
    }

    results.matches.sort((a, b) => {
      if (Math.abs(a.priority - b.priority) > 0.1) {
        return b.priority - a.priority;
      }
      return b.score - a.score;
    });

    if (results.matches.length > 0) {
      results.finalGroup = results.matches[0];
    }

    return results;
  }

  matchKeywordRules(tab) {
    const enabledRules = this.getKeywordRules().filter(r => r.enabled);
    
    for (const rule of enabledRules) {
      const match = this.matchKeywordRule(tab, rule);
      if (match) {
        return match;
      }
    }

    return null;
  }

  // ========== 批量分组 ==========

  groupTabs(tabs, options = {}) {
    const groups = new Map();
    const ungrouped = [];
    const groupingMode = options.mode || 'auto';
    const mergeThreshold = options.mergeThreshold || 0.5;

    for (const tab of tabs) {
      const classification = this.classifyTab(tab);
      
      if (classification.finalGroup) {
        const groupKey = this.getGroupKey(classification.finalGroup, groupingMode);
        
        if (!groups.has(groupKey)) {
          groups.set(groupKey, this.createGroup(classification.finalGroup));
        }
        groups.get(groupKey).tabs.push(tab);
      } else {
        ungrouped.push(tab);
      }
    }

    const resultGroups = Array.from(groups.values())
      .filter(g => g.tabs.length > 0)
      .sort((a, b) => {
        if (a.priority !== b.priority) {
          return (b.priority || 0) - (a.priority || 0);
        }
        return b.tabs.length - a.tabs.length;
      });

    if (ungrouped.length > 0) {
      resultGroups.push({
        id: 'scene_ungrouped',
        name: '未分类',
        type: 'ungrouped',
        icon: '📁',
        color: '#607D8B',
        tabs: ungrouped,
        collapsed: false,
        createdAt: Date.now(),
        priority: 0
      });
    }

    return resultGroups;
  }

  getGroupKey(match, groupingMode) {
    switch (groupingMode) {
      case 'content':
        return `content_${match.contentType || match.groupName}`;
      case 'scene':
        return `scene_${match.sceneType || match.groupName}`;
      case 'keyword':
        return `keyword_${match.rule?.id || match.groupName}`;
      default:
        return `${match.type}_${match.groupName}`;
    }
  }

  createGroup(match) {
    return {
      id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: match.groupName,
      type: match.type,
      contentType: match.contentType,
      sceneType: match.sceneType,
      icon: match.icon || '📁',
      color: match.color || '#607D8B',
      tabs: [],
      collapsed: false,
      createdAt: Date.now(),
      priority: match.priority || 0,
      rule: match.rule
    };
  }

  // ========== 多维度联合分组 ==========

  groupByMultipleDimensions(tabs, options = {}) {
    const dimensions = options.dimensions || ['content', 'scene'];
    const includeKeywords = options.includeKeywords !== false;
    const minGroupSize = options.minGroupSize || 1;

    let groupedTabs = new Map();

    if (includeKeywords) {
      const keywordGroups = this.groupByKeywords(tabs);
      for (const [key, group] of keywordGroups) {
        groupedTabs.set(key, group);
      }
      const matchedUuids = new Set();
      for (const group of groupedTabs.values()) {
        for (const tab of group.tabs) {
          matchedUuids.add(tab.uuid);
        }
      }
      tabs = tabs.filter(t => !matchedUuids.has(t.uuid));
    }

    for (const dimension of dimensions) {
      const dimensionGroups = this.groupByDimension(tabs, dimension);
      
      for (const [key, group] of dimensionGroups) {
        if (group.tabs.length >= minGroupSize) {
          const fullKey = `${dimension}_${key}`;
          if (!groupedTabs.has(fullKey)) {
            groupedTabs.set(fullKey, {
              ...group,
              type: dimension
            });
          }
        }
      }
    }

    const allMatched = new Set();
    for (const group of groupedTabs.values()) {
      for (const tab of group.tabs) {
        allMatched.add(tab.uuid);
      }
    }

    const ungrouped = tabs.filter(t => !allMatched.has(t.uuid));
    if (ungrouped.length > 0) {
      groupedTabs.set('ungrouped', {
        id: 'ungrouped',
        name: '未分类',
        type: 'ungrouped',
        icon: '📁',
        color: '#607D8B',
        tabs: ungrouped,
        collapsed: false,
        createdAt: Date.now()
      });
    }

    return Array.from(groupedTabs.values())
      .sort((a, b) => b.tabs.length - a.tabs.length);
  }

  groupByKeywords(tabs) {
    const groups = new Map();

    for (const tab of tabs) {
      const match = this.matchKeywordRules(tab);
      if (match) {
        const groupKey = `keyword_${match.rule.id}`;
        if (!groups.has(groupKey)) {
          groups.set(groupKey, {
            id: groupKey,
            name: match.rule.targetGroup,
            type: 'keyword',
            icon: '🔑',
            color: '#FF9800',
            rule: match.rule,
            tabs: [],
            collapsed: false,
            createdAt: Date.now()
          });
        }
        groups.get(groupKey).tabs.push(tab);
      }
    }

    return groups;
  }

  groupByDimension(tabs, dimension) {
    const groups = new Map();

    for (const tab of tabs) {
      let result;
      
      switch (dimension) {
        case 'content':
          result = this.contentTypeClassifier.classify(tab);
          break;
        case 'scene':
          result = this.sceneClassifier.classify(tab);
          break;
        default:
          continue;
      }

      if (result && result.score > 0.3) {
        const key = result.type;
        if (!groups.has(key)) {
          groups.set(key, {
            id: `${dimension}_${key}`,
            name: result.name,
            icon: result.icon,
            color: result.color,
            description: result.description,
            tabs: [],
            collapsed: false,
            createdAt: Date.now()
          });
        }
        groups.get(key).tabs.push(tab);
      }
    }

    return groups;
  }

  // ========== 获取统计信息 ==========

  getStats() {
    return {
      keywordRuleCount: this.keywordRules.size,
      enabledKeywordRules: this.getKeywordRules().filter(r => r.enabled).length,
      groupingModes: { ...this.groupingModes },
      groupingPriorities: { ...this.groupingPriorities },
      customGroupWeights: Object.fromEntries(this.customGroupWeights),
      contentCategories: this.contentTypeClassifier.getCategories().length,
      sceneCategories: this.sceneClassifier.getScenes().length,
      initialized: this.initialized
    };
  }

  // ========== 重置 ==========

  async reset() {
    this.keywordRules.clear();
    this.customGroupWeights.clear();
    this.groupingModes = {
      content: true,
      scene: true,
      keyword: true,
      custom: true
    };
    this.groupingPriorities = {
      keyword: 4,
      custom: 3,
      content: 2,
      scene: 1
    };

    await this.saveKeywordRules();
    console.log('🔄 SceneGrouper reset');
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SceneGrouper;
}

if (typeof window !== 'undefined') {
  window.SceneGrouper = SceneGrouper;
}
