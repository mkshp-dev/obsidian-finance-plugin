// src/settings.ts

import { App, PluginSettingTab, Setting, Notice, TFolder } from 'obsidian';
import type BeancountPlugin from './main';
import ConnectionSettings from './ui/partials/settings/ConnectionSettings.svelte';
import { updateOperatingCurrency } from './utils/index';
import type { LintMode } from './lang/beancount-lint';
import { Logger } from './utils/logger';


/**
 * Interface defining the plugin settings.


 */
export type FileOrganization = "yearly" | "monthly";
export type DashboardDefaultPeriod = "this-month" | "last-month" | "this-year" | "last-year";

export interface BeancountPluginSettings {
    /** Command to run Beancount/Python (e.g. "bean-query", "python3"). */
    beancountCommand: string;
    /** The primary currency for reporting and defaults. */
    operatingCurrency: string;
    /** Max transactions to fetch in the dashboard. */
    maxTransactionResults: number;
    /** Max entries to fetch in the journal. */
    maxJournalResults: number;
    /** Default period shown by dashboard period summaries. */
    dashboardDefaultPeriod: DashboardDefaultPeriod;
    // BQL Code Block Settings
    /** Whether to show tool buttons (copy, refresh) on query blocks. */
    bqlShowTools: boolean;
    /** Whether to show the query source code above results. */
    bqlShowQuery: boolean;
    /** Whether to enable debug logging. */
    debugMode: boolean;
    // Backup Settings
    /** Whether to create backup files when modifying the beancount file. */
    createBackups: boolean;
    // Structured Layout Settings
    /** Name of the folder for structured layout (e.g., "Finances"). */
    structuredFolderName: string;
    /** How to organize transaction files. */
    fileOrganization: FileOrganization;
    // Price Fetching Settings
    /** Whether to enable automatic price fetching on a schedule. */
    autoPriceFetch: boolean;
    /** Interval in hours for automatic price fetching. */
    priceFetchIntervalHours: number;
    /** Timestamp of last automatic price fetch. */
    lastAutoPriceFetch: number;
    /** Bean-price command path (detected automatically). */
    beanPriceCommand: string;
    /** Whether to enable account-name autocomplete in the Beancount editor. */
    accountAutocomplete: boolean;
    /** Whether to enable user-defined transaction snippets. */
    enableUserSnippets: boolean;
    /** Whether to format the Beancount file on every save (Format on save). */
    formatOnSave: boolean;
    /** Lint mode for inline bean-check diagnostics: 'off' | 'on-save' | 'on-change'. */
    lintMode: LintMode;
    /** Whether the user has completed the onboarding wizard. */
    onboardingCompleted: boolean;
}

/**
 * Default settings for the plugin.
 */
export const DEFAULT_SETTINGS: BeancountPluginSettings = {
    beancountCommand: '',
    operatingCurrency: 'USD',
    maxTransactionResults: 2000,
    maxJournalResults: 1000,
    dashboardDefaultPeriod: 'this-month',
    // BQL Code Block Settings
    bqlShowTools: true,
    bqlShowQuery: false,
    debugMode: false,
    // Backup Settings
    createBackups: true,
    // Structured Layout Settings
    structuredFolderName: 'Finances',
    fileOrganization: 'yearly',
    // Price Fetching Settings
    autoPriceFetch: false,
    priceFetchIntervalHours: 24,
    lastAutoPriceFetch: 0,
    beanPriceCommand: '',
    // Editor Settings
    accountAutocomplete: true,
    enableUserSnippets: false,
    formatOnSave: false,
    lintMode: 'on-save',
    onboardingCompleted: false,
}

/**
 * BeancountSettingTab
 *
 * The settings tab for the plugin in Obsidian's settings modal.
 * Provides UI for configuring connection, currencies, limits, and templates.
 */
export class BeancountSettingTab extends PluginSettingTab {
    plugin: BeancountPlugin;
    private activeTab = 'general';
    private isEditingFolderName = false;
    private tempFolderName = '';

