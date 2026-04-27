/**
 * RuleEngine - 规则引擎核心类
 *
 * 负责规则匹配逻辑，包括：
 * - 条件匹配检查
 * - 字段值提取
 * - 域名提取
 * - 规则优先级排序
 * - 匹配规则查找
 * - 支持多种匹配条件和组合逻辑
 */

class RuleEngine {
  constructor() {
    console.log('🔧 RuleEngine initialized');
    
    // 支持的字段类型
    this.supportedFields = {
      'title': {
        label: '标题',
        operators: ['contains', 'equals', 'startsWith', 'endsWith', 'regex', 'notContains', 'notEquals']
      },
      'url': {
        label: 'URL',
        operators: ['contains', 'equals', 'startsWith', 'endsWith', 'regex', 'notContains', 'notEquals']
      },
      'domain': {
        label: '域名',
        operators: ['contains', 'equals', 'startsWith', 'endsWith', 'regex', 'notContains', 'notEquals']
      },
      'path': {
        label: '路径',
        operators: ['contains', 'equals', 'startsWith', 'endsWith', 'regex', 'notContains', 'notEquals']
      },
      'note': {
        label: '备注',
        operators: ['contains', 'equals', 'regex', 'notContains', 'notEquals']
      },
      'alias': {
        label: '别名',
        operators: ['contains', 'equals', 'startsWith', 'endsWith', 'regex', 'notContains', 'notEquals']
      },
      'openedAt': {
        label: '打开时间',
        operators: ['before', 'after', 'between', 'today', 'yesterday', 'thisWeek', 'thisMonth']
      },
      'lastAccessed': {
        label: '最后访问时间',
        operators: ['before', 'after', 'between', 'today', 'yesterday', 'thisWeek', 'thisMonth']
      },
      'visitCount': {
        label: '访问次数',
        operators: ['greaterThan', 'lessThan', 'equals', 'between', 'notEquals']
      },
      'pinned': {
        label: '固定标签',
        operators: ['equals', 'notEquals']
      }
    };
    
    // 逻辑操作符
    this.logicOperators = {
      'AND': '全部满足',
      'OR': '满足任一'
    };
  }

  /**
   * 检查标签页是否匹配指定规则
   * @param {Object} tab - 标签页对象
   * @param {Object} rule - 规则对象
   * @returns {boolean} 是否匹配
   */
  matchesRule(tab, rule) {
    if (!rule.enabled || !rule.conditions || rule.conditions.length === 0) {
      return false;
    }

    const logicOperator = rule.logicOperator || 'AND';
    
    if (logicOperator === 'AND') {
      for (const condition of rule.conditions) {
        if (!this.matchesCondition(tab, condition)) {
          return false;
        }
      }
      return true;
    } else {
      for (const condition of rule.conditions) {
        if (this.matchesCondition(tab, condition)) {
          return true;
        }
      }
      return false;
    }
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
    const operator = typeof condition.operator === 'string' && condition.operator.trim()
      ? condition.operator
      : 'contains';

    // 时间相关操作符
    if (['before', 'after', 'between', 'today', 'yesterday', 'thisWeek', 'thisMonth'].includes(operator)) {
      return this.matchTimeCondition(fieldValue, operator, condition);
    }

    // 数字相关操作符
    if (['greaterThan', 'lessThan', 'between'].includes(operator)) {
      return this.matchNumberCondition(fieldValue, operator, condition);
    }

    // 布尔值操作符
    if (condition.field === 'pinned') {
      return this.matchBooleanCondition(fieldValue, operator, condition);
    }

    // 字符串相关操作符
    return this.matchStringCondition(fieldValue, operator, condition);
  }

