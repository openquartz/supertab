/**
 * SuperTab Status Bar - Real-time status display for AI model and session info
 */

class SuperTabStatusBar {
  constructor() {
    this.container = null;
    this.isVisible = true;
    this.isCompact = false;
    this.currentModel = 'claude-opus-4-6';
    this.sessionSize = 0;
    this.sessionLimit = 100000; // tokens
    this.memoryUsage = 0;
    this.isConnected = true;
    this.connectionStatus = 'connected'; // connected, connecting, disconnected

    this.initialize();
  }

  initialize() {
    this.createStatusBar();
    this.updateAll();
    this.startPeriodicUpdates();
  }

  createStatusBar() {
    // Create main container
    this.container = document.createElement('div');
    this.container.className = 'supertab-status-bar';
    this.container.innerHTML = this.getHTML();

    // Add to document
    document.body.appendChild(this.container);

    // Add CSS
    this.injectCSS();
  }

  getHTML() {
    return `
      <div class="supertab-status-left">
        <div class="supertab-status-item">
          <div class="supertab-model-indicator">
            <div class="supertab-model-dot"></div>
            <span class="supertab-status-label">Model:</span>
            <span class="supertab-status-value supertab-model-name">${this.currentModel}</span>
          </div>
        </div>

        <div class="supertab-status-item supertab-progress-container">
          <span class="supertab-status-label">Session:</span>
          <div class="supertab-progress-bar">
            <div class="supertab-progress-fill" style="width: 0%"></div>
          </div>
          <span class="supertab-progress-text">0%</span>
        </div>

        <div class="supertab-status-item supertab-memory-indicator">
          <span class="supertab-status-label">Memory:</span>
          <div class="supertab-memory-bar">
            <div class="supertab-memory-fill" style="width: 0%"></div>
          </div>
          <span class="supertab-status-value supertab-memory-text">0%</span>
        </div>
      </div>

      <div class="supertab-status-right">
        <div class="supertab-status-item supertab-connection-status">
          <div class="supertab-connection-dot"></div>
          <span class="supertab-status-label">Connection</span>
        </div>

        <div class="supertab-status-item hide-on-mobile">
          <span class="supertab-status-label">Tokens:</span>
          <span class="supertab-status-value supertab-token-count">0</span>
          <span class="supertab-status-label">/</span>
          <span class="supertab-status-value supertab-token-limit">${this.formatNumber(this.sessionLimit)}</span>
        </div>

        <div class="supertab-status-item hide-on-mobile">
          <span class="supertab-status-label">Status:</span>
          <span class="supertab-status-value supertab-connection-text">Connected</span>
        </div>
      </div>
    `;
  }

  injectCSS() {
    if (document.getElementById('supertab-status-bar-css')) {
      return;
    }

    const link = document.createElement('link');
    link.id = 'supertab-status-bar-css';
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('ui/status-bar/status-bar.css');
    document.head.appendChild(link);
  }

  updateAll() {
    this.updateModel();
    this.updateSessionProgress();
    this.updateMemoryUsage();
    this.updateConnectionStatus();
    this.updateTokenCount();
  }

  updateModel(model = this.currentModel) {
    this.currentModel = model;
    const modelElement = this.container.querySelector('.supertab-model-name');
    if (modelElement) {
      modelElement.textContent = model;
      this.addUpdateAnimation(modelElement);
    }
  }

  updateSessionProgress(current = this.sessionSize, limit = this.sessionLimit) {
    this.sessionSize = current;
    this.sessionLimit = limit;

    const percentage = Math.min(100, (current / limit) * 100);
    const progressFill = this.container.querySelector('.supertab-progress-fill');
    const progressText = this.container.querySelector('.supertab-progress-text');

    if (progressFill) {
      progressFill.style.width = `${percentage}%`;

      // Color coding based on usage
      if (percentage > 80) {
        progressFill.style.background = 'linear-gradient(90deg, #FF3B30, #FF9500)';
      } else if (percentage > 60) {
        progressFill.style.background = 'linear-gradient(90deg, #FF9500, #FFCC00)';
      } else {
        progressFill.style.background = 'linear-gradient(90deg, #007AFF, #00C7FF)';
      }
    }

    if (progressText) {
      progressText.textContent = `${Math.round(percentage)}%`;
      this.addUpdateAnimation(progressText);
    }
  }

