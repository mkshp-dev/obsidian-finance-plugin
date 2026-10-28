// src/utils/journal.ts
// BQL-backed journal entry fetchers: balance assertions and notes.

import { parse as parseCsv } from 'csv-parse/sync';
import type BeancountPlugin from '../main';
import { runQuery } from './queryRunner';
import { Logger } from './logger';
import type { JournalApiResponse, JournalFilters, JournalBalance, JournalNote, JournalTransaction, JournalPosting } from '../models/journal';

/** Shape of a balance row returned by BQL. */
interface BalanceRow {
    date: string;
    account: string;
    amount: string;
    tolerance: string;
    discrepancy: string;
    filename: string;
    lineno: string;
}

/** Shape of a note row returned by BQL. */
interface NoteRow {
    date: string;
    account: string;
    comment: string;
    tags: string;
    links: string;
    filename: string;
    lineno: string;
}

/** Shape of a posting row returned by BQL. */
interface PostingRow {
    id: string;
    date: string;
    flag: string;
    payee: string;
    narration: string;
    tags: string;
    links: string;
    filename: string;
    lineno: string;
    account: string;
    number: string;
    currency: string;
    cost_number: string;
    cost_currency: string;
    cost_date: string;
    price: string;
    entry_meta: string;
}

/** bean-query prints tag/link sets as Python reprs: `frozenset({'a', 'b'})` or `frozenset()`. */
function parseBqlSet(value: string | undefined): string[] {
    return [...(value || '').matchAll(/'([^']*)'/g)].map((m) => m[1]).sort();
}

/** Where an entry lives, kept in its metadata (as for transactions) so edits and deletes target that exact line. */
function locationMetadata(row: { filename: string; lineno: string }): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};
    if (row.filename) metadata['filename'] = row.filename;
    const lineno = parseInt(row.lineno);
    if (!isNaN(lineno)) metadata['lineno'] = lineno;
    return metadata;
}

// --- BALANCE ENTRIES ---

/**
 * Fetches balance entries from Beancount using BQL.
 */
export async function getBalanceEntries(
    plugin: BeancountPlugin,
    filters: JournalFilters = {},
    page = 1,
    pageSize = 200
): Promise<JournalApiResponse> {
    try {
        Logger.log('[getBalanceEntries] Fetching with filters:', filters);

        const whereConditions: string[] = [];
        if (filters.startDate) whereConditions.push(`date >= ${filters.startDate}`);
        if (filters.endDate) whereConditions.push(`date <= ${filters.endDate}`);
        if (filters.account) whereConditions.push(`account ~ "${filters.account}"`);

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const query = `SELECT date, account, amount, tolerance, discrepancy, meta['filename'] AS filename, meta['lineno'] AS lineno FROM #balances ${whereClause} ORDER BY date DESC, account`;

        Logger.log('[getBalanceEntries] Running BQL query:', query);
        const csv = await runQuery(plugin, query);

        const records = parseCsv(csv.replace(/\r/g, '').trim(), {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        }) as unknown as BalanceRow[];

        Logger.log(`[getBalanceEntries] Parsed ${records.length} balance rows`);

        let balances: JournalBalance[] = records.map((row) => {
            const amountStr = (row.amount || '').trim();
            const amountParts = amountStr.split(/\s+/);
            const amount = amountParts.length >= 2 ? amountParts[0] : '';
            const currency = amountParts.length >= 2 ? amountParts[1] : '';
            return {
                // Unique even for several assertions on one account and day (e.g. one per currency).
                id: `balance|${row.filename}|${row.lineno}`,
                type: 'balance' as const,
                date: row.date,
                account: row.account,
                amount,
                currency,
                tolerance: row.tolerance || null,
                diff_amount: row.discrepancy || null,
                metadata: locationMetadata(row),
            };
        });

        // In-memory filters
        if (filters.payee || filters.tag) {
            balances = [];
        } else if (filters.searchTerm) {
            const q = filters.searchTerm.toLowerCase();
            balances = balances.filter((b) =>
                b.account?.toLowerCase().includes(q) ||
                b.amount?.toLowerCase().includes(q) ||
                b.currency?.toLowerCase().includes(q)
            );
        }

        // Re-sort only when an in-memory filter disrupted BQL ORDER BY
        if (filters.searchTerm || filters.payee || filters.tag) {
            balances.sort((a, b) => {
                const d = b.date.localeCompare(a.date);
                return d !== 0 ? d : a.account.localeCompare(b.account);
            });
        }

        const totalCount = balances.length;
        const offset = (page - 1) * pageSize;
        const paginatedBalances = balances.slice(offset, offset + pageSize);

        return {
            entries: paginatedBalances,
            total_count: totalCount,
            returned_count: paginatedBalances.length,
            offset,
            limit: pageSize,
            has_more: offset + paginatedBalances.length < totalCount,
        };
    } catch (error) {
        Logger.error('[getBalanceEntries] Error:', error);
        throw error;
    }
}

