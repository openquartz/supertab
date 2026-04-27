/**
 * TabSearchEngine - 增强的标签页搜索引擎
 * 
 * 功能特性：
 * - 实时搜索防抖
 * - 多维度搜索（标题、备注、URL、域名、别名、打开时间、访问次数）
 * - 高级搜索语法（引号精确匹配、排除词、字段限定）
 * - 搜索历史记录
 * - 搜索结果排序（相关度、时间、访问次数）
 * - 搜索结果高亮
 */

class TabSearchEngine {
  constructor(options = {}) {
    this.options = {
      debounceDelay: options.debounceDelay || 150,
      maxHistoryItems: options.maxHistoryItems || 20,
      defaultSearchFields: options.defaultSearchFields || ['title', 'alias', 'url', 'note', 'domain'],
      highlightClass: options.highlightClass || 'tf-search-highlight',
      ...options
    };
    
    this.searchHistory = [];
    this.debounceTimer = null;
    this.lastQuery = '';
    this.currentResults = [];
    
    // 高级搜索语法标记
    this.syntaxTokens = {
      exactMatch: /"([^"]+)"/g,
      exclude: /-(\S+)/g,
      fieldLimit: /(\w+):/g
    };
    
    // 字段权重配置（用于相关度排序）
    this.fieldWeights = {
      title: 10,
      alias: 9,
      note: 8,
      domain: 7,
      url: 5,
      path: 3
    };
    
    // 可搜索字段映射
    this.searchableFields = {
      title: { label: '标题', weight: 10 },
      alias: { label: '别名', weight: 9 },
      note: { label: '备注', weight: 8 },
      domain: { label: '域名', weight: 7 },
      url: { label: 'URL', weight: 5 },
      path: { label: '路径', weight: 3 }
    };
    
    // 从存储加载搜索历史
    this.loadSearchHistory();
  }

  /**
   * 解析搜索查询
   * @param {string} query - 原始搜索查询
   * @returns {Object} 解析后的查询对象
   */
  parseQuery(query) {
    if (!query || typeof query !== 'string') {
      return {
        terms: [],
        exactTerms: [],
        excludeTerms: [],
        fieldLimits: {},
        rawQuery: ''
      };
    }
    
    const trimmedQuery = query.trim();
    let remainingQuery = trimmedQuery;
    
    // 提取精确匹配项（带引号的内容）
    const exactTerms = [];
    let exactMatch;
    while ((exactMatch = this.syntaxTokens.exactMatch.exec(trimmedQuery)) !== null) {
      exactTerms.push(exactMatch[1].toLowerCase());
      remainingQuery = remainingQuery.replace(exactMatch[0], '');
    }
    
    // 提取排除项（以-开头的词）
    const excludeTerms = [];
    let excludeMatch;
    while ((excludeMatch = this.syntaxTokens.exclude.exec(trimmedQuery)) !== null) {
      excludeTerms.push(excludeMatch[1].toLowerCase());
      remainingQuery = remainingQuery.replace(excludeMatch[0], '');
    }
    
    // 提取字段限定（field:value）
    const fieldLimits = {};
    let fieldMatch;
    const fieldLimitPattern = /(\w+):([^\s]+)/g;
    while ((fieldMatch = fieldLimitPattern.exec(trimmedQuery)) !== null) {
      const field = fieldMatch[1].toLowerCase();
      const value = fieldMatch[2].toLowerCase();
      if (this.searchableFields[field]) {
        if (!fieldLimits[field]) {
          fieldLimits[field] = [];
        }
        fieldLimits[field].push(value);
      }
      remainingQuery = remainingQuery.replace(fieldMatch[0], '');
    }
    
    // 提取普通搜索词
    const terms = remainingQuery
      .split(/\s+/)
      .filter(term => term.length > 0)
      .map(term => term.toLowerCase());
    
    return {
      terms,
      exactTerms,
      excludeTerms,
      fieldLimits,
      rawQuery: trimmedQuery,
      hasAdvancedSyntax: exactTerms.length > 0 || excludeTerms.length > 0 || Object.keys(fieldLimits).length > 0
    };
  }

  /**
   * 检查标签页是否匹配搜索查询
   * @param {Object} tab - 标签页对象
   * @param {Object} parsedQuery - 解析后的查询对象
   * @param {Array} searchFields - 要搜索的字段列表
   * @returns {Object} 匹配结果 { matches: boolean, score: number, matches: Object }
   */
  matchTab(tab, parsedQuery, searchFields = this.options.defaultSearchFields) {
    if (!tab || !parsedQuery) {
      return { matches: false, score: 0, fieldMatches: {} };
    }
    
    const { terms, exactTerms, excludeTerms, fieldLimits } = parsedQuery;
    
    // 如果没有任何搜索条件，认为匹配
    if (terms.length === 0 && exactTerms.length === 0 && Object.keys(fieldLimits).length === 0) {
      return { matches: true, score: 0, fieldMatches: {} };
    }
    
    let totalScore = 0;
    const fieldMatches = {};
    let hasMatch = false;
    
    // 首先检查排除项
    for (const field of searchFields) {
      const fieldValue = this.getFieldValue(tab, field);
      if (!fieldValue) continue;
      
      const lowerValue = fieldValue.toLowerCase();
      
      // 检查是否包含排除项
      for (const excludeTerm of excludeTerms) {
        if (lowerValue.includes(excludeTerm)) {
          return { matches: false, score: 0, fieldMatches: {} };
        }
      }
    }
    
    // 检查字段限定
    for (const [field, values] of Object.entries(fieldLimits)) {
      const fieldValue = this.getFieldValue(tab, field);
      if (!fieldValue) {
        return { matches: false, score: 0, fieldMatches: {} };
      }
      
      const lowerValue = fieldValue.toLowerCase();
      let fieldMatch = false;
      
      for (const value of values) {
        if (lowerValue.includes(value)) {
          fieldMatch = true;
          const weight = this.fieldWeights[field] || 1;
          totalScore += weight * value.length;
          
          if (!fieldMatches[field]) {
            fieldMatches[field] = [];
          }
          fieldMatches[field].push(value);
        }
      }
      
      if (!fieldMatch) {
        return { matches: false, score: 0, fieldMatches: {} };
      }
      
      hasMatch = true;
    }
    
    // 检查精确匹配项
    for (const exactTerm of exactTerms) {
      let exactMatchFound = false;
      
      for (const field of searchFields) {
        const fieldValue = this.getFieldValue(tab, field);
        if (!fieldValue) continue;
        
        const lowerValue = fieldValue.toLowerCase();
        
        if (lowerValue.includes(exactTerm)) {
          exactMatchFound = true;
          const weight = this.fieldWeights[field] || 1;
          totalScore += weight * exactTerm.length * 2; // 精确匹配权重更高
          
          if (!fieldMatches[field]) {
            fieldMatches[field] = [];
          }
          fieldMatches[field].push(exactTerm);
          
          break;
        }
      }
      
      if (!exactMatchFound) {
        return { matches: false, score: 0, fieldMatches: {} };
      }
      
      hasMatch = true;
    }
    
    // 检查普通搜索词
    for (const term of terms) {
      let termMatchFound = false;
      
      for (const field of searchFields) {
        const fieldValue = this.getFieldValue(tab, field);
        if (!fieldValue) continue;
        
        const lowerValue = fieldValue.toLowerCase();
        
        if (lowerValue.includes(term)) {
          termMatchFound = true;
          const weight = this.fieldWeights[field] || 1;
          
          // 根据匹配位置计算额外权重
          const termIndex = lowerValue.indexOf(term);
          const positionBonus = termIndex === 0 ? 2 : (termIndex < 10 ? 1.5 : 1);
          
          totalScore += weight * term.length * positionBonus;
          
          if (!fieldMatches[field]) {
            fieldMatches[field] = [];
          }
          if (!fieldMatches[field].includes(term)) {
            fieldMatches[field].push(term);
          }
        }
      }
      
      if (!termMatchFound) {
        return { matches: false, score: 0, fieldMatches: {} };
      }
      
      hasMatch = true;
    }
    
    return {
      matches: hasMatch,
      score: totalScore,
      fieldMatches
    };
  }

  /**
   * 获取标签页指定字段的值
   * @param {Object} tab - 标签页对象
   * @param {string} field - 字段名
   * @returns {string} 字段值
   */
  getFieldValue(tab, field) {
    if (!tab) return '';
    
    switch (field) {
      case 'title':
        return tab.title || '';
      case 'alias':
        return tab.alias || '';
      case 'note':
        return tab.note || '';
      case 'url':
        return tab.url || '';
      case 'domain':
        try {
          return new URL(tab.url || '').hostname || '';
        } catch {
          return '';
        }
      case 'path':
        try {
          return new URL(tab.url || '').pathname || '';
        } catch {
          return '';
        }
      default:
        return '';
    }
  }

  /**
   * 搜索标签页
   * @param {Array} tabs - 标签页数组
   * @param {string} query - 搜索查询
   * @param {Object} options - 搜索选项
   * @returns {Array} 搜索结果（按相关度排序）
   */
  search(tabs, query, options = {}) {
    const {
      searchFields = this.options.defaultSearchFields,
      sortBy = 'relevance', // 'relevance', 'time', 'visitCount'
      sortOrder = 'desc'
    } = options;
    
    if (!Array.isArray(tabs)) {
      return [];
    }
    
    const parsedQuery = this.parseQuery(query);
    
    // 如果没有搜索词，返回空结果
    if (!parsedQuery.rawQuery) {
      return [];
    }
    
    const results = [];
    
    for (const tab of tabs) {
      const matchResult = this.matchTab(tab, parsedQuery, searchFields);
      
      if (matchResult.matches) {
        results.push({
          tab,
          score: matchResult.score,
          fieldMatches: matchResult.fieldMatches,
          parsedQuery
        });
      }
    }
    
    // 排序
    this.sortResults(results, sortBy, sortOrder);
    
    // 保存到搜索历史（如果是有效查询）
    if (parsedQuery.rawQuery.length > 1) {
      this.addToSearchHistory(parsedQuery.rawQuery, results.length);
    }
    
    this.lastQuery = parsedQuery.rawQuery;
    this.currentResults = results;
    
    return results;
  }

  /**
   * 对搜索结果排序
   * @param {Array} results - 搜索结果数组
   * @param {string} sortBy - 排序方式
   * @param {string} sortOrder - 排序方向
   */
  sortResults(results, sortBy = 'relevance', sortOrder = 'desc') {
    results.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'relevance':
          comparison = a.score - b.score;
          break;
        case 'time':
          const timeA = a.tab.openedAt || 0;
          const timeB = b.tab.openedAt || 0;
          comparison = timeA - timeB;
          break;
        case 'visitCount':
          const visitsA = a.tab.visitCount || 0;
          const visitsB = b.tab.visitCount || 0;
          comparison = visitsA - visitsB;
          break;
        default:
          comparison = a.score - b.score;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }

  /**
   * 防抖搜索
   * @param {Function} searchFn - 搜索函数
   * @param {Array} tabs - 标签页数组
   * @param {string} query - 搜索查询
   * @param {Object} options - 搜索选项
   */
  debouncedSearch(searchFn, tabs, query, options = {}) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = setTimeout(() => {
      const results = this.search(tabs, query, options);
      if (typeof searchFn === 'function') {
        searchFn(results, query);
      }
    }, this.options.debounceDelay);
  }

  /**
   * 高亮搜索结果中的匹配文本
   * @param {string} text - 原始文本
   * @param {Array} searchTerms - 搜索词数组
   * @param {string} highlightClass - 高亮类名
   * @returns {string} 带高亮的HTML
   */
  highlightMatches(text, searchTerms, highlightClass = this.options.highlightClass) {
    if (!text || !Array.isArray(searchTerms) || searchTerms.length === 0) {
      return this.escapeHtml(text);
    }
    
    let result = this.escapeHtml(text);
    const lowerText = text.toLowerCase();
    
    // 按长度降序排序搜索词，确保长词先被匹配
    const sortedTerms = [...searchTerms].sort((a, b) => b.length - a.length);
    
    for (const term of sortedTerms) {
      if (!term) continue;
      
      // 使用正则表达式进行不区分大小写的替换
      const regex = new RegExp(`(${this.escapeRegExp(term)})`, 'gi');
      
      // 只在还没有被高亮的部分进行替换
      // 这是一个简化版本，实际项目中可能需要更复杂的处理
      result = result.replace(regex, `<span class="${highlightClass}">$1</span>`);
    }
    
    return result;
  }

  /**
   * 转义HTML特殊字符
   * @param {string} text - 原始文本
   * @returns {string} 转义后的文本
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 转义正则表达式特殊字符
   * @param {string} string - 原始字符串
   * @returns {string} 转义后的字符串
   */
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 添加到搜索历史
   * @param {string} query - 搜索查询
   * @param {number} resultCount - 结果数量
   */
  addToSearchHistory(query, resultCount) {
    if (!query || query.trim().length === 0) return;
    
    const historyItem = {
      query: query.trim(),
      timestamp: Date.now(),
      resultCount: resultCount || 0
    };
    
    // 检查是否已存在相同的查询，如果存在则更新时间戳
    const existingIndex = this.searchHistory.findIndex(item => 
      item.query.toLowerCase() === query.toLowerCase()
    );
    
    if (existingIndex !== -1) {
      this.searchHistory.splice(existingIndex, 1);
    }
    
    // 添加到历史开头
    this.searchHistory.unshift(historyItem);
    
    // 限制历史数量
    if (this.searchHistory.length > this.options.maxHistoryItems) {
      this.searchHistory = this.searchHistory.slice(0, this.options.maxHistoryItems);
    }
    
    // 保存到存储
    this.saveSearchHistory();
  }

  /**
   * 获取搜索历史
   * @param {number} limit - 返回数量限制
   * @returns {Array} 搜索历史数组
   */
  getSearchHistory(limit = 10) {
    return this.searchHistory.slice(0, limit);
  }

  /**
   * 清除搜索历史
   */
  clearSearchHistory() {
    this.searchHistory = [];
    this.saveSearchHistory();
  }

  /**
   * 保存搜索历史到存储
   */
  saveSearchHistory() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({
          'tabflow:searchHistory': this.searchHistory
        });
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tabflow:searchHistory', JSON.stringify(this.searchHistory));
      }
    } catch (error) {
      console.warn('Failed to save search history:', error);
    }
  }

  /**
   * 从存储加载搜索历史
   */
  loadSearchHistory() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['tabflow:searchHistory'], (result) => {
          if (result['tabflow:searchHistory']) {
            this.searchHistory = result['tabflow:searchHistory'];
          }
        });
      } else if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('tabflow:searchHistory');
        if (stored) {
          this.searchHistory = JSON.parse(stored);
        }
      }
    } catch (error) {
      console.warn('Failed to load search history:', error);
      this.searchHistory = [];
    }
  }

  /**
   * 获取搜索建议
   * @param {string} partialQuery - 部分输入的查询
   * @param {Array} tabs - 当前标签页列表
   * @returns {Array} 建议列表
   */
  getSearchSuggestions(partialQuery, tabs = []) {
    if (!partialQuery || partialQuery.trim().length === 0) {
      // 返回最近的搜索历史
      return this.getSearchHistory(5).map(item => ({
        type: 'history',
        query: item.query,
        label: item.query,
        timestamp: item.timestamp
      }));
    }
    
    const suggestions = [];
    const lowerPartial = partialQuery.toLowerCase();
    
    // 1. 从搜索历史获取匹配项
    const historySuggestions = this.searchHistory
      .filter(item => item.query.toLowerCase().includes(lowerPartial))
      .slice(0, 3)
      .map(item => ({
        type: 'history',
        query: item.query,
        label: item.query,
        timestamp: item.timestamp
      }));
    
    suggestions.push(...historySuggestions);
    
    // 2. 从当前标签页获取标题/域名建议
    if (Array.isArray(tabs) && tabs.length > 0) {
      const tabSuggestions = [];
      const seenValues = new Set();
      
      for (const tab of tabs) {
        // 检查标题
        const title = tab.title || '';
        if (title.toLowerCase().includes(lowerPartial) && !seenValues.has(title)) {
          seenValues.add(title);
          tabSuggestions.push({
            type: 'title',
            query: title,
            label: title,
            tab: tab
          });
        }
        
        // 检查域名
        try {
          const domain = new URL(tab.url || '').hostname;
          if (domain && domain.toLowerCase().includes(lowerPartial) && !seenValues.has(domain)) {
            seenValues.add(domain);
            tabSuggestions.push({
              type: 'domain',
              query: domain,
              label: domain,
              tab: tab
            });
          }
        } catch (e) {
          // 忽略无效URL
        }
        
        // 检查备注
        if (tab.note) {
          const note = tab.note;
          if (note.toLowerCase().includes(lowerPartial) && !seenValues.has(note)) {
            seenValues.add(note);
            tabSuggestions.push({
              type: 'note',
              query: note,
              label: note,
              tab: tab
            });
          }
        }
        
        if (tabSuggestions.length >= 5) break;
      }
      
      suggestions.push(...tabSuggestions);
    }
    
    return suggestions.slice(0, 8);
  }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TabSearchEngine;
}

// 浏览器环境导出
if (typeof window !== 'undefined') {
  window.TabSearchEngine = TabSearchEngine;
}
