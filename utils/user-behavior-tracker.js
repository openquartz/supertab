/**
 * UserBehaviorTracker - 用户行为追踪器
 * 
 * 追踪用户使用习惯，包括：
 * - 历史分组操作记录
 * - 标签页访问频率
 * - 标签页停留时长
 * - 用户偏好学习
 */

class UserBehaviorTracker {
  constructor(storageManager, eventBusOrOptions = null, options = {}) {
    this.storageManager = storageManager;
    
    // 检测第二个参数是 eventBus 还是 options (向后兼容)
    if (eventBusOrOptions && typeof eventBusOrOptions.on === 'function' && typeof eventBusOrOptions.emit === 'function') {
      this.eventBus = eventBusOrOptions;
      this.options = options;
    } else {
      this.eventBus = null;
      this.options = eventBusOrOptions || {};
    }
    
    this.storageKey = this.options.storageKey || 'tabflow:user_behavior';
    this.preferencesKey = this.options.preferencesKey || 'tabflow:user_preferences';
    
    this.maxHistorySize = this.options.maxHistorySize || 1000;
    this.maxVisitHistory = this.options.maxVisitHistory || 500;
    this.decayRate = this.options.decayRate || 0.001;
    
    this.groupingHistory = [];
    this.visitHistory = [];
    this.domainVisitCounts = new Map();
    this.domainTotalTime = new Map();
    this.manualGroupPreferences = new Map();
    this.contentTypePreferences = new Map();
    
    this.sessionStartTime = null;
    this.currentActiveTab = null;
    this.tabSwitchTimes = new Map();
    
    this.initialized = false;
    
    console.log('📊 UserBehaviorTracker initialized');
  }

  async initialize() {
    if (this.initialized) {
      return true;
    }

    try {
      await this.loadFromStorage();
      this.sessionStartTime = Date.now();
      this.initialized = true;
      
      console.log('✅ UserBehaviorTracker initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize UserBehaviorTracker:', error);
      return false;
    }
  }

  async loadFromStorage() {
    try {
      const result = await new Promise((resolve, reject) => {
        chrome.storage.local.get([this.storageKey, this.preferencesKey], (data) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(data);
          }
        });
      });

      const behaviorData = result[this.storageKey];
      const preferencesData = result[this.preferencesKey];

      if (behaviorData) {
        this.groupingHistory = behaviorData.groupingHistory || [];
        this.visitHistory = behaviorData.visitHistory || [];
        this.domainVisitCounts = new Map(Object.entries(behaviorData.domainVisitCounts || {}));
        this.domainTotalTime = new Map(Object.entries(behaviorData.domainTotalTime || {}));
      }

      if (preferencesData) {
        this.manualGroupPreferences = new Map(Object.entries(preferencesData.manualGroupPreferences || {}));
        this.contentTypePreferences = new Map(Object.entries(preferencesData.contentTypePreferences || {}));
      }

