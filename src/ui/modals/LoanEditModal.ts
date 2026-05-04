// src/ui/modals/LoanEditModal.ts

import { App, Modal, Notice } from 'obsidian';
import type BeancountPlugin from '../../main';
import LoanEditModalComponent from './LoanEditModal.svelte';
import {
    parseLoanAccounts,
    applyLoanEdits,
    type LoanFormDraft,
} from '../../services/liabilities.service';
import { getOpenAccounts, getCommodities } from '../../utils/accounts';
import { getAllCurrenciesQuery } from '../../queries/index';
import { parse as parseCsv } from 'csv-parse/sync';
import { Logger } from '../../utils/logger';

type Mode = 'add' | 'edit';

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isoNextDay(iso: string): string {
    const d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
}

async function appendToFile(adapter: any, path: string, block: string): Promise<void> {
    const exists = await adapter.exists(path);
    const original = exists ? await adapter.read(path) : '';
    const sep = !original ? '' : (original.endsWith('\n') ? '' : '\n');
    await adapter.write(path, original + sep + block);
}

export class LoanEditModal extends Modal {
    plugin: BeancountPlugin;
    private component: any;
    private mode: Mode;
    private initial: LoanFormDraft;
    private onSaved?: () => void;

    constructor(
        app: App,
        plugin: BeancountPlugin,
        opts: { mode: Mode; initial: LoanFormDraft; onSaved?: () => void },
    ) {
        super(app);
        this.plugin = plugin;
        this.mode = opts.mode;
        this.initial = opts.initial;
        this.onSaved = opts.onSaved;
    }

    private resolveAccountsPath(): string {
        const folder = this.plugin.settings.structuredFolderName?.trim() || 'Finances';
        return `${folder}/accounts.beancount`;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        this.modalEl.style.maxWidth = '720px';
        this.modalEl.style.width = '90vw';
        this.setTitle(this.mode === 'add' ? 'Add loan account' : `Edit ${this.initial.account}`);

        let accounts: string[] = [];
        let currencies: string[] = [this.plugin.settings.operatingCurrency || 'USD'];
        try {
            // Two sources, unioned: `#commodities` covers every declared
            // commodity (canonical list — includes assets like BTC/XAU
            // that have no postings yet); `distinct(currency)` from
            // postings catches anything actually transacted.
            const [accs, declaredCommodities, postingsCsv] = await Promise.all([
                getOpenAccounts(this.plugin),
                getCommodities(this.plugin).catch(() => [] as Array<{ name: string }>),
                this.plugin.runQuery(getAllCurrenciesQuery()).catch(() => ''),
            ]);
            accounts = accs ?? [];

            const merged = new Set<string>();
            for (const c of declaredCommodities ?? []) {
                if (c?.name) merged.add(c.name);
            }
            if (postingsCsv) {
                const rows = parseCsv(postingsCsv, { columns: true, skip_empty_lines: true, trim: true }) as any[];
                for (const r of rows) {
                    const code = (r['currency_'] ?? '').trim();
                    if (code) merged.add(code);
                }
            }
            const op = this.plugin.settings.operatingCurrency;
            if (op) merged.add(op);

            // Operating currency floats to the top, rest sorted alphabetically.
            const sorted = Array.from(merged).sort((a, b) => {
                if (op) {
                    if (a === op) return -1;
                    if (b === op) return 1;
                }
                return a.localeCompare(b);
            });
            if (sorted.length > 0) currencies = sorted;
        } catch (e) {
            Logger.log('[LoanEditModal] Could not prefetch accounts/currencies:', e);
        }

        this.component = new (LoanEditModalComponent as any)({
            target: contentEl,
            props: {
                initial: this.initial,
                mode: this.mode,
                accounts,
                currencies,
            },
        });

        this.component.$on('save', async (e: any) => {
            const { draft, originalAccount } = e.detail as { draft: LoanFormDraft; originalAccount: string };
            try {
                await this.persist(draft, originalAccount);
                new Notice(`Loan account ${this.mode === 'add' ? 'added' : 'updated'}.`);
                this.close();
                this.onSaved?.();
            } catch (err) {
                new Notice(`Failed to save: ${err instanceof Error ? err.message : String(err)}`);
                Logger.error('[LoanEditModal] persist error:', err);
            }
        });

        this.component.$on('delete', async (e: any) => {
            const { originalAccount } = e.detail as { originalAccount: string };
            try {
                await this.persistDelete(originalAccount);
                new Notice(`Loan account "${originalAccount}" removed.`);
                this.close();
                this.onSaved?.();
            } catch (err) {
                new Notice(`Failed to delete: ${err instanceof Error ? err.message : String(err)}`);
                Logger.error('[LoanEditModal] delete error:', err);
            }
        });

        this.component.$on('cancel', () => this.close());
    }

