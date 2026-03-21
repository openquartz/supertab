class PrivacyManager {
  constructor() {
    this.encryptionKey = null;
    this.encryptionInitPromise = null;
    this.settings = {
      privacy: {
        encryptNotes: false,
        excludeDomains: [],
        autoCleanupDays: 30
      },
      ui: {
        collapsedGroups: [],
        defaultGrouping: 'domain'
      },
      preferences: {
        showFavicons: true,
        enableNotifications: true
      }
    };
    this._ready = this.initialize();
  }

  async initialize() {
    try {
      // Load settings from storage
      const stored = await this.getSettingsFromStorage();
      this.settings = this.mergeSettings(stored || {});

      // Initialize encryption if enabled
      if (this.settings.privacy?.encryptNotes) {
        await this.ensureEncryptionKey();
      }
      return true;
    } catch (error) {
      console.error('PrivacyManager initialization failed:', error);
      return false;
    }
  }

  async getSettingsFromStorage() {
    return new Promise((resolve) => {
      chrome.storage.local.get('tabflow:settings', (data) => {
        if (chrome.runtime?.lastError) {
          resolve(null);
          return;
        }
        resolve(data['tabflow:settings'] || null);
      });
    });
  }

  async getSettings() {
    await this.waitReady();
    return this.settings;
  }

  async updateSettings(newSettings) {
    await this.waitReady();
    this.settings = this.mergeSettings({
      ...this.settings,
      ...(newSettings || {}),
      privacy: {
        ...(this.settings.privacy || {}),
        ...((newSettings && newSettings.privacy) || {})
      },
      ui: {
        ...(this.settings.ui || {}),
        ...((newSettings && newSettings.ui) || {})
      },
      preferences: {
        ...(this.settings.preferences || {}),
        ...((newSettings && newSettings.preferences) || {})
      }
    });

    if (this.settings.privacy?.encryptNotes) {
      await this.ensureEncryptionKey();
    } else {
      this.encryptionKey = null;
    }

    return new Promise((resolve) => {
      chrome.storage.local.set({ 'tabflow:settings': this.settings }, () => {
        resolve(true);
      });
    });
  }

  shouldExcludeUrl(url) {
    return this.shouldExcludeTab(url, this.settings.privacy?.excludeDomains || []);
  }

  async processTabData(tab) {
    const processed = { ...tab };
    if (this.shouldExcludeUrl(tab.url)) {
      return null;
    }

    // Sanitize tab data
    if (processed.title) processed.title = this.sanitizeInput(processed.title);
    if (processed.note) processed.note = this.sanitizeInput(processed.note);
    return processed;
  }

  async processRetrievedTabData(tab) {
    const processed = { ...tab };
    // Decrypt note if encryption is enabled
    if (processed.note && this.settings.privacy?.encryptNotes) {
      try {
        processed.note = await this.decryptNote(processed.note);
      } catch (e) {
        console.warn('Failed to decrypt note:', e);
      }
    }
    return processed;
  }

  async initializeEncryption() {
    // Generate AES-GCM 256-bit encryption key for secure note storage
    // AES-GCM provides both confidentiality and integrity protection
    if (!globalThis.crypto?.subtle) {
      this.encryptionKey = null;
      console.warn('Encryption is unavailable in current context, fallback to plaintext notes');
      return false;
    }

    try {
      this.encryptionKey = await globalThis.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );
      return true;
    } catch (error) {
      this.encryptionKey = null;
      console.warn('Encryption initialization failed, fallback to plaintext notes');
      return false;
    }
  }

  async waitReady() {
    await this._ready;
  }

  mergeSettings(input = {}) {
    const defaults = {
      privacy: {
        encryptNotes: false,
        excludeDomains: [],
        autoCleanupDays: 30
      },
      ui: {
        collapsedGroups: [],
        defaultGrouping: 'domain'
      },
      preferences: {
        showFavicons: true,
        enableNotifications: true
      }
    };

    return {
      ...defaults,
      ...(input && typeof input === 'object' ? input : {}),
      privacy: {
        ...defaults.privacy,
        ...((input && input.privacy) || {})
      },
      ui: {
        ...defaults.ui,
        ...((input && input.ui) || {})
      },
      preferences: {
        ...defaults.preferences,
        ...((input && input.preferences) || {})
      }
    };
  }

  async ensureEncryptionKey() {
    if (!this.settings.privacy?.encryptNotes) {
      return false;
    }

    if (this.encryptionKey) {
      return true;
    }

    if (this.encryptionInitPromise) {
      return this.encryptionInitPromise;
    }

    this.encryptionInitPromise = (async () => {
      try {
        const initialized = await this.initializeEncryption();
        if (!initialized) {
          return false;
        }
        return Boolean(this.encryptionKey);
      } catch (error) {
        console.warn('Encryption key is unavailable, falling back to plaintext notes');
        return false;
      } finally {
        this.encryptionInitPromise = null;
      }
    })();

    return this.encryptionInitPromise;
  }

  async encryptNote(note) {
    if (!note) return '';

    try {
      await this.waitReady();
      if (!this.settings.privacy?.encryptNotes) {
        return note;
      }

      const ready = await this.ensureEncryptionKey();
      if (!ready || !this.encryptionKey) {
        return note;
      }

      const encoder = new TextEncoder();
      const data = encoder.encode(note);
      const iv = crypto.getRandomValues(new Uint8Array(12));

      const encrypted = await globalThis.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        this.encryptionKey,
        data
      );

      // Combine IV and encrypted data
      const result = new Uint8Array(iv.length + encrypted.byteLength);
      result.set(iv);
      result.set(new Uint8Array(encrypted), iv.length);

      return `enc:v1:${btoa(String.fromCharCode(...result))}`;
    } catch (error) {
      console.warn('Encryption operation skipped, storing plaintext note');
      return note;
    }
  }

  async decryptNote(encryptedNote) {
    if (!encryptedNote) return '';

    try {
      await this.waitReady();
      if (!this.settings.privacy?.encryptNotes) {
        return encryptedNote;
      }

      const ready = await this.ensureEncryptionKey();
      if (!ready || !this.encryptionKey) {
        return encryptedNote;
      }

      const encodedPayload = encryptedNote.startsWith('enc:v1:')
        ? encryptedNote.slice('enc:v1:'.length)
        : encryptedNote;

      if (!encryptedNote.startsWith('enc:v1:') && !this.isLikelyCipherText(encodedPayload)) {
        return encryptedNote;
      }

      const data = new Uint8Array(
        atob(encodedPayload).split('').map(char => char.charCodeAt(0))
      );
      if (data.length <= 12) {
        return encryptedNote;
      }

      const iv = data.slice(0, 12);
      const encrypted = data.slice(12);

      const decrypted = await globalThis.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        this.encryptionKey,
        encrypted
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.warn('Decryption failed, returning original note payload');
      return encryptedNote;
    }
  }

  isLikelyCipherText(value) {
    if (typeof value !== 'string' || value.length < 16) {
      return false;
    }
    if (value.length % 4 !== 0) {
      return false;
    }
    return /^[A-Za-z0-9+/]+=*$/.test(value);
  }

  shouldExcludeTab(url, excludeDomains) {
    if (!url || !excludeDomains || !Array.isArray(excludeDomains) || excludeDomains.length === 0) {
      return false;
    }

    const domain = this.extractDomain(url);
    if (!domain) return false;

    return excludeDomains.some(excluded => {
      return domain === excluded || domain.endsWith(`.${excluded}`);
    });
  }

  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      console.error('Invalid URL for domain extraction');
      return null;
    }
  }

  sanitizeInput(input) {
    if (typeof input !== 'string') return '';

    // Comprehensive XSS prevention
    let sanitized = input
      // Remove null bytes and control characters
      .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
      // Remove potential script tags and event handlers
      .replace(/<\s*script[^>]*>/gi, '')
      .replace(/<\/\s*script\s*>/gi, '')
      .replace(/\bon\w+\s*=/gi, ' data-removed-event=')
      .replace(/javascript\s*:/gi, 'javascript-blocked:')
      .replace(/vbscript\s*:/gi, 'vbscript-blocked:')
      .replace(/data\s*:/gi, 'data-blocked:')
      // HTML entity encoding
      .replace(/[<>&"']/g, char => {
        const entities = {
          '<': '&lt;',
          '>': '&gt;',
          '&': '&amp;',
          '"': '&quot;',
          "'": '&#x27;'
        };
        return entities[char] || char;
      });

    // Limit input length to prevent DoS
    if (sanitized.length > 10000) {
      sanitized = sanitized.substring(0, 10000);
    }

    return sanitized;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PrivacyManager;
}
