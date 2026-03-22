// Bottom Panel JavaScript - Main functionality for bottom panel mode

class BottomPanel {
    constructor() {
        this.tabs = [];
        this.groups = [];
        this.selectedTabs = new Set();
        this.currentFilter = {
            group: 'all',
            sort: 'lastAccessed',
            search: ''
        };
        this.gridSize = 'medium'; // small, medium, large

        this.init();
    }

    async init() {
        await this.loadTabs();
        this.setupEventListeners();
        this.render();
        this.updateStats();
    }

    async loadTabs() {
        try {
            // Show loading state
            this.showLoadingState(true);

            // Query all tabs from current window
            const tabs = await chrome.tabs.query({ currentWindow: true });

            // Get stored notes and grouping data
            const storage = await chrome.storage.local.get(['tabNotes', 'tabGroups', 'groupRules']);
            const tabNotes = storage.tabNotes || {};
            const tabGroups = storage.tabGroups || {};
            const groupRules = storage.groupRules || [];

            // Process tabs with notes and group information
            this.tabs = tabs.map(tab => ({
                ...tab,
                note: tabNotes[tab.id] || '',
                groupId: this.determineGroup(tab, groupRules, tabGroups)
            }));

            // Generate groups based on current grouping strategy
            this.generateGroups();

        } catch (error) {
            console.error('Error loading tabs:', error);
        } finally {
            this.showLoadingState(false);
        }
    }

    determineGroup(tab, groupRules, tabGroups) {
        // Check if tab is already in a custom group
        if (tabGroups[tab.id]) {
            return tabGroups[tab.id];
        }

        // Apply automatic grouping rules
        for (const rule of groupRules) {
            if (this.matchesRule(tab, rule)) {
                return rule.groupId;
            }
        }

        // Default grouping by domain
        try {
            const url = new URL(tab.url);
            return `domain-${url.hostname}`;
        } catch {
            return 'domain-unknown';
        }
    }

    matchesRule(tab, rule) {
        switch (rule.type) {
            case 'domain':
                return tab.url.includes(rule.value);
            case 'title':
                return tab.title.toLowerCase().includes(rule.value.toLowerCase());
            case 'url':
                return tab.url.toLowerCase().includes(rule.value.toLowerCase());
            default:
                return false;
        }
    }

    generateGroups() {
        const groupMap = new Map();

        this.tabs.forEach(tab => {
            const groupId = tab.groupId;
            if (!groupMap.has(groupId)) {
                groupMap.set(groupId, {
                    id: groupId,
                    name: this.getGroupName(groupId),
                    tabs: []
                });
            }
            groupMap.get(groupId).tabs.push(tab);
        });

        this.groups = Array.from(groupMap.values());

        // Sort groups by tab count (descending)
        this.groups.sort((a, b) => b.tabs.length - a.tabs.length);
    }