    private async persist(draft: LoanFormDraft, originalAccount: string): Promise<void> {
        const path = this.resolveAccountsPath();
        const adapter = this.plugin.app.vault.adapter;
        const exists = await adapter.exists(path);
        const original = exists ? await adapter.read(path) : '';

        if (this.mode === 'add') {
            const existing = parseLoanAccounts(original);
            if (existing.some(a => a.account === draft.account)) {
                throw new Error(`Account "${draft.account}" already exists.`);
            }
            const next = applyLoanEdits(original, {}, [draft]);
            await adapter.write(path, next);
            // Mirror the contractual principal as a real opening posting
            // so the Balance Sheet (which reads sum(position)) lines up
            // with the Liabilities & Receivables card (which falls back
            // to the principal meta).
            if (draft.principal !== null && draft.principal !== 0) {
                await this.writeOpeningPostings(draft);
            }
            return;
        }

        // edit: rewrite the original block in place. If the user changed
        // the account path we treat it as a rename — same surgical edit
        // since we key by `originalAccount`.
        const next = applyLoanEdits(original, { [originalAccount]: draft }, []);
        await adapter.write(path, next);
    }

    /**
     * Append a `pad` + `balance` pair so a freshly-opened loan account
     * starts with a real posting that matches its contractual principal.
     * Idempotent: if the account already has a `pad` directive in
     * pads.beancount we skip silently — the user's hand-written
     * postings are the source of truth from then on.
     *
     * Sign convention:
     *   - Liabilities  → balance is `-principal` (the user owes it)
     *   - Receivables  → balance is `+principal` (the user is owed)
     *
     * Offsetting account: `Equity:OpeningBalances`. We don't try to
     * create the offset account — we assume the structured-layout
     * scaffolding already provided it (the plugin's onboarding does).
     */
    private async writeOpeningPostings(draft: LoanFormDraft): Promise<void> {
        const folder = this.plugin.settings.structuredFolderName?.trim() || 'Finances';
        const padsPath = `${folder}/pads.beancount`;
        const balancesPath = `${folder}/balances.beancount`;
        const adapter = this.plugin.app.vault.adapter;

        // Skip if a pad for this account already exists (user-authored
        // or earlier auto-write — either way, don't double up).
        const padsContent = (await adapter.exists(padsPath)) ? await adapter.read(padsPath) : '';
        const padPattern = new RegExp(`^\\d{4}-\\d{2}-\\d{2}\\s+pad\\s+${escapeRegExp(draft.account)}\\b`, 'm');
        if (padPattern.test(padsContent)) {
            Logger.log('[LoanEditModal] pad already exists for', draft.account, '— skipping auto-postings');
            return;
        }

        const isReceivable = draft.account.startsWith('Assets:Receivables');
        const sign = isReceivable ? '' : '-';
        const padDate = draft.openDate;
        const balDate = isoNextDay(padDate);
        const principal = Math.abs(draft.principal!);
        const offset = 'Equity:OpeningBalances';

        const padBlock = `\n${padDate} pad ${draft.account}    ${offset}\n`;
        const balBlock = `\n${balDate} balance ${draft.account}    ${sign}${principal} ${draft.currency}\n`;

        await appendToFile(adapter, padsPath, padBlock);
        await appendToFile(adapter, balancesPath, balBlock);
    }

    private async persistDelete(originalAccount: string): Promise<void> {
        const path = this.resolveAccountsPath();
        const adapter = this.plugin.app.vault.adapter;
        const exists = await adapter.exists(path);
        if (!exists) return;
        const original = await adapter.read(path);
        const next = applyLoanEdits(original, { [originalAccount]: null }, []);
        await adapter.write(path, next);
    }

    onClose() {
        if (this.component) {
            this.component.$destroy();
            this.component = null;
        }
    }
}
