// src/lang/beancount-autocomplete.ts
// CodeMirror 6 autocomplete for Beancount files.
// Provides account-name, payee, narration, currency/commodity, tag, and link completions
// in a single context-aware CompletionSource.

import { autocompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import type { Extension } from '@codemirror/state';
import { parse as parseCsv } from 'csv-parse/sync';
import type BeancountPlugin from '../main';
import { getOpenAccounts, getPayees, getTags, getCommodities } from '../utils/accounts';
import { runQuery } from '../utils/queryRunner';

const CACHE_TTL = 30_000; // 30 seconds

// ---------------------------------------------------------------------------
// Cache structures
// ---------------------------------------------------------------------------

interface AccountCache {
    accounts: string[];
    timestamp: number;
}

interface PayeeCache {
    payees: string[];
    timestamp: number;
}

interface CommodityCache {
    commodities: string[];
    timestamp: number;
}

interface TagCache {
    tags: string[];
    timestamp: number;
}

interface LinkCache {
    links: string[];
    timestamp: number;
}

// Per-plugin caches keyed by plugin instance
const accountCacheMap = new WeakMap<BeancountPlugin, AccountCache>();
const payeeCacheMap   = new WeakMap<BeancountPlugin, PayeeCache>();
const commodityCacheMap = new WeakMap<BeancountPlugin, CommodityCache>();
const tagCacheMap     = new WeakMap<BeancountPlugin, TagCache>();
const linkCacheMap    = new WeakMap<BeancountPlugin, LinkCache>();

// ---------------------------------------------------------------------------
// Fetch helpers (each with its own TTL cache)
// ---------------------------------------------------------------------------

async function fetchAccountsSorted(plugin: BeancountPlugin): Promise<string[]> {
    const cached = accountCacheMap.get(plugin);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.accounts;

    let accounts: string[];
    try {
        const open = await getOpenAccounts(plugin);
        const openSet = new Set(open);
        try {
            const csv = await runQuery(
                plugin,
                'SELECT account, COUNT(*) AS n FROM postings GROUP BY account ORDER BY COUNT(*) DESC'
            );
            const records = parseCsv(csv, { columns: true, skip_empty_lines: true, trim: true }) as unknown as { account: string }[];
            const byFreq = records.map((r) => r.account).filter((a) => openSet.has(a));
            const seen = new Set(byFreq);
            const remaining = open.filter((a) => !seen.has(a)).sort();
            accounts = [...byFreq, ...remaining];
        } catch {
            accounts = open.slice().sort();
        }
    } catch {
        accounts = [];
    }

    accountCacheMap.set(plugin, { accounts, timestamp: Date.now() });
    return accounts;
}

async function fetchPayees(plugin: BeancountPlugin): Promise<string[]> {
    const cached = payeeCacheMap.get(plugin);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.payees;

    const payees = await getPayees(plugin);
    payeeCacheMap.set(plugin, { payees, timestamp: Date.now() });
    return payees;
}

async function fetchCommodities(plugin: BeancountPlugin): Promise<string[]> {
    const cached = commodityCacheMap.get(plugin);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.commodities;

    const raw = await getCommodities(plugin);
    const commodities = raw.map((c) => c.name).filter(Boolean);
    commodityCacheMap.set(plugin, { commodities, timestamp: Date.now() });
    return commodities;
}

async function fetchTags(plugin: BeancountPlugin): Promise<string[]> {
    const cached = tagCacheMap.get(plugin);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.tags;

    const tags = await getTags(plugin);
    tagCacheMap.set(plugin, { tags, timestamp: Date.now() });
    return tags;
}

async function fetchLinks(plugin: BeancountPlugin): Promise<string[]> {
    const cached = linkCacheMap.get(plugin);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.links;

    let links: string[];
    try {
        const csv = await runQuery(plugin, `SELECT DISTINCT joinstr(links) FROM entries WHERE links IS NOT NULL`);
        const records = parseCsv(csv, { columns: true, skip_empty_lines: true, trim: true }) as unknown as Record<string, string>[];
        const seen = new Set<string>();
        records.forEach((row) => {
            const raw = row['joinstr(links)'] || row.links || Object.values(row)[0];
            if (raw && typeof raw === 'string') {
                raw.split(',').forEach((l: string) => {
                    const link = l.trim().replace(/^\^/, '');
                    if (link) seen.add(link);
                });
            }
        });
        links = Array.from(seen).sort();
    } catch {
        links = [];
    }

    linkCacheMap.set(plugin, { links, timestamp: Date.now() });
    return links;
}

// ---------------------------------------------------------------------------
// Cache invalidation (called when ledger is saved/reloaded)
// ---------------------------------------------------------------------------

export function invalidateAccountCache(plugin: BeancountPlugin): void {
    accountCacheMap.delete(plugin);
    payeeCacheMap.delete(plugin);
    commodityCacheMap.delete(plugin);
    tagCacheMap.delete(plugin);
    linkCacheMap.delete(plugin);
}

// ---------------------------------------------------------------------------
// Context analysis helpers
// ---------------------------------------------------------------------------

/**
 * Returns the number of complete (closed) double-quoted string segments that
 * precede the cursor on the same line, and whether the cursor is currently
 * inside an open (unclosed) quoted segment.
 *
 * Example: `2024-01-01 * "Acme" "Grocerie`
 *   quotesBefore=1 (one closed pair), inString=true (cursor inside second)
 */
function analyseQuoteContext(lineUpToCursor: string): { closedPairs: number; inString: boolean } {
    let closedPairs = 0;
    let inString = false;
    for (let i = 0; i < lineUpToCursor.length; i++) {
        if (lineUpToCursor[i] === '"' && (i === 0 || lineUpToCursor[i - 1] !== '\\')) {
            if (inString) {
                closedPairs++;
                inString = false;
            } else {
                inString = true;
            }
        }
    }
    return { closedPairs, inString };
}

/**
 * Returns true when the line looks like a transaction header:
 *   YYYY-MM-DD [*|!|txn] ...
 */
function isTransactionHeaderLine(lineText: string): boolean {
    return /^\d{4}-\d{2}-\d{2}\s+[*!]/.test(lineText);
}

// ---------------------------------------------------------------------------
// Unified CompletionSource
// ---------------------------------------------------------------------------

function beancountCompletionSource(plugin: BeancountPlugin) {
    return async (context: CompletionContext): Promise<CompletionResult | null> => {
        const { state, pos } = context;
        const line = state.doc.lineAt(pos);
        const lineText = line.text;
        const lineUpToCursor = lineText.slice(0, pos - line.from);

        // Skip comment lines
        if (lineText.trimStart().startsWith(';')) return null;

        const { closedPairs, inString } = analyseQuoteContext(lineUpToCursor);
        const onTxnHeader = isTransactionHeaderLine(lineText);

        // ------------------------------------------------------------------
        // 1. Payee autocomplete
        //    Trigger: cursor inside the FIRST quoted string on a txn header line
        // ------------------------------------------------------------------
        if (onTxnHeader && inString && closedPairs === 0) {
            // Grab what the user has typed since the opening quote
            const lastQuote = lineUpToCursor.lastIndexOf('"');
            const typed = lineUpToCursor.slice(lastQuote + 1);

            const payees = await fetchPayees(plugin);
            const options = payees
                .filter((p) => p.toLowerCase().includes(typed.toLowerCase()))
                .map((p) => ({ label: p, type: 'text', detail: 'payee' }));

            if (options.length === 0) return null;
            return { from: pos - typed.length, options, filter: false };
        }

        // ------------------------------------------------------------------
        // 2. Narration autocomplete
        //    Trigger: cursor inside the SECOND quoted string on a txn header line
        //    Optionally filter narrations by the payee in the first string
        // ------------------------------------------------------------------
        if (onTxnHeader && inString && closedPairs === 1) {
            // Extract the payee from the first completed string pair
            const firstOpenIdx = lineText.indexOf('"');
            const firstCloseIdx = lineText.indexOf('"', firstOpenIdx + 1);
            const payeeValue = firstOpenIdx >= 0 && firstCloseIdx > firstOpenIdx
                ? lineText.slice(firstOpenIdx + 1, firstCloseIdx)
                : '';

            const lastQuote = lineUpToCursor.lastIndexOf('"');
            const typed = lineUpToCursor.slice(lastQuote + 1);

            let narrations: string[];
            try {
                const whereClause = payeeValue
                    ? `WHERE payee = "${payeeValue.replace(/"/g, '\\"')}"`
                    : '';
                const csv = await runQuery(
                    plugin,
                    `SELECT DISTINCT narration ${whereClause} ORDER BY date DESC`
                );
                const records = parseCsv(csv, { columns: true, skip_empty_lines: true, trim: true }) as unknown as Record<string, string>[];
                narrations = records
                    .map((r) => r.narration)
                    .filter((n: string) => n && n.trim() !== '');
            } catch {
                narrations = [];
            }

            const options = narrations
                .filter((n) => n.toLowerCase().includes(typed.toLowerCase()))
                .map((n) => ({ label: n, type: 'text', detail: 'narration' }));

            if (options.length === 0) return null;
            return { from: pos - typed.length, options, filter: false };
        }

        // ------------------------------------------------------------------
        // 3. Tag autocomplete  (#word on txn header lines)
        // ------------------------------------------------------------------
        const tagMatch = lineUpToCursor.match(/#([A-Za-z0-9_-]*)$/);
        if (tagMatch && onTxnHeader && !inString) {
            const typed = tagMatch[1];
            const tags = await fetchTags(plugin);
            const options = tags
                .filter((t) => t.toLowerCase().startsWith(typed.toLowerCase()))
                .map((t) => ({ label: '#' + t, type: 'keyword', detail: 'tag' }));

            if (options.length === 0) return null;
            return { from: pos - typed.length - 1, options, filter: false };
        }

        // ------------------------------------------------------------------
        // 4. Link autocomplete  (^word on txn header lines)
        // ------------------------------------------------------------------
        const linkMatch = lineUpToCursor.match(/\^([A-Za-z0-9_-]*)$/);
        if (linkMatch && onTxnHeader && !inString) {
            const typed = linkMatch[1];
            const links = await fetchLinks(plugin);
            const options = links
                .filter((l) => l.toLowerCase().startsWith(typed.toLowerCase()))
                .map((l) => ({ label: '^' + l, type: 'keyword', detail: 'link' }));

            if (options.length === 0) return null;
            return { from: pos - typed.length - 1, options, filter: false };
        }

        // ------------------------------------------------------------------
        // 5. Currency / commodity autocomplete
        //    Triggers:
        //      a) After a numeric amount token: "100 U" → suggests USD, USDC
        //      b) After commodity, price, balance directive keywords
        // ------------------------------------------------------------------
        if (!inString) {
            // 5a. After a number followed by a partial uppercase word
            const amountCurrencyMatch = lineUpToCursor.match(/\d+(?:\.\d+)?\s+([A-Z][A-Z0-9]*)$/);
            // 5b. After directive keywords
            const directiveCurrencyMatch = lineUpToCursor.match(/\b(?:commodity|price|balance)\s+(?:\S+\s+)?([A-Z][A-Z0-9]*)$/);

            const currMatch = amountCurrencyMatch || directiveCurrencyMatch;
            if (currMatch) {
                const typed = currMatch[1];
                const commodities = await fetchCommodities(plugin);
                const options = commodities
                    .filter((c) => c.startsWith(typed))
                    .map((c) => ({ label: c, type: 'constant', detail: 'commodity' }));

                if (options.length === 0) return null;
                return { from: pos - typed.length, options, filter: false };
            }
        }

        // ------------------------------------------------------------------
        // 6. Account-name autocomplete (existing behaviour)
        //    Skip when cursor is inside a string literal
        // ------------------------------------------------------------------
        if (!inString) {
            const match = lineUpToCursor.match(/([A-Z][A-Za-z0-9]*(?::[A-Za-z0-9]*)*)$/);
            if (match) {
                const prefix = match[1];
                if (/^(?:Assets|Liabilities|Equity|Income|Expenses)/.test(prefix)) {
                    const accounts = await fetchAccountsSorted(plugin);
                    const options = accounts
                        .filter((acc) => acc.startsWith(prefix))
                        .map((account) => ({
                            label: account,
                            type: 'variable',
                            detail: account.split(':')[0],
                            boost: 0,
                        }));

                    if (options.length === 0) return null;
                    return { from: pos - prefix.length, options, filter: false };
                }
            }
        }

        return null;
    };
}

// ---------------------------------------------------------------------------
// Public extension factory
// ---------------------------------------------------------------------------

/**
 * The raw CompletionSource for use when composing multiple sources into
 * a single autocompletion() extension.
 */
export { beancountCompletionSource };

/**
 * Returns a CodeMirror extension that provides context-aware Beancount autocomplete:
 * account names, payees, narrations, currencies/commodities, tags, and links.
 * Should only be added when the plugin setting `accountAutocomplete` is enabled.
 */
export function beancountAutocomplete(plugin: BeancountPlugin): Extension {
    return autocompletion({
        override: [beancountCompletionSource(plugin)],
        activateOnTyping: true,
    });
}
