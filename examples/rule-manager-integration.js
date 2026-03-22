/**
 * RuleManager 集成示例
 *
 * 展示如何在实际项目中使用RuleManager与其他组件集成
 */

// 模拟的依赖组件
class MockStorageManager {
  // 在实际项目中，这将是一个真实的StorageManager实例
}

class MockRuleEngine {
  constructor() {}

  matchesRule(tab, rule) {
    // 简化的规则匹配逻辑
    if (!rule.enabled || !rule.conditions || rule.conditions.length === 0) {
      return false;
    }

    for (const condition of rule.conditions) {
      const fieldValue = this.getFieldValue(tab, condition.field);
      if (!fieldValue) return false;

      const searchValue = condition.caseSensitive ? fieldValue : fieldValue.toLowerCase();
      const keyword = condition.caseSensitive ? condition.keyword : condition.keyword.toLowerCase();

      if (!searchValue.includes(keyword)) {
        return false;
      }
    }

    return true;
  }

  getFieldValue(tab, field) {
    switch (field) {
      case 'title': return tab.title || '';
      case 'url': return tab.url || '';
      case 'domain':
        try {
          return new URL(tab.url).hostname || '';
        } catch {
          return '';
        }
      default: return '';
    }
  }
}

// 使用示例
async function demonstrateRuleManager() {
  console.log('🚀 RuleManager 集成示例开始...');

  // 1. 初始化组件
  const storageManager = new MockStorageManager();
  const ruleManager = new RuleManager(storageManager);
  const ruleEngine = new MockRuleEngine();

  // 2. 创建一些示例规则
  console.log('\n📝 创建示例规则...');

  const githubRule = await ruleManager.createRule({
    name: 'GitHub 项目',
    enabled: true,
    priority: 1,
    conditions: [
      {
        field: 'domain',
        keyword: 'github.com',
        caseSensitive: false
      }
    ],
    targetGroup: {
      name: '开发工具',
      autoCreate: true
    }
  });

  const stackOverflowRule = await ruleManager.createRule({
    name: 'Stack Overflow',
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
      name: '学习资源',
      autoCreate: true
    }
  });

  console.log('✅ 规则创建成功:', {
    github: githubRule.name,
    stackoverflow: stackOverflowRule.name
  });

  // 3. 获取所有规则
  console.log('\n📋 获取所有规则...');
  const allRules = await ruleManager.getAllRules();
  console.log(`📊 当前共有 ${Object.keys(allRules).length} 条规则`);

  // 4. 获取排序后的规则列表
  const rulesList = await ruleManager.getRulesList();
  console.log('📊 规则按优先级排序:', rulesList.map(r => `${r.priority}. ${r.name}`));

  // 5. 模拟标签页匹配
  console.log('\n🔍 模拟标签页匹配...');
  const sampleTabs = [
    {
      id: 1,
      title: 'GitHub - user/repo',
      url: 'https://github.com/user/repo',
      uuid: 'tab-1'
    },
    {
      id: 2,
      title: 'How to use JavaScript',
      url: 'https://stackoverflow.com/questions/12345',
      uuid: 'tab-2'
    },
    {
      id: 3,
      title: 'Google Search',
      url: 'https://google.com/search?q=test',
      uuid: 'tab-3'
    }
  ];

  for (const tab of sampleTabs) {
    const matchingRule = ruleEngine.matchesRule(tab, githubRule) ? githubRule :
                         ruleEngine.matchesRule(tab, stackOverflowRule) ? stackOverflowRule : null;

    if (matchingRule) {
      console.log(`✅ 标签页 "${tab.title}" 匹配规则 "${matchingRule.name}"`);
      console.log(`   将分配到分组: "${matchingRule.targetGroup.name}"`);
    } else {
      console.log(`❌ 标签页 "${tab.title}" 没有匹配任何规则`);
    }
  }

  // 6. 更新规则
  console.log('\n🔄 更新规则...');
  const updatedRule = await ruleManager.updateRule(githubRule.id, {
    priority: 3,
    targetGroup: {
      name: '代码仓库',
      autoCreate: true
    }
  });
  console.log(`✅ 规则更新成功: ${updatedRule.name} (优先级: ${updatedRule.priority})`);

  // 7. 切换规则状态
  console.log('\n🔄 切换规则启用状态...');
  const toggledRule = await ruleManager.toggleRuleEnabled(stackOverflowRule.id);
  console.log(`✅ 规则状态已切换: ${toggledRule.name} -> ${toggledRule.enabled ? '启用' : '禁用'}`);

  // 8. 重新排序规则
  console.log('\n🔄 重新排序规则...');
  await ruleManager.reorderRules([stackOverflowRule.id, githubRule.id]);
  const reorderedList = await ruleManager.getRulesList();
  console.log('📊 重新排序后:', reorderedList.map(r => `${r.priority}. ${r.name}`));

  // 9. 删除规则
  console.log('\n🗑️  删除规则...');
  const deleteSuccess = await ruleManager.deleteRule(githubRule.id);
  console.log(`✅ 规则删除${deleteSuccess ? '成功' : '失败'}`);

  // 10. 最终状态
  const finalRules = await ruleManager.getAllRules();
  console.log(`\n📋 最终规则数量: ${Object.keys(finalRules).length}`);

  console.log('\n🎉 RuleManager 集成示例完成！');
}

