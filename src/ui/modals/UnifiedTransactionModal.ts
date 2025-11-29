// src/ui/modals/UnifiedTransactionModal.ts

import { App, Modal, Notice } from 'obsidian';
import type BeancountPlugin from '../../main';
import type { JournalTransaction, JournalEntry } from '../../models/journal';
// Import the component statically to avoid dynamic import delay
import TransactionEditModal from './TransactionEditModal.svelte';

export class UnifiedTransactionModal extends Modal {
    plugin: BeancountPlugin;
    private component: any;
    private transaction: JournalTransaction | null;
    private entry: JournalEntry | null;
    private mode: 'add' | 'edit';
    private onRefreshCallback?: () => Promise<void>; // Add refresh callback

    constructor(
        app: App, 
        plugin: BeancountPlugin, 
        entryOrTransaction: JournalEntry | JournalTransaction | null = null,
        onRefresh?: () => Promise<void> // Add optional refresh callback
    ) {
        super(app);
        this.plugin = plugin;
        this.onRefreshCallback = onRefresh;
        
        // Handle both transaction (legacy) and entry (new) parameters
        if (entryOrTransaction?.type === 'transaction') {
            this.transaction = entryOrTransaction as JournalTransaction;
            this.entry = entryOrTransaction as JournalEntry;
        } else if (entryOrTransaction) {
            this.transaction = null;
            this.entry = entryOrTransaction as JournalEntry;
        } else {
            this.transaction = null;
            this.entry = null;
        }
        
        this.mode = entryOrTransaction ? 'edit' : 'add';
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        // Set modal container to be wider
        this.modalEl.style.maxWidth = '1200px';
        this.modalEl.style.width = '95vw';

        // Set initial title (fallback, component will update it)
        this.setTitle(this.mode === 'edit' ? 'Edit Transaction' : 'Add Transaction');

        // Initialize with empty data
        const accounts: string[] = [];
        const payees: string[] = [];
        const tags: string[] = [];
        let currencies: string[] = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD']; // Default fallback

        // Create component immediately with static import
        this.component = new (TransactionEditModal as any)({
            target: contentEl,
            props: {
                transaction: this.transaction,
                entry: this.entry,
                accounts,
                payees,
                tags,
                currencies, // Add currencies for autocomplete
                mode: this.mode,
                operatingCurrency: this.plugin.settings.operatingCurrency
            }
        });

        // Handle events
        this.component.$on('add', (e: any) => this.onAdd(e.detail));
        this.component.$on('save', (e: any) => this.onSave(e.detail));
        this.component.$on('delete', (e: any) => this.onDelete(e.detail));
        this.component.$on('cancel', () => this.close());
        this.component.$on('titleChange', (e: any) => this.setTitle(e.detail)); // Listen for title changes

        // Fetch data in background
        this.fetchData();
    }

    async fetchData() {
        try {
            // Use ApiClient to fetch data directly or via Service if exposed
            const { apiClient } = this.plugin;

            // Run all requests in parallel for better performance
            const [accountsResult, payeesResult, tagsResult, commoditiesResult] = await Promise.allSettled([
                apiClient.get<{accounts: string[]}>('/accounts'),
                apiClient.get<{payees: string[]}>('/payees'),
                apiClient.get<{tags: string[]}>('/tags'),
                apiClient.get<{commodities: {name: string}[]}>('/commodities')
            ]);

            const accounts = accountsResult.status === 'fulfilled' ? accountsResult.value.accounts : [];
            const payees = payeesResult.status === 'fulfilled' ? payeesResult.value.payees : [];
            const tags = tagsResult.status === 'fulfilled' ? tagsResult.value.tags : [];
            const fetchedCurrencies = commoditiesResult.status === 'fulfilled' ? commoditiesResult.value.commodities.map(c => c.name) : [];

            const currencies = fetchedCurrencies.length > 0 ? fetchedCurrencies : ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD'];

            // Update component props
            if (this.component) {
                this.component.$set({
                    accounts,
                    payees,
                    tags,
                    currencies
                });
            }
        } catch (error) {
            console.error('Error loading form data:', error);
        }
    }

    async onAdd(entryData: any) {
        try {
            // Use JournalService
            const success = await this.plugin.journalService.createEntry(entryData);
            if (success) {
                new Notice(`${entryData.type.charAt(0).toUpperCase() + entryData.type.slice(1)} added successfully!`);
                
                // Refresh the store
                await this.plugin.journalStore.refresh();

                // Call refresh callback if provided (legacy)
                if (this.onRefreshCallback) {
                    try {
                        await this.onRefreshCallback();
                    } catch (error) {
                        console.error('Error refreshing dashboard:', error);
                    }
                }
                
                this.close();
            }
        } catch (error) {
            console.error('Error adding entry:', error);
            new Notice(`Failed to add ${entryData.type}. Check console for details.`);
        }
    }

    async onSave(entryData: any) {
        if (!this.transaction && !this.entry) return;
        
        try {
            const entryId = this.transaction?.id || this.entry?.id;
            // Use JournalService
            const success = await this.plugin.journalService.updateTransaction(entryId!, entryData);
            if (success) {
                new Notice(`${entryData.type.charAt(0).toUpperCase() + entryData.type.slice(1)} updated successfully!`);
                
                // Refresh the store
                await this.plugin.journalStore.refresh();

                // Call refresh callback if provided
                if (this.onRefreshCallback) {
                    try {
                        await this.onRefreshCallback();
                    } catch (error) {
                        console.error('Error refreshing dashboard:', error);
                    }
                }
                
                this.close();
            }
        } catch (error) {
            console.error('Error updating entry:', error);
            new Notice(`Failed to update ${entryData.type}. Check console for details.`);
        }
    }

    async onDelete(entryId: string) {
        try {
             // Use JournalService
            const success = await this.plugin.journalService.deleteTransaction(entryId);
            if (success) {
                new Notice('Entry deleted successfully!');
                
                // Refresh the store
                await this.plugin.journalStore.refresh();

                // Call refresh callback if provided
                if (this.onRefreshCallback) {
                    try {
                        await this.onRefreshCallback();
                    } catch (error) {
                        console.error('Error refreshing dashboard:', error);
                    }
                }
                
                this.close();
            }
        } catch (error) {
            console.error('Error deleting entry:', error);
            new Notice('Failed to delete entry. Check console for details.');
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        if (this.component) {
            this.component.$destroy();
        }
    }
}
