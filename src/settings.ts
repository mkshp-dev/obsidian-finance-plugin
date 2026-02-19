// src/settings.ts

import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type BeancountPlugin from './main';
import ConnectionSettings from './ui/partials/settings/ConnectionSettings.svelte';

/**
 * Interface defining the plugin settings.
 */
export interface BeancountPluginSettings {
    /** Path to the main Beancount file. */
    beancountFilePath: string;
    /** Command to run Beancount/Python (e.g. "bean-query", "python3"). */
    beancountCommand: string;
    /** The primary currency for reporting and defaults. */
    operatingCurrency: string;
    /** Max transactions to fetch in the dashboard. */
    maxTransactionResults: number;
    /** Max entries to fetch in the journal. */
    maxJournalResults: number;
    // BQL Code Block Settings
    /** Whether to show tool buttons (copy, refresh) on query blocks. */
    bqlShowTools: boolean;
    /** Whether to show the query source code above results. */
    bqlShowQuery: boolean;
    // BQL Shorthand Template File
    /** Path to the markdown file defining BQL shortcuts. */
    bqlShorthandsTemplatePath: string;
    /** Whether to enable debug logging. */
    debugMode: boolean;
    // Backup Settings
    /** Whether to create backup files when modifying the beancount file. */
    createBackups: boolean;
    /** Maximum number of backup files to keep (0 = unlimited). */
    maxBackupFiles: number;
    // Structured Layout Settings
    /** Name of the folder for structured layout (e.g., "Finances"). */
    structuredFolderName: string;
    /** Computed absolute path to the structured folder (set automatically). */
    structuredFolderPath: string;
}

/**
 * Default settings for the plugin.
 */
export const DEFAULT_SETTINGS: BeancountPluginSettings = {
    beancountFilePath: '',
    beancountCommand: '',
    operatingCurrency: 'USD',
    maxTransactionResults: 2000,
    maxJournalResults: 1000,
    // BQL Code Block Settings
    bqlShowTools: true,
    bqlShowQuery: false,
    // BQL Shorthand Template File
    bqlShorthandsTemplatePath: '',
    debugMode: false,
    // Backup Settings
    createBackups: true,
    maxBackupFiles: 10,
    // Structured Layout Settings
    structuredFolderName: 'Finances',
    structuredFolderPath: ''
}

/**
 * BeancountSettingTab
 *
 * The settings tab for the plugin in Obsidian's settings modal.
 * Provides UI for configuring connection, currencies, limits, and templates.
 */
export class BeancountSettingTab extends PluginSettingTab {
    plugin: BeancountPlugin;
    private activeTab: string = 'general';

    constructor(app: App, plugin: BeancountPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;
        containerEl.empty();
        containerEl.createEl('h2', {text: 'Beancount Settings'});

        // Create tab navigation
        const tabsContainer = containerEl.createDiv({cls: 'beancount-settings-tabs'});
        const tabsNav = tabsContainer.createDiv({cls: 'beancount-tabs-nav'});
        const tabsContent = tabsContainer.createDiv({cls: 'beancount-tabs-content'});

        // Define tabs
        const tabs = [
            {id: 'general', label: '⚙️ General'},
            {id: 'connection', label: '🔌 Connection'},
            {id: 'files', label: '📁 File Organization'},
            {id: 'bql', label: '📊 BQL'},
            {id: 'performance', label: '⚡ Performance'},
            {id: 'backup', label: '💾 Backup'}
        ];

        // Create tab buttons
        tabs.forEach(tab => {
            const tabBtn = tabsNav.createDiv({cls: 'beancount-tab-button'});
            tabBtn.textContent = tab.label;
            if (this.activeTab === tab.id) {
                tabBtn.addClass('active');
            }
            tabBtn.addEventListener('click', () => {
                this.activeTab = tab.id;
                this.display();
            });
        });

        // Render active tab content
        switch (this.activeTab) {
            case 'general':
                this.renderGeneralTab(tabsContent);
                break;
            case 'connection':
                this.renderConnectionTab(tabsContent);
                break;
            case 'files':
                this.renderFilesTab(tabsContent);
                break;
            case 'bql':
                this.renderBQLTab(tabsContent);
                break;
            case 'performance':
                this.renderPerformanceTab(tabsContent);
                break;
            case 'backup':
                this.renderBackupTab(tabsContent);
                break;
        }

        // Add CSS styles
        this.addTabStyles();
    }