      console.log('📥 User behavior data loaded');
      return true;
    } catch (error) {
      console.warn('⚠️ Failed to load user behavior data:', error);
      return false;
    }
  }

  async saveToStorage() {
    try {
      const behaviorData = {
        groupingHistory: this.groupingHistory,
        visitHistory: this.visitHistory.slice(-this.maxVisitHistory),
        domainVisitCounts: Object.fromEntries(this.domainVisitCounts),
        domainTotalTime: Object.fromEntries(this.domainTotalTime),
        lastUpdated: Date.now()
      };

      const preferencesData = {
        manualGroupPreferences: Object.fromEntries(this.manualGroupPreferences),
        contentTypePreferences: Object.fromEntries(this.contentTypePreferences),
        lastUpdated: Date.now()
      };

      await new Promise((resolve, reject) => {
        chrome.storage.local.set({
          [this.storageKey]: behaviorData,
          [this.preferencesKey]: preferencesData
        }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });

      console.log('💾 User behavior data saved');
      return true;
    } catch (error) {
      console.error('❌ Failed to save user behavior data:', error);
      return false;
    }
  }

  // ========== 标签页访问追踪 ==========

  trackTabActivated(tab) {
    const now = Date.now();
    
    if (this.currentActiveTab) {
      const previousTabId = this.currentActiveTab.id;
      const startTime = this.tabSwitchTimes.get(previousTabId) || now;
      const duration = now - startTime;
      
      if (duration > 0) {
        this.addVisitRecord(this.currentActiveTab, duration);
      }
    }

    this.currentActiveTab = tab;
    this.tabSwitchTimes.set(tab.id, now);

    const domain = this.extractDomain(tab.url);
    if (domain) {
      const currentCount = this.domainVisitCounts.get(domain) || 0;
      this.domainVisitCounts.set(domain, currentCount + 1);
    }

    console.log('📌 Tab tracked:', tab.title, '->', domain);
  }

  addVisitRecord(tab, duration) {
    const domain = this.extractDomain(tab.url);
    if (!domain) return;

    const record = {
      tabId: tab.id,
      url: tab.url,
      title: tab.title,
      domain,
      startTime: this.tabSwitchTimes.get(tab.id) || Date.now(),
      endTime: Date.now(),
      duration,
      timestamp: Date.now()
    };

    this.visitHistory.push(record);
    if (this.visitHistory.length > this.maxVisitHistory) {
      this.visitHistory.shift();
    }

    const currentTotal = this.domainTotalTime.get(domain) || 0;
    this.domainTotalTime.set(domain, currentTotal + duration);
  }

  trackTabCreated(tab) {
    const domain = this.extractDomain(tab.url);
    if (domain) {
      const currentCount = this.domainVisitCounts.get(domain) || 0;
      this.domainVisitCounts.set(domain, currentCount + 1);
    }
  }

  trackTabClosed(tab) {
    if (this.currentActiveTab && this.currentActiveTab.id === tab.id) {
      const startTime = this.tabSwitchTimes.get(tab.id);
      if (startTime) {
        const duration = Date.now() - startTime;
        this.addVisitRecord(tab, duration);
      }
      this.currentActiveTab = null;
      this.tabSwitchTimes.delete(tab.id);
    }
  }

  // ========== 分组操作追踪 ==========

  trackGroupingAction(actionType, tabs, groupName, isManual = false) {
    const record = {
      actionType,
      groupName,
      isManual,
      tabs: tabs.map(tab => ({
        id: tab.id,
        url: tab.url,
        title: tab.title,
        domain: this.extractDomain(tab.url)
      })),
      timestamp: Date.now()
    };

    this.groupingHistory.push(record);
    if (this.groupingHistory.length > this.maxHistorySize) {
      this.groupingHistory.shift();
    }

    if (isManual) {
      this.learnManualPreference(tabs, groupName);
    }

    console.log('📊 Grouping action tracked:', actionType, groupName, isManual ? '(manual)' : '(auto)');
  }

  learnManualPreference(tabs, groupName) {
    for (const tab of tabs) {
      const domain = this.extractDomain(tab.url);
      if (!domain) continue;

      const key = `${domain}:${groupName}`;
      const currentCount = this.manualGroupPreferences.get(key) || 0;
      this.manualGroupPreferences.set(key, currentCount + 1);

      const domainKey = `domain:${domain}`;
      const domainCount = this.manualGroupPreferences.get(domainKey) || 0;
      this.manualGroupPreferences.set(domainKey, domainCount + 1);
    }
  }

  // ========== 内容类型和场景偏好学习 ==========

  trackContentPreference(tab, contentType, scene) {
    const domain = this.extractDomain(tab.url);
    if (!domain) return;

    const contentKey = `content:${domain}:${contentType}`;
    const contentCount = this.contentTypePreferences.get(contentKey) || 0;
    this.contentTypePreferences.set(contentKey, contentCount + 1);

    if (scene) {
      const sceneKey = `scene:${domain}:${scene}`;
      const sceneCount = this.contentTypePreferences.get(sceneKey) || 0;
      this.contentTypePreferences.set(sceneKey, sceneCount + 1);
    }
  }

  // ========== 行为分析和预测 ==========

  analyzeDomainPreferences() {
    const preferences = [];
    const now = Date.now();

    for (const [domain, count] of this.domainVisitCounts.entries()) {
      const totalTime = this.domainTotalTime.get(domain) || 0;
      const avgTime = count > 0 ? totalTime / count : 0;
      
      const recencyScore = this.calculateRecencyScore(domain);
      const frequencyScore = Math.min(count / 10, 1);
      const durationScore = Math.min(avgTime / (5 * 60 * 1000), 1);

      const combinedScore = (
        recencyScore * 0.4 +
        frequencyScore * 0.35 +
        durationScore * 0.25
      );

      preferences.push({
        domain,
        visitCount: count,
        totalTime,
        avgTime,
        recencyScore,
        frequencyScore,
        durationScore,
        preferenceScore: combinedScore
      });
    }

    return preferences.sort((a, b) => b.preferenceScore - a.preferenceScore);
  }

  calculateRecencyScore(domain) {
    const recentVisits = this.visitHistory
      .filter(record => record.domain === domain)
      .slice(-5);

    if (recentVisits.length === 0) return 0;

    const now = Date.now();
    const lastVisit = recentVisits[recentVisits.length - 1];
    const hoursSinceLastVisit = (now - lastVisit.timestamp) / (1000 * 60 * 60);

    return Math.exp(-this.decayRate * hoursSinceLastVisit);
  }

  predictGroupForTab(tab) {
    const domain = this.extractDomain(tab.url);
    if (!domain) return null;

    const candidates = [];

    for (const [key, count] of this.manualGroupPreferences.entries()) {
      if (key.startsWith(`${domain}:`)) {
        const groupName = key.split(':')[1];
        const totalDomainCount = this.manualGroupPreferences.get(`domain:${domain}`) || 1;
        const confidence = count / totalDomainCount;

        candidates.push({
          groupName,
          count,
          confidence
        });
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    candidates.sort((a, b) => b.confidence - a.confidence);
    return candidates[0];
  }

  getTopDomains(limit = 10) {
    const preferences = this.analyzeDomainPreferences();
    return preferences.slice(0, limit);
  }

  getRecommendedGroups(tab) {
    const domain = this.extractDomain(tab.url);
    if (!domain) return [];

    const recommendations = [];

    for (const [key, count] of this.manualGroupPreferences.entries()) {
      if (key.startsWith(`${domain}:`)) {
        const groupName = key.split(':')[1];
        recommendations.push({
          groupName,
          count,
          score: count
        });
      }
    }

    return recommendations.sort((a, b) => b.count - a.count);
  }

  // ========== 时间衰减的历史数据清理 ==========

  applyTimeDecay(halfLifeDays = 7) {
    const now = Date.now();
    const halfLifeMs = halfLifeDays * 24 * 60 * 60 * 1000;
    const decayFactor = Math.log(2) / halfLifeMs;

    const decayedVisitCounts = new Map();
    for (const [domain, count] of this.domainVisitCounts.entries()) {
      const recentVisits = this.visitHistory.filter(r => r.domain === domain);
      if (recentVisits.length === 0) continue;

      let decayedCount = 0;
      for (const visit of recentVisits) {
        const ageMs = now - visit.timestamp;
        decayedCount += Math.exp(-decayFactor * ageMs);
      }

      if (decayedCount > 0.01) {
        decayedVisitCounts.set(domain, decayedCount);
      }
    }

    this.domainVisitCounts = decayedVisitCounts;
    console.log('⏰ Time decay applied to visit counts');
  }

  // ========== 训练数据生成 ==========

  generateTrainingData() {
    const trainingData = [];

    for (const record of this.groupingHistory) {
      if (!record.isManual) continue;

      for (const tabInfo of record.tabs) {
        const tab = {
          id: tabInfo.id,
          url: tabInfo.url,
          title: tabInfo.title
        };

        trainingData.push({
          tab,
          label: record.groupName,
          timestamp: record.timestamp
        });
      }
    }

    console.log('📚 Generated', trainingData.length, 'training samples from grouping history');
    return trainingData;
  }

  extractDomain(url) {
    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      return null;
    }

    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      return null;
    }
  }

  getStats() {
    return {
      groupingHistoryCount: this.groupingHistory.length,
      visitHistoryCount: this.visitHistory.length,
      domainCount: this.domainVisitCounts.size,
      manualPreferencesCount: this.manualGroupPreferences.size,
      contentTypePreferencesCount: this.contentTypePreferences.size,
      sessionStartTime: this.sessionStartTime,
      initialized: this.initialized
    };
  }

  async clearHistory(daysToKeep = 30) {
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);

    this.groupingHistory = this.groupingHistory.filter(r => r.timestamp > cutoffTime);
    this.visitHistory = this.visitHistory.filter(r => r.timestamp > cutoffTime);

    const activeDomains = new Set(this.visitHistory.map(r => r.domain));
    
    for (const domain of this.domainVisitCounts.keys()) {
      if (!activeDomains.has(domain)) {
        this.domainVisitCounts.delete(domain);
        this.domainTotalTime.delete(domain);
      }
    }

    await this.saveToStorage();
    console.log('🧹 History cleared, keeping last', daysToKeep, 'days');
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = UserBehaviorTracker;
}

if (typeof window !== 'undefined') {
  window.UserBehaviorTracker = UserBehaviorTracker;
}
