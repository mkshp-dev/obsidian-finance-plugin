// src/controllers/LiabilitiesController.ts
//
// Reads `open` directives from the structured accounts file, parses
// out loan-shaped metadata via liabilities.service, joins each
// account with its current balance pulled from BQL, and exposes a
// reactive Svelte store for the Liabilities & Receivables tab.

import { writable, type Writable, get } from 'svelte/store';
import type BeancountPlugin from '../main';
import { parse as parseCsv } from 'csv-parse/sync';
import * as queries from '../queries/index';
import {
    parseLoanAccounts,
    type LoanAccount,
} from '../services/liabilities.service';
import { Logger } from '../utils/logger';
import { formatCurrencyAmount } from '../utils/currency-precision';

export interface LoanRow extends LoanAccount {
    /** Live balance from the ledger, in the account's currency. Null if no movements yet. */
    currentBalance: number | null;
    /** Display string for the live balance (e.g. "-12,500.00 UYU"). */
    currentBalanceDisplay: string;
    /**
     * Where the displayed balance came from:
     *   'posted'     – `sum(position)` returned a real number for this account
     *   'principal'  – no postings yet, but the open directive carries a
     *                  `principal` meta we surface as the implicit balance
     *   'zero'       – BQL ran successfully and the account has no postings
     *                  and no principal — genuinely 0
     *   'unknown'    – BQL failed; we couldn't determine the balance
     */
    balanceSource: 'posted' | 'principal' | 'zero' | 'unknown';
}

export interface LiabilitiesState {
    isLoading: boolean;
    error: string | null;
    liabilities: LoanRow[];
    receivables: LoanRow[];
    /** Vault-relative path of the accounts file that was read. */
    sourcePath: string;
    /** Sum of liability balances in the operating currency, for a header KPI. */
    totalLiabilities: number | null;
    /** Sum of receivable balances in the operating currency, for a header KPI. */
    totalReceivables: number | null;
    /** Reporting currency. */
    currency: string;
}

/**
 * Resolve the accounts file path. We default to
 * `<structuredFolder>/accounts.beancount` since the plugin's
 * structured layout assumes that filename.
 */
function resolveAccountsPath(plugin: BeancountPlugin): string {
    const folder = plugin.settings.structuredFolderName?.trim() || 'Finances';
    return `${folder}/accounts.beancount`;
}

function parseBalanceCell(raw: string): { amount: number | null; currency: string | null } {
    // BQL `sum(position)` renders ONE fixed column per commodity in the
    // ledger, comma-joined, with BLANK slots for commodities this account
    // doesn't hold. A UYU-only balance therefore comes back as
    // "        ,-1570.0000 UYU" — an empty leading (USD) slot and the
    // value in a later slot. We must scan every comma-separated segment
    // and take the first that parses as "<number> <currency>", rather
    // than assuming the value lives in segment 0 (which silently read 0
    // for any account whose currency isn't the first ledger column).
    //
    // An entirely blank cell means the account is in the result set but
    // its positions net to zero (e.g. a pad -200 against a +200 payment)
    // — semantically 0, not "no data". Returning null there would let the
    // caller fall back to the principal metadata, defeating payoff / Force
    // Balance, so we return 0.
    if (!raw || !raw.trim()) return { amount: 0, currency: null };
    for (const seg of raw.split(',')) {
        const t = seg.trim();
        if (!t) continue;
        const parts = t.split(/\s+/);
        if (parts.length < 2) continue;
        const amount = parseFloat(parts[0].replace(/,/g, ''));
        if (!isFinite(amount)) continue;
        return { amount, currency: parts[1] || null };
    }
    // Non-empty cell but no segment parsed as number+currency → treat as 0.
    return { amount: 0, currency: null };
}

function formatBalance(amount: number | null, currency: string | null): string {
    return formatCurrencyAmount(amount, currency);
}

export class LiabilitiesController {
    private plugin: BeancountPlugin;
    public state: Writable<LiabilitiesState>;

    constructor(plugin: BeancountPlugin) {
        this.plugin = plugin;
        this.state = writable({
            isLoading: true,
            error: null,
            liabilities: [],
            receivables: [],
            sourcePath: '',
            totalLiabilities: null,
            totalReceivables: null,
            currency: plugin.settings.operatingCurrency || 'USD',
        });
    }

