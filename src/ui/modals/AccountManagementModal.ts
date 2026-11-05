// src/ui/modals/AccountManagementModal.ts

import { App, Modal, Setting, Notice } from 'obsidian';
import type BeancountPlugin from '../../main';
import { getOpenAccounts, saveOpenDirective, saveCloseDirective } from '../../utils';

/**
 * Modal for opening or closing accounts.
 */
export class AccountManagementModal extends Modal {
    private plugin: BeancountPlugin;
    private mode: 'open' | 'close';
    private accountName = '';
    private date = '';
    private currencies = '';
    private reconcileDays = '';
    private onSuccess?: () => Promise<void>;
    private openAccounts: string[] = [];

    constructor(app: App, plugin: BeancountPlugin, mode: 'open' | 'close', onSuccess?: () => Promise<void>) {
        super(app);
        this.plugin = plugin;
        this.mode = mode;
        this.onSuccess = onSuccess;
        // Initialize date with today's date
        this.date = new Date().toISOString().split('T')[0];
    }

    async onOpen() {
        // Fetch open accounts for close mode
        if (this.mode === 'close') {
            try {
                this.openAccounts = await getOpenAccounts(this.plugin);
            } catch (error) {
                console.error('Failed to fetch accounts:', error);
                new Notice('Failed to fetch accounts list');
            }
        }
        
        this.renderContent();
    }

    private renderContent() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: this.mode === 'open' ? 'Open Account' : 'Close Account' });

        // Account name field - dropdown for close mode, text input for open mode
        if (this.mode === 'close' && this.openAccounts.length > 0) {
            new Setting(contentEl)
                .setName('Account name')
                .setDesc('Select an account to close')
                .addDropdown(dropdown => {
                    // Add empty option
                    dropdown.addOption('', '-- select an account --');
                    // Add all open accounts
                    this.openAccounts.forEach(account => {
                        dropdown.addOption(account, account);
                    });
                    dropdown
                        .setValue(this.accountName)
                        .onChange(value => {
                            this.accountName = value;
                        });
                });
        } else {
            const accountDesc = 'Enter the full account name (e.g., Assets:Bank:Checking)';
            const accountPlaceholder = 'Assets:Bank:Checking';
            new Setting(contentEl)
                .setName('Account name')
                .setDesc(accountDesc)
                .addText(text => text
                    .setPlaceholder(accountPlaceholder)
                    .setValue(this.accountName)
                    .onChange(value => {
                        this.accountName = value;
                    }));
        }

        // Date field
        new Setting(contentEl)
            .setName('Date')
            .setDesc('Enter the date in YYYY-MM-DD format')
            .addText(text => {
                text.inputEl.type = 'date';
                return text
                    .setValue(this.date)
                    .onChange(value => {
                        this.date = value;
                    });
            });

        // Currencies field (only for open mode)
        if (this.mode === 'open') {
            new Setting(contentEl)
                .setName('Currencies')
                .setDesc('Optional: Enter comma-separated currencies (e.g., USD,EUR)')
                .addText(text => text
                    .setPlaceholder('USD,EUR')
                    .setValue(this.currencies)
                    .onChange(value => {
                        this.currencies = value;
                    }));

            new Setting(contentEl)
                .setName('Reconciliation interval (days)')
                .setDesc('Optional: Number of days between reconciliations (e.g. 30)')
                .addText(text => text
                    .setPlaceholder('30')
                    .setValue(this.reconcileDays)
                    .onChange(value => {
                        this.reconcileDays = value;
                    }));
        }

        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container beancount-modal-buttons' });

        const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
        cancelButton.addEventListener('click', () => {
            this.close();
        });

        const submitButton = buttonContainer.createEl('button', { 
            text: this.mode === 'open' ? 'Open Account' : 'Close Account',
            cls: 'mod-cta'
        });
        submitButton.addEventListener('click', () => {
            void this.handleSubmit();
        });
    }

    async handleSubmit() {
        // Validate inputs
        if (!this.accountName.trim()) {
            new Notice('Please enter an account name');
            return;
        }

        if (!this.date.trim()) {
            new Notice('Please enter a date');
            return;
        }

        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(this.date)) {
            new Notice('Invalid date format. Use YYYY-MM-DD');
            return;
        }

        try {
            if (this.mode === 'open') {
                // Parse currencies
                const currenciesArray = this.currencies.trim() 
                    ? this.currencies.split(',').map(c => c.trim()).filter(c => c)
                    : undefined;

                // Parse reconcile metadata
                let metadata: Record<string, string> | undefined;
                if (this.reconcileDays.trim()) {
                    const days = parseInt(this.reconcileDays.trim(), 10);
                    if (isNaN(days) || days <= 0) {
                        new Notice('Reconciliation interval must be a positive number of days');
                        return;
                    }
                    metadata = { reconcile: days.toString() };
                }

                const result = await saveOpenDirective(
                    this.plugin,
                    this.date,
                    this.accountName,
                    currenciesArray,
                    undefined,
                    metadata
                );
                
                if (!result.success) {
                    throw new Error(result.error || 'Unknown error');
                }
                
                new Notice(`Account ${this.accountName} opened successfully`);
            } else {
                const result = await saveCloseDirective(
                    this.plugin,
                    this.date,
                    this.accountName
                );
                
                if (!result.success) {
                    throw new Error(result.error || 'Unknown error');
                }
                
                new Notice(`Account ${this.accountName} closed successfully`);
            }

            // Call success callback
            if (this.onSuccess) {
                await this.onSuccess();
            }

            this.close();
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            new Notice(`Failed to ${this.mode} account: ${errMsg}`);
            console.error(`Failed to ${this.mode} account:`, error);
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
