// Grouping Engine - Intelligent tab grouping algorithms

class GroupingEngine {
  constructor() {
    this.domainGroups = new Map();
    this.dateGroups = new Map();
    
    // Common domain patterns for smart grouping
    this.domainPatterns = {
      'google.com': ['google.com', 'google.co.uk', 'google.co.jp', 'google.fr', 'google.de'],
      'github.com': ['github.com', 'gist.github.com', 'pages.github.com'],
      'amazon.com': ['amazon.com', 'amazon.co.uk', 'amazon.co.jp', 'amazon.fr', 'amazon.de'],
      'microsoft.com': ['microsoft.com', 'office.com', 'onedrive.com', 'outlook.com', 'azure.com'],
      'apple.com': ['apple.com', 'icloud.com', 'itunes.com', 'appstore.com'],
      'alibaba.com': ['alibaba.com', 'taobao.com', 'tmall.com', 'aliexpress.com'],
      'tencent.com': ['qq.com', 'weixin.qq.com', 'tencent.com', 'wechat.com'],
      'baidu.com': ['baidu.com', 'tieba.baidu.com', 'zhidao.baidu.com', 'map.baidu.com'],
      'bilibili.com': ['bilibili.com', 'bilibili.tv', 'bilibili.net'],
      'jd.com': ['jd.com', 'jd.hk', 'jd.co.jp'],
      'netflix.com': ['netflix.com', 'netflix.net'],
      'youtube.com': ['youtube.com', 'youtu.be'],
      'twitter.com': ['twitter.com', 'x.com'],
      'reddit.com': ['reddit.com', 'redd.it'],
      'stackoverflow.com': ['stackoverflow.com', 'stackexchange.com'],
      'wikipedia.org': ['wikipedia.org', 'wikimedia.org', 'wikidata.org']
    };
    
    // Domain category mapping for smarter grouping
    this.domainCategories = {
      'work': ['linkedin.com', 'indeed.com', 'glassdoor.com', 'upwork.com', 'fiverr.com'],
      'social': ['facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'reddit.com', 'pinterest.com', 'tiktok.com', 'snapchat.com', 'weibo.com', 'zhihu.com', 'douban.com'],
      'shopping': ['amazon.com', 'ebay.com', 'walmart.com', 'target.com', 'alibaba.com', 'taobao.com', 'tmall.com', 'jd.com', 'pinduoduo.com', 'suning.com'],
      'learning': ['coursera.org', 'udemy.com', 'edx.org', 'khanacademy.org', 'pluralsight.com', 'lynda.com', 'codecademy.com', 'freecodecamp.org'],
      'news': ['bbc.com', 'cnn.com', 'nytimes.com', 'theguardian.com', 'washingtonpost.com', 'reuters.com', 'bloomberg.com', 'wsj.com', 'ft.com', 'qq.com/news', 'sina.com.cn', 'sohu.com', '163.com/news'],
      'finance': ['bankofamerica.com', 'chase.com', 'wellsfargo.com', 'citibank.com', 'hsbc.com', 'icbc.com.cn', 'ccb.com', 'boc.cn', 'abcchina.com', 'psbc.com', 'citics.com'],
      'entertainment': ['netflix.com', 'hbo.com', 'disneyplus.com', 'hulu.com', 'primevideo.com', 'bilibili.com', 'youku.com', 'iqiyi.com', 'tencentvideo.com', 'spotify.com', 'music.163.com', 'qqmusic.com', 'kuwo.cn', 'kugou.com'],
      'search': ['google.com', 'bing.com', 'yahoo.com', 'baidu.com', 'sogou.com', 'so.com', 'duckduckgo.com'],
      'tools': ['slack.com', 'notion.so', 'trello.com', 'asana.com', 'jira.com', 'dropbox.com', 'box.com', 'evernote.com', 'onedrive.com', 'icloud.com', 'docs.google.com', 'sheets.google.com', 'slides.google.com', 'office.com'],
      'coding': ['github.com', 'gitlab.com', 'bitbucket.org', 'stackoverflow.com', 'codepen.io', 'jsfiddle.net', 'repl.it', 'codewars.com', 'leetcode.com', 'hackerrank.com', 'hackerearth.com', 'topcoder.com', 'codesignal.com']
    };
  }

  // Extract base domain (e.g., 'github.com' from 'gist.github.com')
  extractBaseDomain(hostname) {
    if (!hostname) return null;
    
    const parts = hostname.split('.');
    if (parts.length <= 2) return hostname;
    
    // Check for common country code TLDs
    const countryTLDs = ['cn', 'jp', 'uk', 'fr', 'de', 'es', 'it', 'br', 'au', 'ca', 'in', 'ru', 'kr', 'tw', 'hk', 'sg', 'my', 'th', 'vn', 'id', 'ph', 'mx', 'ar', 'co', 'pe', 'cl', 'ec', 'uy', 'za', 'ng', 'eg', 'sa', 'ae', 'il', 'tr', 'pl', 'nl', 'se', 'no', 'fi', 'dk', 'pt', 'gr', 'ro', 'bg', 'hu', 'cz', 'sk', 'at', 'ch', 'be', 'lu', 'ie'];
    
    // Check for second-level domains like .co.uk, .co.jp, .com.cn
    if (parts.length >= 3) {
      const lastTwo = parts.slice(-2).join('.');
      const lastThree = parts.slice(-3).join('.');
      
      // Handle .co.uk, .co.jp etc.
      if (parts[parts.length - 2] === 'co' && countryTLDs.includes(parts[parts.length - 1])) {
        return lastThree;
      }
      
      // Handle .com.cn, .net.cn etc.
      if (['com', 'net', 'org', 'gov', 'edu', 'ac'].includes(parts[parts.length - 2]) && countryTLDs.includes(parts[parts.length - 1])) {
        return lastThree;
      }
    }
    
    // Default: return last two parts
    return parts.slice(-2).join('.');
  }

  // Get domain category for smarter grouping
  getDomainCategory(domain) {
    if (!domain) return null;
    
    const baseDomain = this.extractBaseDomain(domain);
    if (!baseDomain) return null;
    
    for (const [category, domains] of Object.entries(this.domainCategories)) {
      for (const pattern of domains) {
        if (baseDomain === pattern || baseDomain.endsWith(`.${pattern}`) || pattern.endsWith(`.${baseDomain}`)) {
          return category;
        }
      }
    }
    
    return null;
  }

  // Check if domains are related (same company/service)
  areDomainsRelated(domain1, domain2) {
    if (!domain1 || !domain2) return false;
    if (domain1 === domain2) return true;
    
    const base1 = this.extractBaseDomain(domain1);
    const base2 = this.extractBaseDomain(domain2);
    
    if (base1 === base2) return true;
    
    // Check domain patterns
    for (const [mainDomain, relatedDomains] of Object.entries(this.domainPatterns)) {
      const hasDomain1 = relatedDomains.some(d => domain1.includes(d) || base1 === d);
      const hasDomain2 = relatedDomains.some(d => domain2.includes(d) || base2 === d);
      if (hasDomain1 && hasDomain2) return true;
    }
    
    return false;
  }

  // Group tabs by domain (enhanced version)
  groupByDomain(tabs, options = {}) {
    const { 
      smartGrouping = true, 
      groupByCategory = false,
      includeSubdomains = true 
    } = options;
    
    const groups = new Map();
    const categoryGroups = new Map();

    for (const tab of tabs) {
      const domain = this.extractDomain(tab.url);
      if (!domain) continue;
      
      let groupKey = domain;
      let groupName = domain;
      
      if (smartGrouping) {
        const baseDomain = this.extractBaseDomain(domain);
        if (baseDomain && includeSubdomains) {
          groupKey = baseDomain;
          
          // Check if domain has a common pattern with special name
          for (const [mainDomain, relatedDomains] of Object.entries(this.domainPatterns)) {
            if (relatedDomains.some(d => domain.includes(d) || baseDomain === d)) {
              groupKey = mainDomain;
              groupName = mainDomain;
              break;
            }
          }
        }
      }
      
      // If grouping by category
      if (groupByCategory) {
        const category = this.getDomainCategory(domain);
        if (category) {
          if (!categoryGroups.has(category)) {
            categoryGroups.set(category, {
              id: `category_${category}`,
              name: this.getCategoryDisplayName(category),
              type: 'category',
              tabs: [],
              collapsed: true,
              createdAt: Date.now(),
              icon: this.getCategoryIcon(category)
            });
          }
          categoryGroups.get(category).tabs.push(tab);
          continue;
        }
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          id: `domain_${this.sanitizeId(groupKey)}`,
          name: groupName,
          type: 'domain',
          tabs: [],
          collapsed: true,
          createdAt: Date.now(),
          icon: this.getDomainIcon(groupKey)
        });
      }

      groups.get(groupKey).tabs.push(tab);
    }
    
