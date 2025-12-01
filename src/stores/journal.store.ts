// src/stores/journal.store.ts
import { writable, derived, get } from 'svelte/store';
import type { JournalService } from '../services/journal.service';
import type { JournalEntry, JournalFilters, JournalTransaction } from '../models/journal';
import { Logger } from '../utils/logger';

/**
 * Creates a Svelte store for managing journal entries and state.
 *
 * Provides reactive stores for entries, loading state, errors, and pagination.
 * Exposes methods to load, filter, and modify entries via the JournalService.
 *
 * @param {JournalService} service - The journal service instance.
 * @returns {object} The store object containing state and actions.
 */
export function createJournalStore(service: JournalService) {
    // State
    const entries = writable<JournalEntry[]>([]);
    const transactions = derived(entries, $entries =>
        $entries.filter(e => e.type === 'transaction') as JournalTransaction[]
    );

    const filters = writable<JournalFilters>({});
    const loading = writable<boolean>(false);
    const error = writable<string | null>(null);
    const lastUpdated = writable<Date | null>(null);

    // Pagination
    const currentPage = writable<number>(1);
    const pageSize = writable<number>(200);
    const totalCount = writable<number>(0);
    const hasMore = writable<boolean>(false);

    // Actions

    /**
     * Loads entries from the backend based on current filters and pagination.
     */
    async function loadEntries() {
        loading.set(true);
        error.set(null);
        try {
            const currentFilters = get(filters);
            const page = get(currentPage);
            const size = get(pageSize);

            Logger.log('Loading entries...', { filters: currentFilters, page, size });
            const data = await service.getEntries(currentFilters, page, size);

            // Ensure entries is always an array to prevent crashes
            if (Array.isArray(data.entries)) {
                entries.set(data.entries);
            } else {
                Logger.warn('JournalStore: Received invalid entries data', data.entries);
                entries.set([]);
            }

            totalCount.set(data.total_count || 0);
            hasMore.set(data.has_more || false);
            lastUpdated.set(new Date());
        } catch (err: any) {
            Logger.error('Failed to load entries', err);
            error.set(err.message || 'Failed to load entries');
        } finally {
            loading.set(false);
        }
    }

    /**
     * Updates the filters and reloads entries (resets to page 1).
     * @param {Partial<JournalFilters>} newFilters - The new filters to apply.
     */
    async function setFilters(newFilters: Partial<JournalFilters>) {
        Logger.log('Setting filters', newFilters);
        filters.update(f => ({ ...f, ...newFilters }));
        currentPage.set(1);
        await loadEntries();
    }

    /**
     * Clears all filters and reloads entries.
     */
    async function clearFilters() {
        filters.set({});
        currentPage.set(1);
        await loadEntries();
    }

    /**
     * Sets the current page and reloads entries.
     * @param {number} page - The page number (1-based).
     */
    async function setPage(page: number) {
        if (page < 1) return;
        currentPage.set(page);
        await loadEntries();
    }

    /**
     * Refreshes the current view.
     */
    async function refresh() {
        await loadEntries();
    }

    /**
     * Adds a new entry via the service and reloads.
     * @param {any} entry - The entry data.
     * @returns {Promise<boolean>} True if successful.
     */
    async function addEntry(entry: any) {
        try {
            await service.createEntry(entry);
            await loadEntries();
            return true;
        } catch (err: any) {
            error.set(err.message);
            return false;
        }
    }

    /**
     * Updates an existing transaction.
     * @param {string} id - The transaction ID.
     * @param {any} data - The updated data.
     * @returns {Promise<boolean>} True if successful.
     */
    async function updateTransaction(id: string, data: any) {
        try {
            await service.updateTransaction(id, data);
            await loadEntries();
            return true;
        } catch (err: any) {
            error.set(err.message);
            return false;
        }
    }

    /**
     * Deletes a transaction.
     * @param {string} id - The transaction ID.
     * @returns {Promise<boolean>} True if successful.
     */
    async function deleteTransaction(id: string) {
        try {
            await service.deleteTransaction(id);
            await loadEntries();
            return true;
        } catch (err: any) {
            error.set(err.message);
            return false;
        }
    }

    return {
        // State
        entries: { subscribe: entries.subscribe },
        transactions: { subscribe: transactions.subscribe },
        filters: { subscribe: filters.subscribe },
        loading: { subscribe: loading.subscribe },
        error: { subscribe: error.subscribe },
        lastUpdated: { subscribe: lastUpdated.subscribe },
        currentPage: { subscribe: currentPage.subscribe },
        pageSize: { subscribe: pageSize.subscribe },
        totalCount: { subscribe: totalCount.subscribe },
        hasMore: { subscribe: hasMore.subscribe },

        // Actions
        loadEntries,
        setFilters,
        clearFilters,
        setPage,
        refresh,
        addEntry,
        updateTransaction,
        deleteTransaction,
        reloadBackend: () => service.reloadBackend().then(loadEntries)
    };
}
