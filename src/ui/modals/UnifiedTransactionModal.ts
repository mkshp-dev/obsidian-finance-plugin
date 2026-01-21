// src/ui/modals/UnifiedTransactionModal.ts

import { App, Modal, Notice } from 'obsidian';
import type BeancountPlugin from '../../main';
import type { JournalTransaction, JournalEntry } from '../../models/journal';
// Import the component statically to avoid dynamic import delay
import TransactionEditModal from './TransactionEditModal.svelte';
import { Logger } from '../../utils/logger';
import { getOpenAccounts, getPayees, getTags, getCommodities, createTransaction, updateTransaction, deleteTransaction, createBalanceAssertion, saveOpenDirective, saveCloseDirective, createNote } from '../../utils';

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
        Logger.log('Opening UnifiedTransactionModal', { mode: this.mode });
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
            // Use direct BQL queries instead of backend API
            // Run all requests in parallel for better performance
            const [accountsResult, payeesResult, tagsResult, commoditiesResult] = await Promise.allSettled([
                getOpenAccounts(this.plugin),
                getPayees(this.plugin),
                getTags(this.plugin),
                getCommodities(this.plugin)
            ]);

            const accounts = accountsResult.status === 'fulfilled' ? accountsResult.value : [];
            const payees = payeesResult.status === 'fulfilled' ? payeesResult.value : [];
            const tags = tagsResult.status === 'fulfilled' ? tagsResult.value : [];
            const fetchedCurrencies = commoditiesResult.status === 'fulfilled' ? commoditiesResult.value.map(c => c.name) : [];

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
            Logger.log('Adding entry', entryData);
            
            // Handle different entry types
            if (entryData.type === 'transaction') {
                // Use direct file writing for transactions
                const result = await createTransaction(this.plugin, entryData);
                
                if (result.success) {
                    new Notice('Transaction added successfully!');
                    
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
                } else {
                    new Notice(`Failed to add transaction: ${result.error || 'Unknown error'}`);
                }
            } else if (entryData.type === 'balance') {
                // Use direct file writing for balance assertions
                const result = await createBalanceAssertion(
                    this.plugin,
                    entryData.date,
                    entryData.account,
                    entryData.amount,
                    entryData.currency,
                    entryData.tolerance,
                    this.plugin.settings.createBackups ?? true
                );
                
                if (result.success) {
                    new Notice('Balance assertion added successfully!');
                    
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
                } else {
                    new Notice(`Failed to add balance: ${result.error || 'Unknown error'}`);
                }
            } else if (entryData.type === 'open') {
                // Use direct file writing for open directives
                const result = await saveOpenDirective(
                    this.plugin,
                    entryData.date,
                    entryData.account,
                    entryData.currencies || [],
                    entryData.booking,
                    this.plugin.settings.createBackups ?? true
                );
                
                if (result.success) {
                    new Notice('Open directive added successfully!');
                    
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
                } else {
                    new Notice(`Failed to add open directive: ${result.error || 'Unknown error'}`);
                }
            } else if (entryData.type === 'close') {
                // Use direct file writing for close directives
                const result = await saveCloseDirective(
                    this.plugin,
                    entryData.date,
                    entryData.account,
                    this.plugin.settings.createBackups ?? true
                );
                
                if (result.success) {
                    new Notice('Close directive added successfully!');
                    
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
                } else {
                    new Notice(`Failed to add close directive: ${result.error || 'Unknown error'}`);
                }
            } else if (entryData.type === 'note') {
                // Use direct file writing for notes
                const result = await createNote(
                    this.plugin,
                    entryData.date,
                    entryData.account,
                    entryData.comment,
                    entryData.tags || [],
                    entryData.links || [],
                    this.plugin.settings.createBackups ?? true
                );
                
                if (result.success) {
                    new Notice('Note added successfully!');
                    
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
                } else {
                    new Notice(`Failed to add note: ${result.error || 'Unknown error'}`);
                }
            } else {
                // Pad entries have no UI - this code path is unreachable
                new Notice(`Creating ${entryData.type} entries is not supported through the UI.`);
                Logger.warn(`Attempted to create ${entryData.type} entry without UI support`);
            }
        } catch (error) {
            Logger.error('Error adding entry:', error);
            new Notice(`Failed to add ${entryData.type}. Check console for details.`);
        }
    }

    async onSave(entryData: any) {
        if (!this.transaction && !this.entry) return;
        
        try {
            const entryId = this.transaction?.id || this.entry?.id;
            Logger.log('Updating entry', { id: entryId, data: entryData });
            
            // Handle different entry types
            if (entryData.type === 'transaction') {
                // Use direct file writing for transactions
                const result = await updateTransaction(this.plugin, entryId!, entryData);
                
                if (result.success) {
                    new Notice('Transaction updated successfully!');
                    
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
                } else {
                    new Notice(`Failed to update transaction: ${result.error || 'Unknown error'}`);
                }
            } else {
                // Open/Close entries have no edit UI - this code path is unreachable
                new Notice(`Updating ${entryData.type} entries is not supported through the UI.`);
                Logger.warn(`Attempted to update ${entryData.type} entry without UI support`);
            }
        } catch (error) {
            Logger.error('Error updating entry:', error);
            new Notice(`Failed to update ${entryData.type}. Check console for details.`);
        }
    }

    async onDelete(entryId: string) {
        try {
            Logger.log('Deleting entry', entryId);
            
            // Determine entry type
            const entryType = this.transaction?.type || this.entry?.type || 'transaction';
            
            if (entryType === 'transaction') {
                // Use direct file writing for transactions
                const result = await deleteTransaction(this.plugin, entryId);
                
                if (result.success) {
                    new Notice('Transaction deleted successfully!');
                    
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
                } else {
                    new Notice(`Failed to delete transaction: ${result.error || 'Unknown error'}`);
                }
            } else {
                // Open/Close entries have no delete UI - this code path is unreachable
                const entryType = entryId.split('_')[0];
                new Notice(`Deleting ${entryType} entries is not supported through the UI.`);
                Logger.warn(`Attempted to delete ${entryType} entry without UI support`);
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
