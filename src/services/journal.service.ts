// src/services/journal.service.ts
import type { JournalEntry, JournalFilters, JournalApiResponse } from '../models/journal';
import type BeancountPlugin from '../main';
import { getTransactionEntries, getBalanceEntries, getNoteEntries } from '../utils';

/**
 * JournalService
 *
 * Provides methods to interact with journal data via BQL queries.
 * Handles fetching entries using direct Beancount queries.
 */
export class JournalService {
    private plugin: BeancountPlugin;

    /**
     * Creates an instance of JournalService.
     * @param {BeancountPlugin} plugin - The plugin instance.
     */
    constructor(plugin: BeancountPlugin) {
        this.plugin = plugin;
    }



    /**
     * Fetches journal entries based on filters and pagination.
     * @param {JournalFilters} filters - Filters to apply (date, account, etc.).
     * @param {number} [page=1] - Page number to retrieve.
     * @param {number} [pageSize=200] - Number of items per page.
     * @returns {Promise<JournalApiResponse>} The paginated response containing entries.
     */
    public async getEntries(filters: JournalFilters, page: number = 1, pageSize: number = 200): Promise<JournalApiResponse> {
        // Use BQL queries to fetch entries directly
        const entryTypes = filters.entryTypes || ['transaction', 'balance', 'note'];
        
        // Fetch all requested entry types in parallel
        const promises: Promise<any>[] = [];
        
        if (entryTypes.includes('transaction')) {
            promises.push(getTransactionEntries(this.plugin, filters, 1, 10000)); // Fetch all for merging
        }
        
        if (entryTypes.includes('balance')) {
            promises.push(getBalanceEntries(this.plugin, filters, 1, 10000)); // Fetch all for merging
        }
        
        if (entryTypes.includes('note')) {
            promises.push(getNoteEntries(this.plugin, filters, 1, 10000)); // Fetch all for merging
        }
        
        
        if (promises.length === 0) {
            return {
                entries: [],
                total_count: 0,
                returned_count: 0,
                offset: 0,
                limit: pageSize,
                has_more: false
            };
        }
        
        // Fetch all entry types
        const results = await Promise.all(promises);
        
        // Merge all entries
        let allEntries: JournalEntry[] = [];
        for (const result of results) {
            allEntries = allEntries.concat(result.entries);
        }
        
        // Sort by date descending
        allEntries.sort((a, b) => {
            const dateCompare = b.date.localeCompare(a.date);
            if (dateCompare !== 0) return dateCompare;
            // Secondary sort by type then id
            const typeCompare = a.type.localeCompare(b.type);
            if (typeCompare !== 0) return typeCompare;
            return a.id.localeCompare(b.id);
        });
        
        // Apply pagination
        const totalCount = allEntries.length;
        const offset = (page - 1) * pageSize;
        const paginatedEntries = allEntries.slice(offset, offset + pageSize);
        const hasMore = offset + paginatedEntries.length < totalCount;
        
        return {
            entries: paginatedEntries,
            total_count: totalCount,
            returned_count: paginatedEntries.length,
            offset,
            limit: pageSize,
            has_more: hasMore
        };
    }
}