    private renderGeneralTab(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'General Settings' });

        new Setting(containerEl)
            .setName('Operating currency')
            .setDesc('The currency to use for transaction defaults and for consolidating totals (e.g., USD, INR).')
            .addText(text => {
                const validationEl = this.createValidationElement(containerEl);

                text
                    .setPlaceholder('USD')
                    .setValue(this.plugin.settings.operatingCurrency)
                    .onChange(async (value) => {
                        this.plugin.settings.operatingCurrency = value.toUpperCase();
                        await this.plugin.saveSettings();

                        if (value.trim()) {
                            const validation = this.validateCurrency(value);
                            this.updateValidationDisplay(validationEl, validation);
                        } else {
                            validationEl.textContent = '';
                        }

                        text.setValue(this.plugin.settings.operatingCurrency);
                    });

                if (this.plugin.settings.operatingCurrency) {
                    const validation = this.validateCurrency(this.plugin.settings.operatingCurrency);
                    this.updateValidationDisplay(validationEl, validation);
                }

                return text;
            });

        new Setting(containerEl)
            .setName('Debug mode')
            .setDesc('Enable debug logging to the console.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.debugMode)
                .onChange(async (value) => {
                    this.plugin.settings.debugMode = value;
                    await this.plugin.saveSettings();
                }));
    }

    private renderConnectionTab(containerEl: HTMLElement): void {
        this.createConnectionSection(containerEl);
    }

    private renderBQLTab(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'BQL Code Block Settings' });

        new Setting(containerEl)
            .setName('Show query tools')
            .setDesc('Display refresh, copy, and download buttons above BQL query results.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.bqlShowTools)
                .onChange(async (value) => {
                    this.plugin.settings.bqlShowTools = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Show query text')
            .setDesc('Display the BQL query text above the results in a collapsible section.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.bqlShowQuery)
                .onChange(async (value) => {
                    this.plugin.settings.bqlShowQuery = value;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h3', { text: 'BQL Shortcuts' });

        const templateSetting = new Setting(containerEl)
            .setName('Shortcuts template file')
            .setDesc('Path to markdown file containing BQL shortcut definitions. Leave empty to use defaults.');

        const filePickerContainer = templateSetting.controlEl.createDiv({ cls: 'bql-template-file-picker' });
        
        const textInput = filePickerContainer.createEl('input', {
            type: 'text',
            placeholder: 'e.g., BQL_Shortcuts.md',
            value: this.plugin.settings.bqlShorthandsTemplatePath
        });
        textInput.style.width = '300px';
        textInput.style.marginRight = '8px';
        
        this.setupFileAutocomplete(textInput);
        
        textInput.addEventListener('input', async (event) => {
            const value = (event.target as HTMLInputElement).value;
            this.plugin.settings.bqlShorthandsTemplatePath = value;
            await this.plugin.saveSettings();
        });
        
        const browseButton = filePickerContainer.createEl('button', {
            text: '📁 Browse',
            cls: 'mod-cta'
        });
        browseButton.style.marginRight = '8px';
        browseButton.addEventListener('click', () => {
            this.showFileSuggestModal(textInput);
        });
        
        const createButton = filePickerContainer.createEl('button', {
            text: '✨ Create Template',
        });
        createButton.addEventListener('click', async () => {
            const templatePath = this.plugin.settings.bqlShorthandsTemplatePath.trim();
            if (!templatePath) {
                new Notice('Please specify a template file path first');
                return;
            }
            
            const { ShorthandParser } = await import('./utils/shorthandParser');
            try {
                ShorthandParser.createDefaultTemplateFile(templatePath);
                new Notice(`Created template file: ${templatePath}`);
            } catch (error) {
                new Notice(`Error creating template file: ${error.message}`);
            }
        });
        
        containerEl.createEl('p', { 
            text: 'Use bql-sh:SHORTCUT in your notes to insert live financial data.',
            cls: 'setting-item-description' 
        });
    }

    private renderPerformanceTab(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Performance Settings' });

        new Setting(containerEl)
            .setName('Max transaction results')
            .setDesc('Maximum number of transactions to load at once (to prevent memory issues with large datasets).')
            .addText(text => text
                .setPlaceholder('2000')
                .setValue(this.plugin.settings.maxTransactionResults.toString())
                .onChange(async (value) => {
                    const numValue = parseInt(value);
                    if (!isNaN(numValue) && numValue > 0 && numValue <= 10000) {
                        this.plugin.settings.maxTransactionResults = numValue;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('Max journal results')
            .setDesc('Maximum number of journal entries to load at once.')
            .addText(text => text
                .setPlaceholder('1000')
                .setValue(this.plugin.settings.maxJournalResults.toString())
                .onChange(async (value) => {
                    const numValue = parseInt(value);
                    if (!isNaN(numValue) && numValue > 0 && numValue <= 5000) {
                        this.plugin.settings.maxJournalResults = numValue;
                        await this.plugin.saveSettings();
                    }
                }));
    }

    private renderBackupTab(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Backup Settings' });

        new Setting(containerEl)
            .setName('Create backups')
            .setDesc('Create timestamped backup files before modifying your Beancount file. Highly recommended for data safety.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.createBackups)
                .onChange(async (value) => {
                    this.plugin.settings.createBackups = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Max backup files')
            .setDesc('Maximum number of backup files to keep (oldest are deleted automatically). Set to 0 for unlimited backups.')
            .addText(text => text
                .setPlaceholder('10')
                .setValue(this.plugin.settings.maxBackupFiles.toString())
                .onChange(async (value) => {
                    const numValue = parseInt(value);
                    if (!isNaN(numValue) && numValue >= 0 && numValue <= 1000) {
                        this.plugin.settings.maxBackupFiles = numValue;
                        await this.plugin.saveSettings();
                    }
                }));
    }

    private renderFilesTab(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'File Organization' });
        
        containerEl.createEl('p', { 
            text: 'Your finances are organized using a structured folder layout with separate files for accounts, transactions, prices, and more.',
            cls: 'setting-item-description'
        });

        // Folder name setting
        new Setting(containerEl)
            .setName('Folder name')
            .setDesc('Name of the folder containing your structured Beancount files.')
            .addText(text => text
                .setPlaceholder('Finances')
                .setValue(this.plugin.settings.structuredFolderName)
                .onChange(async (value) => {
                    this.plugin.settings.structuredFolderName = value || 'Finances';
                    await this.plugin.saveSettings();
                }));

        // Display file structure info
        const infoDiv = containerEl.createDiv({ cls: 'structured-layout-info' });
        infoDiv.style.padding = '10px';
        infoDiv.style.marginTop = '10px';
        infoDiv.style.backgroundColor = 'var(--background-secondary)';
        infoDiv.style.borderRadius = '5px';
        
        infoDiv.createEl('strong', { text: 'Structured Layout File Organization:' });
        const fileList = infoDiv.createEl('ul');
        fileList.style.marginTop = '8px';
        fileList.style.marginBottom = '0';
        
        const files = [
            '📄 ledger.beancount - Main file with include statements',
            '📄 accounts.beancount - Account open/close directives',
            '📄 commodities.beancount - Commodity definitions',
            '📄 prices.beancount - Price directives',
            '📄 pads.beancount - Pad directives',
            '📄 balances.beancount - Balance assertions',
            '📄 notes.beancount - Note directives',
            '📄 events.beancount - Event directives',
            '📁 transactions/ - Folder with year-based transaction files (e.g., 2024.beancount, 2025.beancount)'
        ];
        
        files.forEach(file => {
            const li = fileList.createEl('li');
            li.style.marginBottom = '4px';
            li.textContent = file;
        });

        // Show current path
        if (this.plugin.settings.beancountFilePath) {
            const pathDiv = containerEl.createDiv({ cls: 'current-path-display' });
            pathDiv.style.marginTop = '15px';
            pathDiv.style.padding = '10px';
            pathDiv.style.backgroundColor = 'var(--background-modifier-border)';
            pathDiv.style.borderRadius = '5px';
            
            pathDiv.createEl('div', { 
                text: 'Main ledger file path:',
                cls: 'setting-item-name'
            });
            pathDiv.createEl('div', { 
                text: this.plugin.settings.beancountFilePath,
                cls: 'setting-item-description'
            }).style.fontFamily = 'monospace';
        }
    }

    private renderAdvancedTab(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Advanced Settings' });

        new Setting(containerEl)
            .setName('Debug mode')
            .setDesc('Enable detailed logging to the developer console for troubleshooting.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.debugMode)
                .onChange(async (value) => {
                    this.plugin.settings.debugMode = value;
                    await this.plugin.saveSettings();
                    const { Logger } = await import('./utils/logger');
                    Logger.setDebugMode(value);
                }));
    }

    private validateCurrency(currency: string): { isValid: boolean; message: string } {
        if (!currency.trim()) {
            return { isValid: false, message: 'Currency is required' };
        }

        const currencyRegex = /^[A-Z]{3}$/;
        if (!currencyRegex.test(currency.toUpperCase())) {
            return { isValid: false, message: 'Currency should be 3 letters (e.g., USD, EUR, INR)' };
        }

        return { isValid: true, message: '✅ Valid currency code' };
    }

    private createValidationElement(container: HTMLElement): HTMLElement {
        const validationEl = container.createEl('div', { 
            cls: 'beancount-validation-message',
            attr: { style: 'margin-top: 5px; font-size: 0.9em; opacity: 0.8;' }
        });
        return validationEl;
    }

    private updateValidationDisplay(element: HTMLElement, result: { isValid: boolean; message: string }) {
        element.textContent = result.message;
        element.style.color = result.isValid ? '#4CAF50' : '#f44336';
    }

    private createConnectionSection(containerEl: HTMLElement) {
        containerEl.createEl('h3', { text: 'Connection Configuration' });

        const desc = containerEl.createDiv({ cls: 'setting-item-description' });
        desc.style.marginBottom = '1em';
        desc.innerHTML = `
            <p>Configure your Beancount file path and connection settings. The plugin will automatically detect your Python environment and test the connection.</p>
        `;

        const settingsContainer = containerEl.createDiv({ cls: 'beancount-connection-settings-container' });

        new ConnectionSettings({
            target: settingsContainer,
            props: {
                plugin: this.plugin,
                settings: this.plugin.settings,
                app: this.app
            }
        });
    }

    private setupFileAutocomplete(input: HTMLInputElement) {
        let suggestionContainer: HTMLElement | null = null;
        
        const showSuggestions = (files: string[]) => {
            this.hideSuggestions();
            
            if (files.length === 0) return;
            
            suggestionContainer = document.createElement('div');
            suggestionContainer.className = 'bql-file-suggestions';
            suggestionContainer.style.cssText = `
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                background: var(--background-primary);
                border: 1px solid var(--background-modifier-border);
                border-radius: 6px;
                box-shadow: var(--shadow-s);
                max-height: 200px;
                overflow-y: auto;
                z-index: 1000;
            `;
            
            files.forEach((file, index) => {
                const item = document.createElement('div');
                item.className = 'bql-file-suggestion-item';
                item.textContent = file;
                item.style.cssText = `
                    padding: 8px 12px;
                    cursor: pointer;
                    border-bottom: 1px solid var(--background-modifier-border-hover);
                `;
                
                item.addEventListener('mouseenter', () => {
                    item.style.background = 'var(--background-modifier-hover)';
                });
                
                item.addEventListener('mouseleave', () => {
                    item.style.background = '';
                });
                
                item.addEventListener('click', () => {
                    input.value = file;
                    input.dispatchEvent(new Event('input'));
                    this.hideSuggestions();
                });
                
                if (index === files.length - 1) {
                    item.style.borderBottom = 'none';
                }
                
                suggestionContainer!.appendChild(item);
            });
            
            const inputRect = input.getBoundingClientRect();
            const parent = input.parentElement!;
            parent.style.position = 'relative';
            parent.appendChild(suggestionContainer);
        };
        
        this.hideSuggestions = () => {
            if (suggestionContainer) {
                suggestionContainer.remove();
                suggestionContainer = null;
            }
        };
        
        input.addEventListener('input', () => {
            const value = input.value.toLowerCase();
            if (value.length < 1) {
                this.hideSuggestions();
                return;
            }
            
            const markdownFiles = this.app.vault.getMarkdownFiles()
                .map(file => file.path)
                .filter(path => path.toLowerCase().includes(value))
                .slice(0, 10);
            
            showSuggestions(markdownFiles);
        });
        
        document.addEventListener('click', (event) => {
            if (!input.contains(event.target as Node) && !suggestionContainer?.contains(event.target as Node)) {
                this.hideSuggestions();
            }
        });
    }

    private hideSuggestions: () => void = () => {};

    private showFileSuggestModal(input: HTMLInputElement) {
        const modal = document.createElement('div');
        modal.className = 'bql-file-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-center: center;
            z-index: 9999;
        `;
        
        const modalContent = modal.createEl('div', {
            cls: 'bql-file-modal-content'
        });
        modalContent.style.cssText = `
            background: var(--background-primary);
            padding: 24px;
            border-radius: 8px;
            max-width: 600px;
            width: 90%;
            max-height: 80%;
            overflow-y: auto;
            border: 1px solid var(--background-modifier-border);
        `;
        
        modalContent.createEl('h3', { text: 'Select Template File' });
        
        const searchInput = modalContent.createEl('input', {
            type: 'text',
            placeholder: 'Search markdown files...'
        });
        searchInput.style.cssText = `
            width: 100%;
            padding: 8px;
            margin-bottom: 16px;
            border: 1px solid var(--background-modifier-border);
            border-radius: 4px;
            background: var(--background-secondary);
            color: var(--text-normal);
        `;
        
        const fileList = modalContent.createEl('div', {
            cls: 'bql-file-list'
        });
        fileList.style.cssText = `
            max-height: 300px;
            overflow-y: auto;
            border: 1px solid var(--background-modifier-border);
            border-radius: 4px;
        `;
        
        const updateFileList = (filter = '') => {
            fileList.empty();
            
            const markdownFiles = this.app.vault.getMarkdownFiles()
                .filter(file => filter === '' || file.path.toLowerCase().includes(filter.toLowerCase()))
                .slice(0, 50);
            
            if (markdownFiles.length === 0) {
                const noFiles = fileList.createEl('div', {
                    text: 'No markdown files found',
                    cls: 'bql-no-files'
                });
                noFiles.style.cssText = `
                    padding: 16px;
                    text-align: center;
                    color: var(--text-muted);
                    font-style: italic;
                `;
                return;
            }
            
            markdownFiles.forEach(file => {
                const item = fileList.createEl('div', {
                    text: file.path,
                    cls: 'bql-file-item'
                });
                item.style.cssText = `
                    padding: 8px 12px;
                    cursor: pointer;
                    border-bottom: 1px solid var(--background-modifier-border-hover);
                `;
                
                item.addEventListener('mouseenter', () => {
                    item.style.background = 'var(--background-modifier-hover)';
                });
                
                item.addEventListener('mouseleave', () => {
                    item.style.background = '';
                });
                
                item.addEventListener('click', () => {
                    input.value = file.path;
                    input.dispatchEvent(new Event('input'));
                    modal.remove();
                });
            });
        };
        
        updateFileList();
        
        searchInput.addEventListener('input', () => {
            updateFileList(searchInput.value);
        });
        
        const buttonContainer = modalContent.createEl('div');
        buttonContainer.style.cssText = `
            display: flex;
            justify-content: flex-end;
            margin-top: 16px;
            gap: 8px;
        `;
        
        const closeButton = buttonContainer.createEl('button', {
            text: 'Cancel'
        });
        closeButton.style.cssText = `
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            background: var(--interactive-normal);
            color: var(--text-normal);
            border: 1px solid var(--background-modifier-border);
        `;
        closeButton.addEventListener('click', () => {
            modal.remove();
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        document.body.appendChild(modal);
    }

    private addTabStyles() {
        // Check if styles already exist
        if (document.getElementById('beancount-tab-styles')) return;

        const style = document.createElement('style');
        style.id = 'beancount-tab-styles';
        style.textContent = `
            .beancount-settings-tabs {
                margin-top: 1em;
            }
            
            .beancount-tabs-nav {
                display: flex;
                gap: 4px;
                border-bottom: 2px solid var(--background-modifier-border);
                margin-bottom: 1.5em;
                flex-wrap: wrap;
            }
            
            .beancount-tab-button {
                padding: 8px 16px;
                cursor: pointer;
                border: none;
                background: transparent;
                color: var(--text-muted);
                font-size: 0.95em;
                transition: all 0.2s ease;
                border-bottom: 2px solid transparent;
                margin-bottom: -2px;
                user-select: none;
            }
            
            .beancount-tab-button:hover {
                color: var(--text-normal);
                background: var(--background-modifier-hover);
            }
            
            .beancount-tab-button.active {
                color: var(--text-accent);
                border-bottom-color: var(--text-accent);
                font-weight: 500;
            }
            
            .beancount-tabs-content {
                animation: fadeIn 0.2s ease;
            }
            
            @keyframes fadeIn {
                from {
                    opacity: 0;
                    transform: translateY(4px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `;
        document.head.appendChild(style);
    }
}
