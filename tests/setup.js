// Mock Chrome extension APIs for testing
global.chrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
      getBytesInUse: jest.fn()
    }
  },
  runtime: {
    lastError: null
  }
};

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};

// Helper function to mock chrome.storage.local.get
const mockStorageGet = (data) => {
  chrome.storage.local.get.mockImplementation((key, callback) => {
    if (typeof callback === 'function') {
      if (typeof key === 'string') {
        callback({ [key]: data });
      } else if (Array.isArray(key)) {
        const result = {};
        key.forEach(k => result[k] = data[k] || {});
        callback(result);
      } else {
        callback(data);
      }
    }
  });
};

// Helper function to mock chrome.storage.local.set
const mockStorageSet = () => {
  chrome.storage.local.set.mockImplementation((data, callback) => {
    if (typeof callback === 'function') {
      callback();
    }
  });
};

// Helper function to mock chrome.storage.local.clear
const mockStorageClear = () => {
  chrome.storage.local.clear.mockImplementation((callback) => {
    if (typeof callback === 'function') {
      callback();
    }
  });
};

// Helper function to mock chrome.storage.local.getBytesInUse
const mockStorageGetBytesInUse = (bytes) => {
  chrome.storage.local.getBytesInUse.mockImplementation((callback) => {
    if (typeof callback === 'function') {
      callback(bytes);
    }
  });
};

// Expose helpers to global scope for use in tests
global.mockStorageGet = mockStorageGet;
global.mockStorageSet = mockStorageSet;
global.mockStorageClear = mockStorageClear;
global.mockStorageGetBytesInUse = mockStorageGetBytesInUse;