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

        // Show loading indicator
        const loadingEl = contentEl.createDiv('loading-indicator');
        loadingEl.textContent = 'Loading...';

        // Load form data with better error handling and defaults
        let accounts: string[] = [];
        let payees: string[] = [];
        let tags: string[] = [];
        let currencies: string[] = [];

        try {
            // Use ApiClient to fetch data directly or via Service if exposed
            const { apiClient } = this.plugin;

            // Run all requests in parallel for better performance
            // We can use the apiClient directly here
            const [accountsResult, payeesResult, tagsResult, commoditiesResult] = await Promise.allSettled([
                apiClient.get<{accounts: string[]}>('/accounts'),
                apiClient.get<{payees: string[]}>('/payees'),
                apiClient.get<{tags: string[]}>('/tags'),
                apiClient.get<{commodities: {name: string}[]}>('/commodities')
            ]);
            
            accounts = accountsResult.status === 'fulfilled' ? accountsResult.value.accounts : [];
            payees = payeesResult.status === 'fulfilled' ? payeesResult.value.payees : [];
            tags = tagsResult.status === 'fulfilled' ? tagsResult.value.tags : [];
            currencies = commoditiesResult.status === 'fulfilled' ? commoditiesResult.value.commodities.map(c => c.name) : [];
            
            // Fallback to common currencies if no commodities found
            if (currencies.length === 0) {
                currencies = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD'];
            }
        } catch (error) {
            console.error('Error loading form data:', error);
            // Don't show notice for data loading errors, just use empty arrays and fallback currencies
            currencies = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD'];
        }

        // Remove loading indicator
        loadingEl.remove();

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
