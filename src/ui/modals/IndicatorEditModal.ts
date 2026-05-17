// src/ui/modals/IndicatorEditModal.ts
//
// Unified add/edit modal for Indicator directives (Budget / Target /
// Savings). Replaces the older AddBudgetModal and AddTargetModal: those
// are still in the codebase for backwards compatibility but the
// IndicatorsSection now opens this one for all three kinds.

import { App, Modal, Notice } from 'obsidian';
import type BeancountPlugin from '../../main';
import IndicatorEditModalComponent from './IndicatorEditModal.svelte';
import { getOpenAccounts, runQuery } from '../../utils';
import { getAllCurrenciesQuery } from '../../queries';
import { parse as parseCsv } from 'csv-parse/sync';
import { Logger } from '../../utils/logger';
import {
    parseIndicators,
    applyIndicatorEdits,
    type Indicator,
    type IndicatorType,
} from '../../services/indicators.service';
import {
    atomicFileWrite,
    convertWslPathToWindows,
    createBackupFile,
} from '../../utils/fileEditor';
import { readFile } from 'fs/promises';
import { getTargetFile } from '../../utils/structuredLayout';

type Mode = 'add' | 'edit';

export class IndicatorEditModal extends Modal {
    plugin: BeancountPlugin;
    private component: any;
    private mode: Mode;
    private kind: IndicatorType;
    private initial: Indicator;
    private onSaved?: () => void;

    constructor(
        app: App,
        plugin: BeancountPlugin,
        opts: {
            mode: Mode;
            kind: IndicatorType;
            initial?: Partial<Indicator>;
            onSaved?: () => void;
        },
    ) {
        super(app);
        this.plugin = plugin;
        this.mode = opts.mode;
        this.kind = opts.kind;
        this.onSaved = opts.onSaved;

        const op = plugin.settings.operatingCurrency || 'USD';
        const today = new Date().toISOString().slice(0, 10);
        this.initial = {
            type: opts.initial?.type ?? opts.kind,
            name: opts.initial?.name ?? '',
            accountQuery: opts.initial?.accountQuery ?? '',
            cycle: opts.initial?.cycle ?? 'Monthly',
            target: opts.initial?.target ?? 0,
            currency: opts.initial?.currency ?? op,
            isRollover: opts.initial?.isRollover ?? false,
            startDate: opts.initial?.startDate ?? today,
            sourceLine: opts.initial?.sourceLine,
            sourceEndLine: opts.initial?.sourceEndLine,
        };
    }

    private resolveEventsPath(): string | null {
        const p = getTargetFile(this.plugin, 'event');
        return p || null;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        this.modalEl.style.maxWidth = '640px';
        this.modalEl.style.width = '90vw';

        const titleVerb = this.mode === 'add' ? 'Add' : 'Edit';
        this.setTitle(`${titleVerb} ${this.kind.toLowerCase()}`);

        const op = this.plugin.settings.operatingCurrency || 'USD';
        let accounts: string[] = [];
        let currencies: string[] = [op];
        try {
            const [accs, csvResult] = await Promise.all([
                getOpenAccounts(this.plugin),
                runQuery(this.plugin, getAllCurrenciesQuery()).catch(() => ''),
            ]);
            accounts = accs ?? [];
            if (csvResult) {
                const rows = parseCsv(csvResult, {
                    columns: true,
                    skip_empty_lines: true,
                    trim: true,
                }) as any[];
                const fetched = rows
                    .map((r: any) => (r['currency_'] ?? '').trim())
                    .filter(Boolean) as string[];
                if (fetched.length > 0) currencies = fetched;
            }
            if (!currencies.includes(op)) currencies.unshift(op);
        } catch (err) {
            Logger.log('[IndicatorEditModal] prefetch error:', err);
        }

        this.component = new (IndicatorEditModalComponent as any)({
            target: contentEl,
            props: {
                initial: this.initial,
                mode: this.mode,
                kind: this.kind,
                accounts,
                currencies,
            },
        });

        this.component.$on('save', async (e: any) => {
            const { indicator } = e.detail as { indicator: Indicator };
            try {
                await this.persist(indicator);
                new Notice(
                    `${this.kind} "${indicator.name}" ${this.mode === 'add' ? 'created' : 'updated'}.`,
                );
                this.close();
                this.onSaved?.();
            } catch (err) {
                new Notice(
                    `Failed to save: ${err instanceof Error ? err.message : String(err)}`,
                );
                Logger.error('[IndicatorEditModal] persist error:', err);
            }
        });

        this.component.$on('delete', async () => {
            try {
                await this.persistDelete();
                new Notice(
                    `${this.kind} "${this.initial.name}" deleted.`,
                );
                this.close();
                this.onSaved?.();
            } catch (err) {
                new Notice(
                    `Failed to delete: ${err instanceof Error ? err.message : String(err)}`,
                );
                Logger.error('[IndicatorEditModal] delete error:', err);
            }
        });

        this.component.$on('cancel', () => this.close());
    }

    private async persist(indicator: Indicator): Promise<void> {
        const filePath = this.resolveEventsPath();
        if (!filePath) throw new Error('Events file path not configured.');
        const normalizedPath = convertWslPathToWindows(filePath);

        const content = await readFile(normalizedPath, 'utf-8');
        const existing = parseIndicators(content);

        if (this.mode === 'add') {
            // Reject duplicate (type + name) — that's the user-facing identity.
            const dup = existing.find(
                e => e.type === indicator.type && e.name === indicator.name,
            );
            if (dup) {
                throw new Error(
                    `A ${indicator.type.toLowerCase()} named "${indicator.name}" already exists.`,
                );
            }
            const next = applyIndicatorEdits(content, [
                ...existing,
                { ...indicator, sourceLine: undefined, sourceEndLine: undefined },
            ]);
            await createBackupFile(normalizedPath, true, 'IndicatorEditModal.add');
            await atomicFileWrite(normalizedPath, next);
            return;
        }

        // Edit: locate the original block by sourceLine, replace in place.
        // Renaming is supported — we key on the original sourceLine so the
        // user's edits to name/account/etc. are written back to the same
        // physical block.
        const sourceLine = this.initial.sourceLine;
        if (!sourceLine) {
            throw new Error('Cannot locate original directive — file may have been edited externally.');
        }
        const updated = existing.map(e =>
            e.sourceLine === sourceLine
                ? {
                    ...indicator,
                    sourceLine: e.sourceLine,
                    sourceEndLine: e.sourceEndLine,
                }
                : e,
        );
        const next = applyIndicatorEdits(content, updated);
        await createBackupFile(normalizedPath, true, 'IndicatorEditModal.edit');
        await atomicFileWrite(normalizedPath, next);
    }

    private async persistDelete(): Promise<void> {
        const filePath = this.resolveEventsPath();
        if (!filePath) throw new Error('Events file path not configured.');
        const normalizedPath = convertWslPathToWindows(filePath);

        const content = await readFile(normalizedPath, 'utf-8');
        const existing = parseIndicators(content);
        const sourceLine = this.initial.sourceLine;
        if (!sourceLine) {
            throw new Error('Cannot locate original directive to delete.');
        }
        const remaining = existing.filter(e => e.sourceLine !== sourceLine);
        const next = applyIndicatorEdits(content, remaining);
        await createBackupFile(normalizedPath, true, 'IndicatorEditModal.delete');
        await atomicFileWrite(normalizedPath, next);
    }

    onClose() {
        if (this.component) {
            this.component.$destroy();
            this.component = null;
        }
    }
}
