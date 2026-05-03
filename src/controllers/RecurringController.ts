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

    async loadData(): Promise<void> {
        this.loading.set(true);
        this.error.set(null);
        try {
            const vaultPath = this.resolveVaultPath();
            const adapter = this.plugin.app.vault.adapter;
            if (!(await adapter.exists(vaultPath))) {
                this.rules.set([]);
                this.lastLoaded.set(new Date());
                return;
            }
            const content = await adapter.read(vaultPath);
            const rules = parseRecurringFile(content);
            this.rules.set(rules);
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
