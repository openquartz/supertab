/**
 * RulesManager - 规则管理类
 * 负责规则的增删改查、拖拽排序、测试等功能
 */

class RulesManager {
    constructor() {
        this.rules = [];
        this.currentEditingRule = null;
        this.sortable = null;

        // DOM元素缓存
        this.elements = {
            rulesContainer: document.getElementById('rules-container'),
            ruleEditorModal: document.getElementById('rule-editor-modal'),
            testResultsModal: document.getElementById('test-results-modal'),
            addRuleBtn: document.getElementById('add-rule-btn'),
            closeBtn: document.getElementById('close-btn'),
            ruleEditorCloseBtn: document.getElementById('rule-editor-close-btn'),
            ruleEditorCancelBtn: document.getElementById('rule-editor-cancel-btn'),
            ruleEditorSaveBtn: document.getElementById('rule-editor-save-btn'),
            testRuleBtn: document.getElementById('test-rule-btn'),
            addConditionBtn: document.getElementById('add-condition-btn'),
            conditionsContainer: document.getElementById('conditions-container'),
            targetGroupSelect: document.getElementById('target-group-select'),
            customGroupInputContainer: document.getElementById('custom-group-input-container'),
            customGroupInput: document.getElementById('custom-group-input'),
            testResultsCloseBtn: document.getElementById('test-results-close-btn'),
            testResultsCloseFooterBtn: document.getElementById('test-results-close-footer-btn'),
            testResultsSummary: document.getElementById('test-results-summary'),
            testResultsList: document.getElementById('test-results-list'),
            conditionTemplate: document.getElementById('condition-template')
        };

        this.init();
    }

