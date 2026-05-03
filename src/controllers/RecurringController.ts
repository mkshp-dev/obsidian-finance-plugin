// src/controllers/RecurringController.ts
//
// Reads the recurring.beancount file from the structured ledger folder
// (or a path overridden in settings), parses it via recurring.service,
// and exposes Svelte stores for the dashboard widget.

import { writable, derived, type Readable, type Writable } from 'svelte/store';
import type BeancountPlugin from '../main';
import {
    parseRecurringFile,
    getUpcoming,
    type RecurringRule,
    type RecurringOccurrence,
} from '../services/recurring.service';
import {
    parseLoanAccounts,
    synthesizeRecurringFromLoans,
} from '../services/liabilities.service';

export class RecurringController {
    private plugin: BeancountPlugin;

    public rules: Writable<RecurringRule[]> = writable([]);
    public loading: Writable<boolean> = writable(false);
    public error: Writable<string | null> = writable(null);
    public lastLoaded: Writable<Date | null> = writable(null);
    public upcoming: Readable<RecurringOccurrence[]>;

    constructor(plugin: BeancountPlugin) {
        this.plugin = plugin;
        this.upcoming = derived(this.rules, ($rules) => {
            const days = Math.max(1, plugin.settings.recurringLookaheadDays ?? 30);
            return getUpcoming($rules, days);
        });
    }

    /**
     * Resolve the path to the recurring file. Priority:
     *   1. plugin.settings.recurringFilePath (vault-relative) if set
     *   2. <structuredFolderName>/recurring.beancount
     */
    private resolveVaultPath(): string {
        const explicit = this.plugin.settings.recurringFilePath?.trim();
        if (explicit) return explicit;
        const folder = this.plugin.settings.structuredFolderName?.trim() || 'Finances';
        return `${folder}/recurring.beancount`;
    }

    private resolveAccountsPath(): string {
        const folder = this.plugin.settings.structuredFolderName?.trim() || 'Finances';
        return `${folder}/accounts.beancount`;
    }

    async loadData(): Promise<void> {
        this.loading.set(true);
        this.error.set(null);
        try {
            const adapter = this.plugin.app.vault.adapter;

            // 1. Explicit rules from recurring.beancount.
            const recurringPath = this.resolveVaultPath();
            const explicit = (await adapter.exists(recurringPath))
                ? parseRecurringFile(await adapter.read(recurringPath))
                : [];

            // 2. Synthetic rules derived from loan-shaped accounts in
            //    accounts.beancount (γ integration). An explicit rule
            //    with the same nickname always wins, so the user can
            //    override the auto-generated schedule by authoring a
            //    `custom "recurring"` line with nickname `loan:<acct>`.
            const accountsPath = this.resolveAccountsPath();
            let synthetic: RecurringRule[] = [];
            if (await adapter.exists(accountsPath)) {
                try {
                    const accountsContent = await adapter.read(accountsPath);
                    const loans = parseLoanAccounts(accountsContent);
                    const generated = synthesizeRecurringFromLoans(loans);
                    const explicitNicknames = new Set(explicit.map(r => r.nickname));
                    synthetic = generated
                        .filter(g => !explicitNicknames.has(g.nickname))
                        .map(g => ({
                            nickname: g.nickname,
                            cadence: g.cadence,
                            expenseAccount: g.expenseAccount,
                            fundingAccount: g.fundingAccount,
                            amount: g.amount,
                            currency: g.currency,
                            startDate: g.startDate,
                            synthetic: true,
                            fromLoanAccount: g.fromLoanAccount,
                        }));
                } catch (_) {
                    // Soft-fail: synthetic merge is best-effort.
                }
            }

            this.rules.set([...explicit, ...synthetic]);
            this.lastLoaded.set(new Date());
        } catch (e) {
            this.error.set(e instanceof Error ? e.message : String(e));
            this.rules.set([]);
        } finally {
            this.loading.set(false);
        }
    }

    async refresh(): Promise<void> {
        await this.loadData();
    }
}
