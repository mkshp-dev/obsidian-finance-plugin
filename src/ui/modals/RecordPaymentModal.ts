// src/ui/modals/RecordPaymentModal.ts
//
// Lightweight modal that records a single payment against a loan-shaped
// account. Builds a Beancount transaction and appends it to the user's
// year-partitioned transactions file. No reliance on the heavier
// UnifiedTransactionModal — this is a focused 4-field flow.

import { App, Modal, Notice } from 'obsidian';
import type BeancountPlugin from '../../main';
import RecordPaymentModalComponent from './RecordPaymentModal.svelte';
import type { LoanRow } from '../../controllers/LiabilitiesController';
import { getOpenAccounts } from '../../utils/accounts';
import { Logger } from '../../utils/logger';
import { ConfirmModal } from './ConfirmModal';
import { atomicFileWrite, createBackupFile } from '../../utils/fileEditor';
import {
    computeAssertionUpdates,
    applyAssertionUpdates,
    type BalancePosting,
} from '../../utils/balanceReconcile';

interface PaymentDetail {
    date: string;
    amount: number;
    currency: string;
    loanAccount: string;
    fundingAccount: string;
    payee: string | null;
    narration: string | null;
    role: 'liability' | 'receivable';
}

export class RecordPaymentModal extends Modal {
    plugin: BeancountPlugin;
    private component: any;
    private loan: LoanRow;
    private onSaved?: () => void;

    constructor(
        app: App,
        plugin: BeancountPlugin,
        opts: { loan: LoanRow; onSaved?: () => void },
    ) {
        super(app);
        this.plugin = plugin;
        this.loan = opts.loan;
        this.onSaved = opts.onSaved;
    }

    private resolveTransactionsPath(year: number): string {
        const folder = this.plugin.settings.structuredFolderName?.trim() || 'Finances';
        return `${folder}/transactions/${year}.beancount`;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        this.modalEl.style.maxWidth = '640px';
        this.modalEl.style.width = '90vw';
        this.setTitle('Record payment');

        let accounts: string[] = [];
        try {
            accounts = (await getOpenAccounts(this.plugin)) ?? [];
        } catch (e) {
            Logger.log('[RecordPaymentModal] Could not prefetch accounts:', e);
        }

        const defaultFunding = this.loan.fundingAccount
            || (this.loan.role === 'liability' ? 'Assets:Banking' : 'Income:Repayment');

        this.component = new (RecordPaymentModalComponent as any)({
            target: contentEl,
            props: {
                loan: this.loan,
                accounts,
                defaultFunding,
            },
        });

        this.component.$on('save', async (e: any) => {
            const detail = e.detail as PaymentDetail;
            try {
                await this.appendTransaction(detail);
                new Notice('Payment recorded.');
                this.close();
                this.onSaved?.();
                await this.reconcileDownstreamAssertions(detail);
            } catch (err) {
                new Notice(`Failed to record: ${err instanceof Error ? err.message : String(err)}`);
                Logger.error('[RecordPaymentModal] write error:', err);
            }
        });

        this.component.$on('cancel', () => this.close());
    }

    /**
     * Build a beancount transaction and append to transactions/<year>.beancount.
     * For liabilities: loanAccount receives a positive posting (paying down debt),
     * fundingAccount receives the matching negative (money out).
     * For receivables: fundingAccount receives positive (money in), loanAccount
     * receives negative (receivable shrinks).
     */
    private async appendTransaction(d: PaymentDetail): Promise<void> {
        const adapter = this.plugin.app.vault.adapter;
        const year = parseInt(d.date.slice(0, 4), 10);
        const path = this.resolveTransactionsPath(year);

        const exists = await adapter.exists(path);
        const original = exists ? await adapter.read(path) : '';

        const amountStr = String(d.amount);
        const negStr = `-${amountStr}`;
        const payeePart = d.payee ? `"${d.payee.replace(/"/g, '\\"')}"` : '""';
        const narrPart = d.narration ? `"${d.narration.replace(/"/g, '\\"')}"` : '""';

        const lines: string[] = [];
        // Always lead with a blank line if the file already has content
        // and isn't already trailing-blank.
        if (original.length > 0 && !original.endsWith('\n\n')) {
            if (!original.endsWith('\n')) lines.push('');
            lines.push('');
        }

        lines.push(`${d.date} * ${payeePart} ${narrPart}`.replace(/\s+$/, ''));
        if (d.role === 'liability') {
            lines.push(`  ${d.loanAccount}  ${amountStr} ${d.currency}`);
            lines.push(`  ${d.fundingAccount}  ${negStr} ${d.currency}`);
        } else {
            lines.push(`  ${d.fundingAccount}  ${amountStr} ${d.currency}`);
            lines.push(`  ${d.loanAccount}  ${negStr} ${d.currency}`);
        }

        const next = original + lines.join('\n') + '\n';
        await adapter.write(path, next);
    }

    /**
     * After recording a payment, the new transaction shifts the running
     * balance of the accounts it touches. Any balance assertion dated
     * AFTER the transaction (common when a vault keeps forward-dated
     * closing assertions, e.g. a clean-start cut-over) would now fail
     * bean-check. Detect those and offer a one-click correction. Best-
     * effort: a failure here never blocks the already-recorded payment.
     */
    private async reconcileDownstreamAssertions(d: PaymentDetail): Promise<void> {
        try {
            const folder = this.plugin.settings.structuredFolderName?.trim() || 'Finances';
            const balRelPath = `${folder}/balances.beancount`;
            const adapter = this.plugin.app.vault.adapter;
            if (!(await adapter.exists(balRelPath))) return;
            const content = await adapter.read(balRelPath);

            // The two postings exactly as appendTransaction wrote them.
            const postings: BalancePosting[] = d.role === 'liability'
                ? [
                    { account: d.loanAccount, amount: d.amount, currency: d.currency },
                    { account: d.fundingAccount, amount: -d.amount, currency: d.currency },
                ]
                : [
                    { account: d.fundingAccount, amount: d.amount, currency: d.currency },
                    { account: d.loanAccount, amount: -d.amount, currency: d.currency },
                ];

            const updates = computeAssertionUpdates(content, postings, d.date);
            if (updates.length === 0) return;

            const noun = updates.length === 1 ? 'assertion' : 'assertions';
            const list = updates
                .map(u => `${u.date} ${u.account} ${u.oldAmount} → ${u.newAmount} ${u.currency}`)
                .join(' · ');
            const msg = `This payment shifts ${updates.length} later balance ${noun}: ${list}. `
                + `Update ${updates.length === 1 ? 'it' : 'them'} so bean-check stays valid?`;

            new ConfirmModal(this.app, 'Update downstream balance assertions?', msg, async () => {
                try {
                    const next = applyAssertionUpdates(content, updates);
                    // @ts-ignore — getBasePath on FileSystemAdapter
                    const absPath = `${adapter.getBasePath()}/${balRelPath}`;
                    await createBackupFile(absPath, true, 'recordPayment.reconcile');
                    await atomicFileWrite(absPath, next);
                    new Notice(`Updated ${updates.length} balance ${noun}.`);
                } catch (err) {
                    new Notice(`Could not update assertions: ${err instanceof Error ? err.message : String(err)}`);
                    Logger.error('[RecordPaymentModal] reconcile write error:', err);
                }
            }).open();
        } catch (e) {
            Logger.log('[RecordPaymentModal] reconcile skipped:', e);
        }
    }

    onClose() {
        if (this.component) {
            this.component.$destroy();
            this.component = null;
        }
    }
}