    // Combine regular groups with category groups if using category grouping
    let resultGroups = [];
    if (groupByCategory) {
      resultGroups = Array.from(categoryGroups.values());
      // Add remaining domain groups that don't fit into any category
      resultGroups = resultGroups.concat(Array.from(groups.values()));
    } else {
      resultGroups = Array.from(groups.values());
    }

    // Sort by tab count (descending), then alphabetically
    return resultGroups
      .sort((a, b) => {
        if (b.tabs.length !== a.tabs.length) {
          return b.tabs.length - a.tabs.length;
        }
        return a.name.localeCompare(b.name);
      });
  }

  // Get category display name
  getCategoryDisplayName(category) {
    const categoryNames = {
      'work': '工作',
      'social': '社交',
      'shopping': '购物',
      'learning': '学习',
      'news': '新闻',
      'finance': '金融',
      'entertainment': '娱乐',
      'search': '搜索',
      'tools': '工具',
      'coding': '编程'
    };
    return categoryNames[category] || category;
  }

  // Get category icon
  getCategoryIcon(category) {
    const categoryIcons = {
      'work': '💼',
      'social': '👥',
      'shopping': '🛍️',
      'learning': '📚',
      'news': '📰',
      'finance': '💰',
      'entertainment': '🎬',
      'search': '🔍',
      'tools': '🔧',
      'coding': '💻'
    };
    return categoryIcons[category] || '🌐';
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

  // Get time of day label (morning, afternoon, evening, night)
  getTimeOfDayLabel(hour) {
    if (hour >= 5 && hour < 9) return '清晨';
    if (hour >= 9 && hour < 12) return '上午';
    if (hour >= 12 && hour < 14) return '中午';
    if (hour >= 14 && hour < 18) return '下午';
    if (hour >= 18 && hour < 22) return '晚上';
    return '深夜';
  }

  // Check if a date is a weekend
  isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  // Get week number of the year
  getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  // Enhanced getTimeGroup with more granular options
  getTimeGroup(timestamp, options = {}) {
    const { 
      includeTimeOfDay = true, 
      separateWeekends = false,
      useChineseLabels = true
    } = options;
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    // Today - more granular grouping with time of day
    if (diffHours < 24 && this.isSameDay(date, now)) {
      const hour = date.getHours();
      
      if (includeTimeOfDay) {
        const timeOfDay = this.getTimeOfDayLabel(hour);
        const timeSlot = hour;
        return {
          key: `today_${timeOfDay}`,
          label: useChineseLabels ? `今天 ${timeOfDay}` : `Today ${timeOfDay}`,
          timeSlot: `today_${timeOfDay}`,
          isToday: true,
          timeOfDay
        };
      } else {
        // Original 4-hour slots
        const timeSlot = Math.floor(hour / 4) * 4;
        return {
          key: `today_${timeSlot}`,
          label: useChineseLabels ? `今天 ${timeSlot}:00-${timeSlot + 4}:00` : `Today ${timeSlot}:00-${timeSlot + 4}:00`,
          timeSlot: `today_${timeSlot}`,
          isToday: true
        };
      }
    }

    // Yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (diffDays < 2 && this.isSameDay(date, yesterday)) {
      const hour = date.getHours();
      const timeOfDay = includeTimeOfDay ? this.getTimeOfDayLabel(hour) : '';
      
      if (separateWeekends && this.isWeekend(yesterday)) {
        return {
          key: 'yesterday_weekend',
          label: useChineseLabels ? '昨天（周末）' : 'Yesterday (Weekend)',
          timeSlot: 'yesterday_weekend',
          isYesterday: true,
          isWeekend: true
        };
      }
      
      return {
        key: 'yesterday',
        label: useChineseLabels ? (timeOfDay ? `昨天 ${timeOfDay}` : '昨天') : (timeOfDay ? `Yesterday ${timeOfDay}` : 'Yesterday'),
        timeSlot: 'yesterday',
        isYesterday: true
      };
    }

    // This week - with weekday/weekend separation
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    if (diffDays < 7 && date >= weekAgo) {
      const dayNamesEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayNamesCn = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      const dayNameEn = dayNamesEn[date.getDay()];
      const dayNameCn = dayNamesCn[date.getDay()];
      const isWeekend = this.isWeekend(date);
      
      if (separateWeekends) {
        if (isWeekend) {
          return {
            key: 'this_week_weekend',
            label: useChineseLabels ? '本周周末' : 'This Weekend',
            timeSlot: 'this_week_weekend',
            isWeekend: true,
            isThisWeek: true
          };
        } else {
          return {
            key: `this_week_${dayNameEn.toLowerCase()}`,
            label: useChineseLabels ? `本周${dayNameCn}` : `This ${dayNameEn}`,
            timeSlot: `this_week_${dayNameEn.toLowerCase()}`,
            isThisWeek: true,
            isWeekend: false
          };
        }
      }
      
      return {
        key: `this_week_${dayNameEn.toLowerCase()}`,
        label: useChineseLabels ? dayNameCn : dayNameEn,
        timeSlot: `this_week_${dayNameEn.toLowerCase()}`,
        isThisWeek: true
      };
    }

    // Last week
    const twoWeeksAgo = new Date(now);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    if (diffDays < 14 && date >= twoWeeksAgo) {
      const weekNum = this.getWeekNumber(date);
      return {
        key: `last_week_${weekNum}`,
        label: useChineseLabels ? '上周' : 'Last Week',
        timeSlot: 'last_week',
        isLastWeek: true
      };
    }

    // This month
    if (diffDays < 30 && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) {
      return {
        key: 'this_month',
        label: useChineseLabels ? '本月' : 'This Month',
        timeSlot: 'this_month',
        isThisMonth: true
      };
    }

    // Last month
    const lastMonth = new Date(now);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    if (date.getMonth() === lastMonth.getMonth() && date.getFullYear() === lastMonth.getFullYear()) {
      return {
        key: 'last_month',
        label: useChineseLabels ? '上月' : 'Last Month',
        timeSlot: 'last_month',
        isLastMonth: true
      };
    }

    // Older - group by month with year
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const monthNamesEn = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    const monthNamesCn = ['', '一月', '二月', '三月', '四月', '五月', '六月',
                       '七月', '八月', '九月', '十月', '十一月', '十二月'];

    // Check if it's this year
    if (year === now.getFullYear()) {
      return {
        key: `older_${year}_${month}`,
        label: useChineseLabels ? `${monthNamesCn[month]}` : `${monthNamesEn[month]}`,
        timeSlot: `older_${year}_${month}`,
        year,
        month
      };
    }

    return {
      key: `older_${year}_${month}`,
      label: useChineseLabels ? `${year}年${monthNamesCn[month]}` : `${monthNamesEn[month]} ${year}`,
      timeSlot: `older_${year}_${month}`,
      year,
      month
    };
  }

  // Group tabs by date with enhanced options
  groupByDate(tabs, options = {}) {
    const { 
      includeTimeOfDay = true, 
      separateWeekends = false,
      useChineseLabels = true
    } = options;
    
    const groups = new Map();

    for (const tab of tabs) {
      const timeGroup = this.getTimeGroup(tab.openedAt || Date.now(), {
        includeTimeOfDay,
        separateWeekends,
        useChineseLabels
      });

      if (!groups.has(timeGroup.key)) {
        groups.set(timeGroup.key, {
          id: `date_${timeGroup.key}`,
          name: timeGroup.label,
          type: 'date',
          tabs: [],
          collapsed: true,
          createdAt: Date.now(),
          timeSlot: timeGroup.timeSlot,
          ...timeGroup
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

  // Group tabs by work week (Monday-Friday vs weekend)
  groupByWorkWeek(tabs) {
    const groups = new Map();
    
    for (const tab of tabs) {
      const date = new Date(tab.openedAt || Date.now());
      const isWeekend = this.isWeekend(date);
      const weekNum = this.getWeekNumber(date);
      const year = date.getFullYear();
      
      const groupKey = isWeekend 
        ? `weekend_${year}_${weekNum}` 
        : `workweek_${year}_${weekNum}`;
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          id: `week_${groupKey}`,
          name: isWeekend ? `第${weekNum}周 周末` : `第${weekNum}周 工作日`,
          type: 'workweek',
          tabs: [],
          collapsed: true,
          createdAt: Date.now(),
          isWeekend,
          weekNum,
          year
        });
      }
      
      groups.get(groupKey).tabs.push(tab);
    }
    
    return Array.from(groups.values())
      .sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        if (b.weekNum !== a.weekNum) return b.weekNum - a.weekNum;
        return a.isWeekend ? 1 : -1; // Work days come before weekend
      });
  }

  getTimeValue(timeSlot) {
    if (timeSlot.startsWith('today_')) return Date.now();
    if (timeSlot === 'yesterday' || timeSlot === 'yesterday_weekend') return Date.now() - (24 * 60 * 60 * 1000);
    if (timeSlot.startsWith('this_week_')) return Date.now() - (3 * 24 * 60 * 60 * 1000);
    if (timeSlot === 'last_week') return Date.now() - (10 * 24 * 60 * 60 * 1000);
    if (timeSlot === 'this_month') return Date.now() - (15 * 24 * 60 * 60 * 1000);
    if (timeSlot === 'last_month') return Date.now() - (45 * 24 * 60 * 60 * 1000);
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
