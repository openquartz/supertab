const StorageManager = require('../../background/storage-manager');

describe('StorageManager', () => {
  let storageManager;
  let privacyManager;

  beforeEach(() => {
    privacyManager = {
      encryptNote: jest.fn(text => `encrypted:${text}`),
      decryptNote: jest.fn(text => text.replace('encrypted:', ''))
    };
    storageManager = new StorageManager(privacyManager);

    // Reset all mocks
    jest.clearAllMocks();
  });

  test('should save and retrieve tabs', async () => {
    const testTab = {
      id: 1,
      uuid: 'test-123',
      title: 'Test Tab',
      url: 'https://example.com',
      groupId: 'group-1',
      openedAt: Date.now()
    };

    // Mock storage get to return empty initially, then return saved tab
    let storageData = {};
    chrome.storage.local.get.mockImplementation((key, callback) => {
      callback({ [key]: storageData });
    });

    chrome.storage.local.set.mockImplementation((data, callback) => {
      const key = Object.keys(data)[0];
      storageData = data[key];
      callback();
    });

    await storageManager.saveTab(testTab);
    const retrieved = await storageManager.getTab('test-123');
    expect(retrieved).toEqual(testTab);
  });

  test('should handle storage quota limits', async () => {
    // Mock chrome.storage.local.getBytesInUse
    chrome.storage.local.getBytesInUse.mockImplementation((callback) => {
      callback(4.0 * 1024 * 1024); // 4.0MB used (under 90% of 5MB)
    });

    const result = await storageManager.checkStorageQuota();
    expect(result).toBe(true);
  });

  test('should perform auto cleanup of old tabs', async () => {
    const oldTab = {
      id: 1,
      uuid: 'old-123',
      title: 'Old Tab',
      url: 'https://example.com',
      openedAt: Date.now() - (31 * 24 * 60 * 60 * 1000) // 31 days ago
    };

    // Mock storage to simulate existing old tab
    let storageData = { 'old-123': oldTab };
    chrome.storage.local.get.mockImplementation((key, callback) => {
      callback({ [key]: storageData });
    });

    chrome.storage.local.set.mockImplementation((data, callback) => {
      const key = Object.keys(data)[0];
      storageData = data[key];
      callback();
    });

    await storageManager.performAutoCleanup({ autoCleanupDays: 30 });

    const retrieved = await storageManager.getTab('old-123');
    expect(retrieved).toBeNull();
  });
});