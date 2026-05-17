// src/ui/modals/RecurringEditModal.ts

import { App, Modal, Notice } from 'obsidian';
import type BeancountPlugin from '../../main';
import RecurringEditModalComponent from './RecurringEditModal.svelte';
import {
    parseRecurringFile,
    applyRecurringEdits,
    type RecurringRule,
} from '../../services/recurring.service';
import { getOpenAccounts, getCommodities } from '../../utils/accounts';
import { getAllCurrenciesQuery } from '../../queries/index';
import { parse as parseCsv } from 'csv-parse/sync';
import { Logger } from '../../utils/logger';

type Mode = 'add' | 'edit';

export class RecurringEditModal extends Modal {
    plugin: BeancountPlugin;
    private component: any;
    private mode: Mode;
    private initial: RecurringRule;
    private onSaved?: () => void;

    constructor(
        app: App,
        plugin: BeancountPlugin,
        opts: { mode: Mode; initial: RecurringRule; onSaved?: () => void },
    ) {
        super(app);
        this.plugin = plugin;
        this.mode = opts.mode;
        this.initial = opts.initial;
        this.onSaved = opts.onSaved;
    }

    private resolveRecurringPath(): string {
        const explicit = this.plugin.settings.recurringFilePath?.trim();
        if (explicit) return explicit;
        const folder = this.plugin.settings.structuredFolderName?.trim() || 'Finances';
        return `${folder}/recurring.beancount`;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        this.modalEl.style.maxWidth = '640px';
        this.modalEl.style.width = '90vw';
        this.setTitle(
            this.mode === 'add' ? 'Add recurring rule' : `Edit "${this.initial.nickname}"`,
        );

        let accounts: string[] = [];
        let currencies: string[] = [this.plugin.settings.operatingCurrency || 'USD'];
        try {
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
                const rows = parseCsv(postingsCsv, {
                    columns: true,
                    skip_empty_lines: true,
                    trim: true,
                }) as any[];
                for (const r of rows) {
                    const code = (r['currency_'] ?? '').trim();
                    if (code) merged.add(code);
                }
            }
            const op = this.plugin.settings.operatingCurrency;
            if (op) merged.add(op);

            const sorted = Array.from(merged).sort((a, b) => {
                if (op) {
                    if (a === op) return -1;
                    if (b === op) return 1;
                }
                return a.localeCompare(b);
            });
            if (sorted.length > 0) currencies = sorted;
        } catch (e) {
            Logger.log('[RecurringEditModal] could not prefetch sources:', e);
        }

        this.component = new (RecurringEditModalComponent as any)({
            target: contentEl,
            props: {
                initial: this.initial,
                mode: this.mode,
                accounts,
                currencies,
            },
        });

        this.component.$on('save', async (e: any) => {
            const { rule, originalNickname } = e.detail as {
                rule: RecurringRule;
                originalNickname: string;
            };
            try {
                await this.persist(rule, originalNickname);
                new Notice(
                    `Recurring rule ${this.mode === 'add' ? 'added' : 'updated'}.`,
                );
                this.close();
                this.onSaved?.();
            } catch (err) {
                new Notice(
                    `Failed to save: ${err instanceof Error ? err.message : String(err)}`,
                );
                Logger.error('[RecurringEditModal] persist error:', err);
            }
        });

        this.component.$on('delete', async (e: any) => {
            const { originalNickname } = e.detail as { originalNickname: string };
            try {
                await this.persistDelete(originalNickname);
                new Notice(`Recurring rule "${originalNickname}" removed.`);
                this.close();
                this.onSaved?.();
            } catch (err) {
                new Notice(
                    `Failed to delete: ${err instanceof Error ? err.message : String(err)}`,
                );
                Logger.error('[RecurringEditModal] delete error:', err);
            }
        });

        this.component.$on('cancel', () => this.close());
    }

    private async persist(rule: RecurringRule, originalNickname: string): Promise<void> {
        const path = this.resolveRecurringPath();
        const adapter = this.plugin.app.vault.adapter;
        const exists = await adapter.exists(path);
        const original = exists ? await adapter.read(path) : '';

        const existingRules = parseRecurringFile(original);

        if (this.mode === 'add') {
            // Reject duplicate nicknames — we use them as the identity key.
            if (existingRules.some(r => r.nickname === rule.nickname)) {
                throw new Error(
                    `A rule named "${rule.nickname}" already exists. Pick a different nickname.`,
                );
            }
            const next = applyRecurringEdits(original, [
                ...existingRules,
                { ...rule, sourceLine: undefined },
            ]);
            await adapter.write(path, next);
            return;
        }

        // edit mode: locate the original by nickname to find its sourceLine,
        // then rewrite that line in place. Renaming the rule is supported —
        // we key the lookup on `originalNickname`.
        const originalRule = existingRules.find(r => r.nickname === originalNickname);
        if (!originalRule) {
            throw new Error(
                `Could not find rule "${originalNickname}" — file may have been edited externally.`,
            );
        }
        const updated = existingRules.map(r =>
            r.nickname === originalNickname
                ? { ...rule, sourceLine: originalRule.sourceLine }
                : r,
        );
        const next = applyRecurringEdits(original, updated);
        await adapter.write(path, next);
    }

    private async persistDelete(originalNickname: string): Promise<void> {
        const path = this.resolveRecurringPath();
        const adapter = this.plugin.app.vault.adapter;
        if (!(await adapter.exists(path))) return;
        const original = await adapter.read(path);
        const existingRules = parseRecurringFile(original);
        const remaining = existingRules.filter(r => r.nickname !== originalNickname);
        const next = applyRecurringEdits(original, remaining);
        await adapter.write(path, next);
    }

    onClose() {
        if (this.component) {
            this.component.$destroy();
            this.component = null;
        }
    }
}
