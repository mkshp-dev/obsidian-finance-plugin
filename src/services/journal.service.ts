// src/services/journal.service.ts
import { ApiClient } from '../api/client';
import { ENDPOINTS } from '../api/endpoints';
import type { JournalEntry, JournalFilters, JournalApiResponse, JournalTransaction } from '../models/journal';

export class JournalService {
    private api: ApiClient;

    constructor(api: ApiClient) {
        this.api = api;
    }

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

    public async getTransaction(id: string): Promise<JournalTransaction> {
        return this.api.get<JournalTransaction>(`${ENDPOINTS.TRANSACTIONS}/${id}`);
    }

    public async createEntry(entry: Partial<JournalEntry>): Promise<boolean> {
        const result = await this.api.post<{success: boolean, error?: string}>(ENDPOINTS.TRANSACTIONS, entry);
        if (!result.success) throw new Error(result.error || 'Failed to create entry');
        return true;
    }

    public async updateTransaction(id: string, entry: Partial<JournalTransaction>): Promise<boolean> {
        const result = await this.api.put<{success: boolean, error?: string}>(`${ENDPOINTS.TRANSACTIONS}/${id}`, entry);
        if (!result.success) throw new Error(result.error || 'Failed to update transaction');
        return true;
    }

    public async deleteTransaction(id: string): Promise<boolean> {
        const result = await this.api.delete<{success: boolean, error?: string}>(`${ENDPOINTS.TRANSACTIONS}/${id}`);
        if (!result.success) throw new Error(result.error || 'Failed to delete transaction');
        return true;
    }

    public async reloadBackend(): Promise<void> {
        await this.api.post(ENDPOINTS.RELOAD, {});
    }
}