// --- NOTE ENTRIES ---

/**
 * Fetches note entries from Beancount using BQL.
 */
export async function getNoteEntries(
    plugin: BeancountPlugin,
    filters: JournalFilters = {},
    page = 1,
    pageSize = 200
): Promise<JournalApiResponse> {
    try {
        Logger.log('[getNoteEntries] Fetching with filters:', filters);

        const whereConditions: string[] = [];
        if (filters.startDate) whereConditions.push(`date >= ${filters.startDate}`);
        if (filters.endDate) whereConditions.push(`date <= ${filters.endDate}`);
        if (filters.account) whereConditions.push(`account ~ "${filters.account}"`);

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const query = `SELECT date, account, comment, tags, links, meta['filename'] AS filename, meta['lineno'] AS lineno FROM #notes ${whereClause} ORDER BY date DESC, account`;

        Logger.log('[getNoteEntries] Running BQL query:', query);
        const csv = await runQuery(plugin, query);

        const records = parseCsv(csv.replace(/\r/g, '').trim(), {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        }) as unknown as NoteRow[];

        Logger.log(`[getNoteEntries] Parsed ${records.length} note rows`);

        let notes: JournalNote[] = records.map((row) => ({
            id: `note|${row.filename}|${row.lineno}`,
            type: 'note' as const,
            date: row.date,
            account: row.account,
            comment: row.comment || '',
            tags: parseBqlSet(row.tags),
            links: parseBqlSet(row.links),
            metadata: locationMetadata(row),
        }));

        // In-memory filters
        if (filters.payee) {
            notes = [];
        } else {
            if (filters.tag) {
                const tag = filters.tag.toLowerCase();
                notes = notes.filter((note) => (note.tags ?? []).some((t) => t.toLowerCase() === tag));
            }
            if (filters.searchTerm) {
                const q = filters.searchTerm.toLowerCase();
                notes = notes.filter((n) =>
                    n.account?.toLowerCase().includes(q) ||
                    n.comment?.toLowerCase().includes(q)
                );
            }
        }

        // Re-sort only when an in-memory filter disrupted BQL ORDER BY
        if (filters.searchTerm || filters.payee || filters.tag) {
            notes.sort((a, b) => {
                const d = b.date.localeCompare(a.date);
                return d !== 0 ? d : a.account.localeCompare(b.account);
            });
        }

        const totalCount = notes.length;
        const offset = (page - 1) * pageSize;
        const paginatedNotes = notes.slice(offset, offset + pageSize);

        return {
            entries: paginatedNotes,
            total_count: totalCount,
            returned_count: paginatedNotes.length,
            offset,
            limit: pageSize,
            has_more: offset + paginatedNotes.length < totalCount,
        };
    } catch (error) {
        Logger.error('[getNoteEntries] Error:', error);
        throw error;
    }
}

// --- TRANSACTION ENTRIES ---

/**
 * Fetches transaction entries from Beancount using BQL, groups postings by transaction ID,
 * and returns a paginated JournalApiResponse.
 */
