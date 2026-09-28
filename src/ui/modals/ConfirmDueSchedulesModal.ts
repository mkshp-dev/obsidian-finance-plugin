// src/ui/modals/ConfirmDueSchedulesModal.ts

import { App, Modal, Notice } from 'obsidian';
import type BeancountPlugin from '../../main';
import ConfirmDueSchedulesModalComponent from './ConfirmDueSchedulesModal.svelte';
import { createTransaction, updateScheduleDirective, advanceScheduleDate, runQuery, scheduleToTransactionData } from '../../utils';
import { getScheduledOccurrenceExistsQuery } from '../../queries';
import { parse as parseCsv } from 'csv-parse/sync';
import { Logger } from '../../utils/logger';
import type { ScheduledTransactionItem, DueOccurrence } from '../../models/schedule';
import { SvelteComponent } from 'svelte';

export type OccurrenceDecision = 'insert' | 'skip' | 'hold';

export interface OccurrenceRow extends DueOccurrence {
	decision: OccurrenceDecision;
}

function scheduleKey(schedule: ScheduledTransactionItem): string {
	return `${schedule.filename}:${schedule.lineno}`;
}

export class ConfirmDueSchedulesModal extends Modal {
	plugin: BeancountPlugin;
	private component: SvelteComponent | null = null;
	private dueOccurrences: DueOccurrence[];
	private onComplete?: () => void;

	constructor(app: App, plugin: BeancountPlugin, dueOccurrences: DueOccurrence[], onComplete?: () => void) {
		super(app);
		this.plugin = plugin;
		this.dueOccurrences = dueOccurrences;
		this.onComplete = onComplete;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		this.modalEl.setCssStyles({ maxWidth: '640px', width: '90vw' });
		this.setTitle('Transactions due');

		this.component = new (ConfirmDueSchedulesModalComponent)({
			target: contentEl,
			props: {
				plugin: this.plugin,
				dueOccurrences: this.dueOccurrences,
			},
		});

		this.component.$on('confirm', (e: CustomEvent<OccurrenceRow[]>) => {
			void this.materialize(e.detail);
		});

		this.component.$on('cancel', () => this.close());
	}

	/** Dedupe check: has this exact occurrence already been materialized?
	 * Fails open (returns false) on query error — a failed safety check
	 * shouldn't block a legitimate insert. */
	private async occurrenceAlreadyExists(scheduleName: string, date: string): Promise<boolean> {
		try {
			const csv = await runQuery(this.plugin, getScheduledOccurrenceExistsQuery(scheduleName, date));
			const rows = parseCsv(csv, { columns: true, skip_empty_lines: true, trim: true });
			return rows.length > 0;
		} catch (error) {
			Logger.error(`[ConfirmDueSchedulesModal] Dedupe check failed for "${scheduleName}" on ${date}:`, error);
			return false;
		}
	}

	private async materialize(rows: OccurrenceRow[]) {
		if (rows.length === 0) {
			this.close();
			return;
		}

		// Group by schedule, process each schedule's occurrences oldest-first —
		// nextDate is a single cursor, so a Hold blocks advancement past it.
		const groups = new Map<string, { schedule: ScheduledTransactionItem; rows: OccurrenceRow[] }>();
		for (const row of rows) {
			const key = scheduleKey(row.schedule);
			if (!groups.has(key)) groups.set(key, { schedule: row.schedule, rows: [] });
			groups.get(key)!.rows.push(row);
		}

		let insertedCount = 0;
		let skippedCount = 0;

		for (const { schedule, rows: groupRows } of groups.values()) {
			groupRows.sort((a, b) => a.date.localeCompare(b.date));

			let cursor: string = schedule.nextDate;
			let lastGenerated = schedule.lastGenerated;
			let active = schedule.active;
			let touched = false;

			for (const occ of groupRows) {
				if (occ.decision === 'hold') break; // cursor stays here; nothing after this can advance either

				if (occ.decision === 'insert') {
					try {
						const exists = await this.occurrenceAlreadyExists(schedule.name, occ.date);
						if (!exists) {
							const txResult = await createTransaction(this.plugin, scheduleToTransactionData(schedule, occ.date));
							if (!txResult.success) {
								Logger.error(`[ConfirmDueSchedulesModal] Failed to materialize "${schedule.name}" on ${occ.date}: ${txResult.error}`);
								break; // don't advance past a failed write
							}
						} else {
							Logger.log(`[ConfirmDueSchedulesModal] "${schedule.name}" on ${occ.date} already exists — skipping duplicate write`);
						}
						lastGenerated = occ.date;
						insertedCount++;
					} catch (error) {
						Logger.error(`[ConfirmDueSchedulesModal] Error materializing "${schedule.name}" on ${occ.date}:`, error);
						break;
					}
				} else if (occ.decision === 'skip') {
					skippedCount++;
				}

				// Both insert and skip advance the cursor past this occurrence.
				touched = true;
				const next = advanceScheduleDate(occ.date, schedule.frequency);
				if (next === null) {
					active = false;
					cursor = occ.date;
					break;
				}
				cursor = next;
			}

			if (!touched) continue; // every row in this group was Hold — nothing to persist

			const updateResult = await updateScheduleDirective(this.plugin, schedule.filename!, schedule.lineno!, {
				name: schedule.name,
				frequency: schedule.frequency,
				startDate: schedule.startDate,
				nextDate: cursor,
				lastGenerated,
				active,
				payee: schedule.payee,
				narration: schedule.narration,
				flag: schedule.flag,
				tags: schedule.tags,
				links: schedule.links,
				metadata: schedule.metadata,
				postings: schedule.postings,
				displayAmount: schedule.displayAmount,
				displayCurrency: schedule.displayCurrency,
			});

			if (!updateResult.success) {
				Logger.error(`[ConfirmDueSchedulesModal] Materialized/advanced "${schedule.name}" but failed to save schedule: ${updateResult.error}`);
			}
		}

		const summaryParts: string[] = [];
		if (insertedCount > 0) summaryParts.push(`${insertedCount} added`);
		if (skippedCount > 0) summaryParts.push(`${skippedCount} skipped`);
		new Notice(summaryParts.length > 0 ? summaryParts.join(', ') : 'No changes made');

		try {
			await this.plugin.getDashboardRefreshCallback()();
		} catch (error) {
			Logger.error('[ConfirmDueSchedulesModal] Error refreshing dashboard:', error);
		}

		this.close();
		if (this.onComplete) this.onComplete();
	}

	onClose() {
		if (this.component) {
			this.component.$destroy();
			this.component = null;
		}
	}
}
