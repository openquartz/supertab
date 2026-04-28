/**
 * SmartGroupingEngine - 智能分组引擎
 * 
 * 结合机器学习分类器和用户行为追踪的智能分组核心算法
 * 提升按域名、按日期、自定义规则的分类准确率
 */

class SmartGroupingEngine {
  constructor(options = {}) {
    this.groupingEngine = new GroupingEngine();
    
    this.mlClassifier = options.mlClassifier || new MLClassifier({
      modelType: 'naive-bayes'
    });
    
    this.ensembleClassifier = options.ensembleClassifier || new EnsembleClassifier();
    
    this.useEnsemble = options.useEnsemble !== false;
    this.enableML = options.enableML !== false;
    this.enableBehaviorLearning = options.enableBehaviorLearning !== false;
    
    this.domainGroupCache = new Map();
    this.dateGroupCache = new Map();
    this.customGroupCache = new Map();
    
    this.lastGroupingHash = '';
    this.cacheTimeout = options.cacheTimeout || 5 * 60 * 1000;
    
    this.customWeights = options.customWeights || {
      domain: 0.4,
      title: 0.3,
      urlPath: 0.2,
      userBehavior: 0.1
    };
    
    console.log('🧠 SmartGroupingEngine initialized');
  }

  setBehaviorTracker(behaviorTracker) {
    this.behaviorTracker = behaviorTracker;
  }

  setStorageManager(storageManager) {
    this.storageManager = storageManager;
  }

  // ========== 增强的域名分组 ==========

  groupByDomain(tabs, options = {}) {
    const useML = options.useML !== false && this.enableML;
    const useBehavior = options.useBehavior !== false && this.enableBehaviorLearning && this.behaviorTracker;

    const baseGroups = this.groupingEngine.groupByDomain(tabs);
    
    if (!useML && !useBehavior) {
      return baseGroups;
    }

    const enhancedGroups = this.enhanceDomainGroupsWithML(baseGroups, tabs, useML, useBehavior);
    
    return enhancedGroups;
  }

