/**
 * RuleManager - 规则管理器
 *
 * 负责规则的CRUD操作、存储管理、验证等
 * - 规则的创建、读取、更新、删除
 * - 规则的启用/禁用切换
 * - 规则的优先级管理
 * - 规则数据验证
 */

class RuleManager {
  constructor(storageManager) {
    this.storageManager = storageManager;
    this.storageKey = 'tabflow:grouping_rules';
    console.log('🔧 RuleManager initialized');
  }

  /**
   * 生成规则ID
   * @returns {string} 规则ID
   */
  generateRuleId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `rule_${timestamp}_${random}`;
  }

  /**
   * 验证规则数据
   * @param {Object} ruleData - 规则数据
   * @returns {Object} 验证结果 {isValid: boolean, errors: string[]}
   */
  validateRule(ruleData) {
    const errors = [];

    // 检查规则名称
    if (!ruleData.name || typeof ruleData.name !== 'string' || ruleData.name.trim() === '') {
      errors.push('规则名称不能为空');
    }

    // 检查匹配条件
    if (!ruleData.conditions || !Array.isArray(ruleData.conditions) || ruleData.conditions.length === 0) {
      errors.push('至少需要一个匹配条件');
    } else {
      for (let i = 0; i < ruleData.conditions.length; i++) {
        const condition = ruleData.conditions[i];

        // 检查条件字段
        if (!condition.field || !['title', 'url', 'domain'].includes(condition.field)) {
          errors.push(`条件 ${i + 1}: 字段必须是 title、url 或 domain`);
        }

        // 检查关键词
        if (!condition.keyword || typeof condition.keyword !== 'string' || condition.keyword.trim() === '') {
          errors.push(`条件 ${i + 1}: 关键词不能为空`);
        }

        // 检查大小写敏感设置
        if (typeof condition.caseSensitive !== 'boolean') {
          errors.push(`条件 ${i + 1}: caseSensitive 必须是布尔值`);
        }
      }
    }

    // 检查目标分组
    if (!ruleData.targetGroup || typeof ruleData.targetGroup !== 'object') {
      errors.push('目标分组配置不能为空');
    } else {
      if (!ruleData.targetGroup.name || typeof ruleData.targetGroup.name !== 'string' || ruleData.targetGroup.name.trim() === '') {
        errors.push('目标分组名称不能为空');
      }

      if (typeof ruleData.targetGroup.autoCreate !== 'boolean') {
        errors.push('autoCreate 必须是布尔值');
      }
    }

    // 检查启用状态
    if (typeof ruleData.enabled !== 'boolean') {
      errors.push('enabled 必须是布尔值');
    }

    // 检查优先级
    if (typeof ruleData.priority !== 'number' || ruleData.priority < 0) {
      errors.push('priority 必须是非负数');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 从存储中获取规则数据
   * @returns {Promise<Object>} 规则对象（以ID为键）
   */
  async getRulesFromStorage() {
    try {
      const result = await new Promise((resolve, reject) => {
        chrome.storage.local.get(this.storageKey, (data) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(data);
          }
        });
      });
      return result[this.storageKey] || {};
    } catch (error) {
      console.error('Failed to get rules from storage:', error);
      return {};
    }
  }

  /**
   * 保存规则数据到存储
   * @param {Object} rules - 规则对象（以ID为键）
   * @returns {Promise<boolean>} 是否保存成功
   */
  async saveRulesToStorage(rules) {
    try {
      await new Promise((resolve, reject) => {
        chrome.storage.local.set({ [this.storageKey]: rules }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
      return true;
    } catch (error) {
      console.error('Failed to save rules to storage:', error);
      return false;
    }
  }

  /**
   * 创建新规则
   * @param {Object} ruleData - 规则数据（不包含id和createdAt）
   * @returns {Promise<Object>} 创建的规则对象
   */
  async createRule(ruleData) {
    try {
      // 验证规则数据
      const validation = this.validateRule(ruleData);
      if (!validation.isValid) {
        throw new Error(`规则验证失败: ${validation.errors.join(', ')}`);
      }

      // 创建规则对象
      const rule = {
        id: this.generateRuleId(),
        name: ruleData.name.trim(),
        enabled: ruleData.enabled,
        priority: ruleData.priority,
        conditions: ruleData.conditions,
        targetGroup: {
          name: ruleData.targetGroup.name.trim(),
          autoCreate: ruleData.targetGroup.autoCreate
        },
        createdAt: Date.now()
      };

      // 获取现有规则并添加新规则
      const rules = await this.getRulesFromStorage();
      rules[rule.id] = rule;

      // 保存到存储
      await this.saveRulesToStorage(rules);

      console.log(`✅ Created rule: ${rule.name} (${rule.id})`);
      return rule;
    } catch (error) {
      console.error('❌ Failed to create rule:', error);
      throw error;
    }
  }

  /**
   * 获取所有规则
   * @returns {Promise<Object>} 规则对象（以ID为键）
   */
  async getAllRules() {
    try {
      return await this.getRulesFromStorage();
    } catch (error) {
      console.error('❌ Failed to get all rules:', error);
      return {};
    }
  }

  /**
   * 获取指定规则
   * @param {string} ruleId - 规则ID
   * @returns {Promise<Object|null>} 规则对象或null
   */
  async getRule(ruleId) {
    try {
      const rules = await this.getRulesFromStorage();
      return rules[ruleId] || null;
    } catch (error) {
      console.error(`❌ Failed to get rule ${ruleId}:`, error);
      return null;
    }
  }

  /**
   * 更新规则
   * @param {string} ruleId - 规则ID
   * @param {Object} updates - 更新数据
   * @returns {Promise<Object|null>} 更新后的规则对象或null
   */
  async updateRule(ruleId, updates) {
    try {
      const rules = await this.getRulesFromStorage();
      const existingRule = rules[ruleId];

      if (!existingRule) {
        throw new Error(`规则不存在: ${ruleId}`);
      }

      // 创建更新后的规则对象
      const updatedRule = {
        ...existingRule,
        ...updates,
        id: ruleId, // 确保ID不被修改
        createdAt: existingRule.createdAt // 确保创建时间不被修改
      };

      // 验证更新后的规则
      const validation = this.validateRule(updatedRule);
      if (!validation.isValid) {
        throw new Error(`规则验证失败: ${validation.errors.join(', ')}`);
      }

      // 更新规则
      rules[ruleId] = updatedRule;
      await this.saveRulesToStorage(rules);

      console.log(`✅ Updated rule: ${updatedRule.name} (${ruleId})`);
      return updatedRule;
    } catch (error) {
      console.error(`❌ Failed to update rule ${ruleId}:`, error);
      throw error;
    }
  }

  /**
   * 删除规则
   * @param {string} ruleId - 规则ID
   * @returns {Promise<boolean>} 是否删除成功
   */
  async deleteRule(ruleId) {
    try {
      const rules = await this.getRulesFromStorage();

      if (!rules[ruleId]) {
        console.warn(`⚠️ Rule not found: ${ruleId}`);
        return false;
      }

      const ruleName = rules[ruleId].name;
      delete rules[ruleId];

      await this.saveRulesToStorage(rules);
      console.log(`✅ Deleted rule: ${ruleName} (${ruleId})`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to delete rule ${ruleId}:`, error);
      return false;
    }
  }

  /**
   * 切换规则启用状态
   * @param {string} ruleId - 规则ID
   * @returns {Promise<Object|null>} 更新后的规则对象或null
   */
  async toggleRuleEnabled(ruleId) {
    try {
      const rules = await this.getRulesFromStorage();
      const rule = rules[ruleId];

      if (!rule) {
        throw new Error(`规则不存在: ${ruleId}`);
      }

      // 切换启用状态
      const updatedRule = {
        ...rule,
        enabled: !rule.enabled
      };

      rules[ruleId] = updatedRule;
      await this.saveRulesToStorage(rules);

      console.log(`✅ Toggled rule ${updatedRule.name} (${ruleId}) to ${updatedRule.enabled ? 'enabled' : 'disabled'}`);
      return updatedRule;
    } catch (error) {
      console.error(`❌ Failed to toggle rule ${ruleId}:`, error);
      throw error;
    }
  }

  /**
   * 更新规则优先级
   * @param {string} ruleId - 规则ID
   * @param {number} newPriority - 新的优先级值
   * @returns {Promise<Object|null>} 更新后的规则对象或null
   */
  async updateRulePriority(ruleId, newPriority) {
    try {
      if (typeof newPriority !== 'number' || newPriority < 0) {
        throw new Error('优先级必须是非负数');
      }

      return await this.updateRule(ruleId, { priority: newPriority });
    } catch (error) {
      console.error(`❌ Failed to update rule priority ${ruleId}:`, error);
      throw error;
    }
  }

  /**
   * 重新排序规则
   * @param {Array<string>} ruleIds - 按新顺序排列的规则ID数组
   * @returns {Promise<boolean>} 是否排序成功
   */
  async reorderRules(ruleIds) {
    try {
      if (!Array.isArray(ruleIds)) {
        throw new Error('ruleIds 必须是数组');
      }

      const rules = await this.getRulesFromStorage();

      // 验证所有ID都存在
      for (const ruleId of ruleIds) {
        if (!rules[ruleId]) {
          throw new Error(`规则不存在: ${ruleId}`);
        }
      }

      // 更新优先级（按数组顺序分配）
      for (let i = 0; i < ruleIds.length; i++) {
        const ruleId = ruleIds[i];
        rules[ruleId].priority = i + 1; // 优先级从1开始
      }

      await this.saveRulesToStorage(rules);
      console.log(`✅ Reordered ${ruleIds.length} rules`);
      return true;
    } catch (error) {
      console.error('❌ Failed to reorder rules:', error);
      return false;
    }
  }

  /**
   * 保存规则到存储
   * @param {Object} rules - 规则对象（以ID为键）
   * @returns {Promise<boolean>} 是否保存成功
   */
  async saveRules(rules) {
    try {
      return await this.saveRulesToStorage(rules);
    } catch (error) {
      console.error('❌ Failed to save rules:', error);
      return false;
    }
  }

  /**
   * 获取规则列表（按优先级排序）
   * @returns {Promise<Array>} 排序后的规则数组
   */
  async getRulesList() {
    try {
      const rules = await this.getRulesFromStorage();
      return Object.values(rules).sort((a, b) => a.priority - b.priority);
    } catch (error) {
      console.error('❌ Failed to get rules list:', error);
      return [];
    }
  }

  /**
   * 清除所有规则
   * @returns {Promise<boolean>} 是否清除成功
   */
  async clearAllRules() {
    try {
      await this.saveRulesToStorage({});
      console.log('✅ Cleared all rules');
      return true;
    } catch (error) {
      console.error('❌ Failed to clear all rules:', error);
      return false;
    }
  }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RuleManager;
}

// 浏览器环境导出
if (typeof window !== 'undefined') {
  window.RuleManager = RuleManager;
}