  updateMemoryUsage(usage = this.memoryUsage) {
    this.memoryUsage = usage;

    const memoryFill = this.container.querySelector('.supertab-memory-fill');
    const memoryText = this.container.querySelector('.supertab-memory-text');

    if (memoryFill) {
      const percentage = Math.min(100, usage);
      memoryFill.style.width = `${percentage}%`;
    }

    if (memoryText) {
      memoryText.textContent = `${Math.round(usage)}%`;
      this.addUpdateAnimation(memoryText);
    }
  }

  updateConnectionStatus(status = this.connectionStatus) {
    this.connectionStatus = status;

    const dot = this.container.querySelector('.supertab-connection-dot');
    const text = this.container.querySelector('.supertab-connection-text');

    if (dot) {
      dot.className = 'supertab-connection-dot';
      switch (status) {
        case 'connected':
          // Default styling is connected
          break;
        case 'connecting':
          dot.classList.add('connecting');
          break;
        case 'disconnected':
          dot.classList.add('disconnected');
          break;
      }
    }

    if (text) {
      const statusText = {
        'connected': 'Connected',
        'connecting': 'Connecting...',
        'disconnected': 'Disconnected'
      }[status] || 'Unknown';

      text.textContent = statusText;
      text.className = `supertab-status-value supertab-connection-text ${status}`;
      this.addUpdateAnimation(text);
    }
  }

  updateTokenCount(current = this.sessionSize, limit = this.sessionLimit) {
    const tokenCount = this.container.querySelector('.supertab-token-count');
    const tokenLimit = this.container.querySelector('.supertab-token-limit');

    if (tokenCount) {
      tokenCount.textContent = this.formatNumber(current);
      this.addUpdateAnimation(tokenCount);
    }

    if (tokenLimit) {
      tokenLimit.textContent = this.formatNumber(limit);
    }
  }

  addUpdateAnimation(element) {
    if (!element) return;

    element.classList.add('updating');
    setTimeout(() => {
      element.classList.remove('updating');
    }, 500);
  }

  formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  toggleCompactMode(compact = !this.isCompact) {
    this.isCompact = compact;
    this.container.classList.toggle('compact', compact);
  }

  show() {
    this.isVisible = true;
    this.container.classList.remove('hidden');
  }

  hide() {
    this.isVisible = false;
    this.container.classList.add('hidden');
  }

  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  startPeriodicUpdates() {
    // Simulate real-time updates
    setInterval(() => {
      // Simulate session growth
      this.sessionSize += Math.floor(Math.random() * 100);

      // Simulate memory usage fluctuation
      this.memoryUsage = Math.random() * 80 + 10; // 10-90%

      // Update display
      this.updateSessionProgress();
      this.updateMemoryUsage();
    }, 5000);

    // Connection status simulation
    setInterval(() => {
      if (Math.random() < 0.1) { // 10% chance
        const statuses = ['connected', 'connecting', 'disconnected'];
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
        this.updateConnectionStatus(randomStatus);
      }
    }, 30000);
  }

  // Public API methods
  setModel(model) {
    this.updateModel(model);
  }

  setSessionInfo(current, limit) {
    this.updateSessionProgress(current, limit);
  }

  setMemoryUsage(usage) {
    this.updateMemoryUsage(usage);
  }

  setConnectionStatus(status) {
    this.updateConnectionStatus(status);
  }

  setTokenCount(current, limit) {
    this.updateTokenCount(current, limit);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.supertabStatusBar = new SuperTabStatusBar();
  });
} else {
  window.supertabStatusBar = new SuperTabStatusBar();
}