export async function getTransactionEntries(
    plugin: BeancountPlugin,
    filters: JournalFilters = {},
    page = 1,
    pageSize = 200
): Promise<JournalApiResponse> {
    try {
        Logger.log('[getTransactionEntries] Fetching with filters:', filters);

        const whereConditions: string[] = [];
        if (filters.startDate) whereConditions.push(`date >= ${filters.startDate}`);
        if (filters.endDate) whereConditions.push(`date <= ${filters.endDate}`);
        // Account filter applied in-memory after grouping
        if (filters.payee) whereConditions.push(`payee ~ "${filters.payee}"`);
        if (filters.tag) whereConditions.push(`"${filters.tag}" IN tags`);

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const query = `SELECT id, date, flag, payee, narration, tags, links, filename, lineno, account, number, currency, cost_number, cost_currency, cost_date, price, entry.meta as entry_meta FROM postings ${whereClause} ORDER BY date DESC, id, account`;

        Logger.log('[getTransactionEntries] Running BQL query:', query);
        const csv = await runQuery(plugin, query);

        const records = parseCsv(csv.replace(/\r/g, '').trim(), {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        }) as unknown as PostingRow[];

        Logger.log(`[getTransactionEntries] Parsed ${records.length} posting rows`);

        // Group postings by transaction ID
        const transactionsMap = new Map<string, JournalTransaction>();

        for (const row of records) {
            const txnId = row.id;

            if (!transactionsMap.has(txnId)) {
                const tagsStr = row.tags || '';
                const linksStr = row.links || '';
                const tags = tagsStr.trim() ? tagsStr.split(',').map((t) => t.trim()).filter(Boolean) : [];
                const links = linksStr.trim() ? linksStr.split(',').map((l) => l.trim()).filter(Boolean) : [];

                const entryMetaStr = row.entry_meta || '{}';
                let metadata: Record<string, unknown> = {};
                try { metadata = JSON.parse(entryMetaStr) as Record<string, unknown>; } catch { metadata = { raw: entryMetaStr }; }

                if (row.filename) metadata['filename'] = row.filename;
                if (row.lineno) {
                    const n = parseInt(row.lineno);
                    if (!isNaN(n)) metadata['lineno'] = n;
                }

                transactionsMap.set(txnId, {
                    id: txnId,
                    type: 'transaction' as const,
                    date: row.date,
                    flag: row.flag || '*',
                    payee: row.payee || null,
                    narration: row.narration || '',
                    tags,
                    links,
                    metadata,
                    postings: [],
                });
            }

            const transaction = transactionsMap.get(txnId)!;
            const posting: JournalPosting = {
                account: row.account,
                amount: row.number || null,
                currency: row.currency || null,
                flag: null,
                comment: null,
                metadata: {},
            };

            if (row.cost_number || row.cost_currency) {
                posting.cost = {
                    number: row.cost_number || null,
                    currency: row.cost_currency || null,
                    date: row.cost_date || null,
                    label: null,
                    isTotal: false,
                };
            }

            const priceStr = row.price;
            if (priceStr?.trim()) {
                const priceParts = priceStr.trim().split(/\s+/);
                if (priceParts.length >= 2) {
                    posting.price = { amount: priceParts[0], currency: priceParts[1], isTotal: false };
                }
            }

            transaction.postings.push(posting);
        }

        let transactions = Array.from(transactionsMap.values());

        // In-memory account filter — applied after grouping so whole transactions are pulled
        if (filters.account) {
            const accountPattern = filters.account;
            transactions = transactions.filter((txn) =>
                txn.postings.some((p) => {
                    try { return new RegExp(accountPattern).test(p.account); }
                    catch { return p.account?.includes(accountPattern); }
                })
            );
        }

        // In-memory search term filter
        if (filters.searchTerm) {
            const q = filters.searchTerm.toLowerCase();
            transactions = transactions.filter((txn) =>
                txn.narration?.toLowerCase().includes(q) ||
                txn.payee?.toLowerCase().includes(q) ||
                txn.postings.some((p) => p.account?.toLowerCase().includes(q))
            );
        }

        // Re-sort only when in-memory filters were applied
        if (filters.account || filters.searchTerm) {
            transactions.sort((a, b) => {
                const d = b.date.localeCompare(a.date);
                return d !== 0 ? d : a.id.localeCompare(b.id);
            });
        }

        const totalCount = transactions.length;
        const offset = (page - 1) * pageSize;
        const paginatedTransactions = transactions.slice(offset, offset + pageSize);

        return {
            entries: paginatedTransactions,
            total_count: totalCount,
            returned_count: paginatedTransactions.length,
            offset,
            limit: pageSize,
            has_more: offset + paginatedTransactions.length < totalCount,
        };
    } catch (error) {
        Logger.error('[getTransactionEntries] Error:', error);
        throw error;
    }
}
