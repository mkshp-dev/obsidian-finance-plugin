// src/ui/modals/AddScheduleModal.ts

import { App, Modal, Notice } from 'obsidian';
import type BeancountPlugin from '../../main';
import AddScheduleModalComponent from './AddScheduleModal.svelte';
import { getOpenAccounts, getPayees, runQuery, createScheduleDirective, updateScheduleDirective, computeScheduleDisplayAmount } from '../../utils';
import { getAllCurrenciesQuery } from '../../queries';
import { parse as parseCsv } from 'csv-parse/sync';
import { Logger } from '../../utils/logger';
import { SCHEDULES_CHANGED_EVENT, type ScheduledTransactionItem } from '../../models/schedule';
import type { PostingStub } from '../../utils/directives/types';
import type { SchedulePrefill } from '../../utils/directives/scheduleDirectives';
import { SvelteComponent } from 'svelte';

interface CurrencyRow {
	currency_: string;
}

interface ScheduleSavePayload {
	name: string;
	frequency: string;
	startDate: string;
	payee?: string;
	narration?: string;
	flag: string;
	tags: string[];
	links: string[];
	metadata?: Record<string, string>;
	postings: PostingStub[];
}

export class AddScheduleModal extends Modal {
	plugin: BeancountPlugin;
	private component: SvelteComponent | null = null;
	private editingSchedule?: ScheduledTransactionItem;
	private onSuccess?: () => void;
	private prefill?: SchedulePrefill;

	/** `prefill` starts a new schedule from an existing transaction; ignored when editing. */
	constructor(app: App, plugin: BeancountPlugin, editingSchedule?: ScheduledTransactionItem, onSuccess?: () => void, prefill?: SchedulePrefill) {
		super(app);
		this.plugin = plugin;
		this.editingSchedule = editingSchedule;
		this.onSuccess = onSuccess;
		this.prefill = prefill;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		this.modalEl.setCssStyles({ maxWidth: '800px', width: '92vw' });
		this.setTitle(this.editingSchedule ? 'Edit Scheduled Transaction' : 'Add Scheduled Transaction');

		const operatingCurrency = this.plugin.settings.operatingCurrency || 'USD';
		let accounts: string[] = [];
		let payees: string[] = [];
		let currencies: string[] = [operatingCurrency];
		try {
			const [accs, pys, csvResult] = await Promise.all([
				getOpenAccounts(this.plugin),
				getPayees(this.plugin).catch(() => []),
				runQuery(this.plugin, getAllCurrenciesQuery()).catch(() => ''),
			]);
			accounts = accs;
			payees = pys;
			if (csvResult) {
				const rows = parseCsv(csvResult, { columns: true, skip_empty_lines: true, trim: true }) as unknown as CurrencyRow[];
				const fetched = rows.map((r) => r.currency_).filter(Boolean);
				if (fetched.length > 0) currencies = fetched;
			}
			if (!currencies.includes(operatingCurrency)) currencies.unshift(operatingCurrency);
		} catch (err) {
			Logger.log('[AddScheduleModal] Could not prefetch accounts/payees/currencies:', err);
		}

		this.component = new (AddScheduleModalComponent)({
			target: contentEl,
			props: {
				accounts,
				payees,
				currencies,
				defaultCurrency: operatingCurrency,
				editingSchedule: this.editingSchedule,
				prefill: this.editingSchedule ? null : this.prefill ?? null,
			},
		});

		this.component.$on('save', (e: CustomEvent<ScheduleSavePayload>) => {
			void (async () => {
				const { name, frequency, startDate, payee, narration, flag, tags, links, metadata, postings } = e.detail;
				Logger.log('[AddScheduleModal] save event', e.detail);

				const display = computeScheduleDisplayAmount(postings);

				try {
					let result;
					if (this.editingSchedule) {
						result = await updateScheduleDirective(this.plugin, this.editingSchedule.filename!, this.editingSchedule.lineno!, {
							name,
							frequency,
							startDate,
							nextDate: this.editingSchedule.nextDate,
							lastGenerated: this.editingSchedule.lastGenerated,
							active: this.editingSchedule.active,
							payee,
							narration,
							flag,
							tags,
							links,
							metadata,
							postings,
							displayAmount: display?.amount,
							displayCurrency: display?.currency,
						});
					} else {
						result = await createScheduleDirective(this.plugin, {
							name,
							frequency,
							startDate,
							nextDate: startDate,
							active: true,
							payee,
							narration,
							flag,
							tags,
							links,
							metadata,
							postings,
							displayAmount: display?.amount,
							displayCurrency: display?.currency,
						});
					}

					if (result.success) {
						new Notice(this.editingSchedule ? `Schedule "${name}" updated successfully` : `Schedule "${name}" created successfully`);
						this.close();
						this.app.workspace.trigger(SCHEDULES_CHANGED_EVENT);
						if (this.onSuccess) this.onSuccess();
					} else {
						new Notice(`Failed to save schedule: ${result.error || 'Unknown error'}`);
					}
				} catch (error) {
					Logger.error('[AddScheduleModal] Error saving schedule:', error);
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
