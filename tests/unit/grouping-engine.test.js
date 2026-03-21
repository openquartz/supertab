const GroupingEngine = require('../../utils/grouping-engine');

describe('GroupingEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new GroupingEngine();
  });

  describe('groupByDomain', () => {
    test('should group tabs by domain', () => {
      const tabs = [
        { id: 1, url: 'https://github.com/user/repo', title: 'GitHub' },
        { id: 2, url: 'https://github.com/other/repo', title: 'GitHub Other' },
        { id: 3, url: 'https://stackoverflow.com/questions', title: 'StackOverflow' }
      ];

      const groups = engine.groupByDomain(tabs);

      expect(groups).toHaveLength(2);
      expect(groups.find(g => g.name === 'github.com').tabs).toHaveLength(2);
      expect(groups.find(g => g.name === 'stackoverflow.com').tabs).toHaveLength(1);
    });

    test('should sort groups by tab count descending', () => {
      const tabs = [
        { id: 1, url: 'https://a.com/page1', title: 'A' },
        { id: 2, url: 'https://a.com/page2', title: 'A' },
        { id: 3, url: 'https://a.com/page3', title: 'A' },
        { id: 4, url: 'https://b.com/page', title: 'B' }
      ];

      const groups = engine.groupByDomain(tabs);

      expect(groups[0].name).toBe('a.com');
      expect(groups[1].name).toBe('b.com');
    });

    test('should handle invalid URLs', () => {
      const tabs = [
        { id: 1, url: 'https://valid.com/page', title: 'Valid' },
        { id: 2, url: 'not-a-url', title: 'Invalid' },
        { id: 3, url: '', title: 'Empty' }
      ];

      const groups = engine.groupByDomain(tabs);

      expect(groups).toHaveLength(1);
      expect(groups[0].name).toBe('valid.com');
    });

    test('should extract domain with subdomain', () => {
      const tabs = [
        { id: 1, url: 'https://my.bank.com/account', title: 'Bank' },
        { id: 2, url: 'https://api.example.com/data', title: 'API' }
      ];

      const groups = engine.groupByDomain(tabs);

      expect(groups.find(g => g.name === 'my.bank.com')).toBeDefined();
      expect(groups.find(g => g.name === 'api.example.com')).toBeDefined();
    });

    test('should default domain groups to collapsed', () => {
      const groups = engine.groupByDomain([
        { id: 1, url: 'https://a.com/1', title: 'A1' }
      ]);

      expect(groups[0].collapsed).toBe(true);
    });
  });

  describe('groupByDate', () => {
    test('should group tabs by time periods', () => {
      const now = Date.now();
      const tabs = [
        { id: 1, url: 'https://a.com', title: 'A', openedAt: now },
        { id: 2, url: 'https://b.com', title: 'B', openedAt: now - (2 * 60 * 60 * 1000) }, // 2 hours ago
        { id: 3, url: 'https://c.com', title: 'C', openedAt: now - (48 * 60 * 60 * 1000) } // 2 days ago
      ];

      const groups = engine.groupByDate(tabs);

      expect(groups.length).toBeGreaterThan(0);
    });

    test('should handle tabs without openedAt', () => {
      const tabs = [
        { id: 1, url: 'https://a.com', title: 'A' }
      ];

      const groups = engine.groupByDate(tabs);

      expect(groups).toHaveLength(1);
    });

    test('should default date groups to collapsed', () => {
      const groups = engine.groupByDate([
        { id: 1, url: 'https://a.com', title: 'A', openedAt: Date.now() }
      ]);

      expect(groups[0].collapsed).toBe(true);
    });
  });

  describe('groupByCustom', () => {
    test('should group tabs with custom logic', () => {
      const customLogic = (tab) => {
        if (tab.url.includes('github')) return 'GitHub';
        if (tab.url.includes('stackoverflow')) return 'StackOverflow';
        return 'Other';
      };

      const tabs = [
        { id: 1, uuid: '1', url: 'https://github.com/user', title: 'GitHub' },
        { id: 2, uuid: '2', url: 'https://stackoverflow.com/q', title: 'SO' },
        { id: 3, uuid: '3', url: 'https://example.com', title: 'Example' }
      ];

      const groups = engine.groupByCustom(tabs, customLogic);

      expect(groups.find(g => g.name === 'GitHub').tabs).toHaveLength(1);
      expect(groups.find(g => g.name === 'StackOverflow').tabs).toHaveLength(1);
      expect(groups.find(g => g.name === 'Other').tabs).toHaveLength(1);
    });

    test('should handle tabs without custom logic', () => {
      const tabs = [
        { id: 1, uuid: '1', url: 'https://a.com', title: 'A' }
      ];

      const groups = engine.groupByCustom(tabs);

      expect(groups).toHaveLength(1);
      expect(groups[0].type).toBe('custom');
    });
  });

  describe('groupBySession', () => {
    test('should group tabs by session (time proximity)', () => {
      const now = Date.now();
      const tabs = [
        { id: 1, url: 'https://a.com', title: 'A', openedAt: now },
        { id: 2, url: 'https://b.com', title: 'B', openedAt: now + 1000 }, // 1 second later
        { id: 3, url: 'https://c.com', title: 'C', openedAt: now + (10 * 60 * 1000) } // 10 minutes later
      ];

      const groups = engine.groupBySession(tabs);

      expect(groups.length).toBeGreaterThanOrEqual(1);
    });

    test('should default session groups to collapsed', () => {
      const now = Date.now();
      const groups = engine.groupBySession([
        { id: 1, url: 'https://a.com', title: 'A', openedAt: now },
        { id: 2, url: 'https://b.com', title: 'B', openedAt: now + 1000 }
      ]);

      expect(groups[0].collapsed).toBe(true);
    });
  });

  describe('extractDomain', () => {
    test('should extract domain from valid URLs', () => {
      expect(engine.extractDomain('https://github.com/user')).toBe('github.com');
      expect(engine.extractDomain('https://sub.domain.example.com/page')).toBe('sub.domain.example.com');
    });

    test('should return null for invalid URLs', () => {
      expect(engine.extractDomain('not-a-url')).toBeNull();
      expect(engine.extractDomain('')).toBeNull();
      expect(engine.extractDomain(null)).toBeNull();
    });

    test('should return null for non-http URLs', () => {
      expect(engine.extractDomain('file:///path')).toBeNull();
      expect(engine.extractDomain('chrome://extensions')).toBeNull();
    });
  });

  describe('getDomainIcon', () => {
    test('should return correct icons for known domains', () => {
      expect(engine.getDomainIcon('github.com')).toBe('🐙');
      expect(engine.getDomainIcon('stackoverflow.com')).toBe('📚');
      expect(engine.getDomainIcon('youtube.com')).toBe('📺');
    });

    test('should return default icon for unknown domains', () => {
      expect(engine.getDomainIcon('unknown-site.com')).toBe('🌐');
    });

    test('should detect domain type for special cases', () => {
      expect(engine.getDomainIcon('mail.example.com')).toBe('📧');
      expect(engine.getDomainIcon('shop.test.com')).toBe('🛍️');
    });
  });

  describe('calculateSimilarity', () => {
    test('should return higher similarity for same domain', () => {
      const tab1 = { url: 'https://github.com/user/repo1', title: 'Project One' };
      const tab2 = { url: 'https://github.com/user/repo2', title: 'Project Two' };

      const similarity = engine.calculateSimilarity(tab1, tab2);

      expect(similarity).toBeGreaterThan(0);
    });

    test('should return lower similarity for different domains', () => {
      const tab1 = { url: 'https://github.com/user/repo', title: 'GitHub' };
      const tab2 = { url: 'https://stackoverflow.com/q', title: 'StackOverflow' };

      const similarity = engine.calculateSimilarity(tab1, tab2);

      expect(similarity).toBeLessThan(0.3);
    });

    test('should return 0 similarity when no factors available', () => {
      const tab1 = { url: 'not-a-url', title: null };
      const tab2 = { url: 'also-invalid', title: null };

      const similarity = engine.calculateSimilarity(tab1, tab2);

      expect(similarity).toBe(0);
    });
  });

  describe('sanitizeId', () => {
    test('should sanitize special characters', () => {
      expect(engine.sanitizeId('test@domain.com')).toBe('test_domain_com');
      expect(engine.sanitizeId('path/to/page')).toBe('path_to_page');
    });
  });

  describe('generateTabUuid', () => {
    test('should generate unique UUIDs', () => {
      const tab1 = { id: 1, url: 'https://a.com', openedAt: 1000 };
      const tab2 = { id: 2, url: 'https://b.com', openedAt: 2000 };

      const uuid1 = engine.generateTabUuid(tab1);
      const uuid2 = engine.generateTabUuid(tab2);

      expect(uuid1).toMatch(/^tab_[a-z0-9]+_[a-z0-9]+$/);
      expect(uuid2).toMatch(/^tab_[a-z0-9]+_[a-z0-9]+$/);
    });
  });
});
