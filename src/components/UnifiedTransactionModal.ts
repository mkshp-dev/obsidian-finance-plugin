// src/components/UnifiedTransactionModal.ts

import { App, Modal, Notice } from 'obsidian';
import type BeancountPlugin from '../main';
import { JournalController, type JournalTransaction, type JournalEntry } from '../controllers/JournalController';
// Import the component statically to avoid dynamic import delay
import TransactionEditModal from './TransactionEditModal.svelte';

export class UnifiedTransactionModal extends Modal {
    plugin: BeancountPlugin;
    private component: any;
    private journalController: JournalController;
    private transaction: JournalTransaction | null;
    private entry: JournalEntry | null;
    private mode: 'add' | 'edit';

    constructor(app: App, plugin: BeancountPlugin, entryOrTransaction: JournalEntry | JournalTransaction | null = null) {
        super(app);
        this.plugin = plugin;
        
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
        this.journalController = new JournalController(plugin);
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
            // Run all requests in parallel for better performance
            const [accountsResult, payeesResult, tagsResult, commoditiesResult] = await Promise.allSettled([
                this.journalController.getAccounts(),
                this.journalController.getPayees(),
                this.journalController.getTags(),
                this.journalController.getCommodities()
            ]);
            
            accounts = accountsResult.status === 'fulfilled' ? accountsResult.value : [];
            payees = payeesResult.status === 'fulfilled' ? payeesResult.value : [];
            tags = tagsResult.status === 'fulfilled' ? tagsResult.value : [];
            currencies = commoditiesResult.status === 'fulfilled' ? commoditiesResult.value : [];
            
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
                defaultCurrency: this.plugin.settings.defaultCurrency
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
            const success = await this.journalController.addEntry(entryData);
            if (success) {
                new Notice(`${entryData.type.charAt(0).toUpperCase() + entryData.type.slice(1)} added successfully!`);
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
            const success = await this.journalController.updateTransaction(entryId!, entryData);
            if (success) {
                new Notice(`${entryData.type.charAt(0).toUpperCase() + entryData.type.slice(1)} updated successfully!`);
                this.close();
            }
        } catch (error) {
            console.error('Error updating entry:', error);
            new Notice(`Failed to update ${entryData.type}. Check console for details.`);
        }
    }

    async onDelete(entryId: string) {
        try {
            const success = await this.journalController.deleteTransaction(entryId);
            if (success) {
                new Notice('Entry deleted successfully!');
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
        this.journalController.cleanup();
    }
}