  enhanceDomainGroupsWithML(groups, tabs, useML, useBehavior) {
    const groupMap = new Map();
    const ungroupedTabs = [];

    for (const group of groups) {
      groupMap.set(group.id, {
        ...group,
        tabs: []
      });
    }

    for (const tab of tabs) {
      let assigned = false;
      let bestGroup = null;
      let bestScore = 0;

      if (useML && this.mlClassifier.trained) {
        const mlPrediction = this.predictGroupWithML(tab);
        if (mlPrediction && mlPrediction.confidence > 0.5) {
          for (const group of groups) {
            if (group.name === mlPrediction.groupName || 
                group.id.includes(mlPrediction.groupName)) {
              const score = mlPrediction.confidence * this.customWeights.domain;
              if (score > bestScore) {
                bestScore = score;
                bestGroup = group;
              }
            }
          }
        }
      }

      if (useBehavior && this.behaviorTracker) {
        const behaviorPrediction = this.behaviorTracker.predictGroupForTab(tab);
        if (behaviorPrediction && behaviorPrediction.confidence > 0.3) {
          for (const group of groups) {
            if (group.name === behaviorPrediction.groupName) {
              const score = behaviorPrediction.confidence * this.customWeights.userBehavior;
              if (score > bestScore) {
                bestScore = score;
                bestGroup = group;
              }
            }
          }
        }
      }

      if (bestGroup) {
        const targetGroup = groupMap.get(bestGroup.id);
        if (targetGroup) {
          targetGroup.tabs.push(tab);
          assigned = true;
        }
      }

      if (!assigned) {
        const domain = this.groupingEngine.extractDomain(tab.url);
        if (domain) {
          const domainGroupId = `domain_${domain.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
          let targetGroup = groupMap.get(domainGroupId);
          
          if (!targetGroup) {
            targetGroup = {
              id: domainGroupId,
              name: domain,
              type: 'domain',
              tabs: [],
              collapsed: true,
              createdAt: Date.now(),
              icon: this.groupingEngine.getDomainIcon(domain)
            };
            groupMap.set(domainGroupId, targetGroup);
          }
          
          targetGroup.tabs.push(tab);
        } else {
          ungroupedTabs.push(tab);
        }
      }
    }

    const resultGroups = Array.from(groupMap.values())
      .filter(g => g.tabs.length > 0)
      .sort((a, b) => b.tabs.length - a.tabs.length);

    if (ungroupedTabs.length > 0) {
      resultGroups.push({
        id: 'domain_ungrouped',
        name: 'Ungrouped',
        type: 'domain',
        tabs: ungroupedTabs,
        collapsed: true,
        createdAt: Date.now(),
        icon: '📁'
      });
    }

    return resultGroups;
  }

  // ========== 增强的日期分组 ==========

  groupByDate(tabs, options = {}) {
    const useBehavior = options.useBehavior !== false && this.enableBehaviorLearning && this.behaviorTracker;

    const baseGroups = this.groupingEngine.groupByDate(tabs);
    
    if (!useBehavior) {
      return baseGroups;
    }

    return this.enhanceDateGroupsWithBehavior(baseGroups, tabs);
  }

  enhanceDateGroupsWithBehavior(groups, tabs) {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const enhancedGroups = groups.map(group => {
      const enhancedTabs = group.tabs.map(tab => {
        const visitScore = this.calculateVisitRecencyScore(tab, now);
        return {
          ...tab,
          _visitScore: visitScore
        };
      });

      enhancedTabs.sort((a, b) => b._visitScore - a._visitScore);

      return {
        ...group,
        tabs: enhancedTabs.map(t => {
          const { _visitScore, ...rest } = t;
          return rest;
        })
      };
    });

    return enhancedGroups;
  }

  calculateVisitRecencyScore(tab, now) {
    const lastAccessed = tab.lastAccessed || tab.openedAt || now;
    const hoursSinceAccess = (now - lastAccessed) / (1000 * 60 * 60);
    
    const decayRate = 0.01;
    return Math.exp(-decayRate * hoursSinceAccess);
  }

  // ========== 智能自定义分组 ==========

  groupBySmartRules(tabs, rules, options = {}) {
    const useML = options.useML !== false && this.enableML;
    const useBehavior = options.useBehavior !== false && this.enableBehaviorLearning && this.behaviorTracker;
    
    const ruleEngine = new RuleEngine();
    const groups = new Map();
    const ungrouped = [];

    for (const tab of tabs) {
      let matched = false;
      let bestRule = null;
      let bestScore = 0;

      for (const rule of rules) {
        if (!rule.enabled) continue;

        if (ruleEngine.matchesRule(tab, rule)) {
          const score = this.calculateRuleMatchScore(tab, rule, useML, useBehavior);
          
          if (score > bestScore) {
            bestScore = score;
            bestRule = rule;
          }
          matched = true;
        }
      }

      if (bestRule) {
        const groupName = bestRule.targetGroup?.name || bestRule.name;
        if (!groups.has(groupName)) {
          groups.set(groupName, {
            id: `smart_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: groupName,
            type: 'smart',
            tabs: [],
            collapsed: false,
            createdAt: Date.now(),
            ruleId: bestRule.id,
            matchScore: bestScore
          });
        }
        groups.get(groupName).tabs.push(tab);
      } else if (!matched) {
        ungrouped.push(tab);
      }
    }

    const result = Array.from(groups.values());

    if (ungrouped.length > 0) {
      result.push({
        id: 'smart_ungrouped',
        name: '未分类',
        type: 'smart',
        tabs: ungrouped,
        collapsed: false,
        createdAt: Date.now()
      });
    }

    return result;
  }

  calculateRuleMatchScore(tab, rule, useML, useBehavior) {
    let baseScore = rule.priority || 1;
    let totalWeight = 1;

    if (useML && this.mlClassifier.trained) {
      const prediction = this.mlClassifier.predict(tab);
      if (prediction) {
        const groupName = rule.targetGroup?.name || rule.name;
        if (prediction.label === groupName) {
          baseScore += (prediction.score || 0.5) * this.customWeights.domain;
          totalWeight += this.customWeights.domain;
        }
      }
    }

    if (useBehavior && this.behaviorTracker) {
      const behaviorPrediction = this.behaviorTracker.predictGroupForTab(tab);
      if (behaviorPrediction) {
        const groupName = rule.targetGroup?.name || rule.name;
        if (behaviorPrediction.groupName === groupName) {
          baseScore += behaviorPrediction.confidence * this.customWeights.userBehavior;
          totalWeight += this.customWeights.userBehavior;
        }
      }
    }

    return baseScore / totalWeight;
  }

  // ========== ML辅助预测 ==========

  predictGroupWithML(tab) {
    if (!this.mlClassifier.trained && !this.ensembleClassifier) {
      return null;
    }

    let prediction;
    
    if (this.useEnsemble && this.ensembleClassifier) {
      prediction = this.ensembleClassifier.predict(tab);
    } else {
      prediction = this.mlClassifier.predict(tab);
    }

    if (!prediction || !prediction.label) {
      return null;
    }

    return {
      groupName: prediction.label,
      confidence: prediction.score || prediction.probability || 0.5,
      method: this.useEnsemble ? 'ensemble' : 'naive-bayes'
    };
  }

  // ========== 训练模型 ==========

  async trainFromHistory() {
    if (!this.behaviorTracker) {
      console.warn('⚠️ No behavior tracker available for training');
      return false;
    }

    const trainingData = this.behaviorTracker.generateTrainingData();
    
    if (trainingData.length === 0) {
      console.log('ℹ️ No training data available');
      return false;
    }

    this.mlClassifier.train(trainingData);
    
    if (this.ensembleClassifier) {
      this.ensembleClassifier.train(trainingData);
    }

    if (this.storageManager) {
      await this.mlClassifier.save(this.storageManager);
      if (this.ensembleClassifier) {
        await this.ensembleClassifier.save(this.storageManager);
      }
    }

    console.log('✅ Model trained with', trainingData.length, 'samples');
    return true;
  }

  async loadModel() {
    if (this.storageManager) {
      await this.mlClassifier.load(this.storageManager);
      if (this.ensembleClassifier) {
        await this.ensembleClassifier.save(this.storageManager);
      }
    }
  }

  learnFromUserAction(tabs, groupName, isManual = true) {
    if (!isManual) return;

    for (const tab of tabs) {
      this.mlClassifier.learn(tab, groupName);
      if (this.ensembleClassifier) {
        this.ensembleClassifier.learn(tab, groupName);
      }
    }

    if (this.behaviorTracker) {
      this.behaviorTracker.trackGroupingAction('manual_group', tabs, groupName, true);
    }

    console.log('📚 Learned from user action:', groupName, tabs.length, 'tabs');
  }

  // ========== 分组相似度计算 ==========

  calculateTabSimilarity(tab1, tab2) {
    let similarity = this.groupingEngine.calculateSimilarity(tab1, tab2);

    const mlSimilarity = this.calculateMLSimilarity(tab1, tab2);
    const behaviorSimilarity = this.calculateBehaviorSimilarity(tab1, tab2);

    similarity = (
      similarity * 0.5 +
      mlSimilarity * 0.3 +
      behaviorSimilarity * 0.2
    );

    return similarity;
  }

  calculateMLSimilarity(tab1, tab2) {
    if (!this.mlClassifier.trained) {
      return 0;
    }

    const pred1 = this.mlClassifier.predict(tab1);
    const pred2 = this.mlClassifier.predict(tab2);

    if (pred1 && pred2 && pred1.label === pred2.label) {
      return Math.min((pred1.score || 0.5) + (pred2.score || 0.5), 1);
    }

    return 0;
  }

  calculateBehaviorSimilarity(tab1, tab2) {
    if (!this.behaviorTracker) {
      return 0;
    }

    const domain1 = this.groupingEngine.extractDomain(tab1.url);
    const domain2 = this.groupingEngine.extractDomain(tab2.url);

    if (domain1 === domain2) {
      const group1 = this.behaviorTracker.predictGroupForTab(tab1);
      const group2 = this.behaviorTracker.predictGroupForTab(tab2);

      if (group1 && group2 && group1.groupName === group2.groupName) {
        return (group1.confidence + group2.confidence) / 2;
      }

      return 0.5;
    }

    return 0;
  }

  // ========== 基于内容的智能分组 ==========

  groupByContent(tabs, options = {}) {
    const similarityThreshold = options.similarityThreshold || 0.6;
    const useML = options.useML !== false && this.enableML;

    const groups = [];
    const processed = new Set();

    const sortedTabs = [...tabs].sort((a, b) => {
      const scoreA = this.calculateTabImportance(a);
      const scoreB = this.calculateTabImportance(b);
      return scoreB - scoreA;
    });

    for (const tab of sortedTabs) {
      if (processed.has(tab.uuid)) continue;

      const similarTabs = sortedTabs.filter(otherTab => {
        if (processed.has(otherTab.uuid) || tab.uuid === otherTab.uuid) {
          return false;
        }

        const similarity = this.calculateTabSimilarity(tab, otherTab);
        return similarity >= similarityThreshold;
      });

      if (similarTabs.length > 0) {
        const allTabs = [tab, ...similarTabs];
        const groupName = this.generateSmartGroupName(allTabs);

        groups.push({
          id: `content_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          name: groupName,
          type: 'content',
          tabs: allTabs,
          collapsed: false,
          createdAt: Date.now(),
          avgSimilarity: this.calculateGroupAverageSimilarity(allTabs)
        });

        processed.add(tab.uuid);
        similarTabs.forEach(t => processed.add(t.uuid));
      } else {
        groups.push({
          id: `single_${tab.uuid}`,
          name: tab.title || 'Untitled',
          type: 'single',
          tabs: [tab],
          collapsed: false,
          createdAt: Date.now()
        });
        processed.add(tab.uuid);
      }
    }

    return groups;
  }

  calculateTabImportance(tab) {
    let score = 0;
    score += (tab.visitCount || 1) * 10;
    
    if (tab.lastAccessed) {
      const recency = Date.now() - tab.lastAccessed;
      score += Math.max(0, 100 - recency / (1000 * 60));
    }

    return score;
  }

  calculateGroupAverageSimilarity(tabs) {
    if (tabs.length < 2) return 1;

    let totalSimilarity = 0;
    let pairCount = 0;

    for (let i = 0; i < tabs.length; i++) {
      for (let j = i + 1; j < tabs.length; j++) {
        totalSimilarity += this.calculateTabSimilarity(tabs[i], tabs[j]);
        pairCount++;
      }
    }

    return pairCount > 0 ? totalSimilarity / pairCount : 0;
  }

  generateSmartGroupName(tabs) {
    const mlGroups = new Map();
    const domains = new Map();

    for (const tab of tabs) {
      const prediction = this.predictGroupWithML(tab);
      if (prediction) {
        mlGroups.set(prediction.groupName, (mlGroups.get(prediction.groupName) || 0) + 1);
      }

      const domain = this.groupingEngine.extractDomain(tab.url);
      if (domain) {
        domains.set(domain, (domains.get(domain) || 0) + 1);
      }
    }

    if (mlGroups.size > 0) {
      const topMLGroup = Array.from(mlGroups.entries())
        .sort((a, b) => b[1] - a[1])[0];
      if (topMLGroup[1] >= tabs.length * 0.5) {
        return topMLGroup[0];
      }
    }

    if (domains.size === 1) {
      const domain = Array.from(domains.keys())[0];
      return domain.replace('www.', '');
    }

    return this.groupingEngine.generateGroupName(tabs[0], tabs.slice(1));
  }

  // ========== 统计信息 ==========

  getStats() {
    return {
      mlTrained: this.mlClassifier.trained,
      mlStats: this.mlClassifier.getStats(),
      behaviorTracker: this.behaviorTracker ? this.behaviorTracker.getStats() : null,
      useEnsemble: this.useEnsemble,
      customWeights: this.customWeights
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SmartGroupingEngine;
}

if (typeof window !== 'undefined') {
  window.SmartGroupingEngine = SmartGroupingEngine;
}
