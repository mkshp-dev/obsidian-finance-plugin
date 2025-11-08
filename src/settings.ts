// src/settings.ts

import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type BeancountPlugin from './main';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { resolve } from 'path';
import ConnectionSettings from './components/ConnectionSettings.svelte';

const execAsync = promisify(exec);



export interface BeancountPluginSettings {
    beancountFilePath: string;
    beancountCommand: string;
    defaultCurrency: string;
    reportingCurrency: string;
    maxTransactionResults: number;
    maxJournalResults: number;
    // BQL Code Block Settings
    bqlShowTools: boolean;
    bqlShowQuery: boolean;
    // BQL Shorthand Template File
    bqlShorthandsTemplatePath: string;
}

export const DEFAULT_SETTINGS: BeancountPluginSettings = {
    beancountFilePath: '',
    beancountCommand: '',
    defaultCurrency: 'USD',
    reportingCurrency: 'INR',
    maxTransactionResults: 2000,
    maxJournalResults: 1000,
    // BQL Code Block Settings
    bqlShowTools: true,
    bqlShowQuery: false,
    // BQL Shorthand Template File
    bqlShorthandsTemplatePath: ''
}

export class BeancountSettingTab extends PluginSettingTab {
    plugin: BeancountPlugin;

    constructor(app: App, plugin: BeancountPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }





    /**
     * Validates if the beancount file path exists and is accessible
     */
    private validateFilePath(filePath: string): { isValid: boolean; message: string } {
        if (!filePath.trim()) {
            return { isValid: false, message: 'File path is required' };
        }

        try {
            const resolvedPath = resolve(filePath);
            if (!existsSync(resolvedPath)) {
                return { isValid: false, message: 'File does not exist' };
            }

            // Check if it's a .beancount file
            if (!filePath.toLowerCase().endsWith('.beancount') && !filePath.toLowerCase().endsWith('.bean')) {
                return { isValid: false, message: 'File should have .beancount or .bean extension' };
            }

            return { isValid: true, message: '✅ Valid file path' };
        } catch (error) {
            return { isValid: false, message: 'Invalid file path format' };
        }
    }

    /**
     * Validates if the beancount command is available
     */
    private async validateCommand(command: string): Promise<{ isValid: boolean; message: string }> {
        if (!command.trim()) {
            return { isValid: false, message: 'Command is required' };
        }

        try {
            // Test if command exists by running with --help
            const testCommand = command.includes('wsl') ? 
                `${command} --help` : 
                `"${command}" --help`;
            
            await execAsync(testCommand, { timeout: 5000 });
            return { isValid: true, message: '✅ Command is available' };
        } catch (error) {
            if (error.code === 'ENOENT' || error.message.includes('not found') || error.message.includes('not recognized')) {
                return { isValid: false, message: 'Command not found in PATH' };
            } else if (error.killed) {
                return { isValid: false, message: 'Command timeout (>5s)' };
            } else {
                // If it fails with other errors but the command exists, it might still be valid
                // (e.g., bean-query might exit with error code when called with --help)
                return { isValid: true, message: '⚠️ Command found (but returned error)' };
            }
        }
    }

    /**
     * Creates a validation display element
     */
    private createValidationElement(container: HTMLElement): HTMLElement {
        const validationEl = container.createEl('div', { 
            cls: 'beancount-validation-message',
            attr: { style: 'margin-top: 5px; font-size: 0.9em; opacity: 0.8;' }
        });
        return validationEl;
    }

    /**
     * Updates validation message display
     */
    private updateValidationDisplay(element: HTMLElement, result: { isValid: boolean; message: string }) {
        element.textContent = result.message;
        element.style.color = result.isValid ? '#4CAF50' : '#f44336';
    }

