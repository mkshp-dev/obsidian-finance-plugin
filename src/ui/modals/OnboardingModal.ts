// src/ui/modals/OnboardingModal.ts
import { App, Modal, Setting, Notice, TFile } from 'obsidian';
import type BeancountPlugin from '../../main';
import { DEMO_LEDGER_CONTENT } from '../../services/demo-ledger';
import { Logger } from '../../utils/logger';
import { createStructuredFolder, getMainLedgerPath, getDemoTransactionsForYear, migrateToStructuredLayout } from '../../utils/structuredLayout';
import { runQuery } from '../../utils/index';
import { ConfirmModal } from './ConfirmModal';

type DataChoice = 'demo' | 'existing';

export class OnboardingModal extends Modal {
    plugin: BeancountPlugin;
    
    // Choices
    private dataChoice: DataChoice | null = null;
    private existingFilePath: string = '';
    private structuredFolderName: string = 'Finances';

    constructor(app: App, plugin: BeancountPlugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        this.render();
    }

    private render() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: 'Welcome to Obsidian Finance' });
        contentEl.createEl('p', { 
            text: 'Choose your starting point. A structured folder layout will be created to organize your finances.',
            cls: 'setting-item-description'
        });

        // Option A: Demo Data
        const demoSection = contentEl.createDiv({ cls: 'onboarding-section' });
        demoSection.style.marginBottom = '20px';
        demoSection.style.padding = '15px';
        demoSection.style.border = '1px solid var(--background-modifier-border)';
        demoSection.style.borderRadius = '5px';
        
        const demoHeader = demoSection.createDiv({ cls: 'onboarding-option-header' });
        demoHeader.style.display = 'flex';
        demoHeader.style.alignItems = 'center';
        demoHeader.style.marginBottom = '10px';
        
        const demoRadio = demoHeader.createEl('input', { 
            type: 'radio',
            attr: { name: 'data-choice', value: 'demo' }
        });
        demoRadio.style.marginRight = '10px';
        demoRadio.checked = this.dataChoice === 'demo';
        demoRadio.onchange = () => {
            this.dataChoice = 'demo';
            this.render();
        };
        
        demoHeader.createEl('h3', { text: 'Start with Demo Data', cls: 'onboarding-option-title' });
        demoSection.createEl('p', { 
            text: 'Perfect for testing! We\'ll create sample accounts and transactions so you can explore the plugin features immediately.',
            cls: 'setting-item-description'
        });

        // Option B: Existing File
        const existingSection = contentEl.createDiv({ cls: 'onboarding-section' });
        existingSection.style.padding = '15px';
        existingSection.style.border = '1px solid var(--background-modifier-border)';
        existingSection.style.borderRadius = '5px';
        existingSection.style.marginBottom = '20px';
        
        const existingHeader = existingSection.createDiv({ cls: 'onboarding-option-header' });
        existingHeader.style.display = 'flex';
        existingHeader.style.alignItems = 'center';
        existingHeader.style.marginBottom = '10px';
        
        const existingRadio = existingHeader.createEl('input', { 
            type: 'radio',
            attr: { name: 'data-choice', value: 'existing' }
        });
        existingRadio.style.marginRight = '10px';
        existingRadio.checked = this.dataChoice === 'existing';
        existingRadio.onchange = () => {
            this.dataChoice = 'existing';
            this.render();
        };
        
        existingHeader.createEl('h3', { text: 'Use My Existing Ledger', cls: 'onboarding-option-title' });
        existingSection.createEl('p', { 
            text: 'Already have a Beancount file? Point us to it.',
            cls: 'setting-item-description'
        });

        // Show file path input if existing is selected
        if (this.dataChoice === 'existing') {
            // Get all .beancount files in the vault
            Logger.log('[Onboarding] Searching for .beancount files in vault...');
            const allFiles = this.app.vault.getFiles();
            Logger.log(`[Onboarding] Total files in vault: ${allFiles.length}`);
            
            const beancountFiles = allFiles
                .filter(file => {
                    const isBeancount = file.extension === 'beancount';
                    if (isBeancount) {
                        Logger.log(`[Onboarding] Found .beancount file: ${file.path} (extension: ${file.extension})`);
                    }
                    return isBeancount;
                })
                .map(file => file.path);
            
            Logger.log(`[Onboarding] Total .beancount files found: ${beancountFiles.length}`);
            Logger.log(`[Onboarding] Files: ${JSON.stringify(beancountFiles)}`);
            
            if (beancountFiles.length > 0) {
                // Show dropdown if there are .beancount files
                new Setting(existingSection)
                    .setName('Select Beancount file')
                    .setDesc('Choose from existing .beancount files in your vault')
                    .addDropdown(dropdown => {
                        dropdown.addOption('', '-- Select a file --');
                        beancountFiles.forEach(filePath => {
                            dropdown.addOption(filePath, filePath);
                        });
                        dropdown.setValue(this.existingFilePath);
                        dropdown.onChange(value => {
                            this.existingFilePath = value;
                        });
                    });
                
                // Also show manual input as fallback
                new Setting(existingSection)
                    .setName('Or enter path manually')
                    .setDesc('Absolute path to your .beancount file (if outside vault)')
                    .addText(text => text
                        .setPlaceholder('/path/to/your/ledger.beancount')
                        .setValue(this.existingFilePath)
                        .onChange(value => {
                            this.existingFilePath = value;
                        }));
            } else {
                // No .beancount files found, show only manual input
                existingSection.createEl('p', { 
                    text: 'No .beancount files found in vault.',
                    cls: 'setting-item-description',
                    attr: { style: 'color: var(--text-muted); font-style: italic; margin-bottom: 10px;' }
                });
                
                new Setting(existingSection)
                    .setName('Beancount file path')
                    .setDesc('Absolute path to your .beancount file')
                    .addText(text => text
                        .setPlaceholder('/path/to/your/ledger.beancount')
                        .setValue(this.existingFilePath)
                        .onChange(value => {
                            this.existingFilePath = value;
                        }));
            }
        }

        // Structured folder name setting
        const folderSection = contentEl.createDiv({ cls: 'onboarding-section' });
        folderSection.style.marginTop = '20px';
        folderSection.style.padding = '15px';
        folderSection.style.border = '1px solid var(--background-modifier-border)';
        folderSection.style.borderRadius = '5px';
        
        new Setting(folderSection)
            .setName('Structured folder name')
            .setDesc('Name of the folder where your organized finance files will be stored')
            .addText(text => text
                .setPlaceholder('Finances')
                .setValue(this.structuredFolderName)
                .onChange(value => {
                    this.structuredFolderName = value || 'Finances';
                }));

        // Setup button
        const buttonContainer = contentEl.createDiv({ cls: 'onboarding-buttons' });
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'flex-end';
        buttonContainer.style.marginTop = '20px';
        buttonContainer.style.gap = '10px';

        const setupBtn = buttonContainer.createEl('button', { text: 'Start Setup', cls: 'mod-cta' });
        setupBtn.onclick = async () => {
            if (!this.dataChoice) {
                new Notice('Please select an option');
                return;
            }
            
            if (this.dataChoice === 'existing' && !this.existingFilePath.trim()) {
                new Notice('Please enter the path to your existing file');
                return;
            }
            
            await this.handleFinish(setupBtn);
        };
    }

    private async handleFinish(buttonEl: HTMLButtonElement) {
        const originalText = buttonEl.textContent;
        buttonEl.textContent = 'Setting up...';
        buttonEl.disabled = true;

        try {
            // Always use structured layout
            if (this.dataChoice === 'demo') {
                await this.handleDemoStructured();
            } else if (this.dataChoice === 'existing') {
                await this.handleExistingStructured();
            }
        } catch (error) {
            Logger.error('Onboarding: Setup failed', error);
            new Notice('Setup failed. Check console for details.');
            buttonEl.textContent = originalText;
            buttonEl.disabled = false;
        }
    }

    private async handleDemoStructured() {
        Logger.log('Onboarding: Demo + Structured');
        
        try {
            // Create structured folder with demo data
            await createStructuredFolder(this.plugin, this.structuredFolderName, true);
            
            // Add demo transactions to current year
            const currentYear = new Date().getFullYear();
            const yearFilePath = `${this.structuredFolderName}/transactions/${currentYear}.beancount`;
            const yearFile = this.app.vault.getAbstractFileByPath(yearFilePath);
            
            if (yearFile && yearFile instanceof TFile) {
                const demoContent = getDemoTransactionsForYear(currentYear);
                await this.app.vault.modify(yearFile, demoContent);
            }
            
            // Update settings
            const mainLedgerPath = getMainLedgerPath(this.plugin);
            this.plugin.settings.useStructuredLayout = true;
            this.plugin.settings.structuredFolderName = this.structuredFolderName;
            this.plugin.settings.structuredFolderPath = mainLedgerPath;
            this.plugin.settings.beancountFilePath = mainLedgerPath;
            await this.plugin.saveSettings();
            
            new Notice(`✓ Created structured layout in ${this.structuredFolderName}/ with demo data`);
            Logger.log('Onboarding: Created demo structured layout');
            this.close();
        } catch (error: any) {
            // If folder/files already exist, configure settings to use them
            if (error.message && error.message.includes('already exists')) {
                Logger.log('Onboarding: Structured folder already exists, configuring to use it');
                const mainLedgerPath = getMainLedgerPath(this.plugin);
                this.plugin.settings.useStructuredLayout = true;
                this.plugin.settings.structuredFolderName = this.structuredFolderName;
                this.plugin.settings.structuredFolderPath = mainLedgerPath;
                this.plugin.settings.beancountFilePath = mainLedgerPath;
                await this.plugin.saveSettings();
                
                new Notice(`✓ Using existing structured layout in ${this.structuredFolderName}/`);
                Logger.log('Onboarding: Configured to use existing structured layout');
                this.close();
            } else {
                // Re-throw other errors
                throw error;
            }
        }
    }

    private async handleExistingStructured() {
        Logger.log('Onboarding: Existing + Structured - migrating');
        
        // Convert vault-relative path to absolute path if needed
        let absolutePath = this.existingFilePath;
        
        // Check if path is vault-relative (doesn't start with / or C:\ etc)
        if (!absolutePath.match(/^[a-zA-Z]:[\\\/]/) && !absolutePath.startsWith('/')) {
            // It's a vault-relative path, convert to absolute
            const file = this.app.vault.getAbstractFileByPath(absolutePath);
            if (file && file instanceof TFile) {
                // @ts-ignore
                absolutePath = this.app.vault.adapter.getFullPath(file.path);
                Logger.log(`[Onboarding] Converted vault path "${this.existingFilePath}" to absolute: "${absolutePath}"`);
            } else {
                Logger.error('[Onboarding] Could not find file in vault:', absolutePath);
                new Notice(`Could not find file: ${absolutePath}`);
                return;
            }
        }
        
        // Temporarily set the file path for migration (MUST set useStructuredLayout=false so queries read from source)
        this.plugin.settings.beancountFilePath = absolutePath;
        this.plugin.settings.useStructuredLayout = false;
        await this.plugin.saveSettings();
        
        Logger.log(`[Onboarding] Starting migration with file: ${absolutePath}`);
        
        // Perform migration
        const result = await migrateToStructuredLayout(this.plugin, this.structuredFolderName);
        
        if (result.success) {
            new Notice(`✓ Migrated to structured layout in ${this.structuredFolderName}/`);
            Logger.log('Onboarding: Migrated existing file to structured');
            this.close();
        } else {
            new Notice(`Migration failed: ${result.error}`);
            Logger.error('Onboarding: Migration failed', result.error);
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
