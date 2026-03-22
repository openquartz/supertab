// Grouping Engine - Intelligent tab grouping algorithms

class GroupingEngine {
  constructor() {
    this.domainGroups = new Map();
    this.dateGroups = new Map();
  }

  // Group tabs by domain
  groupByDomain(tabs) {
    const groups = new Map();

    for (const tab of tabs) {
      const domain = this.extractDomain(tab.url);
      if (!domain) continue;

      if (!groups.has(domain)) {
        groups.set(domain, {
          id: `domain_${this.sanitizeId(domain)}`,
          name: domain,
          type: 'domain',
          tabs: [],
          collapsed: true,
          createdAt: Date.now(),
          icon: this.getDomainIcon(domain)
        });
      }

      groups.get(domain).tabs.push(tab);
    }

    // Convert to array and sort by tab count (descending)
    return Array.from(groups.values())
      .sort((a, b) => b.tabs.length - a.tabs.length);
  }

  // Group tabs by date/time
  groupByDate(tabs) {
    const groups = new Map();

    for (const tab of tabs) {
      const timeGroup = this.getTimeGroup(tab.openedAt || Date.now());

      if (!groups.has(timeGroup.key)) {
        groups.set(timeGroup.key, {
          id: `date_${timeGroup.key}`,
          name: timeGroup.label,
          type: 'date',
          tabs: [],
          collapsed: true,
          createdAt: Date.now(),
          timeSlot: timeGroup.timeSlot
        });
      }

      groups.get(timeGroup.key).tabs.push(tab);
    }

    // Convert to array and sort by time (most recent first)
    return Array.from(groups.values())
      .sort((a, b) => {
        const timeA = this.getTimeValue(a.timeSlot);
        const timeB = this.getTimeValue(b.timeSlot);
        return timeB - timeA;
      });
  }

