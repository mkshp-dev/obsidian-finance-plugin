// src/stores/journal.store.ts
import { writable, derived, get } from 'svelte/store';
import type { JournalService } from '../services/journal.service';
import type { JournalEntry, JournalFilters, JournalTransaction } from '../models/journal';

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
    async function loadEntries() {
        loading.set(true);
        error.set(null);
        try {
            const currentFilters = get(filters);
            const page = get(currentPage);
            const size = get(pageSize);

            const data = await service.getEntries(currentFilters, page, size);

            entries.set(data.entries || []);
            totalCount.set(data.total_count);
            hasMore.set(data.has_more);
            lastUpdated.set(new Date());
        } catch (err: any) {
            console.error('Failed to load entries', err);
            error.set(err.message || 'Failed to load entries');
        } finally {
            loading.set(false);
        }
    }

    async function setFilters(newFilters: Partial<JournalFilters>) {
        filters.update(f => ({ ...f, ...newFilters }));
        currentPage.set(1);
        await loadEntries();
    }

    async function clearFilters() {
        filters.set({});
        currentPage.set(1);
        await loadEntries();
    }

    async function setPage(page: number) {
        if (page < 1) return;
        currentPage.set(page);
        await loadEntries();
    }

    async function refresh() {
        await loadEntries();
    }

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
