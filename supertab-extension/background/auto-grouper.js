/**
 * AutoGrouper - 自动分组处理器
 *
 * 负责监听新标签页事件，应用规则进行自动分组
 * 与TabManager集成，实现标签页的自动分组功能
 */

class AutoGrouper {
  constructor(tabManager, ruleEngine, ruleManager) {
    this.tabManager = tabManager;
    this.ruleEngine = ruleEngine;
    this.ruleManager = ruleManager;
    this.enabled = true;
    this.initialized = false;

    console.log('🔧 AutoGrouper initialized');
  }

  /**
   * 初始化AutoGrouper，设置事件监听器
   */
  async initialize() {
    if (this.initialized) {
      console.log('⚠️ AutoGrouper already initialized');
      return;
    }

    try {
      // 监听tabManager的tab_created事件
      this.tabManager.eventBus.on('tab_created', this.handleNewTab.bind(this));

      console.log('✅ AutoGrouper event listeners set up');
      this.initialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize AutoGrouper:', error);
      throw error;
    }
  }

  /**
   * 处理新标签页创建事件
   * @param {Object} tabData - 标签页数据
   */
  async handleNewTab(tabData) {
    try {
      if (!this.enabled) {
        console.log('⏸️ AutoGrouper is disabled, skipping tab processing');
        return;
      }

      console.log(`🔍 Processing new tab: ${tabData.title}`);

      // 获取所有启用的规则
      const allRules = await this.ruleManager.getAllRules();
      const rules = Object.values(allRules).filter(rule => rule.enabled);

      if (rules.length === 0) {
        console.log('ℹ️ No enabled rules found, skipping auto-grouping');
        return;
      }

      // 处理新标签页的分组逻辑
      await this.processNewTab(tabData, rules);

    } catch (error) {
      console.error('❌ Error handling new tab:', error);
      // 触发错误事件
      this.tabManager.eventBus.emit('auto_grouper_error', {
        error: error.message,
        tabData,
        timestamp: Date.now()
      });
    }
  }

  /**
   * 处理新标签页的分组逻辑
   * @param {Object} tabData - 标签页数据
   * @param {Array} rules - 启用的规则数组
   */
  async processNewTab(tabData, rules) {
    try {
      // 使用RuleEngine找到匹配的规则
      const matchingRule = this.ruleEngine.findMatchingRule(tabData, rules);

      if (!matchingRule) {
        console.log(`ℹ️ No matching rule found for tab: ${tabData.title}`);
        return;
      }

      console.log(`✅ Found matching rule: ${matchingRule.name}`);

      // 获取或创建目标分组
      const targetGroup = await this.getOrCreateGroup(
        matchingRule.targetGroup.name,
        matchingRule.targetGroup.autoCreate
      );

      if (!targetGroup) {
        console.warn(`⚠️ Could not get or create group: ${matchingRule.targetGroup.name}`);
        return;
      }

      // 分配标签页到分组
      await this.assignTabToGroup(tabData, targetGroup.id);

      console.log(`✅ Tab assigned to group: ${tabData.title} -> ${targetGroup.name}`);

    } catch (error) {
      console.error('❌ Error processing new tab:', error);
      throw error;
    }
  }

  /**
   * 获取或创建目标分组
   * @param {string} groupName - 分组名称
   * @param {boolean} autoCreate - 是否自动创建
   * @returns {Promise<Object|null>} 分组对象或null
   */
  async getOrCreateGroup(groupName, autoCreate = true) {
    try {
      // 获取所有现有分组
      const allGroups = await this.tabManager.storageManager.getAllGroups();
      const groups = Object.values(allGroups);

      // 查找现有分组（不区分大小写）
      const existingGroup = groups.find(group =>
        group.name.toLowerCase() === groupName.toLowerCase()
      );

      if (existingGroup) {
        console.log(`✅ Found existing group: ${existingGroup.name}`);
        return existingGroup;
      }

      // 如果找到分组或不允许自动创建，则返回null
      if (!autoCreate) {
        console.warn(`⚠️ Group not found and autoCreate disabled: ${groupName}`);
        return null;
      }

      // 创建新分组
      console.log(`🔧 Creating new group: ${groupName}`);
      const newGroup = await this.tabManager.createCustomGroup(groupName, `Auto-created group for rule-based grouping`);

      if (newGroup) {
        console.log(`✅ Created new group: ${newGroup.name} (${newGroup.id})`);
        return newGroup;
      }

      return null;
    } catch (error) {
      console.error(`❌ Error getting or creating group ${groupName}:`, error);
      return null;
    }
  }

