// src/settings.ts

import { App, PluginSettingTab, Setting, Notice, TFolder, requireApiVersion, type SettingDefinitionItem } from 'obsidian';
import type BeancountPlugin from './main';
import ConnectionSettings from './ui/partials/settings/ConnectionSettings.svelte';
import { updateOperatingCurrency } from './utils/index';
import type { LintMode } from './lang/beancount-lint';
import type { ImportProfile } from './models/import';
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
    /** Whether to show the "i" help icons on sidebar and dashboard sections. */
    showHelpTips: boolean;
    /** Whether the user has completed the onboarding wizard. */
    onboardingCompleted: boolean;
    /** Saved column mappings for bank statement imports, one per bank format. */
    importProfiles: ImportProfile[];
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
    showHelpTips: true,
    onboardingCompleted: false,
    importProfiles: [],
}

/** Names and descriptions shared by the declarative and the legacy settings UI. */
const TEXT = {
    operatingCurrency: ['Operating currency', 'The currency to use for transaction defaults and for consolidating totals (e.g., USD, INR).'],
    dashboardDefaultPeriod: ['Default dashboard period', 'Choose the period shown by dashboard summaries when the dashboard first loads.'],
    showHelpTips: ['Show help icons', 'Show the ⓘ icon on sidebar and dashboard sections. Hover or click it to see how that section works.'],
    debugMode: ['Debug mode', 'Enable debug logging to the console.'],
    autoPriceFetch: ['Enable automatic price fetching', 'Automatically fetch commodity prices at scheduled intervals using bean-price.'],
    priceFetchIntervalHours: ['Fetch interval (hours)', 'How often to automatically fetch prices for all commodities with configured price sources.'],
    connectionIntro: ['Connection configuration', 'Configure your Beancount file path and connection settings. The plugin will automatically detect your Python environment and test the connection.'],
    filesIntro: ['File organization', 'Your finances are organized using a structured folder layout with separate files for accounts, transactions, prices, and more.'],
    structuredFolderName: ['Folder name', 'Name of the folder containing your structured Beancount files.'],
    fileOrganization: ['Transaction file organization', 'How transactions should be split into multiple files inside the transactions/ folder.'],
    accountAutocomplete: ['Editor autocomplete', 'Show context-aware completions in .beancount files: account names, payees, narrations, currencies/commodities, tags (#), and links (^). Reopen the file to apply changes.'],
    enableUserSnippets: ['User-defined snippets', 'Enable user-defined transaction snippets loaded from snippets.beancount. Start typing at the start of a line to autocomplete.'],
    formatOnSave: ['Format on save', 'Automatically format the Beancount file when saving: normalises indentation to 2 spaces, right-aligns amounts, and fixes @ price annotation spacing. Off by default.'],
    lintMode: ['Inline lint mode', 'Show Beancount validation errors as inline squiggly underlines using the existing bean-query connection. Reopen the file to apply changes.'],
    bqlShowTools: ['Show query tools', 'Display refresh, copy, and download buttons above BQL query results.'],
    bqlShowQuery: ['Show query text', 'Display the BQL query text above the results in a collapsible section.'],
    maxTransactionResults: ['Max transaction results', 'Maximum number of transactions to load at once (to prevent memory issues with large datasets).'],
    maxJournalResults: ['Max journal results', 'Maximum number of journal entries to load at once.'],
    createBackups: ['Create backups', 'Create a backup file (<filename>.bak) before modifying your Beancount file. Highly recommended for data safety.'],
} as const;

const DASHBOARD_PERIOD_OPTIONS: Record<DashboardDefaultPeriod, string> = {
    'this-month': 'This month',
    'last-month': 'Last month',
    'this-year': 'This year',
    'last-year': 'Last year',
};

const FILE_ORGANIZATION_OPTIONS: Record<FileOrganization, string> = {
    yearly: 'Yearly (e.g. Transactions/2025.beancount)',
    monthly: 'Monthly (e.g. Transactions/2025/2025-01.beancount)',
};

