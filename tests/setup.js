// Mock Chrome extension APIs for testing
const storageData = {};

global.chrome = {
  storage: {
    local: {
      get: jest.fn((keys, callback) => {
        const result = {};
        if (typeof keys === 'string') {
          result[keys] = storageData[keys] || null;
        } else if (Array.isArray(keys)) {
          keys.forEach(k => result[k] = storageData[k] || null);
        } else if (!keys) {
          return Object.assign({}, storageData);
        }
        if (callback) callback(result);
        return result;
      }),
      set: jest.fn((data, callback) => {
        Object.assign(storageData, data);
        if (callback) callback();
      }),
      remove: jest.fn((keys, callback) => {
        if (Array.isArray(keys)) {
          keys.forEach(k => delete storageData[k]);
        } else {
          delete storageData[keys];
        }
        if (callback) callback();
      }),
      clear: jest.fn((callback) => {
        Object.keys(storageData).forEach(k => delete storageData[k]);
        if (callback) callback();
      }),
      getBytesInUse: jest.fn((callback) => {
        const bytes = JSON.stringify(storageData).length;
        if (callback) callback(bytes);
      })
    }
  },
  runtime: {
    lastError: null
  },
  tabs: {
    query: jest.fn().mockResolvedValue([]),
    remove: jest.fn(),
    update: jest.fn(),
    get: jest.fn()
  },
  windows: {
    update: jest.fn()
  }
};

// Mock importScripts for service worker files
global.importScripts = jest.fn();

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
