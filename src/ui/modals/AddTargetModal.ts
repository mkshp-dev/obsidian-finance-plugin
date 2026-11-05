// src/ui/modals/AddTargetModal.ts

import { App, Modal, Notice } from 'obsidian';
import type BeancountPlugin from '../../main';
import AddTargetModalComponent from './AddTargetModal.svelte';
import { getOpenAccounts, runQuery, createIndicatorDirective, updateIndicatorDirective } from '../../utils';
import { getAllCurrenciesQuery } from '../../queries';
import { parse as parseCsv } from 'csv-parse/sync';
import { Logger } from '../../utils/logger';
import type { IndicatorItem } from '../../models/indicator';
import { SvelteComponent } from 'svelte';

/** Row shape returned by getAllCurrenciesQuery CSV. */
interface CurrencyRow {
    currency_: string;
}

export class AddTargetModal extends Modal {
    plugin: BeancountPlugin;
    private component: SvelteComponent | null = null;
    private editingIndicator?: IndicatorItem;
    private onSuccess?: () => void;

    constructor(app: App, plugin: BeancountPlugin, editingIndicator?: IndicatorItem, onSuccess?: () => void) {
        super(app);
        this.plugin = plugin;
        this.editingIndicator = editingIndicator;
        this.onSuccess = onSuccess;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        this.modalEl.addClass('beancount-modal-add-target');
        this.setTitle(this.editingIndicator ? 'Edit Target' : 'Add Target');

        const operatingCurrency = this.plugin.settings.operatingCurrency || 'USD';
        // Fetch accounts and currencies from the ledger, fall back silently on error
        let accounts: string[] = [];
        let currencies: string[] = [operatingCurrency];
        try {
            const [accs, csvResult] = await Promise.all([
                getOpenAccounts(this.plugin),
                runQuery(this.plugin, getAllCurrenciesQuery()).catch(() => ''),
            ]);
            accounts = accs;
            if (csvResult) {
                const rows = parseCsv(csvResult, { columns: true, skip_empty_lines: true, trim: true }) as unknown as CurrencyRow[];
                const fetched = rows.map((r) => r.currency_).filter(Boolean);
                if (fetched.length > 0) currencies = fetched;
            }
            // Always include the operating currency
            if (!currencies.includes(operatingCurrency)) currencies.unshift(operatingCurrency);
        } catch (err) {
            Logger.log('[AddTargetModal] Could not prefetch accounts/currencies:', err);
        }

        this.component = new (AddTargetModalComponent)({
            target: contentEl,
            props: {
                accounts,
                currencies,
                defaultCurrency: operatingCurrency,
                editingIndicator: this.editingIndicator,
            },
        });

        this.component.$on('save', (e: CustomEvent<Record<string, unknown>>) => {
            void (async () => {
                const { name, accountQuery, cycle, target, currency, isRollover, startDate, tag, tagMode } = e.detail as {
                    name: string;
                    accountQuery: string;
                    cycle: string;
                    target: number;
                    currency: string;
                    isRollover: boolean;
                    startDate: string;
                    tag: string;
                    tagMode: 'has' | 'not_has';
                };
                Logger.log('[AddTargetModal] save event', e.detail);

                try {
                    let result;
                    if (this.editingIndicator) {
                        result = await updateIndicatorDirective(this.plugin, this.editingIndicator.filename!, this.editingIndicator.lineno!, {
                            type: 'Target',
                            name,
                            accountQuery,
                            cycle,
                            target,
                            currency,
                            isRollover,
                            startDate,
                            tag,
                            tagMode,
                        });
                    } else {
                        result = await createIndicatorDirective(this.plugin, {
                            type: 'Target',
                            name,
                            accountQuery,
                            cycle,
                            target,
                            currency,
                            isRollover,
                            startDate,
                            tag,
                            tagMode,
                        });
                    }

                    if (result.success) {
                        new Notice(this.editingIndicator ? `Target "${name}" updated successfully` : `Target "${name}" created successfully`);
                        this.close();
                        if (this.onSuccess) this.onSuccess();
                    } else {
                        new Notice(`Failed to save target: ${result.error || 'Unknown error'}`);
                    }
                } catch (error) {
                    Logger.error('[AddTargetModal] Error saving target:', error);
                    new Notice(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            })();
        });

        this.component.$on('cancel', () => this.close());
    }

    onClose() {
        if (this.component) {
            this.component.$destroy();
            this.component = null;
        }
    }
}