const LINT_MODE_OPTIONS: Record<LintMode, string> = {
    'off': 'Off',
    'on-save': 'On save (recommended)',
    'on-change': 'On change (2 s debounce)',
};

const LAYOUT_FILES = [
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

/** Rejects fractional values for settings stored as whole numbers. */
const wholeNumber = (value: number): string | void => {
    if (!Number.isInteger(value)) return 'Enter a whole number.';
};

/**
 * BeancountSettingTab
 *
 * The settings tab for the plugin in Obsidian's settings modal.
 *
 * On Obsidian 1.13+ the tab is built from `getSettingDefinitions()`, so every
 * setting appears in Obsidian's settings search; each of the six sections is
 * a page. Older versions don't call that method and render `display()`
 * instead, which keeps the previous tabbed layout.
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

    // ── Declarative settings (Obsidian 1.13+) ────────────────────────────────

    getSettingDefinitions(): SettingDefinitionItem[] {
        const settings = this.plugin.settings;
        return [
            {
                type: 'page',
                name: 'General',
                desc: 'Operating currency, dashboard, help icons and automatic price fetching.',
                items: [
                    {
                        type: 'group',
                        heading: 'Basic preferences',
                        items: [
                            {
                                name: TEXT.operatingCurrency[0],
                                desc: TEXT.operatingCurrency[1],
                                aliases: ['currency', 'operating_currency'],
                                render: (setting) => this.renderOperatingCurrency(setting),
                            },
                            {
                                name: TEXT.dashboardDefaultPeriod[0],
                                desc: TEXT.dashboardDefaultPeriod[1],
                                control: { type: 'dropdown', key: 'dashboardDefaultPeriod', defaultValue: 'this-month', options: DASHBOARD_PERIOD_OPTIONS },
                            },
                            {
                                name: TEXT.showHelpTips[0],
                                desc: TEXT.showHelpTips[1],
                                control: { type: 'toggle', key: 'showHelpTips', defaultValue: true },
                            },
                            {
                                name: TEXT.debugMode[0],
                                desc: TEXT.debugMode[1],
                                aliases: ['logging'],
                                control: { type: 'toggle', key: 'debugMode', defaultValue: false },
                            },
                        ],
                    },
                    {
                        type: 'group',
                        heading: 'Automatic price fetching',
                        items: [
                            {
                                name: TEXT.autoPriceFetch[0],
                                desc: TEXT.autoPriceFetch[1],
                                aliases: ['bean-price', 'prices'],
                                control: { type: 'toggle', key: 'autoPriceFetch', defaultValue: false },
                            },
                            {
                                name: TEXT.priceFetchIntervalHours[0],
                                desc: TEXT.priceFetchIntervalHours[1],
                                visible: () => this.plugin.settings.autoPriceFetch,
                                control: { type: 'number', key: 'priceFetchIntervalHours', defaultValue: 24, min: 1, step: 1, placeholder: '24', validate: wholeNumber },
                            },
                            {
                                name: 'Last automatic fetch',
                                desc: this.lastFetchText(),
                                searchable: false,
                                visible: () => this.plugin.settings.autoPriceFetch && this.plugin.settings.lastAutoPriceFetch > 0,
                            },
                        ],
                    },
                ],
            },
            {
                type: 'page',
                name: 'Connection',
                desc: 'Ledger file, Python environment and bean-query connection.',
                items: [
                    {
                        type: 'group',
                        heading: TEXT.connectionIntro[0],
                        items: [
                            {
                                name: 'Beancount connection',
                                desc: TEXT.connectionIntro[1],
                                aliases: ['bean-query', 'python', 'ledger file', 'beancount command', 'connection test'],
                                render: (setting) => this.renderConnection(setting),
                            },
                        ],
                    },
                ],
            },
            {
                type: 'page',
                name: TEXT.filesIntro[0],
                desc: 'Folder name and how transaction files are split.',
                items: [
                    {
                        type: 'group',
                        heading: TEXT.filesIntro[0],
                        items: [
                            {
                                name: TEXT.structuredFolderName[0],
                                desc: TEXT.structuredFolderName[1],
                                aliases: ['base folder', 'structured folder'],
                                render: (setting) => this.renderFolderName(setting),
                            },
                            {
                                name: TEXT.fileOrganization[0],
                                desc: TEXT.fileOrganization[1],
                                aliases: ['yearly', 'monthly'],
                                control: { type: 'dropdown', key: 'fileOrganization', defaultValue: 'yearly', options: FILE_ORGANIZATION_OPTIONS },
                            },
                            {
                                name: 'Structured layout files',
                                desc: createFragment((f) => {
                                    f.appendText(TEXT.filesIntro[1]);
                                    this.appendLayoutFileList(f);
                                }),
                            },
                            {
                                name: 'Main ledger file path',
                                desc: createFragment((f) => {
                                    f.createEl('code', { text: `${settings.structuredFolderName}/ledger.beancount` });
                                }),
                                visible: () => !!this.plugin.settings.structuredFolderName,
                            },
                        ],
                    },
                ],
            },
            {
                type: 'page',
                name: 'Editor',
                desc: 'Autocomplete, snippets, formatting and inline lint in .beancount files.',
                items: [
                    {
                        type: 'group',
                        heading: 'Editor configuration',
                        items: [
                            {
                                name: TEXT.accountAutocomplete[0],
                                desc: TEXT.accountAutocomplete[1],
                                control: { type: 'toggle', key: 'accountAutocomplete', defaultValue: true },
                            },
                            {
                                name: TEXT.enableUserSnippets[0],
                                desc: TEXT.enableUserSnippets[1],
                                control: { type: 'toggle', key: 'enableUserSnippets', defaultValue: false },
                            },
                            {
                                name: TEXT.formatOnSave[0],
                                desc: TEXT.formatOnSave[1],
                                control: { type: 'toggle', key: 'formatOnSave', defaultValue: false },
                            },
                            {
                                name: TEXT.lintMode[0],
                                desc: TEXT.lintMode[1],
                                aliases: ['bean-check', 'validation'],
                                control: { type: 'dropdown', key: 'lintMode', defaultValue: 'on-save', options: LINT_MODE_OPTIONS },
                            },
                        ],
                    },
                ],
            },
            {
                type: 'page',
                name: 'BQL',
                desc: 'How BQL query code blocks are displayed.',
                items: [
                    {
                        type: 'group',
                        heading: 'BQL code blocks',
                        items: [
                            {
                                name: TEXT.bqlShowTools[0],
                                desc: TEXT.bqlShowTools[1],
                                control: { type: 'toggle', key: 'bqlShowTools', defaultValue: true },
                            },
                            {
                                name: TEXT.bqlShowQuery[0],
                                desc: TEXT.bqlShowQuery[1],
                                control: { type: 'toggle', key: 'bqlShowQuery', defaultValue: false },
                            },
                        ],
                    },
                ],
            },
            {
                type: 'page',
                name: 'Performance',
                desc: 'Result limits and backups.',
                items: [
                    {
                        type: 'group',
                        heading: 'Performance',
                        items: [
                            {
                                name: TEXT.maxTransactionResults[0],
                                desc: TEXT.maxTransactionResults[1],
                                control: { type: 'number', key: 'maxTransactionResults', defaultValue: 2000, min: 1, max: 10000, step: 1, placeholder: '2000', validate: wholeNumber },
                            },
                            {
                                name: TEXT.maxJournalResults[0],
                                desc: TEXT.maxJournalResults[1],
                                control: { type: 'number', key: 'maxJournalResults', defaultValue: 1000, min: 1, max: 5000, step: 1, placeholder: '1000', validate: wholeNumber },
                            },
                        ],
                    },
                    {
                        type: 'group',
                        heading: 'Backups',
                        items: [
                            {
                                name: TEXT.createBackups[0],
                                desc: TEXT.createBackups[1],
                                aliases: ['.bak'],
                                control: { type: 'toggle', key: 'createBackups', defaultValue: true },
                            },
                        ],
                    },
                ],
            },
        ];
    }

    /**
     * Persists a control's value through the plugin's own `saveSettings()`
     * (which also refreshes BQL blocks) and applies settings that take effect
     * immediately. Obsidian's default would only call `saveData()`.
     */
    async setControlValue(key: string, value: unknown): Promise<void> {
        (this.plugin.settings as unknown as Record<string, unknown>)[key] = value;
        await this.plugin.saveSettings();

        switch (key) {
            case 'showHelpTips':
                this.plugin.applyHelpTipVisibility();
                break;
            case 'autoPriceFetch':
                // Start the interval right away — no restart needed.
                if (value) this.plugin.setupAutomaticPriceFetching();
                break;
            case 'enableUserSnippets':
                if (value) await this.plugin.loadSnippets();
                else this.plugin.snippetCompletions = [];
                break;
        }
    }

    // ── Shared rows (used by both UIs) ───────────────────────────────────────

    /** Text input with validation and a "Save to ledger" button. */
    private renderOperatingCurrency(setting: Setting): void {
        const validationEl = setting.descEl.createDiv({ cls: 'beancount-validation-message' });

        setting.addText(text => {
            text
                .setPlaceholder('USD')
                .setValue(this.plugin.settings.operatingCurrency)
                .onChange(async (value) => {
                    this.plugin.settings.operatingCurrency = value.toUpperCase();
                    await this.plugin.saveSettings();

                    if (value.trim()) {
                        this.updateValidationDisplay(validationEl, this.validateCurrency(value));
                    } else {
                        validationEl.textContent = '';
                    }

                    text.setValue(this.plugin.settings.operatingCurrency);
                });

            if (this.plugin.settings.operatingCurrency) {
                this.updateValidationDisplay(validationEl, this.validateCurrency(this.plugin.settings.operatingCurrency));
            }
            return text;
        });

        setting.addButton(button => button
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
    }

    /** Read-only folder name with Edit, or an input with Save / Cancel while renaming. */
    private renderFolderName(setting: Setting): void {
        if (this.isEditingFolderName) {
            setting.addText(text => {
                text.setValue(this.tempFolderName)
                    .setPlaceholder('Finances')
                    .onChange(value => {
                        this.tempFolderName = value.trim();
                    });

                // Enter saves, Escape cancels
                text.inputEl.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        void this.saveFolderNameRename();
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        this.isEditingFolderName = false;
                        this.refresh();
                    }
                });

                window.setTimeout(() => text.inputEl.focus(), 50);
                return text;
            });

            setting.addButton(btn => btn
                .setButtonText('Save')
                .setCta()
                .onClick(async () => {
                    await this.saveFolderNameRename();
                }));

            setting.addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => {
                    this.isEditingFolderName = false;
                    this.refresh();
                }));
        } else {
            setting.addText(text => text
                .setValue(this.plugin.settings.structuredFolderName)
                .setDisabled(true));

            setting.addButton(btn => btn
                .setButtonText('Edit')
                .onClick(() => {
                    this.isEditingFolderName = true;
                    this.tempFolderName = this.plugin.settings.structuredFolderName;
                    this.refresh();
                }));
        }
    }

    /** Mounts the connection panel in place of the row; returns its cleanup. */
    private renderConnection(setting: Setting): () => void {
        setting.settingEl.empty();
        setting.settingEl.addClass('beancount-setting-block');
        const settingsContainer = setting.settingEl.createDiv({ cls: 'beancount-connection-settings-container' });
        const component = new ConnectionSettings({
            target: settingsContainer,
            props: {
                plugin: this.plugin,
                settings: this.plugin.settings,
                app: this.app
            }
        });
        return () => component.$destroy();
    }

    private appendLayoutFileList(parent: DocumentFragment | HTMLElement): void {
        const fileList = parent.createEl('ul', { cls: 'beancount-layout-files' });
        for (const file of LAYOUT_FILES) fileList.createEl('li', { text: file });
    }

    private lastFetchText(): string {
        const last = this.plugin.settings.lastAutoPriceFetch;
        if (!(last > 0)) return '';
        const lastFetchDate = new Date(last);
        return `${this.formatTimeSince(lastFetchDate)} (${lastFetchDate.toLocaleString()})`;
    }

    /** Re-renders whichever UI is active after local state changes. */
    private refresh(): void {
        // Obsidian 1.13+ builds the tab from getSettingDefinitions(); older versions use display().
        if (requireApiVersion('1.13.0') && this.settingItems.length > 0) this.update();
        else this.displayTab();
    }

    // ── Legacy tabbed UI (Obsidian < 1.13) ───────────────────────────────────

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

    /** A legacy-UI row with the shared name and description. */
    private legacySetting(containerEl: HTMLElement, text: readonly [string, string]): Setting {
        return new Setting(containerEl).setName(text[0]).setDesc(text[1]);
    }

    private renderGeneralTab(containerEl: HTMLElement): void {
        new Setting(containerEl).setName('Basic preferences').setHeading();

        this.renderOperatingCurrency(this.legacySetting(containerEl, TEXT.operatingCurrency));

        this.legacySetting(containerEl, TEXT.dashboardDefaultPeriod)
            .addDropdown(dropdown => dropdown
                .addOptions(DASHBOARD_PERIOD_OPTIONS)
                .setValue(this.plugin.settings.dashboardDefaultPeriod || 'this-month')
                .onChange(async (value) => {
                    this.plugin.settings.dashboardDefaultPeriod = value as DashboardDefaultPeriod;
                    await this.plugin.saveSettings();
                }));

        this.legacySetting(containerEl, TEXT.showHelpTips)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showHelpTips)
                .onChange(async (value) => {
                    await this.setControlValue('showHelpTips', value);
                }));

        this.legacySetting(containerEl, TEXT.debugMode)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.debugMode)
                .onChange(async (value) => {
                    this.plugin.settings.debugMode = value;
                    await this.plugin.saveSettings();
                }));

        // Price Fetching Settings Section
        new Setting(containerEl).setName('Automatic price fetching').setHeading();

        this.legacySetting(containerEl, TEXT.autoPriceFetch)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoPriceFetch)
                .onChange(async (value) => {
                    await this.setControlValue('autoPriceFetch', value);
                    // Re-render to show/hide the interval setting
                    this.displayTab();
                }));

        if (this.plugin.settings.autoPriceFetch) {
            this.legacySetting(containerEl, TEXT.priceFetchIntervalHours)
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
                containerEl.createDiv({
                    cls: 'setting-item-description beancount-settings-note',
                    text: `Last automatic fetch: ${this.lastFetchText()}`,
                });
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
        new Setting(containerEl).setName(TEXT.connectionIntro[0]).setHeading();

        containerEl.createDiv({
            cls: 'setting-item-description beancount-settings-intro',
            text: TEXT.connectionIntro[1],
        });

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

    private renderBQLTab(containerEl: HTMLElement): void {
        new Setting(containerEl).setName('BQL code blocks').setHeading();

        this.legacySetting(containerEl, TEXT.bqlShowTools)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.bqlShowTools)
                .onChange(async (value) => {
                    this.plugin.settings.bqlShowTools = value;
                    await this.plugin.saveSettings();
                }));

        this.legacySetting(containerEl, TEXT.bqlShowQuery)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.bqlShowQuery)
                .onChange(async (value) => {
                    this.plugin.settings.bqlShowQuery = value;
                    await this.plugin.saveSettings();
                }));
    }

    private renderEditorTab(containerEl: HTMLElement): void {
        new Setting(containerEl).setName('Editor configuration').setHeading();

        this.legacySetting(containerEl, TEXT.accountAutocomplete)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.accountAutocomplete)
                .onChange(async (value) => {
                    this.plugin.settings.accountAutocomplete = value;
                    await this.plugin.saveSettings();
                }));

        this.legacySetting(containerEl, TEXT.enableUserSnippets)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableUserSnippets)
                .onChange(async (value) => {
                    await this.setControlValue('enableUserSnippets', value);
                }));

        this.legacySetting(containerEl, TEXT.formatOnSave)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.formatOnSave)
                .onChange(async (value) => {
                    this.plugin.settings.formatOnSave = value;
                    await this.plugin.saveSettings();
                }));

        this.legacySetting(containerEl, TEXT.lintMode)
            .addDropdown(drop => drop
                .addOptions(LINT_MODE_OPTIONS)
                .setValue(this.plugin.settings.lintMode)
                .onChange(async (value) => {
                    this.plugin.settings.lintMode = value as LintMode;
                    await this.plugin.saveSettings();
                }));
    }

    private renderPerformanceTab(containerEl: HTMLElement): void {
        new Setting(containerEl).setName('Performance').setHeading();

        this.legacySetting(containerEl, TEXT.maxTransactionResults)
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

        this.legacySetting(containerEl, TEXT.maxJournalResults)
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

        this.legacySetting(containerEl, TEXT.createBackups)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.createBackups)
                .onChange(async (value) => {
                    this.plugin.settings.createBackups = value;
                    await this.plugin.saveSettings();
                }));
    }

    private renderFilesTab(containerEl: HTMLElement): void {
        new Setting(containerEl).setName(TEXT.filesIntro[0]).setHeading();

        containerEl.createEl('p', {
            text: TEXT.filesIntro[1],
            cls: 'setting-item-description'
        });

        this.renderFolderName(this.legacySetting(containerEl, TEXT.structuredFolderName));

        this.legacySetting(containerEl, TEXT.fileOrganization)
            .addDropdown(dropdown => dropdown
                .addOptions(FILE_ORGANIZATION_OPTIONS)
                .setValue(this.plugin.settings.fileOrganization)
                .onChange(async (value) => {
                    this.plugin.settings.fileOrganization = value as FileOrganization;
                    await this.plugin.saveSettings();
                }));

        // File structure info
        const infoDiv = containerEl.createDiv({ cls: 'structured-layout-info' });
        infoDiv.createEl('strong', { text: 'Structured layout file organization:' });
        this.appendLayoutFileList(infoDiv);

        // Current (derived) ledger path
        const folderName = this.plugin.settings.structuredFolderName;
        if (folderName) {
            const pathDiv = containerEl.createDiv({ cls: 'current-path-display' });
            pathDiv.createDiv({
                text: 'Main ledger file path:',
                cls: 'setting-item-name'
            });
            pathDiv.createDiv({
                text: `${folderName}/ledger.beancount`,
                cls: 'setting-item-description beancount-mono'
            });
        }
    }

    // ── Validation and folder rename ─────────────────────────────────────────

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

    private updateValidationDisplay(element: HTMLElement, result: { isValid: boolean; message: string }) {
        element.textContent = result.message;
        element.classList.remove('beancount-validation-success', 'beancount-validation-error', 'beancount-validation-neutral');
        element.classList.add(result.isValid ? 'beancount-validation-success' : 'beancount-validation-error');
    }

    private async saveFolderNameRename(): Promise<void> {
        if (!this.tempFolderName) {
            new Notice('Folder name cannot be empty.');
            return;
        }

        const oldFolderName = this.plugin.settings.structuredFolderName;
        if (this.tempFolderName === oldFolderName) {
            this.isEditingFolderName = false;
            this.refresh();
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
        this.refresh();
    }
}
