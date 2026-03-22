/**
 * RuleEngine - 规则引擎核心类
 *
 * 负责规则匹配逻辑，包括：
 * - 条件匹配检查
 * - 字段值提取
 * - 域名提取
 * - 规则优先级排序
 * - 匹配规则查找
 */

class RuleEngine {
  constructor() {
    console.log('🔧 RuleEngine initialized');
  }

  /**
   * 检查标签页是否匹配指定规则
   * @param {Object} tab - 标签页对象
   * @param {Object} rule - 规则对象
   * @returns {boolean} 是否匹配
   */
  matchesRule(tab, rule) {
    // 检查规则是否启用且包含条件
    if (!rule.enabled || !rule.conditions || rule.conditions.length === 0) {
      return false;
    }

    // 所有条件都必须匹配（AND逻辑）
    for (const condition of rule.conditions) {
      if (!this.matchesCondition(tab, condition)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 检查标签页是否匹配单个条件
   * @param {Object} tab - 标签页对象
   * @param {Object} condition - 条件对象
   * @returns {boolean} 是否匹配
   */
  matchesCondition(tab, condition) {
    if (!condition || typeof condition !== 'object') {
      return false;
    }

    const fieldValue = this.getFieldValue(tab, condition.field);
    if (!fieldValue) return false;

    const rawExpectedValue = typeof condition.value === 'string'
      ? condition.value
      : (typeof condition.keyword === 'string' ? condition.keyword : '');
    const expectedValue = rawExpectedValue.trim();
    if (!expectedValue) {
      return false;
    }

    const operator = typeof condition.operator === 'string' && condition.operator.trim()
      ? condition.operator
      : 'contains';
    const caseSensitive = Boolean(condition.caseSensitive);

    if (operator === 'regex') {
      try {
        const flags = caseSensitive ? '' : 'i';
        return new RegExp(expectedValue, flags).test(fieldValue);
      } catch (error) {
        console.warn('Invalid regex condition:', expectedValue, error);
        return false;
      }
    }

    const searchValue = caseSensitive ? fieldValue : fieldValue.toLowerCase();
    const testValue = caseSensitive ? expectedValue : expectedValue.toLowerCase();

    switch (operator) {
      case 'contains':
        return searchValue.includes(testValue);
      case 'equals':
        return searchValue === testValue;
      case 'startsWith':
        return searchValue.startsWith(testValue);
      case 'endsWith':
        return searchValue.endsWith(testValue);
      default:
        return searchValue.includes(testValue);
    }
  }

  /**
   * 获取标签页指定字段的值
   * @param {Object} tab - 标签页对象
   * @param {string} field - 字段名 ('title' | 'url' | 'domain')
   * @returns {string} 字段值
   */
  getFieldValue(tab, field) {
    switch (field) {
      case 'title':
        return tab.title || '';
      case 'url':
        return tab.url || '';
      case 'domain':
        return this.extractDomain(tab.url || '');
      case 'path':
        try {
          const urlObj = new URL(tab.url || '');
          return urlObj.pathname || '';
        } catch (error) {
          return '';
        }
      default:
        return '';
    }
  }

  /**
   * 从URL中提取域名
   * @param {string} url - URL字符串
   * @returns {string} 域名或空字符串
   */
  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.host;
    } catch (error) {
      console.warn('Failed to extract domain from URL:', url, error);
      return '';
    }
  }

  /**
   * 在规则列表中找到第一个匹配的规则
   * @param {Object} tab - 标签页对象
   * @param {Array} rules - 规则数组
   * @returns {Object|null} 匹配的规则对象，如果没有匹配则返回null
   */
  findMatchingRule(tab, rules) {
    const sortedRules = this.sortRulesByPriority(rules);

    for (const rule of sortedRules) {
      if (this.matchesRule(tab, rule)) {
        console.log(`✅ Found matching rule for tab "${tab.title}": ${rule.name}`);
        return rule;
      }
    }

    return null;
  }

  /**
   * 按优先级排序规则（数字越小优先级越高）
   * @param {Array} rules - 规则数组
   * @returns {Array} 排序后的规则数组
   */
  sortRulesByPriority(rules) {
    return [...rules].sort((a, b) => {
      const priorityA = Number.isFinite(Number(a?.priority)) ? Number(a.priority) : Number.MAX_SAFE_INTEGER;
      const priorityB = Number.isFinite(Number(b?.priority)) ? Number(b.priority) : Number.MAX_SAFE_INTEGER;
      return priorityA - priorityB;
    });
  }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RuleEngine;
}

// 浏览器环境导出
if (typeof window !== 'undefined') {
  window.RuleEngine = RuleEngine;
}