    constructor(app: App, plugin: BeancountPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    getSettingDefinitions(): Record<string, { name: string; description: string }> {
        return {
            operatingCurrency: { name: 'Operating currency', description: 'The currency to use for transaction defaults and for consolidating totals.' },
            dashboardDefaultPeriod: { name: 'Default dashboard period', description: 'Choose the period shown by dashboard summaries when the dashboard first loads.' },
            structuredFolderName: { name: 'Base folder name', description: 'The name of the root folder in your vault where Beancount files will be stored.' },
            fileOrganization: { name: 'File organization', description: 'How transactions should be split into separate files.' },
            accountAutocomplete: { name: 'Editor autocomplete', description: 'Show context-aware completions in .beancount files.' },
            enableUserSnippets: { name: 'User-defined snippets', description: 'Enable user-defined transaction snippets loaded from snippets.beancount.' },
            formatOnSave: { name: 'Format on save', description: 'Automatically format the Beancount file when saving.' },
            lintMode: { name: 'Inline lint mode', description: 'Show Beancount validation errors as inline squiggly underlines.' },
            bqlShowTools: { name: 'Show query tools', description: 'Display refresh, copy, and download buttons above BQL query results.' },
            bqlShowQuery: { name: 'Show query text', description: 'Display the BQL query text above the results in a collapsible section.' },
            maxTransactionResults: { name: 'Max transaction results', description: 'Maximum number of transactions to load at once.' },
            maxJournalResults: { name: 'Max journal results', description: 'Maximum number of journal entries to load at once.' },
            createBackups: { name: 'Create backups', description: 'Create a backup file before modifying your Beancount file.' }
        };
    }

    display(): void {
        this.displayTab();
    }

    displayTab(): void {
        const { containerEl } = this;
        containerEl.empty();
        new Setting(containerEl).setName('Beancount configuration').setHeading();

        // Create tab navigation
        const tabsContainer = containerEl.createDiv({ cls: 'beancount-settings-tabs' });
        const tabsNav = tabsContainer.createDiv({ cls: 'beancount-tabs-nav' });
        const tabsContent = tabsContainer.createDiv({ cls: 'beancount-tabs-content' });

        // Define tabs
        const tabs = [
            { id: 'general', label: '⚙️ General' },
            { id: 'connection', label: '🔌 Connection' },
            { id: 'files', label: '📁 File Organization' },
            { id: 'editor', label: '📝 Editor' },
            { id: 'bql', label: '📊 BQL' },
            { id: 'performance', label: '⚡ Performance' }
        ];

        // Create tab buttons
        tabs.forEach(tab => {
            const tabBtn = tabsNav.createDiv({ cls: 'beancount-tab-button' });
            tabBtn.textContent = tab.label;
            if (this.activeTab === tab.id) {
                tabBtn.addClass('active');
            }
            tabBtn.addEventListener('click', () => {
                this.activeTab = tab.id;
                this.displayTab();
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
            case 'editor':
                this.renderEditorTab(tabsContent);
                break;
            case 'bql':
                this.renderBQLTab(tabsContent);
                break;
            case 'performance':
                this.renderPerformanceTab(tabsContent);
                break;
        }


    }

    private renderGeneralTab(containerEl: HTMLElement): void {
        new Setting(containerEl).setName('Basic preferences').setHeading();

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
            })
            .addButton(button => button
                .setButtonText('Save to ledger')
                .setTooltip('Update the operating_currency option in your ledger.beancount file')
                .onClick(async () => {
                    const currency = this.plugin.settings.operatingCurrency;
                    if (!currency) {
                        new Notice('Operating currency is not set.');
                        return;
                    }
                    button.setButtonText('Saving…');
                    button.setDisabled(true);
                    const result = await updateOperatingCurrency(
                        this.plugin,
                        currency,
                        this.plugin.settings.createBackups
                    );
                    button.setDisabled(false);
                    button.setButtonText('Save to ledger');
                    if (result.success) {
                        new Notice(`Operating currency updated to ${currency} in ledger file.`);
                    } else {
                        new Notice(`Failed to update ledger: ${result.error}`);
                    }
                })
            );

        new Setting(containerEl)
            .setName('Default dashboard period')
            .setDesc('Choose the period shown by dashboard summaries when the dashboard first loads.')
            .addDropdown(dropdown => dropdown
                .addOption('this-month', 'This month')
                .addOption('last-month', 'Last month')
                .addOption('this-year', 'This year')
                .addOption('last-year', 'Last year')
                .setValue(this.plugin.settings.dashboardDefaultPeriod || 'this-month')
                .onChange(async (value) => {
                    this.plugin.settings.dashboardDefaultPeriod = value as DashboardDefaultPeriod;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Debug mode')
            .setDesc('Enable debug logging to the console.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.debugMode)
                .onChange(async (value) => {
                    this.plugin.settings.debugMode = value;
                    await this.plugin.saveSettings();
                }));

        // Price Fetching Settings Section
        new Setting(containerEl).setName('Automatic price fetching').setHeading();

        new Setting(containerEl)
            .setName('Enable automatic price fetching')
            .setDesc('Automatically fetch commodity prices at scheduled intervals using bean-price.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoPriceFetch)
                .onChange(async (value) => {
                    this.plugin.settings.autoPriceFetch = value;
                    await this.plugin.saveSettings();
                    // If enabled at runtime, start the interval immediately — no restart needed
                    if (value) {
                        this.plugin.setupAutomaticPriceFetching();
                    }
                    // Trigger re-render to show/hide interval setting
                    this.displayTab();
                }));

        if (this.plugin.settings.autoPriceFetch) {
            new Setting(containerEl)
                .setName('Fetch interval (hours)')
                .setDesc('How often to automatically fetch prices for all commodities with configured price sources.')
                .addText(text => text
                    .setPlaceholder('24')
                    .setValue(String(this.plugin.settings.priceFetchIntervalHours))
                    .onChange(async (value) => {
                        const hours = parseInt(value);
                        if (!isNaN(hours) && hours > 0) {
                            this.plugin.settings.priceFetchIntervalHours = hours;
                            await this.plugin.saveSettings();
                        }
                    }));

            // Display last fetch time if available
            if (this.plugin.settings.lastAutoPriceFetch > 0) {
                const lastFetchDate = new Date(this.plugin.settings.lastAutoPriceFetch);
                const timeSince = this.formatTimeSince(lastFetchDate);

                const infoEl = containerEl.createDiv({ cls: 'setting-item-description' });
                infoEl.setCssStyles({
                    marginTop: '8px',
                    fontSize: '0.9em',
                    opacity: '0.7'
                });
                infoEl.textContent = `Last automatic fetch: ${timeSince} (${lastFetchDate.toLocaleString()})`;
            }
        }
    }

    /**
     * Formats a time duration as a human-readable string.
     */
    private formatTimeSince(date: Date): string {
        const now = new Date().getTime();
        const past = date.getTime();
        const diffMs = now - past;

        const minutes = Math.floor(diffMs / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        return 'just now';
    }

    private renderConnectionTab(containerEl: HTMLElement): void {
        this.createConnectionSection(containerEl);
    }

    private renderBQLTab(containerEl: HTMLElement): void {
        new Setting(containerEl).setName('BQL code blocks').setHeading();

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
    }

    private renderEditorTab(containerEl: HTMLElement): void {
        new Setting(containerEl).setName('Editor configuration').setHeading();

        new Setting(containerEl)
            .setName('Editor autocomplete')
            .setDesc('Show context-aware completions in .beancount files: account names, payees, narrations, currencies/commodities, tags (#), and links (^). Reopen the file to apply changes.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.accountAutocomplete)
                .onChange(async (value) => {
                    this.plugin.settings.accountAutocomplete = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('User-defined snippets')
            .setDesc('Enable user-defined transaction snippets loaded from snippets.beancount. Start typing at the start of a line to autocomplete.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableUserSnippets)
                .onChange(async (value) => {
                    this.plugin.settings.enableUserSnippets = value;
                    await this.plugin.saveSettings();
                    if (value) {
                        await this.plugin.loadSnippets();
                    } else {
                        this.plugin.snippetCompletions = [];
                    }
                }));

        new Setting(containerEl)
            .setName('Format on save')
            .setDesc('Automatically format the Beancount file when saving: normalises indentation to 2 spaces, right-aligns amounts, and fixes @ price annotation spacing. Off by default.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.formatOnSave)
                .onChange(async (value) => {
                    this.plugin.settings.formatOnSave = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Inline lint mode')
            .setDesc('Show Beancount validation errors as inline squiggly underlines using the existing bean-query connection. Reopen the file to apply changes.')
            .addDropdown(drop => drop
                .addOption('off', 'Off')
                .addOption('on-save', 'On save (recommended)')
                .addOption('on-change', 'On change (2 s debounce)')
                .setValue(this.plugin.settings.lintMode)
                .onChange(async (value) => {
                    this.plugin.settings.lintMode = value as LintMode;
                    await this.plugin.saveSettings();
                }));
    }

    private renderPerformanceTab(containerEl: HTMLElement): void {
        new Setting(containerEl).setName('Performance').setHeading();

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

        new Setting(containerEl).setName('Backups').setHeading();

        new Setting(containerEl)
            .setName('Create backups')
            .setDesc('Create a backup file (<filename>.bak) before modifying your Beancount file. Highly recommended for data safety.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.createBackups)
                .onChange(async (value) => {
                    this.plugin.settings.createBackups = value;
                    await this.plugin.saveSettings();
                }));
    }

    private renderFilesTab(containerEl: HTMLElement): void {
        new Setting(containerEl).setName('File organization').setHeading();

        containerEl.createEl('p', {
            text: 'Your finances are organized using a structured folder layout with separate files for accounts, transactions, prices, and more.',
            cls: 'setting-item-description'
        });

        // Folder name setting
        const folderNameSetting = new Setting(containerEl)
            .setName('Folder name')
            .setDesc('Name of the folder containing your structured Beancount files.');

        if (this.isEditingFolderName) {
            folderNameSetting.addText(text => {
                text.setValue(this.tempFolderName)
                    .setPlaceholder('Finances')
                    .onChange(value => {
                        this.tempFolderName = value.trim();
                    });

                // Add keydown listener to support Enter to Save, Escape to Cancel
                text.inputEl.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        void this.saveFolderNameRename();
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        this.isEditingFolderName = false;
                        this.displayTab();
                    }
                });

                window.setTimeout(() => text.inputEl.focus(), 50);
                return text;
            });

            folderNameSetting.addButton(btn => {
                btn.setButtonText('Save')
                   .setCta()
                   .onClick(async () => {
                       await this.saveFolderNameRename();
                   });
            });

            folderNameSetting.addButton(btn => {
                btn.setButtonText('Cancel')
                   .onClick(() => {
                       this.isEditingFolderName = false;
                       this.displayTab();
                   });
            });
        } else {
            folderNameSetting.addText(text => {
                text.setValue(this.plugin.settings.structuredFolderName)
                    .setDisabled(true);
                return text;
            });

            folderNameSetting.addButton(btn => {
                btn.setButtonText('Edit')
                   .onClick(() => {
                       this.isEditingFolderName = true;
                       this.tempFolderName = this.plugin.settings.structuredFolderName;
                       this.displayTab();
                   });
            });
        }

        // File organization setting
        new Setting(containerEl)
            .setName('Transaction file organization')
            .setDesc('How transactions should be split into multiple files inside the transactions/ folder.')
            .addDropdown(dropdown => dropdown
                .addOption('yearly', 'Yearly (e.g. Transactions/2025.beancount)')
                .addOption('monthly', 'Monthly (e.g. Transactions/2025/2025-01.beancount)')
                .setValue(this.plugin.settings.fileOrganization)
                .onChange(async (value) => {
                    this.plugin.settings.fileOrganization = value as FileOrganization;
                    await this.plugin.saveSettings();
                }));

        // Display file structure info
        const infoDiv = containerEl.createDiv({ cls: 'structured-layout-info' });
        infoDiv.setCssStyles({
            padding: '10px',
            marginTop: '10px',
            backgroundColor: 'var(--background-secondary)',
            borderRadius: '5px'
        });

        infoDiv.createEl('strong', { text: 'Structured layout file organization:' });
        const fileList = infoDiv.createEl('ul');
        fileList.setCssStyles({
            marginTop: '8px',
            marginBottom: '0'
        });

        const files = [
            '📄 ledger.beancount - Main file with include statements',
            '📄 accounts.beancount - Account open/close directives',
            '📄 commodities.beancount - Commodity definitions',
            '📄 prices.beancount - Price directives',
            '📄 pads.beancount - Pad directives',
            '📄 balances.beancount - Balance assertions',
            '📄 queries.beancount - Named query directives',
            '📄 notes.beancount - Note directives',
            '📄 events.beancount - Event directives (+ holds financial indicator details)',
            '📁 transactions/ - Folder with transaction files organized by year or month'
        ];

        files.forEach(file => {
            const li = fileList.createEl('li');
            li.setCssStyles({ marginBottom: '4px' });
            li.textContent = file;
        });

        // Show current (derived) ledger path
        const folderName = this.plugin.settings.structuredFolderName;
        if (folderName) {
            const pathDiv = containerEl.createDiv({ cls: 'current-path-display' });
            pathDiv.setCssStyles({
                marginTop: '15px',
                padding: '10px',
                backgroundColor: 'var(--background-modifier-border)',
                borderRadius: '5px'
            });

            pathDiv.createDiv({
                text: 'Main ledger file path:',
                cls: 'setting-item-name'
            });
            const descEl = pathDiv.createDiv({
                text: `${folderName}/ledger.beancount`,
                cls: 'setting-item-description'
            });
            descEl.setCssStyles({ fontFamily: 'monospace' });
        }
    }


    private validateCurrency(currency: string): { isValid: boolean; message: string } {
        if (!currency.trim()) {
            return { isValid: false, message: 'Currency is required' };
        }

        // Beancount currency: starts with an uppercase letter, followed by uppercase
        // letters, digits, or the symbols ' . _ - (e.g. USD, BTC, GOLD, INR, EUR)
        const currencyRegex = /^[A-Z][A-Z0-9'._-]*$/;
        if (!currencyRegex.test(currency.toUpperCase())) {
            return { isValid: false, message: 'Currency must start with a letter and contain only uppercase letters, digits, or \' . _ -' };
        }

        return { isValid: true, message: '✅ Valid currency code' };
    }

    private createValidationElement(container: HTMLElement): HTMLElement {
        const validationEl = container.createDiv({
            cls: 'beancount-validation-message'
        });
        return validationEl;
    }

    private updateValidationDisplay(element: HTMLElement, result: { isValid: boolean; message: string }) {
        element.textContent = result.message;
        element.classList.remove('beancount-validation-success', 'beancount-validation-error', 'beancount-validation-neutral');
        element.classList.add(result.isValid ? 'beancount-validation-success' : 'beancount-validation-error');
    }

    private createConnectionSection(containerEl: HTMLElement) {
        new Setting(containerEl).setName('Connection configuration').setHeading();

        const desc = containerEl.createDiv({ cls: 'setting-item-description' });
        desc.setCssStyles({ marginBottom: '1em' });
        desc.textContent = 'Configure your Beancount file path and connection settings. The plugin will automatically detect your Python environment and test the connection.';

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

    private async saveFolderNameRename(): Promise<void> {
        if (!this.tempFolderName) {
            new Notice('Folder name cannot be empty.');
            return;
        }

        const oldFolderName = this.plugin.settings.structuredFolderName;
        if (this.tempFolderName === oldFolderName) {
            this.isEditingFolderName = false;
            this.displayTab();
            return;
        }

        // Validate illegal characters in folder name
        const invalidCharsRegex = /[\\/:*?"<>|]/;
        if (invalidCharsRegex.test(this.tempFolderName)) {
            new Notice('Folder name contains invalid characters: \\ / : * ? " < > |');
            return;
        }

        if (this.tempFolderName.startsWith('.') || this.tempFolderName.includes('..')) {
            new Notice('Folder name cannot start with a dot or contain ".."');
            return;
        }

        // Check if the target folder/file already exists in the vault
        const targetExists = this.app.vault.getAbstractFileByPath(this.tempFolderName);
        if (targetExists) {
            new Notice(`Error: A folder or file named "${this.tempFolderName}" already exists in the vault. Please choose a different name.`);
            return;
        }

        // Check and rename the physical folder
        const oldFolder = this.app.vault.getAbstractFileByPath(oldFolderName);
        if (oldFolder) {
            if (oldFolder instanceof TFolder) {
                try {
                    await this.app.vault.rename(oldFolder, this.tempFolderName);
                    new Notice(`Folder renamed from "${oldFolderName}" to "${this.tempFolderName}"`);
                } catch (renameError) {
                    Logger.error('Failed to rename structured layout folder in vault:', renameError);
                    new Notice(`Failed to rename folder: ${renameError instanceof Error ? renameError.message : String(renameError)}`);
                    return;
                }
            } else {
                new Notice(`Error: "${oldFolderName}" exists but is not a folder.`);
                return;
            }
        } else {
            Logger.log(`Structured folder "${oldFolderName}" not found in vault. Skipping physical rename.`);
        }

        // Only the folder name needs updating; the ledger path is derived at runtime.
        this.plugin.settings.structuredFolderName = this.tempFolderName;
        await this.plugin.saveSettings();

        // Reload snippets with the new folder path
        if (this.plugin.settings.enableUserSnippets) {
            await this.plugin.loadSnippets();
        }

        // Refresh journal store if it exists
        if (this.plugin.journalStore && typeof this.plugin.journalStore.refresh === 'function') {
            try {
                await this.plugin.journalStore.refresh();
            } catch (err) {
                Logger.error('Failed to refresh journal store after rename:', err);
            }
        }

        this.isEditingFolderName = false;
        this.displayTab();
    }


}
