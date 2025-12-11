// src/ui/modals/AccountManagementModal.ts

import { App, Modal, Setting, Notice } from 'obsidian';
import type BeancountPlugin from '../../main';

/**
 * Modal for opening or closing accounts.
 */
export class AccountManagementModal extends Modal {
    private plugin: BeancountPlugin;
    private mode: 'open' | 'close';
    private accountName: string = '';
    private date: string = '';
    private currencies: string = '';
    private onSuccess?: () => Promise<void>;
    private openAccounts: string[] = [];

    constructor(app: App, plugin: BeancountPlugin, mode: 'open' | 'close', onSuccess?: () => Promise<void>) {
        super(app);
        this.plugin = plugin;
        this.mode = mode;
        this.onSuccess = onSuccess;
    }

    async onOpen() {
        // Fetch open accounts for close mode
        if (this.mode === 'close') {
            try {
                const allAccounts = await this.plugin.journalService.getAccounts();
                // Filter for open accounts by checking their status
                const statusPromises = allAccounts.map(async (account) => {
                    try {
                        const status = await this.plugin.journalService.getAccountStatus(account);
                        return status.is_open ? account : null;
                    } catch {
                        return null;
                    }
                });
                const results = await Promise.all(statusPromises);
                this.openAccounts = results.filter((acc): acc is string => acc !== null);
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
                    dropdown.addOption('', '-- Select an account --');
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
            new Setting(contentEl)
                .setName('Account name')
                .setDesc('Enter the full account name (e.g., Assets:Bank:Checking)')
                .addText(text => text
                    .setPlaceholder('Assets:Bank:Checking')
                    .setValue(this.accountName)
                    .onChange(value => {
                        this.accountName = value;
                    }));
        }

        // Date field
        new Setting(contentEl)
            .setName('Date')
            .setDesc('Enter the date in YYYY-MM-DD format')
            .addText(text => text
                .setPlaceholder(new Date().toISOString().split('T')[0])
                .setValue(this.date || new Date().toISOString().split('T')[0])
                .onChange(value => {
                    this.date = value;
                }));

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
        }

        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
        buttonContainer.style.cssText = 'display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px;';

        const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
        cancelButton.addEventListener('click', () => {
            this.close();
        });

        const submitButton = buttonContainer.createEl('button', { 
            text: this.mode === 'open' ? 'Open Account' : 'Close Account',
            cls: 'mod-cta'
        });
        submitButton.addEventListener('click', () => {
            this.handleSubmit();
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

                await this.plugin.journalService.openAccount(
                    this.accountName,
                    this.date,
                    currenciesArray
                );
                new Notice(`Account ${this.accountName} opened successfully`);
            } else {
                await this.plugin.journalService.closeAccount(
                    this.accountName,
                    this.date
                );
                new Notice(`Account ${this.accountName} closed successfully`);
            }

            // Call success callback
            if (this.onSuccess) {
                await this.onSuccess();
            }

            this.close();
        } catch (error) {
            new Notice(`Failed to ${this.mode} account: ${error.message}`);
            console.error(`Failed to ${this.mode} account:`, error);
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
