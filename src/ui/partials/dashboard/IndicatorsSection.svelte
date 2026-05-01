<!-- src/ui/partials/dashboard/IndicatorsSection.svelte -->
<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import { parse as parseCsv } from 'csv-parse/sync';
	import { runQuery } from '../../../utils';
	import { getBudgetListQuery, getTargetListQuery, getIndicatorStatusQuery } from '../../../queries';

	export let plugin: any = null;

	const dispatch = createEventDispatcher();

	interface IndicatorItem {
		name: string;
		accountString: string;
		period: string;
		isRollOver: boolean;
		targetAmount: number;
		currency: string;
		startDate: string;
		spent: number;
		remaining: number;
		loading: boolean;
		error: string | null;
	}

	type IndicatorView = 'Budgets' | 'Targets';
	let activeView: IndicatorView = 'Budgets';
	let budgets: IndicatorItem[] = [];
	let targets: IndicatorItem[] = [];
	let isLoading = false;
	let loadError: string | null = null;

	$: currentItems = activeView === 'Budgets' ? budgets : targets;

	function col(row: any, name: string): any {
		// bean-query preserves leading underscores but LOWERCASES all alias characters.
		// e.g.  SELECT date AS _startDate  →  CSV header is "_startdate", not "_startDate".
		// Try lowercase first, then original, then bare (no leading underscore) variants.
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

	function formatAmount(amount: number, currency: string): string {
		const abs = Math.abs(amount);
		return `${abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
	}

	// For rollover budgets, available budget = spent + remaining (base + accumulated rollover).
	// For non-rollover, available = base target.
	function getEffectiveTarget(item: IndicatorItem): number {
		if (item.isRollOver) return item.spent + item.remaining;
		return item.targetAmount;
	}

	function getPct(item: IndicatorItem): number {
		const eff = getEffectiveTarget(item);
		if (eff <= 0) return 0;
		return (item.spent / eff) * 100;
	}

	function getBarColor(pct: number, isBudget: boolean): string {
		if (isBudget) {
			if (pct >= 100) return 'var(--color-red, #e05252)';
			if (pct >= 75) return 'var(--color-orange, #e8a027)';
			return 'var(--color-green, #4caf74)';
		}
		if (pct >= 100) return 'var(--color-green, #4caf74)';
		if (pct >= 75) return 'var(--interactive-accent)';
		return 'var(--interactive-accent)';
	}

	function getStatusBadge(pct: number, isBudget: boolean): { label: string; cls: string } {
		if (isBudget) {
			if (pct >= 100) return { label: 'Over Budget', cls: 'status-over' };
			if (pct >= 75)  return { label: 'Warning',     cls: 'status-warn' };
			return { label: 'On Track', cls: 'status-good' };
		}
		if (pct >= 100) return { label: 'Complete',   cls: 'status-good' };
		if (pct >= 75)  return { label: 'On Track',   cls: 'status-good' };
		return { label: 'In Progress', cls: 'status-neutral' };
	}

	async function loadAll() {
		if (!plugin) return;
		isLoading = true;
		loadError = null;
		try {
			await Promise.all([loadBudgets(), loadTargets()]);
		} catch (e) {
			loadError = e instanceof Error ? e.message : String(e);
		} finally {
			isLoading = false;
		}
	}

	async function loadBudgets() {
		const csv = await runQuery(plugin, getBudgetListQuery());
		const rows = parseCsv(csv, { columns: true, skip_empty_lines: true, trim: true }) as any[];
		const items: IndicatorItem[] = rows.map((r: any) => ({
			name: col(r, '_name') || '',
			accountString: col(r, '_accountString') || '',
			period: col(r, '_period') || 'Monthly',
			isRollOver: parseBool(col(r, '_isRollOver')),
			targetAmount: parseNumericValue(col(r, '_budgetAmount')),
			currency: col(r, '_currency') || '',
			startDate: col(r, '_startDate') || '',
			spent: 0,
			remaining: 0,
			loading: true,
			error: null,
		}));
		budgets = items;
		await Promise.all(items.map((_: any, i: number) => loadBudgetStatus(i)));
	}

	async function loadBudgetStatus(index: number) {
		const item = budgets[index];
		if (!item.accountString || !item.startDate || item.targetAmount <= 0) {
			budgets = budgets.map((b, i) => i === index
				? { ...b, loading: false, error: 'Indicator data incomplete — check the event directive in events.beancount.' }
				: b);
			return;
		}
		try {
			const period = item.period.toLowerCase() === 'weekly' ? 'week' : 'month';
			const csv = await runQuery(
				plugin,
				getIndicatorStatusQuery(item.isRollOver, item.currency, item.accountString, item.targetAmount, item.startDate, period)
			);
			const rows = parseCsv(csv, { columns: true, skip_empty_lines: true, trim: true }) as any[];
			if (rows.length > 0) {
				const row = rows[0];
				const spent = Math.abs(parseNumericValue(col(row, '_expenseThisCycle')));
				const remaining = item.isRollOver
					? parseNumericValue(col(row, '_remainingThisCycle'))
					: item.targetAmount - spent;
				budgets = budgets.map((b, i) => i === index ? { ...b, spent, remaining, loading: false } : b);
			} else {
				budgets = budgets.map((b, i) => i === index ? { ...b, spent: 0, remaining: b.targetAmount, loading: false } : b);
			}
		} catch (e) {
			budgets = budgets.map((b, i) => i === index
				? { ...b, loading: false, error: e instanceof Error ? e.message : 'Error loading status' } : b);
		}
	}

	async function loadTargets() {
		const csv = await runQuery(plugin, getTargetListQuery());
		const rows = parseCsv(csv, { columns: true, skip_empty_lines: true, trim: true }) as any[];
		const items: IndicatorItem[] = rows.map((r: any) => ({
			name: col(r, '_name') || '',
			accountString: col(r, '_accountString') || '',
			period: col(r, '_period') || 'Monthly',
			isRollOver: parseBool(col(r, '_isRollOver')),
			targetAmount: parseNumericValue(col(r, '_targetAmount')),
			currency: col(r, '_currency') || '',
			startDate: col(r, '_startDate') || '',
			spent: 0,
			remaining: 0,
			loading: true,
			error: null,
		}));
		targets = items;
		await Promise.all(items.map((_: any, i: number) => loadTargetStatus(i)));
	}

	async function loadTargetStatus(index: number) {
		const item = targets[index];
		if (!item.accountString || !item.startDate || item.targetAmount <= 0) {
			targets = targets.map((t, i) => i === index
				? { ...t, loading: false, error: 'Indicator data incomplete — check the event directive in events.beancount.' }
				: t);
			return;
		}
		try {
			const period = item.period.toLowerCase() === 'weekly' ? 'week' : 'month';
			const csv = await runQuery(
				plugin,
				getIndicatorStatusQuery(item.isRollOver, item.currency, item.accountString, item.targetAmount, item.startDate, period)
			);
			const rows = parseCsv(csv, { columns: true, skip_empty_lines: true, trim: true }) as any[];
			if (rows.length > 0) {
				const row = rows[0];
				const current = parseNumericValue(col(row, '_expenseThisCycle'));
				targets = targets.map((t, i) => i === index
					? { ...t, spent: current, remaining: t.targetAmount - current, loading: false } : t);
			} else {
				targets = targets.map((t, i) => i === index
					? { ...t, spent: 0, remaining: t.targetAmount, loading: false } : t);
			}
		} catch (e) {
			targets = targets.map((t, i) => i === index
				? { ...t, loading: false, error: e instanceof Error ? e.message : 'Error loading status' } : t);
		}
	}

	onMount(() => { if (plugin) loadAll(); });

	function setView(view: IndicatorView) { activeView = view; }
	function handleAddBudget() { dispatch('add-budget'); }
	function handleAddTarget() { dispatch('add-target'); }
</script>

<div class="indicators-section">
	<!-- Header -->
	<div class="indicators-header">
		<div class="title-row">
			<h4>Financial Indicators</h4>
			<button class="icon-btn" class:spinning={isLoading} on:click={loadAll} title="Refresh" disabled={isLoading}>
				↺
			</button>
		</div>
		<div class="controls-row">
			<div class="view-toggle">
				<button class="toggle-btn" class:active={activeView === 'Budgets'} on:click={() => setView('Budgets')}>
					Budgets
					<span class="count-badge" class:active={activeView === 'Budgets'}>{budgets.length}</span>
				</button>
				<button class="toggle-btn" class:active={activeView === 'Targets'} on:click={() => setView('Targets')}>
					Targets
					<span class="count-badge" class:active={activeView === 'Targets'}>{targets.length}</span>
				</button>
			</div>
			<button class="add-btn" on:click={activeView === 'Budgets' ? handleAddBudget : handleAddTarget}>
				<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
				{activeView === 'Budgets' ? 'Add Budget' : 'Add Target'}
			</button>
		</div>
	</div>

	<!-- Body -->
	<div class="indicators-body">
		{#if isLoading && currentItems.length === 0}
			<div class="skeleton-grid">
				<div class="skeleton-card"></div>
				<div class="skeleton-card"></div>
			</div>
		{:else if loadError}
			<div class="error-banner">
				<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
				{loadError}
			</div>
		{:else if currentItems.length === 0}
			<div class="empty-state">
				<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.3">
					<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
				</svg>
				<p>No {activeView.toLowerCase()} defined yet.</p>
				<button class="add-btn" on:click={activeView === 'Budgets' ? handleAddBudget : handleAddTarget}>
					<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
					Add {activeView === 'Budgets' ? 'Budget' : 'Target'}
				</button>
			</div>
		{:else}
			<div class="indicators-list">
				{#each currentItems as item (item.name)}
					{@const isBudget = activeView === 'Budgets'}
					{@const effTarget = getEffectiveTarget(item)}
					{@const pct = getPct(item)}
					{@const barColor = getBarColor(pct, isBudget)}
					{@const rolloverAmt = item.isRollOver ? effTarget - item.targetAmount : 0}
					{@const status = getStatusBadge(pct, isBudget)}
					<div class="indicator-card" class:over-budget={pct >= 100 && isBudget}>

						<!-- Top row: name / meta left — remaining right -->
						<div class="card-top">
							<div class="card-identity">
								<span class="card-name">{item.name}</span>
								<div class="card-meta">
									<span class="meta-chip">
										<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
										{item.accountString}
									</span>
									<span class="meta-chip">
										<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
										{item.period}
									</span>
								</div>
							</div>
							{#if !item.loading && !item.error}
								<div class="card-remaining">
									<span class="remaining-label">{isBudget ? 'Remaining' : 'Still needed'}</span>
									<span class="remaining-value" style="color:{barColor};">{formatAmount(Math.max(item.remaining, 0), item.currency)}</span>
									<span class="status-badge {status.cls}">{status.label}</span>
								</div>
							{/if}
						</div>

						{#if item.loading}
							<div class="card-loading-area">
								<div class="mini-skeleton" style="height:10px; width:40%;"></div>
								<div class="mini-skeleton" style="height:6px;"></div>
								<div class="mini-skeleton" style="height:10px; width:60%;"></div>
							</div>
						{:else if item.error}
							<div class="card-error">{item.error}</div>
						{:else}
							<!-- Progress section -->
							<div class="progress-section">
								<div class="progress-label-row">
									<span class="progress-label-text">{formatAmount(item.spent, item.currency)} of {formatAmount(effTarget, item.currency)}</span>
									<span class="pct-text" style="color:{barColor};">{(Math.round(pct * 10) / 10).toFixed(1)}%</span>
								</div>
								<div class="progress-track">
									<div class="progress-fill" style="width:{Math.min(pct, 100)}%; background:{barColor};"></div>
								</div>
							</div>

							<!-- Bottom stats row -->
							<div class="stats-row">
								<div class="stat-block">
									<span class="stat-label">{isBudget ? 'Base Target' : 'Goal'}</span>
									<span class="stat-value">{formatAmount(item.targetAmount, item.currency)}</span>
								</div>
								{#if item.isRollOver}
									<div class="stat-block">
										<span class="stat-label rollover-label">
											<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
											Rollover
										</span>
										<span class="stat-value rollover-value">{formatAmount(rolloverAmt, item.currency)}</span>
									</div>
									<div class="stat-block">
										<span class="stat-label">Available</span>
										<span class="stat-value">{formatAmount(effTarget, item.currency)}</span>
									</div>
								{:else}
									<div class="stat-block">
										<span class="stat-label">{isBudget ? 'Spent' : 'Saved'}</span>
										<span class="stat-value">{formatAmount(item.spent, item.currency)}</span>
									</div>
									<div class="stat-block">
										<span class="stat-label">{isBudget ? 'Remaining' : 'Still needed'}</span>
										<span class="stat-value" style="color:{barColor};">{formatAmount(Math.max(item.remaining, 0), item.currency)}</span>
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	/* ── Section container ─────────────────────────────── */
	.indicators-section {
		margin-top: var(--size-4-6);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		overflow: hidden;
	}

	/* ── Header ────────────────────────────────────────── */
	.indicators-header {
		padding: var(--size-4-3) var(--size-4-4);
		background: var(--background-secondary);
		border-bottom: 1px solid var(--background-modifier-border);
		display: flex;
		flex-direction: column;
		gap: var(--size-4-2);
	}

	.title-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.title-row h4 {
		margin: 0;
		font-size: var(--font-ui-medium);
		color: var(--text-normal);
	}

	.controls-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	/* ── Toggle ────────────────────────────────────────── */
	.view-toggle {
		display: flex;
		gap: 2px;
		background: var(--background-modifier-border);
		border-radius: var(--radius-s);
		padding: 2px;
	}

	.toggle-btn {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 3px 12px;
		border: none;
		background: transparent;
		border-radius: var(--radius-s);
		color: var(--text-muted);
		cursor: pointer;
		font-size: var(--font-ui-small);
		transition: background 0.15s, color 0.15s;
	}

	.toggle-btn.active {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
	}

	.count-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 17px;
		height: 15px;
		padding: 0 4px;
		border-radius: 8px;
		font-size: 10px;
		font-weight: 600;
		background: var(--background-modifier-border);
		color: var(--text-muted);
		transition: background 0.15s, color 0.15s;
	}

	.count-badge.active {
		background: rgba(255, 255, 255, 0.22);
		color: var(--text-on-accent);
	}

	/* ── Buttons ───────────────────────────────────────── */
	.add-btn {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 4px 12px;
		background: var(--interactive-accent);
		border: none;
		border-radius: var(--radius-s);
		color: var(--text-on-accent);
		cursor: pointer;
		font-size: var(--font-ui-small);
		transition: background 0.15s;
	}

	.add-btn:hover { background: var(--interactive-accent-hover); }

	.icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		background: transparent;
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		color: var(--text-muted);
		cursor: pointer;
		font-size: 15px;
		line-height: 1;
		transition: background 0.15s;
	}

	.icon-btn:hover:not(:disabled) {
		background: var(--background-modifier-hover);
		color: var(--text-normal);
	}

	.icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }

	.icon-btn.spinning { animation: spin 0.8s linear infinite; }

	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	/* ── Body ──────────────────────────────────────────── */
	.indicators-body { padding: var(--size-4-4); }

	/* ── Skeletons ─────────────────────────────────────── */
	.skeleton-grid {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-3);
	}

	.skeleton-card {
		height: 96px;
		border-radius: var(--radius-m);
		background: var(--background-modifier-border);
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.45; }
	}

	/* ── Error banner ──────────────────────────────────── */
	.error-banner {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: var(--size-4-3);
		background: var(--background-modifier-error-rgb, rgba(255, 0, 0, 0.06));
		border-radius: var(--radius-s);
		color: var(--text-error);
		font-size: var(--font-ui-small);
	}

	/* ── Empty state ───────────────────────────────────── */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--size-4-3);
		padding: var(--size-4-8, 32px) var(--size-4-4);
		text-align: center;
	}

	.empty-state p {
		margin: 0;
		color: var(--text-muted);
		font-size: var(--font-ui-small);
	}

	/* ── Indicators list ───────────────────────────────── */
	.indicators-list {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-3);
	}

	/* ── Indicator card (full-width) ───────────────────── */
	.indicator-card {
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		padding: var(--size-4-4);
		display: flex;
		flex-direction: column;
		gap: var(--size-4-3);
		transition: box-shadow 0.15s;
	}

	.indicator-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.07); }

	.indicator-card.over-budget {
		border-left: 3px solid var(--color-red, #e05252);
	}

	/* ── Top row ───────────────────────────────────────── */
	.card-top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--size-4-4);
	}

	.card-identity {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.card-name {
		font-size: var(--font-ui-medium);
		font-weight: 700;
		color: var(--text-normal);
		line-height: 1.2;
	}

	.card-meta {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}

	.meta-chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 11px;
		color: var(--text-muted);
	}

	.meta-chip svg { flex-shrink: 0; opacity: 0.7; }

	/* ── Right: remaining + badge ──────────────────────── */
	.card-remaining {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
		flex-shrink: 0;
	}

	.remaining-label {
		font-size: 11px;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.remaining-value {
		font-size: 20px;
		font-weight: 700;
		line-height: 1.1;
		white-space: nowrap;
	}

	.status-badge {
		display: inline-block;
		padding: 2px 9px;
		border-radius: 20px;
		font-size: 11px;
		font-weight: 500;
	}

	.status-good    { background: rgba(76,175,116,0.12); color: var(--color-green, #4caf74); }
	.status-warn    { background: rgba(232,160,39,0.12); color: var(--color-orange, #e8a027); }
	.status-over    { background: rgba(224,82,82,0.12);  color: var(--color-red, #e05252); }
	.status-neutral { background: var(--background-modifier-border); color: var(--text-muted); }

	/* ── Progress section ──────────────────────────────── */
	.progress-section {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.progress-label-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.progress-label-text {
		font-size: var(--font-ui-small);
		color: var(--text-muted);
	}

	.pct-text {
		font-size: var(--font-ui-small);
		font-weight: 600;
	}

	.progress-track {
		width: 100%;
		height: 8px;
		background: var(--background-modifier-border);
		border-radius: 4px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		border-radius: 4px;
		transition: width 0.4s ease;
	}

	/* ── Stats row ─────────────────────────────────────── */
	.stats-row {
		display: flex;
		gap: var(--size-4-6);
		padding-top: var(--size-4-2);
		border-top: 1px solid var(--background-modifier-border);
	}

	.stat-block {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.stat-label {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-size: 11px;
		color: var(--text-muted);
	}

	.rollover-label { color: var(--color-green, #4caf74); }

	.stat-value {
		font-size: var(--font-ui-small);
		font-weight: 600;
		color: var(--text-normal);
		white-space: nowrap;
	}

	.rollover-value { color: var(--color-green, #4caf74); }

	/* ── Card loading/error ────────────────────────────── */
	.card-loading-area {
		display: flex;
		flex-direction: column;
		gap: 7px;
	}

	.mini-skeleton {
		height: 8px;
		width: 100%;
		background: var(--background-modifier-border);
		border-radius: 4px;
		animation: pulse 1.5s ease-in-out infinite;
	}

	.card-error {
		font-size: var(--font-ui-small);
		color: var(--text-error);
	}
</style>