  /**
   * 匹配字符串条件
   */
  matchStringCondition(fieldValue, operator, condition) {
    if (!fieldValue) return false;
    
    const rawExpectedValue = typeof condition.value === 'string'
      ? condition.value
      : (typeof condition.keyword === 'string' ? condition.keyword : '');
    const expectedValue = rawExpectedValue.trim();
    if (!expectedValue) {
      return false;
    }

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
      case 'notContains':
        return !searchValue.includes(testValue);
      case 'equals':
        return searchValue === testValue;
      case 'notEquals':
        return searchValue !== testValue;
      case 'startsWith':
        return searchValue.startsWith(testValue);
      case 'endsWith':
        return searchValue.endsWith(testValue);
      default:
        return searchValue.includes(testValue);
    }
  }

  /**
   * 匹配时间条件
   */
  matchTimeCondition(fieldValue, operator, condition) {
    const fieldTime = Number(fieldValue);
    if (!Number.isFinite(fieldTime)) return false;
    
    const now = Date.now();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000;
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStart = yesterday.getTime();
    
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartTime = weekStart.getTime();
    
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthStartTime = monthStart.getTime();

    switch (operator) {
      case 'today':
        return fieldTime >= todayStart && fieldTime < todayEnd;
      case 'yesterday':
        return fieldTime >= yesterdayStart && fieldTime < todayStart;
      case 'thisWeek':
        return fieldTime >= weekStartTime && fieldTime < todayEnd;
      case 'thisMonth':
        return fieldTime >= monthStartTime && fieldTime < todayEnd;
      case 'before':
        const beforeTime = Number(condition.value);
        return Number.isFinite(beforeTime) && fieldTime < beforeTime;
      case 'after':
        const afterTime = Number(condition.value);
        return Number.isFinite(afterTime) && fieldTime > afterTime;
      case 'between':
        const startTime = Number(condition.startValue);
        const endTime = Number(condition.endValue);
        return Number.isFinite(startTime) && Number.isFinite(endTime) && 
               fieldTime >= startTime && fieldTime <= endTime;
      default:
        return false;
    }
  }

  /**
   * 匹配数字条件
   */
  matchNumberCondition(fieldValue, operator, condition) {
    const fieldNum = Number(fieldValue);
    if (!Number.isFinite(fieldNum)) return false;
    
    const conditionValue = Number(condition.value);
    const conditionStartValue = Number(condition.startValue);
    const conditionEndValue = Number(condition.endValue);

    switch (operator) {
      case 'greaterThan':
        return Number.isFinite(conditionValue) && fieldNum > conditionValue;
      case 'lessThan':
        return Number.isFinite(conditionValue) && fieldNum < conditionValue;
      case 'equals':
        return Number.isFinite(conditionValue) && fieldNum === conditionValue;
      case 'notEquals':
        return Number.isFinite(conditionValue) && fieldNum !== conditionValue;
      case 'between':
        return Number.isFinite(conditionStartValue) && Number.isFinite(conditionEndValue) &&
               fieldNum >= conditionStartValue && fieldNum <= conditionEndValue;
      default:
        return false;
    }
  }

  /**
   * 匹配布尔值条件
   */
  matchBooleanCondition(fieldValue, operator, condition) {
    const fieldBool = Boolean(fieldValue);
    const conditionValue = condition.value === 'true' || condition.value === true;
    
    if (operator === 'equals') {
      return fieldBool === conditionValue;
    } else if (operator === 'notEquals') {
      return fieldBool !== conditionValue;
    }
    
    return false;
  }

  /**
   * 获取标签页指定字段的值
   * @param {Object} tab - 标签页对象
   * @param {string} field - 字段名
   * @returns {*} 字段值
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
      case 'note':
        return tab.note || '';
      case 'alias':
        return tab.alias || '';
      case 'openedAt':
        return tab.openedAt || 0;
      case 'lastAccessed':
        return tab.lastAccessed || 0;
      case 'visitCount':
        return tab.visitCount || 0;
      case 'pinned':
        return tab.pinned || false;
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
   * 查找所有匹配的规则
   * @param {Object} tab - 标签页对象
   * @param {Array} rules - 规则数组
   * @returns {Array} 匹配的规则数组
   */
  findAllMatchingRules(tab, rules) {
    const sortedRules = this.sortRulesByPriority(rules);
    const matchingRules = [];

    for (const rule of sortedRules) {
      if (this.matchesRule(tab, rule)) {
        matchingRules.push(rule);
      }
    }

    return matchingRules;
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

  /**
   * 验证规则格式是否正确
   * @param {Object} rule - 规则对象
   * @returns {Object} 验证结果 { valid: boolean, errors: string[] }
   */
  validateRule(rule) {
    const errors = [];
    
    if (!rule || typeof rule !== 'object') {
      return { valid: false, errors: ['规则格式无效'] };
    }
    
    if (!rule.name || typeof rule.name !== 'string' || rule.name.trim() === '') {
      errors.push('规则名称不能为空');
    }
    
    if (!rule.conditions || !Array.isArray(rule.conditions)) {
      errors.push('规则必须包含条件数组');
    } else if (rule.conditions.length === 0) {
      errors.push('规则至少需要一个条件');
    } else {
      rule.conditions.forEach((condition, index) => {
        if (!condition.field) {
          errors.push(`条件 ${index + 1}: 缺少字段`);
        } else if (!this.supportedFields[condition.field]) {
          errors.push(`条件 ${index + 1}: 不支持的字段 "${condition.field}"`);
        }
        
        if (!condition.operator) {
          errors.push(`条件 ${index + 1}: 缺少操作符`);
        } else if (condition.field && this.supportedFields[condition.field]) {
          const validOperators = this.supportedFields[condition.field].operators;
          if (!validOperators.includes(condition.operator)) {
            errors.push(`条件 ${index + 1}: 操作符 "${condition.operator}" 不支持字段 "${condition.field}"`);
          }
        }
      });
    }
    
    if (rule.logicOperator && !['AND', 'OR'].includes(rule.logicOperator)) {
      errors.push('逻辑操作符必须是 "AND" 或 "OR"');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 获取支持的字段列表
   * @returns {Array} 字段信息数组
   */
  getSupportedFields() {
    return Object.entries(this.supportedFields).map(([field, info]) => ({
      field,
      label: info.label,
      operators: info.operators
    }));
  }

  /**
   * 获取支持的操作符列表
   * @param {string} field - 字段名（可选）
   * @returns {Object|Array} 操作符信息
   */
  getSupportedOperators(field) {
    if (field && this.supportedFields[field]) {
      return this.supportedFields[field].operators;
    }
    return {
      string: ['contains', 'equals', 'startsWith', 'endsWith', 'regex', 'notContains', 'notEquals'],
      time: ['before', 'after', 'between', 'today', 'yesterday', 'thisWeek', 'thisMonth'],
      number: ['greaterThan', 'lessThan', 'equals', 'between', 'notEquals'],
      boolean: ['equals', 'notEquals']
    };
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
