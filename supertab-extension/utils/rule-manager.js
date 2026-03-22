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
    this.legacyStorageKey = 'tabRules';
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
        const normalizedCondition = this.normalizeCondition(condition);

        // 检查条件字段
        if (!normalizedCondition.field || !['title', 'url', 'domain', 'path'].includes(normalizedCondition.field)) {
          errors.push(`条件 ${i + 1}: 字段必须是 title、url 或 domain`);
        }

        // 检查关键词/值
        const hasKeyword = typeof condition?.keyword === 'string' && condition.keyword.trim() !== '';
        const hasValue = typeof condition?.value === 'string' && condition.value.trim() !== '';
        if (!hasKeyword && !hasValue) {
          errors.push(`条件 ${i + 1}: 关键词不能为空`);
        }

        // 检查大小写敏感设置（兼容旧格式：允许缺省）
        if (condition && condition.caseSensitive !== undefined && typeof condition.caseSensitive !== 'boolean') {
          errors.push(`条件 ${i + 1}: caseSensitive 必须是布尔值`);
        }

        // 检查操作符（兼容旧格式：keyword条件默认为contains）
        if (condition && condition.operator !== undefined) {
          const allowedOperators = ['contains', 'equals', 'startsWith', 'endsWith', 'regex'];
          if (!allowedOperators.includes(String(condition.operator))) {
            errors.push(`条件 ${i + 1}: operator 无效`);
          }
        }
      }
    }

    // 检查目标分组
    if (ruleData.targetGroup && typeof ruleData.targetGroup === 'object') {
      if (!ruleData.targetGroup.name || typeof ruleData.targetGroup.name !== 'string' || ruleData.targetGroup.name.trim() === '') {
        errors.push('目标分组名称不能为空');
      }

      if (ruleData.targetGroup.autoCreate !== undefined && typeof ruleData.targetGroup.autoCreate !== 'boolean') {
        errors.push('autoCreate 必须是布尔值');
      }
    } else {
      const normalizedTargetGroup = this.normalizeTargetGroup(ruleData.targetGroup, ruleData.customGroupName, ruleData.name);
      if (!normalizedTargetGroup) {
        errors.push('目标分组配置不能为空');
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
      const [localResult, syncResult] = await Promise.all([
        this.readFromStorageArea('local', this.storageKey),
        this.readFromStorageArea('sync', this.legacyStorageKey)
      ]);

      const localRules = this.normalizeRulesRecord(localResult[this.storageKey] || {});
      const legacyRules = this.normalizeLegacyRules(syncResult[this.legacyStorageKey] || []);

      const localCount = Object.keys(localRules).length;
      const legacyCount = Object.keys(legacyRules).length;
      const localTimestamp = this.getRulesTimestamp(localRules);
      const legacyTimestamp = this.getRulesTimestamp(legacyRules);

      let selectedRules = {};
      if (localCount > 0 && legacyCount > 0) {
        selectedRules = legacyTimestamp > localTimestamp ? legacyRules : localRules;
      } else if (localCount > 0) {
        selectedRules = localRules;
      } else if (legacyCount > 0) {
        selectedRules = legacyRules;
      }

      // 双向同步，修复“UI写入sync但后台读不到local”的问题
      if (Object.keys(selectedRules).length > 0) {
        if (this.shouldMirrorRules(localRules, selectedRules)) {
          await this.writeToStorageArea('local', { [this.storageKey]: selectedRules });
        }

        if (this.shouldMirrorRules(legacyRules, selectedRules)) {
          const legacyArray = this.toLegacyRulesArray(selectedRules);
          await this.writeToStorageArea('sync', { [this.legacyStorageKey]: legacyArray });
        }
      }

      return selectedRules;
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
      const normalizedRules = this.normalizeRulesRecord(rules || {});
      const localSaved = await this.writeToStorageArea('local', { [this.storageKey]: normalizedRules });
      if (!localSaved) {
        return false;
      }

      // 同步写入旧版规则页使用的 storage.sync/tabRules，保持前后端一致
      const legacyRulesArray = this.toLegacyRulesArray(normalizedRules);
      await this.writeToStorageArea('sync', { [this.legacyStorageKey]: legacyRulesArray });

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
        conditions: (ruleData.conditions || []).map(condition => this.normalizeCondition(condition)),
        targetGroup: this.normalizeTargetGroup(ruleData.targetGroup, ruleData.customGroupName, ruleData.name),
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

      updatedRule.name = updatedRule.name.trim();
      updatedRule.priority = this.normalizePriority(updatedRule.priority);
      updatedRule.conditions = (updatedRule.conditions || []).map(condition => this.normalizeCondition(condition));
      updatedRule.targetGroup = this.normalizeTargetGroup(
        updatedRule.targetGroup,
        updatedRule.customGroupName,
        updatedRule.name
      );
      updatedRule.updatedAt = Date.now();

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

  normalizeCondition(condition = {}) {
    const field = typeof condition?.field === 'string' ? condition.field : '';
    const hasValueSyntax = typeof condition?.value === 'string' || typeof condition?.operator === 'string';
    const caseSensitive = condition?.caseSensitive === undefined ? false : Boolean(condition.caseSensitive);

    if (hasValueSyntax) {
      const operator = typeof condition.operator === 'string' && condition.operator.trim()
        ? condition.operator.trim()
        : 'contains';
      return {
        field,
        operator,
        value: typeof condition.value === 'string' ? condition.value : '',
        caseSensitive
      };
    }

    return {
      field,
      keyword: typeof condition?.keyword === 'string' ? condition.keyword : '',
      caseSensitive
    };
  }

  normalizeTargetGroup(targetGroup, customGroupName = '', fallbackName = '') {
    if (targetGroup && typeof targetGroup === 'object') {
      const groupName = typeof targetGroup.name === 'string' ? targetGroup.name.trim() : '';
      if (!groupName) {
        return null;
      }
      return {
        name: groupName,
        autoCreate: targetGroup.autoCreate === undefined ? true : Boolean(targetGroup.autoCreate)
      };
    }

    if (typeof targetGroup !== 'string') {
      return null;
    }

    const targetValue = targetGroup.trim();
    if (!targetValue) {
      return null;
    }

    if (targetValue === 'custom') {
      const customName = typeof customGroupName === 'string' ? customGroupName.trim() : '';
      const fallback = typeof fallbackName === 'string' ? fallbackName.trim() : '';
      const resolvedName = customName || fallback;
      if (!resolvedName) {
        return null;
      }
      return {
        name: resolvedName,
        autoCreate: true
      };
    }

    if (['domain', 'date', 'session'].includes(targetValue)) {
      const fallback = typeof fallbackName === 'string' ? fallbackName.trim() : '';
      return {
        name: fallback || targetValue,
        autoCreate: true
      };
    }

    return {
      name: targetValue,
      autoCreate: true
    };
  }

  normalizeRulesRecord(rules, options = {}) {
    if (!rules || typeof rules !== 'object' || Array.isArray(rules)) {
      return {};
    }

    const preserveShape = options.preserveShape !== false;
    const normalized = {};
    for (const [ruleId, rawRule] of Object.entries(rules)) {
      if (!rawRule || typeof rawRule !== 'object') {
        continue;
      }

      const hasObjectTargetGroup = Boolean(
        rawRule.targetGroup &&
        typeof rawRule.targetGroup === 'object' &&
        !Array.isArray(rawRule.targetGroup)
      );
      const hasConditions = Array.isArray(rawRule.conditions) && rawRule.conditions.length > 0;

      if (preserveShape && hasObjectTargetGroup && hasConditions) {
        normalized[ruleId] = rawRule;
        continue;
      }

      const normalizedRule = {
        ...rawRule,
        id: typeof rawRule.id === 'string' && rawRule.id.trim() ? rawRule.id : ruleId,
        name: typeof rawRule.name === 'string' ? rawRule.name.trim() : '',
        enabled: Boolean(rawRule.enabled),
        priority: this.normalizePriority(rawRule.priority),
        conditions: Array.isArray(rawRule.conditions)
          ? rawRule.conditions.map(condition => this.normalizeCondition(condition))
          : [],
        targetGroup: this.normalizeTargetGroup(rawRule.targetGroup, rawRule.customGroupName, rawRule.name),
        createdAt: Number.isFinite(Number(rawRule.createdAt)) ? Number(rawRule.createdAt) : Date.now(),
        updatedAt: Number.isFinite(Number(rawRule.updatedAt)) ? Number(rawRule.updatedAt) : undefined
      };

      if (!normalizedRule.name || !normalizedRule.targetGroup || normalizedRule.conditions.length === 0) {
        continue;
      }

      normalized[normalizedRule.id] = normalizedRule;
    }

    return normalized;
  }

  normalizeLegacyRules(legacyRules) {
    if (!legacyRules) {
      return {};
    }

    const list = Array.isArray(legacyRules)
      ? legacyRules
      : (typeof legacyRules === 'object' ? Object.values(legacyRules) : []);
    const normalized = {};

    for (const rawRule of list) {
      if (!rawRule || typeof rawRule !== 'object') {
        continue;
      }

      const fallbackId = this.generateRuleId();
      const normalizedRule = {
        id: typeof rawRule.id === 'string' && rawRule.id.trim() ? rawRule.id : fallbackId,
        name: typeof rawRule.name === 'string' ? rawRule.name.trim() : '',
        enabled: rawRule.enabled === undefined ? true : Boolean(rawRule.enabled),
        priority: this.normalizePriority(rawRule.priority),
        conditions: Array.isArray(rawRule.conditions)
          ? rawRule.conditions.map(condition => this.normalizeCondition(condition))
          : [],
        targetGroup: this.normalizeTargetGroup(rawRule.targetGroup, rawRule.customGroupName, rawRule.name),
        createdAt: Number.isFinite(Number(rawRule.createdAt)) ? Number(rawRule.createdAt) : Date.now(),
        updatedAt: Number.isFinite(Number(rawRule.updatedAt)) ? Number(rawRule.updatedAt) : undefined
      };

      if (!normalizedRule.name || !normalizedRule.targetGroup || normalizedRule.conditions.length === 0) {
        continue;
      }

      normalized[normalizedRule.id] = normalizedRule;
    }

    return normalized;
  }

  normalizePriority(priority) {
    const parsed = Number(priority);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }
    return parsed;
  }

  getRulesTimestamp(rules) {
    const ruleList = Object.values(rules || {});
    if (ruleList.length === 0) {
      return 0;
    }

    return Math.max(...ruleList.map((rule) => {
      const updatedAt = Number.isFinite(Number(rule?.updatedAt)) ? Number(rule.updatedAt) : 0;
      const createdAt = Number.isFinite(Number(rule?.createdAt)) ? Number(rule.createdAt) : 0;
      return Math.max(updatedAt, createdAt);
    }));
  }

  shouldMirrorRules(currentRules, selectedRules) {
    const current = currentRules || {};
    const selected = selectedRules || {};
    const currentIds = Object.keys(current).sort();
    const selectedIds = Object.keys(selected).sort();

    if (currentIds.length !== selectedIds.length) {
      return true;
    }

    for (let i = 0; i < currentIds.length; i++) {
      if (currentIds[i] !== selectedIds[i]) {
        return true;
      }

      const currentRule = current[currentIds[i]];
      const selectedRule = selected[selectedIds[i]];
      const currentTs = Math.max(
        Number.isFinite(Number(currentRule?.updatedAt)) ? Number(currentRule.updatedAt) : 0,
        Number.isFinite(Number(currentRule?.createdAt)) ? Number(currentRule.createdAt) : 0
      );
      const selectedTs = Math.max(
        Number.isFinite(Number(selectedRule?.updatedAt)) ? Number(selectedRule.updatedAt) : 0,
        Number.isFinite(Number(selectedRule?.createdAt)) ? Number(selectedRule.createdAt) : 0
      );
      if (currentTs !== selectedTs) {
        return true;
      }

      if (JSON.stringify(currentRule) !== JSON.stringify(selectedRule)) {
        return true;
      }
    }

    return false;
  }

  toLegacyRulesArray(rules) {
    const list = Object.values(rules || {}).sort((a, b) => this.normalizePriority(a.priority) - this.normalizePriority(b.priority));

    return list.map((rule) => {
      const normalizedTarget = this.normalizeTargetGroup(rule.targetGroup, rule.customGroupName, rule.name);
      const targetName = normalizedTarget?.name || '';
      const isBuiltinTarget = ['domain', 'date', 'session'].includes(targetName);
      const legacyTargetGroup = isBuiltinTarget ? targetName : 'custom';

      const legacyConditions = (Array.isArray(rule.conditions) ? rule.conditions : []).map((condition) => {
        if (typeof condition?.value === 'string' || typeof condition?.operator === 'string') {
          return {
            field: condition.field || 'url',
            operator: condition.operator || 'contains',
            value: typeof condition.value === 'string' ? condition.value : '',
            caseSensitive: Boolean(condition.caseSensitive)
          };
        }
        return {
          field: condition.field || 'url',
          operator: 'contains',
          value: typeof condition?.keyword === 'string' ? condition.keyword : '',
          caseSensitive: Boolean(condition?.caseSensitive)
        };
      });

      return {
        id: rule.id,
        name: rule.name,
        enabled: Boolean(rule.enabled),
        priority: this.normalizePriority(rule.priority),
        conditions: legacyConditions,
        targetGroup: legacyTargetGroup,
        customGroupName: legacyTargetGroup === 'custom' ? targetName : '',
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt || Date.now()
      };
    });
  }

  async readFromStorageArea(area, key) {
    return new Promise((resolve) => {
      const storageArea = chrome?.storage?.[area];
      if (!storageArea || typeof storageArea.get !== 'function') {
        resolve({});
        return;
      }

      storageArea.get(key, (data) => {
        if (chrome?.runtime?.lastError) {
          console.warn(`Failed to read ${area} storage key "${key}":`, chrome.runtime.lastError.message);
          resolve({});
          return;
        }
        resolve(data || {});
      });
    });
  }

  async writeToStorageArea(area, payload) {
    return new Promise((resolve) => {
      const storageArea = chrome?.storage?.[area];
      if (!storageArea || typeof storageArea.set !== 'function') {
        resolve(true);
        return;
      }

      storageArea.set(payload, () => {
        if (chrome?.runtime?.lastError) {
          console.warn(`Failed to write ${area} storage:`, chrome.runtime.lastError.message);
          resolve(false);
          return;
        }
        resolve(true);
      });
    });
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
