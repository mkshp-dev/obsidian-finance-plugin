// src/controllers/JournalController.ts
import { writable, derived, type Writable, type Readable } from 'svelte/store';
import type BeancountPlugin from '../main';
import { BackendManager } from '../backend/BackendManager';

export interface JournalPosting {
    account: string;
    amount: string | null;
    currency: string | null;
    price?: {
        amount: string;
        currency: string;
    };
    cost?: {
        number: string | null;
        currency: string;
        date: string | null;
        label: string | null;
    };
}

// Base interface for all journal entries
export interface JournalBaseEntry {
    id: string;
    type: 'transaction' | 'balance' | 'pad' | 'note';
    date: string;
    metadata: Record<string, any>;
}

// Transaction entry (existing)
export interface JournalTransaction extends JournalBaseEntry {
    type: 'transaction';
    flag: string;
    payee: string | null;
    narration: string;
    tags: string[];
    links: string[];
    postings: JournalPosting[];
}

// Note directive
export interface JournalNote extends JournalBaseEntry {
    type: 'note';
    account: string;
    comment: string;
}

// Balance assertion
export interface JournalBalance extends JournalBaseEntry {
    type: 'balance';
    account: string;
    amount: string;
    currency: string;
    tolerance: string | null;
    diff_amount: string | null;
}

// Pad directive
export interface JournalPad extends JournalBaseEntry {
    type: 'pad';
    account: string;
    source_account: string;
}

// Union type for all supported entries
export type JournalEntry = JournalTransaction | JournalNote | JournalBalance | JournalPad;

export interface JournalFilters {
    startDate?: string;
    endDate?: string;
    account?: string;
    payee?: string;
    tag?: string;
    searchTerm?: string;
    entryTypes?: string[]; // Filter by entry types
}

export interface JournalApiResponse {
    transactions?: JournalTransaction[]; // Legacy support
    entries?: JournalEntry[]; // New comprehensive support
    total_count: number;
    returned_count: number;
    offset: number;
    limit: number;
    has_more: boolean;
}

export class JournalController {
    private plugin: BeancountPlugin;
    private backendManager: BackendManager;

    // Stores - updated for comprehensive entry support
    public entries: Writable<JournalEntry[]> = writable([]);
    public transactions: Writable<JournalTransaction[]> = writable([]); // Legacy support
    public filteredEntries: Readable<JournalEntry[]>;
    public filteredTransactions: Readable<JournalTransaction[]>; // Legacy support
    public filters: Writable<JournalFilters> = writable({});
    public loading: Writable<boolean> = writable(false);
    public error: Writable<string | null> = writable(null);
    public lastUpdated: Writable<Date | null> = writable(null);
    public apiConnected: Writable<boolean> = writable(false);
    
    // Pagination stores
    public currentPage: Writable<number> = writable(1);
    public pageSize: Writable<number> = writable(200);
    public totalCount: Writable<number> = writable(0);
    public hasMore: Writable<boolean> = writable(false);

    constructor(plugin: BeancountPlugin) {
        this.plugin = plugin;
        this.backendManager = new BackendManager(plugin);

        // Create derived stores for compatibility and filtering
        this.filteredEntries = derived(
            [this.entries],
            ([entries]) => entries
        );
        
        this.filteredTransactions = derived(
            [this.entries],
            ([entries]) => entries.filter(entry => entry.type === 'transaction') as JournalTransaction[]
        );
    }

    /**
     * Check if the Python API is running
     */
    public async checkApiConnection(): Promise<boolean> {
        try {
            const isHealthy = await this.backendManager.isBackendHealthy();
            this.apiConnected.set(isHealthy);
            return isHealthy;
        } catch (error) {
            this.apiConnected.set(false);
            return false;
        }
    }