    getGroupName(groupId) {
        if (groupId.startsWith('domain-')) {
            return groupId.replace('domain-', '');
        }
        if (groupId.startsWith('custom-')) {
            return groupId.replace('custom-', '');
        }
        return groupId;
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('bottom-search-input');
        const clearSearchBtn = document.getElementById('clear-search');

        searchInput.addEventListener('input', (e) => {
            this.currentFilter.search = e.target.value;
            this.render();
            clearSearchBtn.classList.toggle('tf-hidden', !e.target.value);
        });

        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            this.currentFilter.search = '';
            this.render();
            clearSearchBtn.classList.add('tf-hidden');
        });

        // Filter controls
        document.getElementById('group-filter').addEventListener('change', (e) => {
            this.currentFilter.group = e.target.value;
            this.render();
        });

        document.getElementById('sort-filter').addEventListener('change', (e) => {
            this.currentFilter.sort = e.target.value;
            this.render();
        });

        // Batch operations
        document.getElementById('select-all').addEventListener('click', () => {
            this.selectAll();
        });

        document.getElementById('select-none').addEventListener('click', () => {
            this.selectNone();
        });

        document.getElementById('batch-bookmark').addEventListener('click', () => {
            this.batchBookmark();
        });

        document.getElementById('batch-move').addEventListener('click', () => {
            this.showBatchMoveModal();
        });

        document.getElementById('batch-close').addEventListener('click', () => {
            this.batchClose();
        });

        // Grid size controls
        document.getElementById('grid-size-small').addEventListener('click', () => {
            this.setGridSize('small');
        });

        document.getElementById('grid-size-medium').addEventListener('click', () => {
            this.setGridSize('medium');
        });

        document.getElementById('grid-size-large').addEventListener('click', () => {
            this.setGridSize('large');
        });

        // Quick group switch
        document.getElementById('quick-group-switch').addEventListener('change', (e) => {
            document.getElementById('group-filter').value = e.target.value;
            this.currentFilter.group = e.target.value;
            this.render();
        });

        // Close and switch controls
        document.getElementById('close-bottom-panel').addEventListener('click', () => {
            this.closePanel();
        });

        document.getElementById('switch-to-sidebar').addEventListener('click', () => {
            this.switchToSidebar();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'a':
                        e.preventDefault();
                        this.selectAll();
                        break;
                    case 'd':
                        e.preventDefault();
                        this.selectNone();
                        break;
                    case 'f':
                        e.preventDefault();
                        document.getElementById('bottom-search-input').focus();
                        break;
                }
            }

            if (e.key === 'Escape') {
                this.selectNone();
            }

            if (e.key === 'Delete') {
                this.batchClose();
            }
        });

        // Context menu
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const card = e.target.closest('.tf-tab-card');
            if (card) {
                this.showContextMenu(e, card);
            }
        });

        // Click outside to close context menu
        document.addEventListener('click', () => {
            this.hideContextMenu();
        });
    }

    render() {
        const filteredTabs = this.getFilteredTabs();
        const grid = document.getElementById('tabs-grid');
        const emptyState = document.getElementById('empty-state');
        const emptyStateMessage = document.getElementById('empty-state-message');

        // Clear existing content
        grid.innerHTML = '';

        if (filteredTabs.length === 0) {
            // Show empty state
            emptyState.classList.remove('tf-hidden');
            if (this.currentFilter.search) {
                emptyStateMessage.textContent = `没有找到包含 "${this.currentFilter.search}" 的标签页`;
            } else if (this.currentFilter.group !== 'all') {
                emptyStateMessage.textContent = `当前分组下没有找到标签页`;
            } else {
                emptyStateMessage.textContent = '当前窗口没有打开的标签页';
            }
            return;
        }

        emptyState.classList.add('tf-hidden');

        // Render tab cards
        filteredTabs.forEach(tab => {
            const card = this.createTabCard(tab);
            grid.appendChild(card);
        });

        this.updateBatchToolbar();
    }

    getFilteredTabs() {
        let filtered = [...this.tabs];

        // Apply search filter
        if (this.currentFilter.search) {
            const searchTerm = this.currentFilter.search.toLowerCase();
            filtered = filtered.filter(tab =>
                tab.title.toLowerCase().includes(searchTerm) ||
                tab.url.toLowerCase().includes(searchTerm) ||
                tab.note.toLowerCase().includes(searchTerm)
            );
        }

        // Apply group filter
        if (this.currentFilter.group !== 'all') {
            switch (this.currentFilter.group) {
                case 'domain':
                    // Show all domain groups, no additional filtering needed
                    break;
                case 'date':
                    // Group by date - implement date grouping logic
                    break;
                case 'custom':
                    filtered = filtered.filter(tab => tab.groupId.startsWith('custom-'));
                    break;
                case 'session':
                    // Group by session - implement session grouping logic
                    break;
            }
        }

        // Apply sorting
        filtered.sort((a, b) => {
            switch (this.currentFilter.sort) {
                case 'title':
                    return a.title.localeCompare(b.title);
                case 'url':
                    return a.url.localeCompare(b.url);
                case 'created':
                    return b.id - a.id; // Assuming newer tabs have higher IDs
                case 'lastAccessed':
                default:
                    return b.lastAccessed - a.lastAccessed;
            }
        });

        return filtered;
    }

    createTabCard(tab) {
        const template = document.getElementById('tab-card-template');
        const card = template.content.cloneNode(true).querySelector('.tf-tab-card');

        // Set tab data
        card.dataset.tabId = tab.id;
        card.dataset.tabUrl = tab.url;

        // Set favicon
        const favicon = card.querySelector('.tf-tab-favicon img');
        favicon.src = tab.favIconUrl || '';
        favicon.alt = tab.title;

        // Set content
        card.querySelector('.tf-tab-title').textContent = tab.title || '无标题';
        const noteEl = card.querySelector('.tf-tab-note');
        if (tab.note) {
            noteEl.textContent = tab.note;
            noteEl.classList.remove('tf-hidden');
        } else {
            noteEl.classList.add('tf-hidden');
        }

        // Selection state
        if (this.selectedTabs.has(tab.id)) {
            card.classList.add('selected');
            card.querySelector('.tf-card-select-btn').classList.add('selected');
        }

        // Event listeners
        card.addEventListener('click', (e) => {
            if (e.ctrlKey || e.metaKey) {
                this.toggleTabSelection(tab.id);
            } else if (e.shiftKey && this.lastSelectedTab) {
                this.selectRange(this.lastSelectedTab, tab.id);
            } else {
                this.selectTab(tab.id);
            }
        });

        card.addEventListener('dblclick', () => {
            this.openTab(tab.id);
        });

        // Action buttons
        const selectBtn = card.querySelector('.tf-card-select-btn');
        selectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleTabSelection(tab.id);
        });

        card.querySelector('[data-action="open"]').addEventListener('click', (e) => {
            e.stopPropagation();
            this.openTab(tab.id);
        });

        card.querySelector('[data-action="note"]').addEventListener('click', (e) => {
            e.stopPropagation();
            this.addNote(tab.id);
        });

        card.querySelector('[data-action="close"]').addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeTab(tab.id);
        });

        return card;
    }

    selectTab(tabId) {
        this.selectedTabs.clear();
        this.selectedTabs.add(tabId);
        this.lastSelectedTab = tabId;
        this.render();
    }

    toggleTabSelection(tabId) {
        if (this.selectedTabs.has(tabId)) {
            this.selectedTabs.delete(tabId);
        } else {
            this.selectedTabs.add(tabId);
        }
        this.lastSelectedTab = tabId;
        this.render();
    }

    selectAll() {
        const filteredTabs = this.getFilteredTabs();
        filteredTabs.forEach(tab => this.selectedTabs.add(tab.id));
        this.render();
    }

    selectNone() {
        this.selectedTabs.clear();
        this.render();
    }

    selectRange(startTabId, endTabId) {
        const filteredTabs = this.getFilteredTabs();
        const startIndex = filteredTabs.findIndex(tab => tab.id === startTabId);
        const endIndex = filteredTabs.findIndex(tab => tab.id === endTabId);

        if (startIndex !== -1 && endIndex !== -1) {
            const [min, max] = [Math.min(startIndex, endIndex), Math.max(startIndex, endIndex)];
            for (let i = min; i <= max; i++) {
                this.selectedTabs.add(filteredTabs[i].id);
            }
        }
        this.render();
    }

    updateBatchToolbar() {
        const count = this.selectedTabs.size;
        const selectionCount = document.getElementById('selection-count');
        const batchActions = ['select-none', 'batch-bookmark', 'batch-move', 'batch-close'];

        selectionCount.textContent = `已选择 ${count} 个标签页`;

        batchActions.forEach(actionId => {
            const btn = document.getElementById(actionId);
            btn.classList.toggle('tf-hidden', count === 0);
        });
    }

    updateStats() {
        const totalTabs = this.tabs.length;
        const totalGroups = this.groups.length;

        document.getElementById('total-tabs').textContent = `共 ${totalTabs} 个标签页`;
        document.getElementById('total-groups').textContent = `${totalGroups} 个分组`;

        // Update quick group switch options
        const quickSwitch = document.getElementById('quick-group-switch');
        quickSwitch.innerHTML = '<option value="all">所有标签页</option>';

        this.groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = `${group.name} (${group.tabs.length})`;
            quickSwitch.appendChild(option);
        });
    }

    setGridSize(size) {
        this.gridSize = size;
        const grid = document.getElementById('tabs-grid');

        // Remove existing size classes
        grid.classList.remove('grid-size-small', 'grid-size-medium', 'grid-size-large');
        grid.classList.add(`grid-size-${size}`);

        // Update active button
        document.querySelectorAll('.tf-view-controls .tf-btn-icon').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById(`grid-size-${size}`).classList.add('active');
    }

    async openTab(tabId) {
        try {
            await chrome.tabs.update(tabId, { active: true });
            this.closePanel();
        } catch (error) {
            console.error('Error opening tab:', error);
        }
    }

    async closeTab(tabId) {
        try {
            await chrome.tabs.remove(tabId);
            this.selectedTabs.delete(tabId);
            await this.loadTabs(); // Reload tabs
            this.render();
        } catch (error) {
            console.error('Error closing tab:', error);
        }
    }

    async batchClose() {
        if (this.selectedTabs.size === 0) return;

        if (!confirm(`确定要关闭选中的 ${this.selectedTabs.size} 个标签页吗？`)) {
            return;
        }

        try {
            await chrome.tabs.remove([...this.selectedTabs]);
            this.selectedTabs.clear();
            await this.loadTabs(); // Reload tabs
            this.render();
        } catch (error) {
            console.error('Error closing tabs:', error);
        }
    }

    async batchBookmark() {
        if (this.selectedTabs.size === 0) return;

        try {
            const tabs = this.tabs.filter(tab => this.selectedTabs.has(tab.id));
            const folderName = `SuperTab 批量收藏 ${new Date().toLocaleDateString()}`;

            // Create bookmark folder
            const folder = await chrome.bookmarks.create({
                title: folderName,
                parentId: '1' // Bookmarks bar
            });

            // Add bookmarks
            for (const tab of tabs) {
                await chrome.bookmarks.create({
                    title: tab.title,
                    url: tab.url,
                    parentId: folder.id
                });
            }

            alert(`已将 ${tabs.length} 个标签页添加到收藏夹`);
        } catch (error) {
            console.error('Error creating bookmarks:', error);
            alert('创建收藏夹失败');
        }
    }

    showBatchMoveModal() {
        if (this.selectedTabs.size === 0) return;

        const modal = document.getElementById('batch-move-modal');
        const groupList = document.getElementById('batch-move-group-list');

        // Generate group options
        groupList.innerHTML = '';
        this.groups.forEach(group => {
            const option = document.createElement('div');
            option.className = 'tf-group-option';
            option.textContent = `${group.name} (${group.tabs.length})`;
            option.dataset.groupId = group.id;
            option.addEventListener('click', () => {
                option.classList.add('selected');
            });
            groupList.appendChild(option);
        });

        // Setup confirm button
        const confirmBtn = document.getElementById('batch-move-confirm');
        confirmBtn.onclick = () => {
            const selectedGroup = groupList.querySelector('.selected');
            if (selectedGroup) {
                this.batchMoveToGroup(selectedGroup.dataset.groupId);
                modal.classList.add('tf-hidden');
            }
        };

        // Show modal
        modal.classList.remove('tf-hidden');
    }

    async batchMoveToGroup(groupId) {
        try {
            const storage = await chrome.storage.local.get(['tabGroups']);
            const tabGroups = storage.tabGroups || {};

            // Update group assignments
            this.selectedTabs.forEach(tabId => {
                tabGroups[tabId] = groupId;
            });

            await chrome.storage.local.set({ tabGroups });
            this.selectedTabs.clear();
            await this.loadTabs();
            this.render();
        } catch (error) {
            console.error('Error moving tabs to group:', error);
        }
    }

    addNote(tabId) {
        const tab = this.tabs.find(t => t.id === tabId);
        if (!tab) return;

        const note = prompt('添加备注:', tab.note || '');
        if (note !== null) {
            this.saveNote(tabId, note);
        }
    }

    async saveNote(tabId, note) {
        try {
            const storage = await chrome.storage.local.get(['tabNotes']);
            const tabNotes = storage.tabNotes || {};
            tabNotes[tabId] = note;
            await chrome.storage.local.set({ tabNotes });

            // Update local data
            const tab = this.tabs.find(t => t.id === tabId);
            if (tab) {
                tab.note = note;
            }

            this.render();
        } catch (error) {
            console.error('Error saving note:', error);
        }
    }

    showContextMenu(e, card) {
        const menu = document.getElementById('context-menu');
        const rect = card.getBoundingClientRect();

        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;
        menu.classList.remove('tf-hidden');

        // Setup menu actions
        menu.querySelectorAll('.tf-context-item').forEach(item => {
            item.onclick = () => {
                const action = item.dataset.action;
                const tabId = parseInt(card.dataset.tabId);
                this.handleContextMenuAction(action, tabId);
                this.hideContextMenu();
            };
        });
    }

    hideContextMenu() {
        const menu = document.getElementById('context-menu');
        menu.classList.add('tf-hidden');
    }

    handleContextMenuAction(action, tabId) {
        switch (action) {
            case 'open':
                this.openTab(tabId);
                break;
            case 'open-new':
                chrome.tabs.create({ url: this.tabs.find(t => t.id === tabId)?.url });
                break;
            case 'bookmark':
                this.bookmarkTab(tabId);
                break;
            case 'note':
                this.addNote(tabId);
                break;
            case 'move':
                this.moveToGroup(tabId);
                break;
            case 'duplicate':
                this.duplicateTab(tabId);
                break;
            case 'close':
                this.closeTab(tabId);
                break;
        }
    }

    async bookmarkTab(tabId) {
        const tab = this.tabs.find(t => t.id === tabId);
        if (!tab) return;

        try {
            await chrome.bookmarks.create({
                title: tab.title,
                url: tab.url,
                parentId: '1'
            });
            alert('已添加到收藏夹');
        } catch (error) {
            console.error('Error bookmarking tab:', error);
        }
    }

    async duplicateTab(tabId) {
        const tab = this.tabs.find(t => t.id === tabId);
        if (!tab) return;

        try {
            await chrome.tabs.create({ url: tab.url });
        } catch (error) {
            console.error('Error duplicating tab:', error);
        }
    }

    moveToGroup(tabId) {
        // Similar to batch move but for single tab
        this.selectedTabs.clear();
        this.selectedTabs.add(tabId);
        this.showBatchMoveModal();
    }

    showLoadingState(show) {
        const loadingState = document.getElementById('loading-state');
        const gridContainer = document.querySelector('.tf-tabs-grid-container');

        if (show) {
            loadingState.classList.remove('tf-hidden');
            gridContainer.style.opacity = '0.5';
        } else {
            loadingState.classList.add('tf-hidden');
            gridContainer.style.opacity = '1';
        }
    }

    closePanel() {
        // Hide bottom panel - implementation depends on how it's integrated
        window.close(); // For popup/separate window
    }

    switchToSidebar() {
        // Switch to sidebar mode
        chrome.storage.local.set({ groupDisplayMode: 'sidebar' }, () => {
            // Close bottom panel and open sidebar
            this.closePanel();
            chrome.runtime.sendMessage({ action: 'openSidebar' });
        });
    }
}

// Initialize bottom panel when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new BottomPanel();
});