  // Group tabs by custom logic (can be extended)
  groupByCustom(tabs, customLogic) {
    if (!customLogic || typeof customLogic !== 'function') {
      return tabs.map(tab => ({
        id: `custom_${tab.uuid}`,
        name: tab.title || 'Untitled',
        type: 'custom',
        tabs: [tab],
        collapsed: false,
        createdAt: Date.now()
      }));
    }

    const groups = new Map();
    for (const tab of tabs) {
      const groupKey = customLogic(tab);
      if (!groupKey) continue;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          id: `custom_${this.sanitizeId(groupKey)}`,
          name: groupKey,
          type: 'custom',
          tabs: [],
          collapsed: false,
          createdAt: Date.now()
        });
      }

      groups.get(groupKey).tabs.push(tab);
    }

    return Array.from(groups.values());
  }

  // Group tabs by content similarity (basic implementation)
  groupByContent(tabs) {
    const groups = [];
    const processedTabs = new Set();

    for (const tab of tabs) {
      if (processedTabs.has(tab.uuid)) continue;

      const similarTabs = tabs.filter(otherTab => {
        if (processedTabs.has(otherTab.uuid) || tab.uuid === otherTab.uuid) {
          return false;
        }

        return this.calculateSimilarity(tab, otherTab) > 0.7;
      });

      if (similarTabs.length > 0) {
        const group = {
          id: `content_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          name: this.generateGroupName(tab, similarTabs),
          type: 'content',
          tabs: [tab, ...similarTabs],
          collapsed: false,
          createdAt: Date.now()
        };

        groups.push(group);

        // Mark tabs as processed
        processedTabs.add(tab.uuid);
        similarTabs.forEach(t => processedTabs.add(t.uuid));
      } else {
        // Single tab group
        groups.push({
          id: `single_${tab.uuid}`,
          name: tab.title || 'Untitled',
          type: 'single',
          tabs: [tab],
          collapsed: false,
          createdAt: Date.now()
        });

        processedTabs.add(tab.uuid);
      }
    }

    return groups;
  }

  // Utility methods
  extractDomain(url) {
    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      return null;
    }

    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      console.warn('Failed to extract domain from URL:', url, error);
      return null;
    }
  }

  getTimeGroup(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    // Today - group by hour
    if (diffHours < 24 && this.isSameDay(date, now)) {
      const hour = date.getHours();
      const timeSlot = Math.floor(hour / 4) * 4; // 4-hour slots
      return {
        key: `today_${timeSlot}`,
        label: `Today ${timeSlot}:00-${timeSlot + 4}:00`,
        timeSlot: `today_${timeSlot}`
      };
    }

    // Yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (diffDays < 2 && this.isSameDay(date, yesterday)) {
      return {
        key: 'yesterday',
        label: 'Yesterday',
        timeSlot: 'yesterday'
      };
    }

    // This week
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    if (diffDays < 7 && date >= weekAgo) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = dayNames[date.getDay()];
      return {
        key: `this_week_${dayName.toLowerCase()}`,
        label: dayName,
        timeSlot: `this_week_${dayName.toLowerCase()}`
      };
    }

    // This month
    if (diffDays < 30 && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) {
      return {
        key: 'this_month',
        label: 'This Month',
        timeSlot: 'this_month'
      };
    }

    // Older - group by month
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];

    return {
      key: `older_${year}_${month}`,
      label: `${monthNames[month]} ${year}`,
      timeSlot: `older_${year}_${month}`
    };
  }

  getTimeValue(timeSlot) {
    if (timeSlot.startsWith('today_')) return Date.now();
    if (timeSlot === 'yesterday') return Date.now() - (24 * 60 * 60 * 1000);
    if (timeSlot.startsWith('this_week_')) return Date.now() - (3 * 24 * 60 * 60 * 1000);
    if (timeSlot === 'this_month') return Date.now() - (15 * 24 * 60 * 60 * 1000);
    return Date.now() - (90 * 24 * 60 * 60 * 1000); // Default to 3 months ago
  }

  isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  calculateSimilarity(tab1, tab2) {
    let score = 0;
    let factors = 0;

    // Domain similarity
    const domain1 = this.extractDomain(tab1.url);
    const domain2 = this.extractDomain(tab2.url);
    if (domain1 && domain2) {
      factors++;
      if (domain1 === domain2) score += 0.5;
      else if (domain1.endsWith(domain2) || domain2.endsWith(domain1)) score += 0.3;
    }

    // Title similarity (simple word overlap)
    if (tab1.title && tab2.title) {
      factors++;
      const words1 = tab1.title.toLowerCase().split(/\s+/);
      const words2 = tab2.title.toLowerCase().split(/\s+/);
      const commonWords = words1.filter(word => words2.includes(word));
      score += (commonWords.length / Math.max(words1.length, words2.length)) * 0.3;
    }

    // URL path similarity
    try {
      const path1 = new URL(tab1.url).pathname;
      const path2 = new URL(tab2.url).pathname;
      if (path1 && path2) {
        factors++;
        if (path1 === path2) score += 0.2;
        else if (path1.split('/')[1] === path2.split('/')[1]) score += 0.1;
      }
    } catch (e) {
      // Ignore URL parsing errors
    }

    return factors > 0 ? score / factors : 0;
  }

  generateGroupName(mainTab, similarTabs) {
    // Try to find common words in titles
    const allTabs = [mainTab, ...similarTabs];
    const titleWords = allTabs
      .map(tab => tab.title.toLowerCase().split(/\s+/))
      .flat()
      .filter(word => word.length > 3);

    const wordCount = {};
    titleWords.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });

    const commonWords = Object.entries(wordCount)
      .filter(([word, count]) => count >= allTabs.length * 0.5)
      .map(([word]) => word)
      .slice(0, 2);

    if (commonWords.length > 0) {
      return commonWords.join(' ');
    }

    // Fallback to domain-based name
    const domain = this.extractDomain(mainTab.url);
    if (domain) {
      return domain.replace('www.', '');
    }

    return 'Similar Content';
  }

  getDomainIcon(domain) {
    // Common domain patterns for icons
    const iconMap = {
      'github.com': '🐙',
      'stackoverflow.com': '📚',
      'youtube.com': '📺',
      'twitter.com': '🐦',
      'linkedin.com': '💼',
      'facebook.com': '👥',
      'instagram.com': '📸',
      'reddit.com': '🤖',
      'medium.com': '📝',
      'google.com': '🔍',
      'wikipedia.org': '📖',
      'amazon.com': '🛒',
      'netflix.com': '🎬',
      'spotify.com': '🎵'
    };

    for (const [pattern, icon] of Object.entries(iconMap)) {
      if (domain.includes(pattern)) {
        return icon;
      }
    }

    // Default icons based on domain type
    if (domain.includes('mail') || domain.includes('email')) return '📧';
    if (domain.includes('news')) return '📰';
    if (domain.includes('blog')) return '📝';
    if (domain.includes('shop') || domain.includes('store')) return '🛍️';
    if (domain.includes('bank') || domain.includes('finance')) return '🏦';
    if (domain.includes('edu') || domain.includes('learn')) return '🎓';
    if (domain.includes('gov')) return '🏛️';
    if (domain.includes('health') || domain.includes('medical')) return '🏥';

    return '🌐'; // Default domain icon
  }

  sanitizeId(str) {
    return str.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  // Generate unique UUID for tabs
  generateTabUuid(tab) {
    const str = `${tab.id}_${tab.url}_${tab.openedAt || Date.now()}`;
    return this.generateUUID(str);
  }

  generateUUID(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return 'tab_' + Math.abs(hash).toString(36) + '_' + Date.now().toString(36);
  }

  // Advanced grouping methods
  groupBySession(tabs) {
    // Group tabs that were opened together (within a short time window)
    const sessions = [];
    const sortedTabs = tabs.sort((a, b) => (a.openedAt || 0) - (b.openedAt || 0));

    let currentSession = [];
    let lastTime = 0;
    const SESSION_GAP = 5 * 60 * 1000; // 5 minutes

    for (const tab of sortedTabs) {
      const tabTime = tab.openedAt || Date.now();

      if (tabTime - lastTime > SESSION_GAP && currentSession.length > 0) {
        // Start new session
        if (currentSession.length > 1) {
          sessions.push({
            id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: this.generateSessionName(currentSession),
            type: 'session',
            tabs: [...currentSession],
            collapsed: true,
            createdAt: Date.now(),
            sessionStart: Math.min(...currentSession.map(t => t.openedAt || Date.now()))
          });
        }
        currentSession = [tab];
      } else {
        currentSession.push(tab);
      }

      lastTime = tabTime;
    }

    // Add final session if it has multiple tabs
    if (currentSession.length > 1) {
      sessions.push({
        id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        name: this.generateSessionName(currentSession),
        type: 'session',
        tabs: currentSession,
        collapsed: true,
        createdAt: Date.now(),
        sessionStart: Math.min(...currentSession.map(t => t.openedAt || Date.now()))
      });
    }

    return sessions.sort((a, b) => b.sessionStart - a.sessionStart);
  }

  generateSessionName(tabs) {
    if (tabs.length === 0) return 'Empty Session';

    // Try to find a common theme
    const domains = tabs.map(tab => this.extractDomain(tab.url)).filter(Boolean);
    const domainCounts = {};

    domains.forEach(domain => {
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    });

    const mostCommonDomain = Object.entries(domainCounts)
      .sort((a, b) => b[1] - a[1])[0];

    if (mostCommonDomain && mostCommonDomain[1] > tabs.length / 2) {
      return `${mostCommonDomain[0]} Session`;
    }

    return `Tab Session (${tabs.length} tabs)`;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GroupingEngine;
}