    /**
     * Load all journal entries (transactions and other directives) from Python API
     */
    public async loadAllEntries(): Promise<void> {
        this.loading.set(true);
        this.error.set(null);

        try {
            // Check API connection first and auto-start if needed
            const connected = await this.backendManager.ensureBackendRunning();
            if (!connected) {
                throw new Error('Failed to start Python backend. Please check that Python 3.8+ and beancount are installed.');
            }
            this.apiConnected.set(true);

            // Build query parameters
            const params = new URLSearchParams();
            
            // Get current filters and pagination
            let currentFilters: JournalFilters = {};
            let currentPage = 1;
            let pageSize = 200;
            
            this.filters.subscribe(f => currentFilters = f)();
            this.currentPage.subscribe(p => currentPage = p)();
            this.pageSize.subscribe(s => pageSize = s)();

            if (currentFilters.startDate) params.append('start_date', currentFilters.startDate);
            if (currentFilters.endDate) params.append('end_date', currentFilters.endDate);
            if (currentFilters.account) params.append('account', currentFilters.account);
            if (currentFilters.payee) params.append('payee', currentFilters.payee);
            if (currentFilters.tag) params.append('tag', currentFilters.tag);
            if (currentFilters.searchTerm) params.append('search', currentFilters.searchTerm);
            if (currentFilters.entryTypes) params.append('types', currentFilters.entryTypes.join(','));
            
            // Set pagination parameters
            const offset = (currentPage - 1) * pageSize;
            params.append('limit', pageSize.toString());
            params.append('offset', offset.toString());

            const response = await this.backendManager.apiRequest(`/entries?${params}`);
            
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }

            const data: JournalApiResponse = await response.json();
            this.entries.set(data.entries || []);
            
            // Update legacy transactions store for backward compatibility
            const transactions = (data.entries || []).filter(entry => entry.type === 'transaction') as JournalTransaction[];
            this.transactions.set(transactions);
            
            this.totalCount.set(data.total_count);
            this.hasMore.set(data.has_more);
            this.lastUpdated.set(new Date());

        } catch (error) {
            console.error('Error loading journal entries:', error);
            this.error.set(error instanceof Error ? error.message : 'Failed to load journal entries');
        } finally {
            this.loading.set(false);
        }
    }

    /**
     * Load journal transactions from Python API (legacy method)
     */
    public async loadData(): Promise<void> {
        this.loading.set(true);
        this.error.set(null);

        try {
            // Check API connection first and auto-start if needed
            const connected = await this.backendManager.ensureBackendRunning();
            if (!connected) {
                throw new Error('Failed to start Python backend. Please check that Python 3.8+ and beancount are installed.');
            }
            this.apiConnected.set(true);

            // Build query parameters
            const params = new URLSearchParams();
            
            // Get current filters and pagination
            let currentFilters: JournalFilters = {};
            let currentPage = 1;
            let pageSize = 200;
            
            this.filters.subscribe(f => currentFilters = f)();
            this.currentPage.subscribe(p => currentPage = p)();
            this.pageSize.subscribe(s => pageSize = s)();

            if (currentFilters.startDate) params.append('start_date', currentFilters.startDate);
            if (currentFilters.endDate) params.append('end_date', currentFilters.endDate);
            if (currentFilters.account) params.append('account', currentFilters.account);
            if (currentFilters.payee) params.append('payee', currentFilters.payee);
            if (currentFilters.tag) params.append('tag', currentFilters.tag);
            if (currentFilters.searchTerm) params.append('search', currentFilters.searchTerm);
            
            // Set pagination parameters
            const offset = (currentPage - 1) * pageSize;
            params.append('limit', pageSize.toString());
            params.append('offset', offset.toString());

            const response = await this.backendManager.apiRequest(`/transactions?${params}`);
            
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }

            const data: JournalApiResponse = await response.json();
            this.transactions.set(data.transactions || []);
            this.totalCount.set(data.total_count);
            this.hasMore.set(data.has_more);
            this.lastUpdated.set(new Date());

        } catch (error) {
            console.error('Error loading journal data:', error);
            this.error.set(error instanceof Error ? error.message : 'Failed to load journal data');
        } finally {
            this.loading.set(false);
        }
    }

    /**
     * Refresh journal data (loads all entries by default)
     */
    public async refresh(): Promise<void> {
        await this.loadAllEntries();
    }

    /**
     * Refresh only transactions (legacy method)
     */
    public async refreshTransactions(): Promise<void> {
        await this.loadData();
    }

    /**
     * Reload the backend data (tells Python API to reload the Beancount file)
     */
    public async reloadBackend(): Promise<void> {
        try {
            await this.backendManager.reloadBackendData();
            
            // Refresh our data after backend reload
            await this.loadAllEntries();
        } catch (error) {
            console.error('Error reloading backend:', error);
            this.error.set(error instanceof Error ? error.message : 'Failed to reload backend');
        }
    }

    /**
     * Update filters and reload data
     */
    public async updateFilters(newFilters: Partial<JournalFilters>): Promise<void> {
        this.filters.update(current => ({ ...current, ...newFilters }));
        // Reset to first page when filters change
        this.currentPage.set(1);
        await this.loadAllEntries(); // Load all entry types by default
    }

    /**
     * Clear all filters and reload data
     */
    public async clearFilters(): Promise<void> {
        this.filters.set({});
        this.currentPage.set(1);
        await this.loadAllEntries(); // Load all entry types by default
    }

    /**
     * Go to next page
     */
    public async nextPage(): Promise<void> {
        let hasMore = false;
        this.hasMore.subscribe(h => hasMore = h)();
        
        if (hasMore) {
            this.currentPage.update(p => p + 1);
            await this.loadAllEntries();
        }
    }

    /**
     * Go to previous page
     */
    public async previousPage(): Promise<void> {
        let currentPage = 1;
        this.currentPage.subscribe(p => currentPage = p)();
        
        if (currentPage > 1) {
            this.currentPage.update(p => p - 1);
            await this.loadAllEntries();
        }
    }

    /**
     * Go to specific page
     */
    public async goToPage(page: number): Promise<void> {
        if (page < 1) return;
        
        this.currentPage.set(page);
        await this.loadAllEntries();
    }

    /**
     * Change page size
     */
    public async changePageSize(newSize: number): Promise<void> {
        if (newSize < 1) return;
        
        this.pageSize.set(newSize);
        this.currentPage.set(1); // Reset to first page
        await this.loadAllEntries();
    }

    /**
     * Get available accounts from API
     */
    public async getAccounts(): Promise<string[]> {
        try {
            const response = await this.backendManager.apiRequest('/accounts');
            if (!response.ok) return [];
            
            const data = await response.json();
            return data.accounts || [];
        } catch (error) {
            console.error('Error fetching accounts:', error);
            return [];
        }
    }

    /**
     * Get available payees from API
     */
    public async getPayees(): Promise<string[]> {
        try {
            const response = await this.backendManager.apiRequest('/payees');
            if (!response.ok) return [];
            
            const data = await response.json();
            return data.payees || [];
        } catch (error) {
            console.error('Error fetching payees:', error);
            return [];
        }
    }

    /**
     * Get available tags from API
     */
    public async getTags(): Promise<string[]> {
        try {
            const response = await this.backendManager.apiRequest('/tags');
            if (!response.ok) return [];
            
            const data = await response.json();
            return data.tags || [];
        } catch (error) {
            console.error('Error fetching tags:', error);
            return [];
        }
    }

    /**
     * Get available commodities/currencies from ledger
     */
    public async getCommodities(): Promise<string[]> {
        try {
            const response = await this.backendManager.apiRequest('/commodities');
            if (!response.ok) return [];
            
            const data = await response.json();
            // Extract commodity names from the result
            return data.commodities?.map((c: any) => c.name) || [];
        } catch (error) {
            console.error('Error fetching commodities:', error);
            return [];
        }
    }

    /**
     * Get ledger statistics from API
     */
    public async getStatistics(): Promise<any> {
        try {
            const response = await this.backendManager.apiRequest('/statistics');
            if (!response.ok) return null;
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching statistics:', error);
            return null;
        }
    }

    /**
     * Get backend status information
     */
    public getBackendStatus() {
        return this.backendManager.getStatus();
    }

    /**
     * Get a specific transaction by ID
     */
    public async getTransactionById(transactionId: string): Promise<JournalTransaction | null> {
        try {
            const response = await this.backendManager.apiRequest(`/transactions/${transactionId}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch transaction: ${response.status} ${response.statusText}`);
            }
            
            const transaction = await response.json();
            return transaction as JournalTransaction;
        } catch (error) {
            console.error('Error fetching transaction:', error);
            this.error.set(`Failed to fetch transaction: ${error.message}`);
            return null;
        }
    }

    /**
     * Update a transaction
     */
    public async updateTransaction(transactionId: string, transactionData: Partial<JournalTransaction>): Promise<boolean> {
        try {
            const response = await this.backendManager.apiRequest(`/transactions/${transactionId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(transactionData)
            });

            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || `Failed to update transaction: ${response.status} ${response.statusText}`);
            }

            if (result.success) {
                // Reload entries to reflect the changes
                await this.loadAllEntries();
                return true;
            } else {
                throw new Error(result.error || 'Failed to update transaction');
            }
        } catch (error) {
            console.error('Error updating transaction:', error);
            this.error.set(`Failed to update transaction: ${error.message}`);
            return false;
        }
    }

    /**
     * Add a new entry (transaction, balance, or note)
     */
    public async addEntry(entryData: any): Promise<boolean> {
        try {
            const response = await this.backendManager.apiRequest('/transactions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(entryData)
            });

            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || `Failed to add ${entryData.type || 'entry'}: ${response.status} ${response.statusText}`);
            }

            if (result.success) {
                // Reload entries to reflect the changes
                await this.loadAllEntries();
                return true;
            } else {
                throw new Error(result.error || `Failed to add ${entryData.type || 'entry'}`);
            }
        } catch (error) {
            console.error('Error adding entry:', error);
            this.error.set(`Failed to add ${entryData.type || 'entry'}: ${error.message}`);
            return false;
        }
    }

    /**
     * Add a new transaction (legacy method)
     */
    public async addTransaction(transactionData: any): Promise<boolean> {
        transactionData.type = 'transaction';
        return this.addEntry(transactionData);
    }

    /**
     * Delete a transaction
     */
    public async deleteTransaction(transactionId: string): Promise<boolean> {
        try {
            const response = await this.backendManager.apiRequest(`/transactions/${transactionId}`, {
                method: 'DELETE'
            });

            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || `Failed to delete transaction: ${response.status} ${response.statusText}`);
            }

            if (result.success) {
                // Reload entries to reflect the changes
                await this.loadAllEntries();
                return true;
            } else {
                throw new Error(result.error || 'Failed to delete transaction');
            }
        } catch (error) {
            console.error('Error deleting transaction:', error);
            this.error.set(`Failed to delete transaction: ${error.message}`);
            return false;
        }
    }

    /**
     * Cleanup resources when controller is destroyed
     */
    public cleanup(): void {
        this.backendManager.stopBackend();
    }
}