    /**
     * 初始化
     */
    async init() {
        this.bindEvents();
        await this.loadRules();
        this.renderRules();
        this.makeRulesSortable();
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 关闭按钮
        this.elements.closeBtn.addEventListener('click', () => {
            window.close();
        });

        // 添加规则
        this.elements.addRuleBtn.addEventListener('click', () => {
            this.showRuleEditor();
        });

        // 规则编辑器模态框
        this.elements.ruleEditorCloseBtn.addEventListener('click', () => {
            this.hideRuleEditor();
        });

        this.elements.ruleEditorCancelBtn.addEventListener('click', () => {
            this.hideRuleEditor();
        });

        this.elements.ruleEditorSaveBtn.addEventListener('click', () => {
            this.saveRule();
        });

        // 测试规则
        this.elements.testRuleBtn.addEventListener('click', () => {
            this.testRule();
        });

        // 模态框背景点击关闭
        this.elements.ruleEditorModal.querySelector('.tf-modal-backdrop').addEventListener('click', () => {
            this.hideRuleEditor();
        });

        // 添加条件
        this.elements.addConditionBtn.addEventListener('click', () => {
            this.addCondition();
        });

        // 目标分组选择
        this.elements.targetGroupSelect.addEventListener('change', () => {
            const isCustom = this.elements.targetGroupSelect.value === 'custom';
            this.elements.customGroupInputContainer.classList.toggle('tf-hidden', !isCustom);
        });

        // 测试结果模态框
        this.elements.testResultsCloseBtn.addEventListener('click', () => {
            this.hideTestResults();
        });

        this.elements.testResultsCloseFooterBtn.addEventListener('click', () => {
            this.hideTestResults();
        });

        this.elements.testResultsModal.querySelector('.tf-modal-backdrop').addEventListener('click', () => {
            this.hideTestResults();
        });

        // 条件容器事件委托
        this.elements.conditionsContainer.addEventListener('click', (e) => {
            if (e.target.closest('.tf-condition-remove-btn')) {
                const conditionItem = e.target.closest('.tf-condition-item');
                if (conditionItem) {
                    conditionItem.remove();
                }
            }
        });

        // ESC键关闭模态框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (!this.elements.ruleEditorModal.classList.contains('tf-hidden')) {
                    this.hideRuleEditor();
                }
                if (!this.elements.testResultsModal.classList.contains('tf-hidden')) {
                    this.hideTestResults();
                }
            }
        });
    }

    /**
     * 加载规则列表
     */
    async loadRules() {
        try {
            // 从存储中加载规则
            const result = await chrome.storage.sync.get(['tabRules']);
            this.rules = result.tabRules || [];
        } catch (error) {
            console.error('加载规则失败:', error);
            this.rules = [];
        }
    }

    /**
     * 渲染规则列表
     */
    renderRules() {
        if (this.rules.length === 0) {
            this.renderEmptyState();
            return;
        }

        const fragment = document.createDocumentFragment();

        this.rules.forEach((rule, index) => {
            const ruleElement = this.createRuleElement(rule, index);
            fragment.appendChild(ruleElement);
        });

        this.elements.rulesContainer.innerHTML = '';
        this.elements.rulesContainer.appendChild(fragment);
    }

    /**
     * 创建单个规则元素
     */
    createRuleElement(rule, index) {
        const ruleItem = document.createElement('div');
        ruleItem.className = 'tf-rule-item';
        ruleItem.dataset.ruleId = rule.id;
        ruleItem.dataset.index = index;

        // 生成条件预览文本
        const conditionsText = rule.conditions.map(condition => {
            return `${condition.field} ${this.getOperatorText(condition.operator)} "${condition.value}"`;
        }).join(' AND ');

        ruleItem.innerHTML = `
            <div class="tf-rule-header">
                <div class="tf-rule-info">
                    <div class="tf-rule-name">${this.escapeHtml(rule.name)}</div>
                    <div class="tf-rule-details">
                        <div class="tf-rule-detail-item">
                            <span class="tf-rule-detail-label">条件:</span>
                            <span class="tf-rule-detail-value">${rule.conditions.length}</span>
                        </div>
                        <div class="tf-rule-detail-item">
                            <span class="tf-rule-detail-label">目标:</span>
                            <span class="tf-rule-detail-value">${this.escapeHtml(rule.targetGroup)}</span>
                        </div>
                        <div class="tf-rule-detail-item">
                            <span class="tf-rule-detail-label">优先级:</span>
                            <span class="tf-rule-detail-value">${rule.priority}</span>
                        </div>
                    </div>
                </div>
                <div class="tf-rule-actions">
                    <div class="tf-rule-toggle">
                        <label class="tf-toggle">
                            <input type="checkbox" ${rule.enabled ? 'checked' : ''}>
                            <span class="tf-toggle-slider"></span>
                        </label>
                    </div>
                    <button class="tf-rule-btn edit-btn" title="编辑规则">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="tf-rule-btn delete-btn" title="删除规则">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                    <button class="tf-rule-btn drag-handle" title="拖拽排序">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="9" cy="12" r="1"/>
                            <circle cx="9" cy="5" r="1"/>
                            <circle cx="9" cy="19" r="1"/>
                            <circle cx="15" cy="12" r="1"/>
                            <circle cx="15" cy="5" r="1"/>
                            <circle cx="15" cy="19" r="1"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="tf-rule-content">
                <div class="tf-rule-conditions">
                    <h4>匹配条件</h4>
                    <div class="tf-condition-preview">${this.escapeHtml(conditionsText)}</div>
                </div>
            </div>
        `;

        // 绑定事件
        const toggle = ruleItem.querySelector('input[type="checkbox"]');
        toggle.addEventListener('change', () => {
            this.toggleRule(rule.id);
        });

        const editBtn = ruleItem.querySelector('.edit-btn');
        editBtn.addEventListener('click', () => {
            this.editRule(rule.id);
        });

        const deleteBtn = ruleItem.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => {
            this.deleteRule(rule.id);
        });

        return ruleItem;
    }

    /**
     * 渲染空状态
     */
    renderEmptyState() {
        this.elements.rulesContainer.innerHTML = `
            <div class="tf-rules-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 12l2 2 4-4"/>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
                <h3>还没有规则</h3>
                <p>创建规则来自动将标签页分组<br>基于URL、标题等条件</p>
                <button id="empty-add-rule-btn" class="tf-btn tf-btn-primary">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    <span>添加第一个规则</span>
                </button>
            </div>
        `;

        // 绑定空状态按钮事件
        const emptyAddBtn = this.elements.rulesContainer.querySelector('#empty-add-rule-btn');
        emptyAddBtn.addEventListener('click', () => {
            this.showRuleEditor();
        });
    }

    /**
     * 实现拖拽排序
     */
    makeRulesSortable() {
        if (this.sortable) {
            this.sortable.destroy();
        }

        const ruleItems = this.elements.rulesContainer.querySelectorAll('.tf-rule-item');
        if (ruleItems.length <= 1) return;

        const dragHandles = this.elements.rulesContainer.querySelectorAll('.drag-handle');

        dragHandles.forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                const ruleItem = handle.closest('.tf-rule-item');
                const startY = e.clientY;
                const startIndex = parseInt(ruleItem.dataset.index);

                ruleItem.classList.add('dragging');

                const onMouseMove = (e) => {
                    const deltaY = e.clientY - startY;
                    const items = Array.from(this.elements.rulesContainer.querySelectorAll('.tf-rule-item:not(.dragging)'));
                    const currentIndex = items.findIndex(item => {
                        const rect = item.getBoundingClientRect();
                        return e.clientY >= rect.top && e.clientY <= rect.bottom;
                    });

                    if (currentIndex !== -1 && currentIndex !== startIndex) {
                        // 移动元素
                        this.elements.rulesContainer.insertBefore(ruleItem, items[currentIndex]);
                        this.reorderRules(startIndex, currentIndex);
                    }
                };

                const onMouseUp = () => {
                    ruleItem.classList.remove('dragging');
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        });
    }

    /**
     * 显示规则编辑器
     */
    showRuleEditor(rule = null) {
        this.currentEditingRule = rule;

        // 清空表单
        this.elements.conditionsContainer.innerHTML = '';

        if (rule) {
            // 编辑现有规则
            document.getElementById('rule-name-input').value = rule.name;
            document.getElementById('rule-priority-input').value = rule.priority;
            document.getElementById('rule-enabled-toggle').checked = rule.enabled;

            // 设置目标分组
            this.elements.targetGroupSelect.value = rule.targetGroup;
            this.elements.targetGroupSelect.dispatchEvent(new Event('change'));

            if (rule.targetGroup === 'custom') {
                this.elements.customGroupInput.value = rule.customGroupName || '';
            }

            // 添加条件
            rule.conditions.forEach(condition => {
                this.addCondition(condition);
            });

            document.getElementById('rule-editor-modal-title').textContent = '编辑规则';
        } else {
            // 新建规则
            document.getElementById('rule-name-input').value = '';
            document.getElementById('rule-priority-input').value = '10';
            document.getElementById('rule-enabled-toggle').checked = true;

            this.elements.targetGroupSelect.value = '';
            this.elements.targetGroupSelect.dispatchEvent(new Event('change'));
            this.elements.customGroupInput.value = '';

            // 添加一个默认条件
            this.addCondition();

            document.getElementById('rule-editor-modal-title').textContent = '添加规则';
        }

        this.elements.ruleEditorModal.classList.remove('tf-hidden');
    }

    /**
     * 隐藏规则编辑器
     */
    hideRuleEditor() {
        this.elements.ruleEditorModal.classList.add('tf-hidden');
        this.currentEditingRule = null;
    }

    /**
     * 显示测试结果
     */
    showTestResults(results) {
        // 生成统计信息
        const totalTabs = results.length;
        const matchedTabs = results.filter(r => r.matched).length;
        const unmatchedTabs = totalTabs - matchedTabs;

        this.elements.testResultsSummary.innerHTML = `
            <div class="tf-test-result-stats">
                <div class="tf-test-stat-item">
                    <span class="tf-test-stat-label">总标签页数</span>
                    <span class="tf-test-stat-value">${totalTabs}</span>
                </div>
                <div class="tf-test-stat-item">
                    <span class="tf-test-stat-label">匹配的标签页</span>
                    <span class="tf-test-stat-value success">${matchedTabs}</span>
                </div>
                <div class="tf-test-stat-item">
                    <span class="tf-test-stat-label">未匹配的标签页</span>
                    <span class="tf-test-stat-value warning">${unmatchedTabs}</span>
                </div>
            </div>
        `;

        // 生成结果列表
        const resultsList = this.elements.testResultsList;
        resultsList.innerHTML = '';

        if (results.length === 0) {
            resultsList.innerHTML = `
                <div style="padding: 24px; text-align: center; color: var(--tf-text-muted);">
                    没有找到标签页进行测试
                </div>
            `;
        } else {
            results.forEach(result => {
                const resultItem = document.createElement('div');
                resultItem.className = 'tf-test-result-item';

                resultItem.innerHTML = `
                    <div class="tf-test-result-match ${result.matched ? 'match' : 'no-match'}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            ${result.matched ?
                                '<polyline points="20,6 9,17 4,12"></polyline>' :
                                '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>'
                            }
                        </svg>
                        ${result.matched ? '匹配' : '不匹配'}
                    </div>
                    <div class="tf-test-result-info">
                        <div class="tf-test-result-title">${this.escapeHtml(result.title)}</div>
                        <div class="tf-test-result-url">${this.escapeHtml(result.url)}</div>
                    </div>
                `;

                resultsList.appendChild(resultItem);
            });
        }

        this.elements.testResultsModal.classList.remove('tf-hidden');
    }

    /**
     * 隐藏测试结果
     */
    hideTestResults() {
        this.elements.testResultsModal.classList.add('tf-hidden');
    }

    /**
     * 添加条件项
     */
    addCondition(condition = null) {
        const template = this.elements.conditionTemplate;
        const clone = template.content.cloneNode(true);

        const conditionItem = clone.querySelector('.tf-condition-item');

        if (condition) {
            conditionItem.querySelector('.tf-condition-field').value = condition.field;
            conditionItem.querySelector('.tf-condition-operator').value = condition.operator;
            conditionItem.querySelector('.tf-condition-value').value = condition.value;
        }

        this.elements.conditionsContainer.appendChild(conditionItem);
    }

    /**
     * 获取表单数据
     */
    getFormData() {
        const name = document.getElementById('rule-name-input').value.trim();
        const priority = parseInt(document.getElementById('rule-priority-input').value) || 10;
        const enabled = document.getElementById('rule-enabled-toggle').checked;
        const targetGroup = this.elements.targetGroupSelect.value;
        const customGroupName = this.elements.customGroupInput.value.trim();

        // 获取所有条件
        const conditions = [];
        const conditionItems = this.elements.conditionsContainer.querySelectorAll('.tf-condition-item');

        conditionItems.forEach(item => {
            const field = item.querySelector('.tf-condition-field').value;
            const operator = item.querySelector('.tf-condition-operator').value;
            const value = item.querySelector('.tf-condition-value').value.trim();

            if (field && operator && value) {
                conditions.push({ field, operator, value });
            }
        });

        return {
            name,
            conditions,
            targetGroup,
            customGroupName,
            priority: Math.max(1, Math.min(100, priority)),
            enabled
        };
    }

    /**
     * 验证表单
     */
    validateForm(formData) {
        const errors = [];

        if (!formData.name) {
            errors.push('请输入规则名称');
        }

        if (formData.conditions.length === 0) {
            errors.push('请至少添加一个匹配条件');
        }

        if (!formData.targetGroup) {
            errors.push('请选择目标分组');
        }

        if (formData.targetGroup === 'custom' && !formData.customGroupName) {
            errors.push('请输入自定义分组名称');
        }

        return errors;
    }

    /**
     * 保存规则
     */
    async saveRule() {
        const formData = this.getFormData();
        const errors = this.validateForm(formData);

        if (errors.length > 0) {
            alert('表单验证失败:\n' + errors.join('\n'));
            return;
        }

        try {
            let rule;

            if (this.currentEditingRule) {
                // 编辑现有规则
                rule = {
                    ...this.currentEditingRule,
                    ...formData,
                    updatedAt: Date.now()
                };

                const index = this.rules.findIndex(r => r.id === this.currentEditingRule.id);
                if (index !== -1) {
                    this.rules[index] = rule;
                }
            } else {
                // 新建规则
                rule = {
                    id: Date.now().toString(),
                    ...formData,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                };

                this.rules.push(rule);
            }

            // 保存到存储
            await chrome.storage.sync.set({ tabRules: this.rules });

            // 刷新UI
            this.renderRules();
            this.makeRulesSortable();
            this.hideRuleEditor();
            await this.applyRulesToExistingTabs();

            console.log('规则保存成功:', rule);

        } catch (error) {
            console.error('保存规则失败:', error);
            alert('保存规则失败，请重试');
        }
    }

    /**
     * 测试规则
     */
    async testRule() {
        const formData = this.getFormData();
        const errors = this.validateForm(formData);

        if (errors.length > 0) {
            alert('表单验证失败:\n' + errors.join('\n'));
            return;
        }

        try {
            // 获取当前所有标签页
            const tabs = await chrome.tabs.query({ currentWindow: true });

            // 测试每个标签页
            const results = tabs.map(tab => {
                const matched = this.testTab(tab, formData.conditions);
                return {
                    id: tab.id,
                    title: tab.title,
                    url: tab.url,
                    matched
                };
            });

            this.showTestResults(results);

        } catch (error) {
            console.error('测试规则失败:', error);
            alert('测试规则失败，请重试');
        }
    }

    /**
     * 测试单个标签页
     */
    testTab(tab, conditions) {
        return conditions.every(condition => {
            const fieldValue = this.getFieldValue(tab, condition.field);
            return this.testCondition(fieldValue, condition.operator, condition.value);
        });
    }

    /**
     * 获取字段值
     */
    getFieldValue(tab, field) {
        switch (field) {
            case 'url':
                return tab.url || '';
            case 'title':
                return tab.title || '';
            case 'domain':
                try {
                    return new URL(tab.url).hostname || '';
                } catch {
                    return '';
                }
            case 'path':
                try {
                    return new URL(tab.url).pathname || '';
                } catch {
                    return '';
                }
            default:
                return '';
        }
    }

    /**
     * 测试条件
     */
    testCondition(fieldValue, operator, testValue) {
        const value = fieldValue.toLowerCase();
        const test = testValue.toLowerCase();

        switch (operator) {
            case 'contains':
                return value.includes(test);
            case 'equals':
                return value === test;
            case 'startsWith':
                return value.startsWith(test);
            case 'endsWith':
                return value.endsWith(test);
            case 'regex':
                try {
                    const regex = new RegExp(testValue, 'i');
                    return regex.test(fieldValue);
                } catch {
                    return false;
                }
            default:
                return false;
        }
    }

    /**
     * 切换规则状态
     */
    async toggleRule(ruleId) {
        const rule = this.rules.find(r => r.id === ruleId);
        if (!rule) return;

        rule.enabled = !rule.enabled;
        rule.updatedAt = Date.now();

        try {
            await chrome.storage.sync.set({ tabRules: this.rules });
            await this.applyRulesToExistingTabs();
            this.renderRules();
        } catch (error) {
            console.error('切换规则状态失败:', error);
        }
    }

    /**
     * 编辑规则
     */
    editRule(ruleId) {
        const rule = this.rules.find(r => r.id === ruleId);
        if (rule) {
            this.showRuleEditor(rule);
        }
    }

    /**
     * 删除规则
     */
    async deleteRule(ruleId) {
        if (!confirm('确定要删除这个规则吗？此操作不可撤销。')) {
            return;
        }

        try {
            this.rules = this.rules.filter(r => r.id !== ruleId);
            await chrome.storage.sync.set({ tabRules: this.rules });
            await this.applyRulesToExistingTabs();

            this.renderRules();
            this.makeRulesSortable();

        } catch (error) {
            console.error('删除规则失败:', error);
            alert('删除规则失败，请重试');
        }
    }

    /**
     * 重新排序规则
     */
    async reorderRules(fromIndex, toIndex) {
        if (fromIndex === toIndex) return;

        const [movedRule] = this.rules.splice(fromIndex, 1);
        this.rules.splice(toIndex, 0, movedRule);

        try {
            await chrome.storage.sync.set({ tabRules: this.rules });
            await this.applyRulesToExistingTabs();
            this.renderRules();
            this.makeRulesSortable();
        } catch (error) {
            console.error('重新排序规则失败:', error);
        }
    }

    async applyRulesToExistingTabs() {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'applyRulesToExistingTabs'
            });
            if (!response?.success) {
                console.warn('应用规则到现有标签页失败:', response?.error || 'unknown error');
            }
        } catch (error) {
            console.warn('触发规则应用失败:', error);
        }
    }

    /**
     * 获取操作符文本
     */
    getOperatorText(operator) {
        const operatorMap = {
            'contains': '包含',
            'equals': '等于',
            'startsWith': '开头是',
            'endsWith': '结尾是',
            'regex': '正则'
        };
        return operatorMap[operator] || operator;
    }

    /**
     * HTML转义
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

function bootstrapRulesManager() {
    // Prevent duplicate initialization when the page script is injected multiple times.
    if (window.rulesManager) {
        return;
    }

    // The rules UI may be injected dynamically after DOMContentLoaded has already fired.
    if (!document.getElementById('rules-container')) {
        return;
    }

    window.rulesManager = new RulesManager();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapRulesManager, { once: true });
} else {
    bootstrapRulesManager();
}