    /**
     * Validates currency code format
     */
    private validateCurrency(currency: string): { isValid: boolean; message: string } {
        if (!currency.trim()) {
            return { isValid: false, message: 'Currency is required' };
        }

        // Check if it's a valid 3-letter currency code
        const currencyRegex = /^[A-Z]{3}$/;
        if (!currencyRegex.test(currency.toUpperCase())) {
            return { isValid: false, message: 'Currency should be 3 letters (e.g., USD, EUR, INR)' };
        }

        return { isValid: true, message: '✅ Valid currency code' };
    }

    display(): void {
        const {containerEl} = this;
        containerEl.empty();
        containerEl.createEl('h2', {text: 'Beancount Settings'});

        // --- Enhanced Connection Settings ---
        this.createConnectionSection(containerEl);

        // --- Transaction Form Settings ---
        containerEl.createEl('h3', { text: 'Transaction Form' });

        new Setting(containerEl)
            .setName('Default currency')
            .setDesc('The default currency to use in the transaction form.')
            .addText(text => {
                const validationEl = this.createValidationElement(containerEl);
                
                text
                    .setPlaceholder('USD')
                    .setValue(this.plugin.settings.defaultCurrency)
                    .onChange(async (value) => {
                        this.plugin.settings.defaultCurrency = value.toUpperCase();
                        await this.plugin.saveSettings();
                        
                        // Real-time validation
                        if (value.trim()) {
                            const validation = this.validateCurrency(value);
                            this.updateValidationDisplay(validationEl, validation);
                        } else {
                            validationEl.textContent = '';
                        }
                        
                        // Update the input field to show uppercase
                        text.setValue(this.plugin.settings.defaultCurrency);
                    });

                // Initial validation
                if (this.plugin.settings.defaultCurrency) {
                    const validation = this.validateCurrency(this.plugin.settings.defaultCurrency);
                    this.updateValidationDisplay(validationEl, validation);
                }
                
                return text;
            });
        
        new Setting(containerEl)
            .setName('Reporting Currency')
            .setDesc('The currency to consolidate all totals into (e.g., USD, INR). You must have "price" entries for this to work.')
            .addText(text => {
                const validationEl = this.createValidationElement(containerEl);
                
                text
                    .setPlaceholder('USD')
                    .setValue(this.plugin.settings.reportingCurrency)
                    .onChange(async (value) => {
                        this.plugin.settings.reportingCurrency = value.toUpperCase();
                        await this.plugin.saveSettings();
                        
                        // Real-time validation
                        if (value.trim()) {
                            const validation = this.validateCurrency(value);
                            this.updateValidationDisplay(validationEl, validation);
                        } else {
                            validationEl.textContent = '';
                        }
                        
                        // Update the input field to show uppercase
                        text.setValue(this.plugin.settings.reportingCurrency);
                    });

                // Initial validation
                if (this.plugin.settings.reportingCurrency) {
                    const validation = this.validateCurrency(this.plugin.settings.reportingCurrency);
                    this.updateValidationDisplay(validationEl, validation);
                }
                
                return text;
            });

        // --- Performance Settings ---
        containerEl.createEl('h3', { text: 'Performance' });

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

        // --- BQL Code Block Settings ---
        containerEl.createEl('h3', { text: 'BQL Code Blocks' });

        new Setting(containerEl)
            .setName('Show query tools')
            .setDesc('Display refresh, copy, and download buttons above BQL query results. When disabled, only a clean table is shown.')
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

        // --- BQL Shorthand Template File ---
        containerEl.createEl('h3', { text: 'BQL Shortcuts Template' });

        const templateSetting = new Setting(containerEl)
            .setName('Shortcuts template file')
            .setDesc('Path to markdown file containing BQL shortcut definitions. Leave empty to use defaults.');

        // Create a container for the file picker components
        const filePickerContainer = templateSetting.controlEl.createDiv({ cls: 'bql-template-file-picker' });
        
        // Create text input with autocomplete
        const textInput = filePickerContainer.createEl('input', {
            type: 'text',
            placeholder: 'e.g., BQL_Shortcuts.md or /full/path/to/file.md',
            value: this.plugin.settings.bqlShorthandsTemplatePath
        });
        textInput.style.width = '300px';
        textInput.style.marginRight = '8px';
        
        // Add autocomplete functionality
        this.setupFileAutocomplete(textInput);
        
        // Handle text input changes
        textInput.addEventListener('input', async (event) => {
            const value = (event.target as HTMLInputElement).value;
            this.plugin.settings.bqlShorthandsTemplatePath = value;
            await this.plugin.saveSettings();
        });
        
        // Browse button for file selection
        const browseButton = filePickerContainer.createEl('button', {
            text: '📁 Browse',
            cls: 'mod-cta'
        });
        browseButton.style.marginRight = '8px';
        browseButton.addEventListener('click', () => {
            this.showFileSuggestModal(textInput);
        });
        
        // Create Template button
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
            text: 'Use bql-sh:SHORTCUT in your notes to insert live financial data. Edit the template file to customize shortcuts.',
            cls: 'setting-item-description' 
        });
    }

    /**
     * Set up file autocomplete for the template file input
     */
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
            
            // Position container relative to input
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
        
        // Setup input event listener for autocomplete
        input.addEventListener('input', () => {
            const value = input.value.toLowerCase();
            if (value.length < 1) {
                this.hideSuggestions();
                return;
            }
            
            // Get markdown files from vault
            const markdownFiles = this.app.vault.getMarkdownFiles()
                .map(file => file.path)
                .filter(path => path.toLowerCase().includes(value))
                .slice(0, 10); // Limit to 10 suggestions
            
            showSuggestions(markdownFiles);
        });
        
        // Hide suggestions when clicking outside
        document.addEventListener('click', (event) => {
            if (!input.contains(event.target as Node) && !suggestionContainer?.contains(event.target as Node)) {
                this.hideSuggestions();
            }
        });
        
        // Handle keyboard navigation
        input.addEventListener('keydown', (event) => {
            if (!suggestionContainer) return;
            
            const items = Array.from(suggestionContainer.querySelectorAll('.bql-file-suggestion-item'));
            const activeIndex = items.findIndex(item => item.classList.contains('active'));
            
            switch (event.key) {
                case 'ArrowDown':
                    event.preventDefault();
                    const nextIndex = activeIndex < items.length - 1 ? activeIndex + 1 : 0;
                    this.setActiveSuggestion(items, nextIndex);
                    break;
                    
                case 'ArrowUp':
                    event.preventDefault();
                    const prevIndex = activeIndex > 0 ? activeIndex - 1 : items.length - 1;
                    this.setActiveSuggestion(items, prevIndex);
                    break;
                    
                case 'Enter':
                    event.preventDefault();
                    if (activeIndex >= 0) {
                        (items[activeIndex] as HTMLElement).click();
                    }
                    break;
                    
                case 'Escape':
                    this.hideSuggestions();
                    break;
            }
        });
    }

    private hideSuggestions: () => void = () => {};

    private setActiveSuggestion(items: Element[], index: number) {
        items.forEach((item, i) => {
            item.classList.toggle('active', i === index);
            if (i === index) {
                item.scrollIntoView({ block: 'nearest' });
            }
        });
    }

    /**
     * Show a file suggestion modal with all markdown files
     */
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
            justify-content: center;
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
                .slice(0, 50); // Limit to 50 files
            
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
        
        // Initial file list
        updateFileList();
        
        // Search functionality
        searchInput.addEventListener('input', () => {
            updateFileList(searchInput.value);
        });
        
        // Close button
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
            border: 1px solid var(--background-modifier-border);
            background: var(--interactive-normal);
            color: var(--text-normal);
            cursor: pointer;
        `;
        closeButton.addEventListener('click', () => modal.remove());
        
        // Close on background click
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.remove();
            }
        });
        
        document.body.appendChild(modal);
        searchInput.focus();
    }

    /**
     * Show a modal to pick a .beancount or .bean file from the current vault
     */
    private showVaultBeancountPicker() {
        const modal = document.createElement('div');
        modal.className = 'beancount-vault-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        `;

        const content = modal.createEl('div', { cls: 'beancount-vault-modal-content' });
        content.style.cssText = `
            background: var(--background-primary);
            padding: 20px;
            border-radius: 8px;
            width: 90%;
            max-width: 700px;
            max-height: 80%;
            overflow-y: auto;
            border: 1px solid var(--background-modifier-border);
        `;

        content.createEl('h3', { text: 'Select Beancount File in Vault' });

        const list = content.createEl('div', { cls: 'beancount-file-list' });
        list.style.cssText = `max-height: 400px; overflow-y: auto; border: 1px solid var(--background-modifier-border); border-radius: 4px;`;

        // Gather files from vault with .beancount or .bean extensions
        const allFiles = this.app.vault.getFiles();
        const beancountFiles = allFiles.filter(f => f.path.toLowerCase().endsWith('.beancount') || f.path.toLowerCase().endsWith('.bean'));

        if (beancountFiles.length === 0) {
            list.createEl('div', { text: 'No .beancount/.bean files found in this vault', cls: 'beancount-no-files' });
        } else {
            beancountFiles.forEach(file => {
                const item = list.createEl('div', { text: file.path, cls: 'beancount-file-item' });
                item.style.cssText = `padding: 8px 12px; cursor: pointer; border-bottom: 1px solid var(--background-modifier-border-hover);`;
                item.addEventListener('mouseenter', () => item.style.background = 'var(--background-modifier-hover)');
                item.addEventListener('mouseleave', () => item.style.background = '');
                item.addEventListener('click', async () => {
                    // Compute absolute path by combining vault base path and relative path
                    // @ts-ignore
                    const vaultBase: string = (this.app.vault.adapter as any).getBasePath();
                    // Normalize separators to forward slashes and remove trailing slash from vaultBase
                    const baseNormalized = vaultBase.replace(/\\/g, '/').replace(/\/$/, '');
                    const rel = file.path.replace(/\\/g, '/');
                    const absolutePath = `${baseNormalized}/${rel}`;
                    this.plugin.settings.beancountFilePath = absolutePath;
                    await this.plugin.saveSettings();
                    // Update the visible input element in settings (if present)
                    const inputEl = document.getElementById('beancount-file-input') as HTMLInputElement | null;
                    if (inputEl) {
                        inputEl.value = absolutePath;
                        // Trigger the input event so the existing onChange handler updates validation
                        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    modal.remove();
                });
            });
        }

        const btnRow = content.createEl('div');
        btnRow.style.cssText = 'display:flex; justify-content:flex-end; gap:8px; margin-top:12px;';
        const cancel = btnRow.createEl('button', { text: 'Cancel' });
        cancel.addEventListener('click', () => modal.remove());

        document.body.appendChild(modal);
    }

    /**
     * Show command suggestion modal with detected beancount commands
     */
    private async showCommandSuggestionModal(suggestions: string[]) {
        const modal = document.createElement('div');
        modal.className = 'beancount-command-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        `;

        const content = modal.createEl('div', { cls: 'beancount-command-modal-content' });
        content.style.cssText = `
            background: var(--background-primary);
            padding: 20px;
            border-radius: 8px;
            width: 90%;
            max-width: 700px;
            max-height: 80%;
            overflow-y: auto;
            border: 1px solid var(--background-modifier-border);
        `;

        content.createEl('h3', { text: 'Detected Beancount Commands' });
        content.createEl('p', { 
            text: 'Select a command that works on your system:', 
            cls: 'setting-item-description' 
        });

        const list = content.createEl('div', { cls: 'beancount-command-list' });
        list.style.cssText = `max-height: 400px; overflow-y: auto; border: 1px solid var(--background-modifier-border); border-radius: 4px; margin: 12px 0;`;

        if (suggestions.length === 0) {
            list.createEl('div', { 
                text: 'No beancount commands detected. Please install beancount and ensure it\'s in your PATH.', 
                cls: 'beancount-no-commands',
                attr: { style: 'padding: 20px; text-align: center; color: var(--text-muted);' }
            });
        } else {
            for (const [index, suggestion] of suggestions.entries()) {
                const item = list.createEl('div', { cls: 'beancount-command-item' });
                item.style.cssText = `
                    display: flex; 
                    align-items: center; 
                    padding: 12px; 
                    cursor: pointer; 
                    border-bottom: 1px solid var(--background-modifier-border-hover);
                    gap: 12px;
                `;

                const radio = item.createEl('input', { type: 'radio', attr: { name: 'beancount-command', value: suggestion } });
                if (index === 0) radio.checked = true;

                const label = item.createEl('label', { 
                    text: suggestion,
                    attr: { style: 'flex: 1; cursor: pointer; font-family: var(--font-monospace);' }
                });

                const testBtn = item.createEl('button', { 
                    text: 'Test',
                    attr: { style: 'padding: 4px 8px; font-size: 0.8em;' }
                });

                label.addEventListener('click', () => {
                    radio.checked = true;
                });

                testBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    testBtn.textContent = 'Testing...';
                    testBtn.disabled = true;

                    try {
                        const { SystemDetector } = await import('./utils/SystemDetector');
                        const detector = SystemDetector.getInstance();
                        const result = await detector.testCommand(`${suggestion} --help`);
                        
                        if (result.success) {
                            testBtn.textContent = '✅ Works';
                            testBtn.style.color = 'var(--text-success)';
                        } else {
                            testBtn.textContent = '❌ Failed';
                            testBtn.style.color = 'var(--text-error)';
                            testBtn.title = result.error || 'Command failed';
                        }
                    } catch (error) {
                        testBtn.textContent = '❌ Error';
                        testBtn.style.color = 'var(--text-error)';
                        testBtn.title = error.message;
                    } finally {
                        testBtn.disabled = false;
                    }
                });

                item.addEventListener('mouseenter', () => item.style.background = 'var(--background-modifier-hover)');
                item.addEventListener('mouseleave', () => item.style.background = '');
            }
        }

        const btnRow = content.createEl('div');
        btnRow.style.cssText = 'display:flex; justify-content:flex-end; gap:8px; margin-top:12px;';
        
        const cancelBtn = btnRow.createEl('button', { text: 'Cancel' });
        const useBtn = btnRow.createEl('button', { text: 'Use Selected', cls: 'mod-cta' });

        cancelBtn.addEventListener('click', () => modal.remove());
        
        useBtn.addEventListener('click', () => {
            const selected = list.querySelector('input[name="beancount-command"]:checked') as HTMLInputElement;
            if (selected) {
                this.plugin.settings.beancountCommand = selected.value;
                this.plugin.saveSettings();
                
                // Update the input element if it exists
                const inputEl = document.getElementById('beancount-command-input') as HTMLInputElement | null;
                if (inputEl) {
                    inputEl.value = selected.value;
                    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                }
                
                new Notice(`Command set to: ${selected.value}`);
                modal.remove();
            }
        });

        document.body.appendChild(modal);
    }

    /**
     * Create the enhanced connection section with Svelte component
     */
    private createConnectionSection(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Connection' });
        
        // Create container for the Svelte component
        const connectionContainer = containerEl.createEl('div', {
            cls: 'connection-settings-container'
        });

        // Create and mount the Svelte component
        const connectionSettings = new ConnectionSettings({
            target: connectionContainer,
            props: {
                plugin: this.plugin
            }
        });

        // Listen for settings changes from the component
        connectionSettings.$on('settingsChanged', (event) => {
            // Settings changed - no additional action needed
        });

        // Store reference for cleanup (if needed)
        (containerEl as any)._connectionSettings = connectionSettings;
    }


}