const PrivacyManager = require('../../utils/privacy-manager');

describe('PrivacyManager', () => {
  let privacyManager;

  beforeEach(() => {
    privacyManager = new PrivacyManager();
  });

  test('should encrypt and decrypt notes', async () => {
    const originalNote = 'This is a sensitive note';
    const encrypted = await privacyManager.encryptNote(originalNote);
    const decrypted = await privacyManager.decryptNote(encrypted);
    expect(decrypted).toBe(originalNote);
    expect(encrypted).not.toBe(originalNote);
  });

  test('should detect excluded domains', () => {
    const excludeDomains = ['bank.com', 'health.gov'];
    expect(privacyManager.shouldExcludeTab('https://my.bank.com/account', excludeDomains)).toBe(true);
    expect(privacyManager.shouldExcludeTab('https://github.com/user/repo', excludeDomains)).toBe(false);
  });

  test('should extract domain from URL correctly', () => {
    expect(privacyManager.extractDomain('https://github.com/user/repo')).toBe('github.com');
    expect(privacyManager.extractDomain('https://sub.domain.example.com/path')).toBe('sub.domain.example.com');
  });
});