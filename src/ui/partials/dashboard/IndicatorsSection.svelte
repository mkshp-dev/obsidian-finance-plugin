<!-- src/ui/partials/dashboard/IndicatorsSection.svelte -->
<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import { parse as parseCsv } from 'csv-parse/sync';
	import { runQuery, deleteIndicatorDirective, parsePeriodLabel } from '../../../utils';
	import { resolveNavTab, type NavRequest } from '../../../types/navigation';
	// `getIndicatorStatusQuery`  → current-cycle expense (single aggregated row).
	// `getIndicatorBalanceQuery` → cumulative balance since the indicator's startDate.
	// Both are needed for rollover indicators so we can recompute `remaining`
	// client-side: `remaining = elapsedCycles * targetAmount - balance`.
	import { getBudgetListQuery, getTargetListQuery, getIndicatorStatusQuery, getIndicatorBalanceQuery } from '../../../queries';
	import { AddBudgetModal } from '../../modals/AddBudgetModal';
	import { AddTargetModal } from '../../modals/AddTargetModal';
	import { Notice } from 'obsidian';
	import CustomSelect from '../../common/CustomSelect.svelte';

	export let plugin: any = null;
	export let navigate: ((req: NavRequest) => void) | null = null;

	const dispatch = createEventDispatcher();

	function handleViewTransactions(item: IndicatorItem, event?: MouseEvent) {
		if (!item.accountString) return;
		// Filter to the *current cycle* (e.g. this month, for a monthly budget that
		// started tracking back in January), matching what the status bar actually
		// shows — not the indicator's overall tracking start date.
		const { startDate, endDate } = getCurrentCycleRange(normalizePeriod(item.period));
		const req: NavRequest = {
			tab: resolveNavTab(event),
			filters: { account: item.accountString, startDate, endDate }
		};
		if (navigate) {
			navigate(req);
		} else {
			dispatch('navigate', req);
		}
	}

	interface IndicatorItem {
		name: string;
		accountString: string;
		period: string;
		isRollOver: boolean;
		targetAmount: number;
		currency: string;
		startDate: string;
		tag?: string;
		tagMode?: 'has' | 'not_has';
		spent: number;
		remaining: number;
		loading: boolean;
		error: string | null;
		filename?: string;
		lineno?: number;
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

	/**
	 * Counts the cycles elapsed from `startDate` through today, inclusive of both endpoints.
	 *
	 * This is the JS mirror of the SQL formula used by the legacy rollover query:
	 *   ((year(today())-year(start)) * N + (subPart(today()) - subPart(start)) + 1)
	 * where N and `subPart` depend on the period:
	 *   • month   → N=12, subPart=month
	 *   • quarter → N=4,  subPart=quarter
	 *   • year    → N=1,  subPart=(none)
	 *   • week    → approximated via (today-start)/7days; ISO week boundaries are
	 *               ignored deliberately, matching the SQL `date_part('week', date)`
	 *               approximation closely enough for indicator math.
	 *
	 * Used by the rollover formula `remaining = elapsedCycles * targetAmount - balance`.
	 * Returns at least 1 — if `startDate` is in the future or unparseable we treat
	 * the indicator as "current cycle only" so rendering never produces NaN.
	 */
	// Maps the user-facing period name (Monthly/Weekly/...) to bean-query's
	// date_trunc token. Shared by the status queries and the cycle-range helper below.
	const PERIOD_TOKENS: Record<string, string> = { weekly: 'week', quarterly: 'quarter', yearly: 'year', monthly: 'month' };
	function normalizePeriod(period: string): string {
		return PERIOD_TOKENS[(period || '').toLowerCase()] ?? 'month';
	}

	/**
	 * Computes the [startDate, endDate] bounds (inclusive, YYYY-MM-DD) of the
	 * *current* cycle bucket for a normalized period, mirroring the
	 * `date_trunc(period, date) = date_trunc(period, today())` bucketing that
	 * `getIndicatorStatusQuery` uses server-side. Used to filter Transactions/
	 * Journal navigation to the cycle currently shown on the card, rather than
	 * the indicator's overall tracking start date.
	 */
	function getCurrentCycleRange(period: string): { startDate: string; endDate: string } {
		const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
		const today = new Date();
		const y = today.getFullYear();
		const m = today.getMonth();

		if (period === 'year') {
			return { startDate: toISO(new Date(y, 0, 1)), endDate: toISO(new Date(y, 11, 31)) };
		}
		if (period === 'quarter') {
			const qStartMonth = Math.floor(m / 3) * 3;
			return { startDate: toISO(new Date(y, qStartMonth, 1)), endDate: toISO(new Date(y, qStartMonth + 3, 0)) };
		}
		if (period === 'week') {
			// Monday-start week, matching the common date_trunc('week', ...) convention.
			const dow = today.getDay(); // 0=Sun..6=Sat
			const diffToMonday = (dow + 6) % 7;
			const monday = new Date(y, m, today.getDate() - diffToMonday);
			const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
			return { startDate: toISO(monday), endDate: toISO(sunday) };
		}
		// Default: month.
		return { startDate: toISO(new Date(y, m, 1)), endDate: toISO(new Date(y, m + 1, 0)) };
	}

	function getElapsedCycles(startDate: string, period: string): number {
		if (!startDate) return 1; // Guard: missing startDate → degenerate to a single cycle.
		const start = new Date(startDate);
		const today = new Date();
		// Guard: an unparseable ISO date string (e.g. malformed event meta) → fall back to 1
		// rather than propagating NaN into the rollover math.
		if (isNaN(start.getTime())) return 1;
		let cycles: number;
		if (period === 'year') {
			// Inclusive year count: e.g. start=2024-X, today=2026-Y → 3 cycles (2024, 2025, 2026).
			cycles = today.getFullYear() - start.getFullYear() + 1;
		} else if (period === 'quarter') {
			// Quarter index in [0..3] derived from getMonth() (0=Jan..11=Dec).
			// Cross-year quarter delta uses *4 for the year wrap.
			cycles = (today.getFullYear() - start.getFullYear()) * 4
				+ (Math.floor(today.getMonth() / 3) - Math.floor(start.getMonth() / 3)) + 1;
		} else if (period === 'week') {
			// Coarse week counting: floor(delta-in-ms / 1 week) + 1.
			// Intentionally NOT ISO-week-aligned — matches the SQL behavior, and
			// rollover budgets are rarely week-granular in practice.
			const msPerWeek = 7 * 24 * 60 * 60 * 1000;
			cycles = Math.floor((today.getTime() - start.getTime()) / msPerWeek) + 1;
		} else {
			// Default: month. Inclusive month count, with *12 for the year carry.
			cycles = (today.getFullYear() - start.getFullYear()) * 12
				+ (today.getMonth() - start.getMonth()) + 1;
		}
		// Clamp to >=1: protects against startDate-in-the-future and similar oddities.
		return Math.max(1, cycles);
	}

	function formatAmount(amount: number, currency: string): string {
		const decimals = plugin?.currencyPrecisionService?.getDecimals(currency) ?? 2;
		const abs = Math.abs(amount);
		return `${abs.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${currency}`;
	}

	function formatSignedAmount(amount: number, currency: string): string {
		const decimals = plugin?.currencyPrecisionService?.getDecimals(currency) ?? 2;
		const sign = amount < 0 ? '−' : ' ';
		const abs = Math.abs(amount);
		return `${sign}${abs.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${currency}`;
	}

	// For rollover budgets, available budget = spent + remaining (base + accumulated rollover).
	// For non-rollover, available = base target.
	function getEffectiveTarget(item: IndicatorItem): number {
		if (item.isRollOver) return item.spent + item.remaining;
		return item.targetAmount;
	}

	function getPct(item: IndicatorItem): number {
		const eff = getEffectiveTarget(item);
		if (eff <= 0) {
			// Rollover deficit (or zero available with spending) — already over budget.
			return eff < 0 || item.spent > 0 ? Infinity : 0;
		}
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
			tag: col(r, '_tag') || undefined,
			tagMode: (col(r, '_tagMode') || undefined) as 'has' | 'not_has' | undefined,
			spent: 0,
			remaining: 0,
			loading: true,
			error: null,
			filename: col(r, '_filename') || '',
			lineno: parseNumericValue(col(r, '_lineno')) || 0,
		}));
		budgets = items;
		await Promise.all(items.map((_: any, i: number) => loadBudgetStatus(i)));
	}

	async function loadBudgetStatus(index: number) {
		const item = budgets[index];
		// Guard: an indicator is only renderable if it has an account scope, a start date,
		// and a positive base target. Otherwise we render an inline error rather than
		// dispatching queries that can't meaningfully return a status.
		if (!item.accountString || !item.startDate || item.targetAmount <= 0) {
			budgets = budgets.map((b, i) => i === index
				? { ...b, loading: false, error: 'Indicator data incomplete — check the event directive in events.beancount.' }
				: b);
			return;
		}
		try {
			const period = normalizePeriod(item.period);

			// Query A — current-cycle expense. Always run for every indicator.
			const expensePromise = runQuery(
				plugin,
				getIndicatorStatusQuery(item.currency, item.accountString, period, item.tag, item.tagMode)
			);
			// Query B — cumulative balance since startDate. Only needed for rollover
			// indicators (used to compute carry-over). For non-rollover we resolve to ''
			// so the Promise.all shape stays uniform without firing an unused query.
			const balancePromise = item.isRollOver
				? runQuery(plugin, getIndicatorBalanceQuery(item.currency, item.accountString, item.startDate, item.tag, item.tagMode))
				: Promise.resolve('');

			// Run both queries in parallel — they have no dependencies on each other.
			const [expenseCsv, balanceCsv] = await Promise.all([expensePromise, balancePromise]);

			// Parse expense CSV. The query selects only aggregate columns, so we get
			// either 0 rows (no postings this cycle) or 1 row. spent defaults to 0 when no rows.
			const expenseRows = parseCsv(expenseCsv, { columns: true, skip_empty_lines: true, trim: true }) as any[];
			// Math.abs preserves the long-standing budget convention: expense postings
			// in beancount are positive but we display "spent" as an absolute magnitude.
			const spent = expenseRows.length > 0
				? Math.abs(parseNumericValue(col(expenseRows[0], '_expenseThisCycle')))
				: 0;

			// Compute remaining differently depending on indicator type.
			let remaining: number;
			if (item.isRollOver) {
				// Rollover: remaining accumulates unused (or absorbs over-spent) budget
				// across every elapsed cycle since startDate.
				//
				//   remaining = elapsedCycles * targetAmount - cumulativeBalance
				//
				// Worked examples (budget = 100/month, started 4 months ago):
				//   • No postings ever         → balance = 0   → remaining = 400  (3 prior months + this month rolled forward)
				//   • Spent 250 across history → balance = 250 → remaining = 150
				//   • Spent 410 across history → balance = 410 → remaining = -10  (over-budget by 10)
				//
				// This formula matches the SQL `elapsed*budget - last(balance)` from the
				// old query, but is now robust to the "no rows this cycle" edge case.
				const balanceRows = parseCsv(balanceCsv, { columns: true, skip_empty_lines: true, trim: true }) as any[];
				const balance = balanceRows.length > 0
					? parseNumericValue(col(balanceRows[0], '_balance'))
					: 0;
				remaining = getElapsedCycles(item.startDate, period) * item.targetAmount - balance;
			} else {
				// Non-rollover: each cycle is independent. Simple subtraction.
				remaining = item.targetAmount - spent;
			}

			budgets = budgets.map((b, i) => i === index ? { ...b, spent, remaining, loading: false } : b);
		} catch (e) {
			// Surface query/parse errors in the card itself rather than throwing globally.
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
			tag: col(r, '_tag') || undefined,
			tagMode: (col(r, '_tagMode') || undefined) as 'has' | 'not_has' | undefined,
			spent: 0,
			remaining: 0,
			loading: true,
			error: null,
			filename: col(r, '_filename') || '',
			lineno: parseNumericValue(col(r, '_lineno')) || 0,
		}));
		targets = items;
		await Promise.all(items.map((_: any, i: number) => loadTargetStatus(i)));
	}

	async function loadTargetStatus(index: number) {
		const item = targets[index];
		// Same renderability guard as for budgets — see loadBudgetStatus for rationale.
		if (!item.accountString || !item.startDate || item.targetAmount <= 0) {
			targets = targets.map((t, i) => i === index
				? { ...t, loading: false, error: 'Indicator data incomplete — check the event directive in events.beancount.' }
				: t);
			return;
		}
		try {
			const period = normalizePeriod(item.period);

			// Query A — this cycle's net contribution (e.g. amount saved this month for an Assets target).
			const expensePromise = runQuery(
				plugin,
				getIndicatorStatusQuery(item.currency, item.accountString, period, item.tag, item.tagMode)
			);
			// Query B — cumulative balance since startDate, only for rollover targets.
			// Bug-fix vs prior behavior: the old code ignored `isRollOver` entirely in the
			// success path, so rollover targets were silently treated like non-rollover.
			// Now we honor it and apply the same elapsed-cycles formula budgets use.
			const balancePromise = item.isRollOver
				? runQuery(plugin, getIndicatorBalanceQuery(item.currency, item.accountString, item.startDate, item.tag, item.tagMode))
				: Promise.resolve('');

			const [expenseCsv, balanceCsv] = await Promise.all([expensePromise, balancePromise]);

			const expenseRows = parseCsv(expenseCsv, { columns: true, skip_empty_lines: true, trim: true }) as any[];
			// NOTE: targets keep the signed value here (no Math.abs) — that's the
			// historical convention because target accounts (Assets) may have positive
			// deposits AND negative withdrawals in the same cycle, and a signed net is
			// the meaningful quantity for "how much did I save / move this cycle".
			const current = expenseRows.length > 0
				? parseNumericValue(col(expenseRows[0], '_expenseThisCycle'))
				: 0;

			let remaining: number;
			if (item.isRollOver) {
				// Rollover target: same math as rollover budget.
				//   remaining = elapsedCycles * targetAmount - cumulativeBalance
				// For a savings target, positive `remaining` means "still need to save more
				// to be on track including any prior shortfall"; negative means you're ahead.
				const balanceRows = parseCsv(balanceCsv, { columns: true, skip_empty_lines: true, trim: true }) as any[];
				const balance = balanceRows.length > 0
					? parseNumericValue(col(balanceRows[0], '_balance'))
					: 0;
				remaining = getElapsedCycles(item.startDate, period) * item.targetAmount - balance;
			} else {
				// Non-rollover target: each cycle resets, so remaining is just goal minus this cycle's net.
				remaining = item.targetAmount - current;
			}

			targets = targets.map((t, i) => i === index
				? { ...t, spent: current, remaining, loading: false } : t);
		} catch (e) {
			targets = targets.map((t, i) => i === index
				? { ...t, loading: false, error: e instanceof Error ? e.message : 'Error loading status' } : t);
		}
	}

	onMount(() => { if (plugin) loadAll(); });

	function setView(view: IndicatorView) { activeView = view; }
	function handleViewChange(value: string) { setView(value as IndicatorView); }
	function handleAddBudget() { dispatch('add-budget'); }
	function handleAddTarget() { dispatch('add-target'); }

	function handleEdit(item: IndicatorItem) {
		if (!plugin) return;
		if (activeView === 'Budgets') {
			new AddBudgetModal(plugin.app, plugin, item, () => loadAll()).open();
		} else {
			new AddTargetModal(plugin.app, plugin, item, () => loadAll()).open();
		}
	}

	async function handleDelete(item: IndicatorItem) {
		if (!plugin) return;
		if (!item.filename || !item.lineno) {
			new Notice('Cannot find indicator location in file');
			return;
		}

		const confirmed = window.confirm(`Are you sure you want to delete the indicator "${item.name}"?`);
		if (!confirmed) return;

		try {
			const result = await deleteIndicatorDirective(plugin, item.filename, item.lineno);
			if (result.success) {
				new Notice(`Indicator "${item.name}" deleted successfully`);
				await loadAll();
			} else {
				new Notice(`Failed to delete indicator: ${result.error || 'Unknown error'}`);
			}
		} catch (error) {
			new Notice(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}
</script>

<div class="indicators-section">
	<!-- Header -->
	<div class="indicators-header">
		<div class="title-row">
			<h4>Financial Indicators</h4>
			<button class="btn btn-primary" on:click={loadAll} disabled={isLoading}>Refresh</button>
		</div>
		<div class="controls-row">
			<CustomSelect
				variant="secondary"
				position="single"
				options={[
					{ value: 'Budgets', label: `Budgets (${budgets.length})` },
					{ value: 'Targets', label: `Targets (${targets.length})` },
				]}
				value={activeView}
				on:change={(e) => handleViewChange(e.detail)}
				ariaLabel="Select indicator view"
			/>
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
								<div class="card-title-row">
									<span class="card-name">{item.name}</span>
									<div class="card-actions">
										<button class="btn-icon view-btn" on:click={(e) => handleViewTransactions(item, e)} title="Click: view in Transactions tab · Ctrl/Cmd+click: view in Journal">→ View</button>
										<button class="btn-icon edit-btn" on:click={() => handleEdit(item)} title="Edit">✏️</button>
										<button class="btn-icon delete-btn" on:click={() => handleDelete(item)} title="Delete">❌</button>
									</div>
								</div>
								<div class="card-meta">
									<button type="button" class="meta-chip account-chip" on:click={(e) => handleViewTransactions(item, e)} title="Click: view in Transactions tab · Ctrl/Cmd+click: view in Journal">
										<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
										{item.accountString}
									</button>
									<span class="meta-chip">
										<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
										{item.period}
									</span>
								</div>
							</div>
							{#if !item.loading && !item.error}
								<div class="card-remaining">
									<span class="remaining-label">{isBudget ? 'Remaining' : 'Still needed'}</span>
									<span class="remaining-value" style="--bar-color: {barColor};">{formatAmount(Math.max(item.remaining, 0), item.currency)}</span>
									<span class="status-badge {status.cls}">{status.label}</span>
								</div>
							{/if}
						</div>

						{#if item.loading}
							<div class="card-loading-area">
								<div class="mini-skeleton style-h10-w40"></div>
								<div class="mini-skeleton style-h6"></div>
								<div class="mini-skeleton style-h10-w60"></div>
							</div>
						{:else if item.error}
							<div class="card-error">{item.error}</div>
						{:else}
							<!-- Progress section -->
							<div class="progress-section">
								<div class="progress-label-row">
									<span class="progress-label-text">{formatAmount(item.spent, item.currency)} of {effTarget < 0 ? formatSignedAmount(effTarget, item.currency) : formatAmount(effTarget, item.currency)}</span>
									<span class="pct-text" style="--bar-color: {barColor};">{isFinite(pct) ? `${(Math.round(pct * 10) / 10).toFixed(1)}%` : 'Over'}</span>
								</div>
								<div class="progress-track">
									<div class="progress-fill" style="--pct-width: {Math.min(pct, 100)}%; --bar-color: {barColor};"></div>
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
										<span class="stat-label rollover-label" class:rollover-negative={rolloverAmt < 0}>
											{#if rolloverAmt < 0}
												<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="7" y1="7" x2="17" y2="17"/><polyline points="17 7 17 17 7 17"/></svg>
											{:else}
												<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
											{/if}
											Rollover
										</span>
										<span class="stat-value rollover-value" class:rollover-negative={rolloverAmt < 0}>{formatSignedAmount(rolloverAmt, item.currency)}</span>
									</div>
									<div class="stat-block">
										<span class="stat-label">Available</span>
										<span class="stat-value">{formatSignedAmount(effTarget, item.currency)}</span>
									</div>
								{:else}
									<div class="stat-block">
										<span class="stat-label">{isBudget ? 'Spent' : 'Saved'}</span>
										<span class="stat-value">{formatAmount(item.spent, item.currency)}</span>
									</div>
									<div class="stat-block">
										<span class="stat-label">{isBudget ? 'Remaining' : 'Still needed'}</span>
										<span class="stat-value stat-value-colored" style="--bar-color: {barColor};">{formatAmount(Math.max(item.remaining, 0), item.currency)}</span>
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

	.btn {
		padding: 0.4rem 0.8rem;
		border-radius: 4px;
		border: 1px solid var(--background-modifier-border);
		background: var(--interactive-normal);
		color: var(--text-normal);
		cursor: pointer;
		font-size: 0.9rem;
	}

	.btn:hover {
		background: var(--interactive-hover);
	}

	.btn-primary {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		border-color: var(--interactive-accent);
	}

	.btn-primary:hover {
		background: var(--interactive-accent-hover);
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
		/* Override Obsidian core's global `.empty-state` rule
		 * (position:absolute; width:100%; height:100%; top:0) which would
		 * otherwise turn this placeholder into a full-viewport overlay
		 * that swallows clicks on every dashboard button. */
		position: relative;
		width: auto;
		height: auto;
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

	button.meta-chip.account-chip {
		background: transparent !important;
		border: none !important;
		box-shadow: none !important;
		outline: none !important;
		padding: 0 !important;
		margin: 0 !important;
		height: auto !important;
		font-family: inherit;
		font-size: 11px;
		color: var(--text-muted);
		cursor: pointer;
		transition: color 0.15s ease;
	}

	button.meta-chip.account-chip:hover {
		color: var(--interactive-accent);
		text-decoration: underline;
		background: transparent !important;
		box-shadow: none !important;
	}

	button.view-btn {
		background: transparent !important;
		border: none !important;
		box-shadow: none !important;
		outline: none !important;
		padding: 0 !important;
		margin: 0 !important;
		height: auto !important;
		font-family: inherit;
		font-size: 11px;
		color: var(--text-muted);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 3px;
		transition: color 0.15s ease;
	}

	button.view-btn:hover {
		color: var(--interactive-accent);
		text-decoration: underline;
		background: transparent !important;
		box-shadow: none !important;
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
		color: var(--bar-color);
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
		color: var(--bar-color);
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
		width: var(--pct-width, 0%);
		background: var(--bar-color);
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
	.rollover-label.rollover-negative { color: var(--color-red, #e05252); }

	.stat-value {
		font-size: var(--font-ui-small);
		font-weight: 600;
		color: var(--text-normal);
		white-space: nowrap;
	}

	.rollover-value { color: var(--color-green, #4caf74); }
	.rollover-value.rollover-negative { color: var(--color-red, #e05252); }

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

	.mini-skeleton.style-h10-w40 {
		height: 10px;
		width: 40%;
	}

	.mini-skeleton.style-h6 {
		height: 6px;
	}

	.mini-skeleton.style-h10-w60 {
		height: 10px;
		width: 60%;
	}

	.stat-value-colored {
		color: var(--bar-color);
	}

	.card-error {
		font-size: var(--font-ui-small);
		color: var(--text-error);
	}

	/* ── Edit/Delete Actions ───────────────────────────── */
	.card-title-row {
		display: flex;
		align-items: center;
		gap: var(--size-4-3);
	}

	.card-actions {
		display: inline-flex;
		gap: 6px;
		opacity: 0;
		transition: opacity 0.15s ease-in-out;
	}

	.indicator-card:hover .card-actions {
		opacity: 0.8;
	}

	.card-actions:hover {
		opacity: 1 !important;
	}

	.btn-icon {
		background: none;
		border: none;
		cursor: pointer;
		padding: 2px 6px;
		font-size: 13px;
		opacity: 0.7;
		transition: opacity 0.2s, background-color 0.2s;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.btn-icon:hover {
		opacity: 1;
		background: var(--background-modifier-hover);
	}

	.edit-btn:hover {
		color: var(--text-accent);
	}

	.delete-btn:hover {
		color: var(--text-error);
	}
</style>