    async loadData(): Promise<void> {
        this.state.update(s => ({ ...s, isLoading: true, error: null }));
        const sourcePath = resolveAccountsPath(this.plugin);

        try {
            // Parse account file metadata. If the file is missing the tab
            // simply renders empty — this is a soft-fail situation, not an error.
            const adapter = this.plugin.app.vault.adapter;
            let accounts: LoanAccount[] = [];
            if (await adapter.exists(sourcePath)) {
                const content = await adapter.read(sourcePath);
                accounts = parseLoanAccounts(content);
            }

            // Pull live balances. Treat BQL failure as soft: we still show metadata.
            let balanceMap = new Map<string, { amount: number | null; currency: string | null }>();
            let bqlSucceeded = false;
            try {
                const csv = await this.plugin.runQuery(queries.getLoanBalancesQuery());
                const cleaned = csv.replace(/\r/g, '').trim();
                const records: string[][] = parseCsv(cleaned, { columns: false, skip_empty_lines: true, relax_column_count: true });
                const firstRowIsHeader = records[0]?.[0]?.toLowerCase().includes('account');
                const rows = firstRowIsHeader ? records.slice(1) : records;
                for (const row of rows) {
                    if (row.length < 2) continue;
                    balanceMap.set(row[0], parseBalanceCell(row[1]));
                }
                bqlSucceeded = true;
            } catch (e) {
                Logger.log('[LiabilitiesController] balance query failed (continuing with metadata only):', e);
            }

            const enriched: LoanRow[] = accounts.map(acc => {
                const bal = balanceMap.get(acc.account);
                const hasPosted = !!bal && bal.amount !== null;

                // Derive the displayed balance with this priority:
                //   1. real posted balance (BQL `sum(position)`)
                //   2. the `principal` meta — the contract face-value, which
                //      is the user's mental model of "what's owed" when no
                //      postings have been recorded yet
                //   3. genuine zero when BQL succeeded with no postings AND
                //      no principal (account just exists)
                //   4. unknown ("—") when BQL itself failed
                let amount: number | null;
                let currency: string;
                let source: LoanRow['balanceSource'];

                if (hasPosted) {
                    amount = bal!.amount;
                    currency = bal!.currency ?? acc.currency;
                    source = 'posted';
                } else if (acc.principal !== null && acc.principal !== 0) {
                    // For liabilities the user owes the principal (negative in
                    // beancount sign); for receivables the user is owed it
                    // (positive). Display value matches the absolute amount —
                    // we let the role badge convey the direction.
                    const sign = acc.role === 'liability' ? -1 : 1;
                    amount = sign * Math.abs(acc.principal);
                    currency = acc.currency;
                    source = 'principal';
                } else if (bqlSucceeded) {
                    amount = 0;
                    currency = acc.currency;
                    source = 'zero';
                } else {
                    amount = null;
                    currency = acc.currency;
                    source = 'unknown';
                }

                return {
                    ...acc,
                    currentBalance: amount,
                    currentBalanceDisplay: formatBalance(amount, currency),
                    balanceSource: source,
                };
            });

            const liabilities = enriched.filter(r => r.role === 'liability');
            const receivables = enriched.filter(r => r.role === 'receivable');

            // Header KPIs: sum balances *in their declared currency* — we're
            // not converting here (the Overview tab already shows the
            // operating-currency aggregate via the existing query).
            const sumByCurrency = (rows: LoanRow[]): number | null => {
                const present = rows.filter(r => r.currentBalance !== null);
                if (present.length === 0) return null;
                return present.reduce((acc, r) => acc + (r.currentBalance ?? 0), 0);
            };

            this.state.set({
                isLoading: false,
                error: null,
                liabilities,
                receivables,
                sourcePath,
                totalLiabilities: sumByCurrency(liabilities),
                totalReceivables: sumByCurrency(receivables),
                currency: this.plugin.settings.operatingCurrency || 'USD',
            });
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            Logger.log('[LiabilitiesController] loadData failed:', e);
            this.state.update(s => ({ ...s, isLoading: false, error: msg }));
        }
    }

    async refresh(): Promise<void> {
        await this.loadData();
    }
}
