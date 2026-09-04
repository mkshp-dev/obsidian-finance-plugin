<!-- src/ui/views/sidebar/UpcomingTab.svelte -->
<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import { parse as parseCsv } from 'csv-parse/sync';
	import { runQuery, deleteScheduleDirective, computeDueOccurrences } from '../../../utils';
	import { getScheduleListQuery, MAX_SCHEDULE_POSTINGS } from '../../../queries';
	import type { ScheduledTransactionItem, DueOccurrence } from '../../../models/schedule';
	import type { PostingStub } from '../../../utils/directives/types';
	import { AddScheduleModal } from '../../modals/AddScheduleModal';
	import { ConfirmDueSchedulesModal } from '../../modals/ConfirmDueSchedulesModal';
	import { Notice } from 'obsidian';
	import CustomSelect from '../../common/CustomSelect.svelte';

	export let plugin: any = null;

	const dispatch = createEventDispatcher();

	let items: ScheduledTransactionItem[] = [];
	let isLoading = false;
	let loadError: string | null = null;

	type Period = 'today' | 'week' | 'month' | 'all';
	let period: Period = 'all';
	const PERIOD_OPTIONS: { value: Period; label: string; icon?: string }[] = [
		{ value: 'today', label: 'Today', icon: 'today' },
		{ value: 'week', label: 'This Week', icon: 'week' },
		{ value: 'month', label: 'This Month', icon: 'month' },
		{ value: 'all', label: 'All', icon: 'all' },
	];

	$: activeItems = items.filter((i) => i.active);
	// Bound is inclusive and always >= today, so already-overdue items
	// (nextDate <= today) fall inside every period, not just "All".
	$: periodEndDate = period === 'today' ? todayISO() : period === 'week' ? endOfWeekISO() : period === 'month' ? endOfMonthISO() : null;
	$: displayedItems = periodEndDate === null ? activeItems : activeItems.filter((i) => i.nextDate <= periodEndDate);
	// Sum of every missed occurrence across all schedules, not just the count
	// of due schedules — a schedule 3 cycles overdue contributes 3.
	$: dueCount = activeItems.reduce(
		(sum, item) => sum + computeDueOccurrences(item.nextDate, item.frequency, todayISO()).length,
		0
	);
	$: dispatch('due-count', dueCount);

	function col(row: any, name: string): any {
		const lower = name.toLowerCase();
		if (row[lower] !== undefined) return row[lower];
		if (row[name] !== undefined) return row[name];
		const bare = name.startsWith('_') ? name.slice(1) : name;
		const bareLower = bare.toLowerCase();
		if (row[bareLower] !== undefined) return row[bareLower];
		return row[bare];
	}

	function parseBool(val: any): boolean {
		if (typeof val === 'boolean') return val;
		const s = String(val).toLowerCase();
		return s === 'true' || s === '1';
	}

	function parseNumericValue(val: any): number {
		if (val === null || val === undefined || val === '') return 0;
		if (typeof val === 'number') return val;
		const match = String(val).match(/[+-]?[\d.]+/);
		return match ? parseFloat(match[0]) : 0;
	}

	function toISO(d: Date): string {
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	function todayISO(): string {
		return toISO(new Date());
	}

	/** Last day (Saturday) of the calendar week containing today. */
	function endOfWeekISO(): string {
		const d = new Date();
		d.setDate(d.getDate() + (6 - d.getDay()));
		return toISO(d);
	}

	/** Last day of the calendar month containing today. */
	function endOfMonthISO(): string {
		const d = new Date();
		return toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
	}

	function formatAmount(amount: number, currency: string): string {
		const decimals = plugin?.currencyPrecisionService?.getDecimals(currency) ?? 2;
		return `${amount.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${currency}`;
	}

	const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	/** "2026-09-01" -> "Sep 1" — compact, locale-independent (matches this file's own date formatting elsewhere). */
	function formatShortDate(dateStr: string): string {
		const [y, m, day] = dateStr.split('-').map(Number);
		if (!y || !m || !day) return dateStr;
		return `${MONTH_ABBR[m - 1]} ${day}`;
	}

	async function loadAll() {
		if (!plugin) return;
		isLoading = true;
		loadError = null;
		try {
			const csv = await runQuery(plugin, getScheduleListQuery());
			const rows = parseCsv(csv, { columns: true, skip_empty_lines: true, trim: true }) as any[];
			const today = todayISO();
			items = rows.map((r: any) => {
				const postings: PostingStub[] = [];
				for (let i = 1; i <= MAX_SCHEDULE_POSTINGS; i++) {
					const account = col(r, `_p${i}account`);
					if (!account) continue;
					const amountRaw = col(r, `_p${i}amount`);
					const hasAmount = amountRaw !== undefined && amountRaw !== null && amountRaw !== '';
					postings.push({
						account,
						amount: hasAmount ? parseNumericValue(amountRaw) : undefined,
						currency: hasAmount ? (col(r, `_p${i}currency`) || '') : undefined,
					});
				}
				const tagsRaw = col(r, '_tags') || '';
				const linksRaw = col(r, '_links') || '';
				const active = parseBool(col(r, '_active'));
				const nextDate = col(r, '_nextDate') || '';
				const displayAmountRaw = col(r, '_displayAmount');
				return {
					name: col(r, '_name') || '',
					frequency: col(r, '_frequency') || 'Monthly',
					startDate: col(r, '_startDate') || '',
					nextDate,
					lastGenerated: col(r, '_lastGenerated') || undefined,
					active,
					payee: col(r, '_payee') || undefined,
					narration: col(r, '_narration') || undefined,
					flag: col(r, '_flag') || '*',
					tags: tagsRaw ? tagsRaw.split(',').filter(Boolean) : [],
					links: linksRaw ? linksRaw.split(',').filter(Boolean) : [],
					postings,
					displayAmount: displayAmountRaw !== undefined && displayAmountRaw !== null && displayAmountRaw !== '' ? parseNumericValue(displayAmountRaw) : undefined,
					displayCurrency: col(r, '_displayCurrency') || undefined,
					filename: col(r, '_filename') || '',
					lineno: parseNumericValue(col(r, '_lineno')) || 0,
					isDue: active && !!nextDate && nextDate <= today,
				} as ScheduledTransactionItem;
			}).sort((a, b) => a.nextDate.localeCompare(b.nextDate));
		} catch (e) {
			loadError = e instanceof Error ? e.message : String(e);
		} finally {
			isLoading = false;
		}
	}

	onMount(() => { if (plugin) loadAll(); });

	function handleAdd() {
		if (!plugin) return;
		new AddScheduleModal(plugin.app, plugin, undefined, () => loadAll()).open();
	}

	function handleEdit(item: ScheduledTransactionItem) {
		if (!plugin) return;
		new AddScheduleModal(plugin.app, plugin, item, () => loadAll()).open();
	}

	async function handleDelete(item: ScheduledTransactionItem, event: MouseEvent) {
		event.stopPropagation();
		if (!plugin) return;
		if (!item.filename || !item.lineno) {
			new Notice('Cannot find schedule location in file');
			return;
		}
		const confirmed = window.confirm(`Are you sure you want to delete the schedule "${item.name}"?`);
		if (!confirmed) return;

		try {
			const result = await deleteScheduleDirective(plugin, item.filename, item.lineno);
			if (result.success) {
				new Notice(`Schedule "${item.name}" deleted successfully`);
				await loadAll();
			} else {
				new Notice(`Failed to delete schedule: ${result.error || 'Unknown error'}`);
			}
		} catch (error) {
			new Notice(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	async function handleRefresh() {
		await loadAll();
		const today = todayISO();
		const dueOccurrences: DueOccurrence[] = [];
		for (const item of activeItems) {
			for (const date of computeDueOccurrences(item.nextDate, item.frequency, today)) {
				dueOccurrences.push({ schedule: item, date });
			}
		}
		if (dueOccurrences.length === 0) {
			new Notice('No transactions due');
			return;
		}
		new ConfirmDueSchedulesModal(plugin.app, plugin, dueOccurrences, () => loadAll()).open();
	}
</script>

<div class="upcoming-tab">
	<div class="upcoming-controls">
		<CustomSelect
			variant="secondary"
			position="single"
			options={PERIOD_OPTIONS}
			bind:value={period}
			ariaLabel="Filter upcoming by period"
		/>
		<div class="upcoming-controls-buttons">
			<button type="button" class="icon-btn icon-btn-labeled" on:click={handleRefresh} disabled={isLoading} title="Check for due transactions">
				<svg class:loading-spinner={isLoading} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M3 12a9 9 0 013.5-7.1"/>
					<path d="M20.5 5.5a9 9 0 01.5 6.5"/>
					<path d="M3 12a9 9 0 016.5 8.1"/>
					<path d="M20.5 18.5a9 9 0 01-6.5-5.5"/>
				</svg>
				<span>Process dues</span>
			</button>
			<button type="button" class="icon-btn" on:click={handleAdd} title="Add scheduled transaction">
				<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
			</button>
		</div>
	</div>

	{#if isLoading && activeItems.length === 0}
		<div class="tab-empty-state">Loading…</div>
	{:else if loadError}
		<div class="tab-empty-state error-text">{loadError}</div>
	{:else if activeItems.length === 0}
		<div class="tab-empty-state">
			<span>No scheduled transactions.<br>Click + to add one.</span>
		</div>
	{:else if displayedItems.length === 0}
		<div class="tab-empty-state">
			<span>No transactions due in this period.</span>
		</div>
	{:else}
		<div class="upcoming-list">
			{#each displayedItems as item (item.name + item.lineno)}
				<div
					class="upcoming-item"
					class:item-due={item.isDue}
				>
					<div class="upcoming-main-row">
						<span class="upcoming-indicator" class:indicator-due={item.isDue} class:indicator-ok={!item.isDue}></span>
						<span class="upcoming-name" title={item.name}>{item.name}</span>
						<span class="upcoming-amount">
							{item.displayAmount !== undefined && item.displayCurrency ? formatAmount(item.displayAmount, item.displayCurrency) : '—'}
						</span>
						<div class="upcoming-actions">
							<button type="button" class="btn-icon edit-btn" on:click={() => handleEdit(item)} title="Edit">✏️</button>
							<button type="button" class="btn-icon delete-btn" on:click={(e) => handleDelete(item, e)} title="Delete">❌</button>
						</div>
					</div>
					<div class="upcoming-detail-row">
						<span class="upcoming-frequency">{item.frequency}</span>
						<span class="upcoming-sep">·</span>
						<span class="upcoming-next-date" class:due-text={item.isDue}>
							{item.isDue ? 'Due' : 'Next'} {formatShortDate(item.nextDate)}
						</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.upcoming-tab {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-2);
	}

	.upcoming-controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--size-4-1);
	}

	.upcoming-controls-buttons {
		display: flex;
		gap: var(--size-4-1);
	}

	.icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		padding: 0;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		color: var(--text-muted);
		cursor: pointer;
		transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
	}

	.icon-btn-labeled {
		width: auto;
		padding: 0 10px;
		gap: 6px;
		font-size: var(--font-ui-smaller);
		font-weight: 500;
	}

	.icon-btn:hover:not(:disabled) {
		color: var(--interactive-accent);
		background: var(--interactive-hover);
		border-color: var(--interactive-accent);
	}

	.icon-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.loading-spinner {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	.tab-empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--size-4-2);
		padding: var(--size-4-6) var(--size-4-3);
		color: var(--text-faint);
		font-size: var(--font-ui-small);
		text-align: center;
		line-height: 1.5;
	}

	.error-text { color: var(--text-error); }

	.upcoming-list {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-1);
	}

	.upcoming-item {
		width: 100%;
		padding: var(--size-4-2);
		background-color: var(--background-secondary);
		border-radius: var(--radius-s);
		border-left: 3px solid var(--color-green);
		transition: background-color 0.15s ease;
	}

	.upcoming-item.item-due {
		border-left-color: var(--color-orange);
	}

	.upcoming-item:hover {
		background-color: var(--background-modifier-hover);
	}

	.upcoming-main-row {
		display: flex;
		align-items: center;
		gap: 7px;
	}

	.upcoming-indicator {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.upcoming-indicator.indicator-ok { background-color: var(--color-green); }
	.upcoming-indicator.indicator-due { background-color: var(--color-orange); }

	.upcoming-name {
		flex: 1;
		font-size: var(--font-ui-small);
		font-weight: 500;
		color: var(--text-normal);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.upcoming-detail-row {
		display: flex;
		align-items: center;
		gap: 5px;
		margin-top: 2px;
		margin-left: 13px; /* align under the name, past the indicator dot + gap */
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
	}

	.upcoming-sep {
		color: var(--text-faint);
	}

	.upcoming-next-date.due-text {
		color: var(--color-orange);
		font-weight: 500;
	}

	.upcoming-amount {
		font-size: var(--font-ui-small);
		font-weight: 600;
		color: var(--text-normal);
		white-space: nowrap;
		flex-shrink: 0;
	}

	.upcoming-actions {
		display: inline-flex;
		gap: 2px;
		opacity: 0;
		transition: opacity 0.15s ease-in-out;
		flex-shrink: 0;
	}

	.upcoming-item:hover .upcoming-actions { opacity: 0.8; }
	.upcoming-actions:hover { opacity: 1 !important; }

	.btn-icon {
		background: none;
		border: none;
		cursor: pointer;
		padding: 1px 5px;
		font-size: 11px;
		opacity: 0.8;
		border-radius: var(--radius-s);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background-color 0.15s ease;
	}

	.btn-icon:hover { background: var(--background-modifier-border); }
</style>
