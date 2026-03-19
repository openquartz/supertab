class PrivacyManager {
  constructor() {
    this.encryptionKey = null;
    this.initializeEncryption();
  }

  async initializeEncryption() {
    try {
      this.encryptionKey = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );
    } catch (error) {
      console.error('Failed to initialize encryption:', error);
      throw new Error('Encryption initialization failed');
    }
  }

  async encryptNote(note) {
    if (!note) return '';

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(note);
      const iv = crypto.getRandomValues(new Uint8Array(12));

      const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        this.encryptionKey,
        data
      );

      // Combine IV and encrypted data
      const result = new Uint8Array(iv.length + encrypted.byteLength);
      result.set(iv);
      result.set(new Uint8Array(encrypted), iv.length);

      return btoa(String.fromCharCode(...result));
    } catch (error) {
      console.error('Encryption failed:', error);
      return note; // Return original if encryption fails
    }
  }

  async decryptNote(encryptedNote) {
    if (!encryptedNote) return '';

    try {
      const data = new Uint8Array(
        atob(encryptedNote).split('').map(char => char.charCodeAt(0))
      );

      const iv = data.slice(0, 12);
      const encrypted = data.slice(12);

      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        this.encryptionKey,
        encrypted
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.error('Decryption failed:', error);
      return encryptedNote; // Return original if decryption fails
    }
  }

  shouldExcludeTab(url, excludeDomains) {
    if (!url || !excludeDomains || excludeDomains.length === 0) {
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
      console.error('Invalid URL for domain extraction:', url);
      return null;
    }
  }

  sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    // Basic XSS prevention
    return input.replace(/[<>&"']/g, char => {
      const entities = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#x27;' };
      return entities[char] || char;
    });
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PrivacyManager;
}