// 验证规则数据的示例
function demonstrateValidation() {
  console.log('\n🔍 规则验证示例...');

  const ruleManager = new RuleManager(null);

  // 有效的规则数据
  const validRule = {
    name: '有效规则',
    enabled: true,
    priority: 1,
    conditions: [
      {
        field: 'title',
        keyword: 'test',
        caseSensitive: false
      }
    ],
    targetGroup: {
      name: '测试分组',
      autoCreate: true
    }
  };

  // 无效的规则数据
  const invalidRule = {
    name: '', // 空名称
    enabled: true,
    priority: -1, // 负数优先级
    conditions: [], // 空条件数组
    targetGroup: {
      name: '', // 空分组名称
      autoCreate: true
    }
  };

  const validResult = ruleManager.validateRule(validRule);
  const invalidResult = ruleManager.validateRule(invalidRule);

  console.log('✅ 有效规则验证:', validResult);
  console.log('❌ 无效规则验证:', invalidResult);
}

// 错误处理示例
async function demonstrateErrorHandling() {
  console.log('\n⚠️  错误处理示例...');

  const ruleManager = new RuleManager(null);

  try {
    // 尝试创建无效规则
    await ruleManager.createRule({
      name: '', // 空名称会导致验证失败
      enabled: true,
      priority: 1,
      conditions: [],
      targetGroup: { name: 'Test', autoCreate: true }
    });
  } catch (error) {
    console.log('✅ 捕获预期错误:', error.message);
  }

  try {
    // 尝试更新不存在的规则
    await ruleManager.updateRule('non_existent_rule', { name: 'New Name' });
  } catch (error) {
    console.log('✅ 捕获预期错误:', error.message);
  }

  // 删除不存在的规则（返回false而不是抛出错误）
  const deleteResult = await ruleManager.deleteRule('non_existent_rule');
  console.log('✅ 删除不存在规则的结果:', deleteResult);
}

// 运行演示
if (typeof window === 'undefined') {
  // Node.js 环境
  demonstrateRuleManager().catch(console.error);
  demonstrateValidation();
  demonstrateErrorHandling().catch(console.error);
} else {
  // 浏览器环境
  window.runRuleManagerDemo = function() {
    demonstrateRuleManager().catch(console.error);
    demonstrateValidation();
    demonstrateErrorHandling().catch(console.error);
  };
}

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    demonstrateRuleManager,
    demonstrateValidation,
    demonstrateErrorHandling
  };
}