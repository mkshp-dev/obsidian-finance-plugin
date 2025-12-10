// src/services/journal.service.ts
import { ApiClient } from '../api/client';
import { ENDPOINTS } from '../api/endpoints';
import type { JournalEntry, JournalFilters, JournalApiResponse, JournalTransaction } from '../models/journal';

/**
 * JournalService
 *
 * Provides methods to interact with the journal data via the API Client.
 * Handles fetching entries, transactions, and modifying data (create, update, delete).
 */
export class JournalService {
    private api: ApiClient;

    /**
     * Creates an instance of JournalService.
     * @param {ApiClient} api - The API client instance.
     */
    constructor(api: ApiClient) {
        this.api = api;
    }

    /**
     * Fetches all account names from the journal.
     * @returns {Promise<string[]>} Array of account names.
     */
    public async getAccounts(): Promise<string[]> {
        const response = await this.api.get<{accounts: string[]}>(`${ENDPOINTS.ACCOUNTS}`);
        return response.accounts;
    }

    /**
     * Fetches journal entries based on filters and pagination.
     * @param {JournalFilters} filters - Filters to apply (date, account, etc.).
     * @param {number} [page=1] - Page number to retrieve.
     * @param {number} [pageSize=200] - Number of items per page.
     * @returns {Promise<JournalApiResponse>} The paginated response containing entries.
     */
    public async getEntries(filters: JournalFilters, page: number = 1, pageSize: number = 200): Promise<JournalApiResponse> {
        const params = new URLSearchParams();
        if (filters.startDate) params.append('start_date', filters.startDate);
        if (filters.endDate) params.append('end_date', filters.endDate);
        if (filters.account) params.append('account', filters.account);
        if (filters.payee) params.append('payee', filters.payee);
        if (filters.tag) params.append('tag', filters.tag);
        if (filters.searchTerm) params.append('search', filters.searchTerm);
        if (filters.entryTypes) params.append('types', filters.entryTypes.join(','));

        const offset = (page - 1) * pageSize;
        params.append('limit', pageSize.toString());
        params.append('offset', offset.toString());

        return this.api.get<JournalApiResponse>(`${ENDPOINTS.ENTRIES}?${params}`);
    }

    /**
     * Fetches a single transaction by ID.
     * @param {string} id - The transaction ID.
     * @returns {Promise<JournalTransaction>} The transaction object.
     */
    public async getTransaction(id: string): Promise<JournalTransaction> {
        return this.api.get<JournalTransaction>(`${ENDPOINTS.TRANSACTIONS}/${id}`);
    }

    /**
     * Creates a new journal entry (transaction, note, etc.).
     * @param {Partial<JournalEntry>} entry - The entry data.
     * @returns {Promise<boolean>} True if successful.
     * @throws {Error} If the creation fails.
     */
    public async createEntry(entry: Partial<JournalEntry>): Promise<boolean> {
        const result = await this.api.post<{success: boolean, error?: string}>(ENDPOINTS.TRANSACTIONS, entry);
        if (!result.success) throw new Error(result.error || 'Failed to create entry');
        return true;
    }

    /**
     * Updates an existing transaction.
     * @param {string} id - The transaction ID to update.
     * @param {Partial<JournalTransaction>} entry - The updated transaction data.
     * @returns {Promise<boolean>} True if successful.
     * @throws {Error} If the update fails.
     */
    public async updateTransaction(id: string, entry: Partial<JournalTransaction>): Promise<boolean> {
        const result = await this.api.put<{success: boolean, error?: string}>(`${ENDPOINTS.TRANSACTIONS}/${id}`, entry);
        if (!result.success) throw new Error(result.error || 'Failed to update transaction');
        return true;
    }

    /**
     * Deletes a transaction by ID.
     * @param {string} id - The transaction ID.
     * @returns {Promise<boolean>} True if successful.
     * @throws {Error} If the deletion fails.
     */
    public async deleteTransaction(id: string): Promise<boolean> {
        const result = await this.api.delete<{success: boolean, error?: string}>(`${ENDPOINTS.TRANSACTIONS}/${id}`);
        if (!result.success) throw new Error(result.error || 'Failed to delete transaction');
        return true;
    }

    /**
     * Triggers a reload of the backend data (re-reads the Beancount file).
     * @returns {Promise<void>}
     */
    public async reloadBackend(): Promise<void> {
        await this.api.post(ENDPOINTS.RELOAD, {});
    }

    /**
     * Gets the status of an account (open/closed, dates).
     * @param {string} accountName - The account name to check.
     * @returns {Promise<{account: string, is_open: boolean, open_date: string | null, close_date: string | null}>}
     */
    public async getAccountStatus(accountName: string): Promise<{account: string, is_open: boolean, open_date: string | null, close_date: string | null}> {
        return this.api.get(`${ENDPOINTS.ACCOUNTS}/${encodeURIComponent(accountName)}/status`);
    }

    /**
     * Opens a new account.
     * @param {string} accountName - The account name to open.
     * @param {string} date - The date to open the account (YYYY-MM-DD).
     * @param {string[]} [currencies] - Optional list of currencies for the account.
     * @param {string} [booking] - Optional booking method.
     * @returns {Promise<boolean>} True if successful.
     * @throws {Error} If the operation fails.
     */
    public async openAccount(accountName: string, date: string, currencies?: string[], booking?: string): Promise<boolean> {
        const data: any = {
            type: 'open',
            account: accountName,
            date
        };
        if (currencies && currencies.length > 0) data.currencies = currencies;
        if (booking) data.booking = booking;

        const result = await this.api.post<{success: boolean, error?: string}>(ENDPOINTS.ACCOUNTS_OPEN, data);
        if (!result.success) throw new Error(result.error || 'Failed to open account');
        return true;
    }

    /**
     * Closes an existing account.
     * @param {string} accountName - The account name to close.
     * @param {string} date - The date to close the account (YYYY-MM-DD).
     * @returns {Promise<boolean>} True if successful.
     * @throws {Error} If the operation fails.
     */
    public async closeAccount(accountName: string, date: string): Promise<boolean> {
        const data = {
            type: 'close',
            account: accountName,
            date
        };

        const result = await this.api.post<{success: boolean, error?: string}>(ENDPOINTS.ACCOUNTS_CLOSE, data);
        if (!result.success) throw new Error(result.error || 'Failed to close account');
        return true;
    }
}