  /**
   * 分配标签页到分组
   * @param {Object} tabData - 标签页数据
   * @param {string} groupId - 分组ID
   */
  async assignTabToGroup(tabData, groupId) {
    try {
      // 更新标签页的groupId
      const updatedTabData = {
        ...tabData,
        groupId: groupId
      };

      // 保存到存储
      const saved = await this.tabManager.storageManager.saveTab(updatedTabData);
      if (!saved) {
        throw new Error('Failed to save tab with new group assignment');
      }

      // 同步更新activeTabs缓存
      if (this.tabManager.activeTabs.has(tabData.id)) {
        this.tabManager.activeTabs.get(tabData.id).groupId = groupId;
      }

      // 触发相关事件
      this.tabManager.eventBus.emit('tab_group_assigned', {
        tabData: updatedTabData,
        groupId,
        timestamp: Date.now()
      });

      console.log(`✅ Tab assigned to group: ${tabData.title} -> ${groupId}`);

    } catch (error) {
      console.error('❌ Error assigning tab to group:', error);
      throw error;
    }
  }

  /**
   * 批量处理现有标签页
   * @returns {Promise<number>} 处理的标签页数量
   */
  async processExistingTabs() {
    try {
      if (!this.enabled) {
        console.log('⏸️ AutoGrouper is disabled, skipping existing tab processing');
        return 0;
      }

      console.log('🔍 Processing existing tabs...');

      // 获取所有标签页
      const allTabs = await this.tabManager.getAllTabs();
      if (!allTabs || allTabs.length === 0) {
        console.log('ℹ️ No existing tabs found');
        return 0;
      }

      // 获取所有启用的规则
      const allRules = await this.ruleManager.getAllRules();
      const rules = Object.values(allRules).filter(rule => rule.enabled);

      if (rules.length === 0) {
        console.log('ℹ️ No enabled rules found, skipping processing');
        return 0;
      }

      let processedCount = 0;
      let assignedCount = 0;

      // 处理每个标签页
      for (const tab of allTabs) {
        try {
          processedCount++;

          // 跳过已经有分组的标签页（非默认分组）
          if (tab.groupId && tab.groupId !== 'ungrouped') {
            continue;
          }

          // 查找匹配的规则
          const matchingRule = this.ruleEngine.findMatchingRule(tab, rules);
          if (!matchingRule) {
            continue;
          }

          // 获取或创建目标分组
          const targetGroup = await this.getOrCreateGroup(
            matchingRule.targetGroup.name,
            matchingRule.targetGroup.autoCreate
          );

          if (targetGroup) {
            // 分配标签页到分组
            await this.assignTabToGroup(tab, targetGroup.id);
            assignedCount++;
          }

        } catch (tabError) {
          console.warn(`⚠️ Error processing tab ${tab.id}:`, tabError);
          // 继续处理其他标签页
        }
      }

      console.log(`✅ Processed ${processedCount} existing tabs, assigned ${assignedCount} tabs to groups`);
      return assignedCount;

    } catch (error) {
      console.error('❌ Error processing existing tabs:', error);
      return 0;
    }
  }

  /**
   * 启用/禁用自动分组
   * @param {boolean} enabled - 是否启用
   */
  setEnabled(enabled) {
    const wasEnabled = this.enabled;
    this.enabled = Boolean(enabled);

    console.log(`🔄 AutoGrouper ${this.enabled ? 'enabled' : 'disabled'}`);

    // 触发状态变更事件
    this.tabManager.eventBus.emit('auto_grouper_status_changed', {
      enabled: this.enabled,
      previousStatus: wasEnabled,
      timestamp: Date.now()
    });
  }

  /**
   * 获取当前状态
   * @returns {Object} AutoGrouper状态
   */
  getStatus() {
    return {
      enabled: this.enabled,
      initialized: this.initialized,
      hasTabManager: Boolean(this.tabManager),
      hasRuleEngine: Boolean(this.ruleEngine),
      hasRuleManager: Boolean(this.ruleManager),
      timestamp: Date.now()
    };
  }

  /**
   * 清理资源
   */
  async cleanup() {
    try {
      // 移除事件监听器
      this.tabManager.eventBus.off('tab_created', this.handleNewTab.bind(this));

      this.initialized = false;
      console.log('🧹 AutoGrouper cleaned up');
    } catch (error) {
      console.error('❌ Error during AutoGrouper cleanup:', error);
    }
  }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AutoGrouper;
}

// 浏览器环境导出
if (typeof window !== 'undefined') {
  window.AutoGrouper = AutoGrouper;
}