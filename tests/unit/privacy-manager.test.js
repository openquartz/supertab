const PrivacyManager = require('../../utils/privacy-manager');

describe('PrivacyManager', () => {
  let privacyManager;

  beforeEach(async () => {
    privacyManager = new PrivacyManager();
    await privacyManager.waitReady();
    // Enable encryption for testing
    privacyManager.settings.privacy.encryptNotes = true;
    await privacyManager.initializeEncryption();
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

  test('should deep-merge settings update and keep defaults', async () => {
    await privacyManager.updateSettings({
      privacy: {
        excludeDomains: ['example.com']
      }
    });

    const settings = await privacyManager.getSettings();
    expect(settings.privacy.excludeDomains).toEqual(['example.com']);
    expect(settings.privacy.encryptNotes).toBe(true);
    expect(settings.ui.defaultGrouping).toBe('domain');
  });

  test('should not throw or return empty when encryption key is unavailable', async () => {
    privacyManager.settings.privacy.encryptNotes = true;
    privacyManager.encryptionKey = null;
    privacyManager.initializeEncryption = jest.fn().mockRejectedValue(new Error('No crypto'));

    const original = 'fallback note';
    const encrypted = await privacyManager.encryptNote(original);
    const decrypted = await privacyManager.decryptNote('not-encrypted-text');

    expect(encrypted).toBe(original);
    expect(decrypted).toBe('not-encrypted-text');
  });
});
