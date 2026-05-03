<!-- src/ui/partials/dashboard/LiabilitiesTab.svelte -->
<script lang="ts">
	import { writable, type Writable } from 'svelte/store';
	import { MarkdownView } from 'obsidian';
	import type { LiabilitiesController, LiabilitiesState, LoanRow } from '../../../controllers/LiabilitiesController';
	import { nextDueDate, daysBetween, payoffFraction } from '../../../services/liabilities.service';
	import { formatCurrency, formatCurrencyAmount } from '../../../utils/currency-precision';

	export let controller: LiabilitiesController;
	export let plugin: any = null;

	const placeholderState: Writable<LiabilitiesState> = writable({
		isLoading: true, error: null, liabilities: [], receivables: [], sourcePath: '',
		totalLiabilities: null, totalReceivables: null, currency: 'USD',
	});

	$: stateStore = controller ? controller.state : placeholderState;
	$: state = $stateStore;

	let searchTerm = '';

	function formatPercent(n: number | null): string {
		if (n === null) return '—';
		// Trim trailing zeros: 29.50 → "29.5%", 29.00 → "29%"
		const fixed = n.toFixed(2);
		const trimmed = fixed.replace(/\.?0+$/, '');
		return `${trimmed}%`;
	}

	function todayIso(): string {
		return new Date().toISOString().slice(0, 10);
	}

	function relativeDue(dueDay: number | null): string {
		if (dueDay === null) return '';
		const next = nextDueDate(dueDay, todayIso());
		if (!next) return '';
		const days = daysBetween(todayIso(), next);
		if (days === 0) return 'today';
		if (days === 1) return 'tomorrow';
		if (days < 0) return `${Math.abs(days)}d ago`;
		return `in ${days}d`;
	}

	function nextDueLabel(dueDay: number | null): string {
		const next = nextDueDate(dueDay, todayIso());
		return next ?? '—';
	}

	function urgencyClass(dueDay: number | null): string {
		if (dueDay === null) return '';
		const next = nextDueDate(dueDay, todayIso());
		if (!next) return '';
		const days = daysBetween(todayIso(), next);
		if (days < 0) return 'urgency-overdue';
		if (days <= 7) return 'urgency-soon';
		return '';
	}

	function payoffPct(row: LoanRow): number | null {
		const f = payoffFraction(row.currentBalance, row.principal);
		return f === null ? null : f * 100;
	}

	function isAboveBudget(row: LoanRow): boolean {
		if (row.principal === null || row.currentBalance === null) return false;
		return Math.abs(row.currentBalance) > Math.abs(row.principal);
	}

	function aboveBudgetPct(row: LoanRow): number | null {
		if (!isAboveBudget(row) || row.principal === null) return null;
		const ratio = Math.abs(row.currentBalance ?? 0) / Math.abs(row.principal);
		return (ratio - 1) * 100;
	}

	// Sort key: next-due ascending (overdue first), accounts without
	// dueDay sort to the end. Stable on account name.
	function sortKey(row: LoanRow): number {
		if (row.dueDay === null) return Number.POSITIVE_INFINITY;
		const next = nextDueDate(row.dueDay, todayIso());
		if (!next) return Number.POSITIVE_INFINITY;
		return daysBetween(todayIso(), next);
	}

	function sortRows(rows: LoanRow[]): LoanRow[] {
		return [...rows].sort((a, b) => {
			const ka = sortKey(a), kb = sortKey(b);
			if (ka !== kb) return ka - kb;
			return a.account.localeCompare(b.account);
		});
	}

	function rowMatches(row: LoanRow, term: string): boolean {
		if (!term.trim()) return true;
		const t = term.toLowerCase();
		return (
			row.account.toLowerCase().includes(t) ||
			(row.loanType ?? '').toLowerCase().includes(t) ||
			(row.counterparty ?? '').toLowerCase().includes(t)
		);
	}

	// Currency-grouped totals (a single sum across mixed currencies is
	// meaningless — show one tile per (role, currency) instead).
	type CurrencyTotal = { currency: string; total: number; count: number };

	function groupByCurrency(rows: LoanRow[]): CurrencyTotal[] {
		const map = new Map<string, { total: number; count: number }>();
		for (const r of rows) {
			if (r.currentBalance === null) continue;
			const ccy = r.currency || '—';
			const entry = map.get(ccy) ?? { total: 0, count: 0 };
			entry.total += r.currentBalance;
			entry.count += 1;
			map.set(ccy, entry);
		}
		return Array.from(map.entries())
			.map(([currency, v]) => ({ currency, total: v.total, count: v.count }))
			.sort((a, b) => a.currency.localeCompare(b.currency));
	}

	$: filteredLiabilities = sortRows((state.liabilities ?? []).filter(r => rowMatches(r, searchTerm)));
	$: filteredReceivables = sortRows((state.receivables ?? []).filter(r => rowMatches(r, searchTerm)));
	$: liabilityTotalsByCcy = groupByCurrency(state.liabilities ?? []);
	$: receivableTotalsByCcy = groupByCurrency(state.receivables ?? []);
	$: hasAnyAccount = (state.liabilities?.length ?? 0) + (state.receivables?.length ?? 0) > 0;

	async function openSource(row: LoanRow) {
		if (!plugin || !row.sourceLine) return;
		try {
			const file = plugin.app.vault.getAbstractFileByPath(state.sourcePath);
			if (!file) return;
			const leaf = plugin.app.workspace.getLeaf(true);
			await leaf.openFile(file as any);
			const view = leaf.view;
			if (view instanceof MarkdownView && view.editor) {
				const line = Math.max(0, (row.sourceLine ?? 1) - 1);
				view.editor.setCursor({ line, ch: 0 });
				view.editor.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch: 0 } }, true);
			}
		} catch (_) {
			/* defensive */
		}
	}

	function handleRefresh() {
		if (controller) controller.refresh();
	}
</script>

<div class="liabilities-tab">
	<div class="header">
		<h3>Liabilities &amp; Receivables</h3>
		<button
			class="refresh-button"
			on:click={handleRefresh}
			disabled={state.isLoading}
			title="Reload accounts file and balances"
		>
			{#if state.isLoading}
				<svg class="spinner" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M21 12a9 9 0 11-6.219-8.56"/>
				</svg>
				Refreshing…
			{:else}
				<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M3 12a9 9 0 013.5-7.1"/>
					<path d="M20.5 5.5a9 9 0 01.5 6.5"/>
					<path d="M3 12a9 9 0 016.5 8.1"/>
					<path d="M20.5 18.5a9 9 0 01-6.5-5.5"/>
				</svg>
				Refresh
			{/if}
		</button>
	</div>

	{#if state.error}
		<p class="error-msg">Error: {state.error}</p>
	{/if}

	{#if state.isLoading && !hasAnyAccount}
		<p class="muted">Loading…</p>
	{:else}
		<!-- Currency-grouped totals: one tile per (role, currency) pair,
		     since summing across currencies would produce a meaningless number. -->
		{#if hasAnyAccount}
			<div class="totals-row">
				{#each liabilityTotalsByCcy as t (t.currency)}
					<div class="total-tile total-liability">
						<div class="total-label">Liabilities ({t.currency})</div>
						<div class="total-value">{formatCurrency(t.total, t.currency)} <span class="ccy">{t.currency}</span></div>
						<div class="total-meta">{t.count} {t.count === 1 ? 'account' : 'accounts'}</div>
					</div>
				{/each}
				{#each receivableTotalsByCcy as t (t.currency)}
					<div class="total-tile total-receivable">
						<div class="total-label">Receivables ({t.currency})</div>
						<div class="total-value">{formatCurrency(t.total, t.currency)} <span class="ccy">{t.currency}</span></div>
						<div class="total-meta">{t.count} {t.count === 1 ? 'account' : 'accounts'}</div>
					</div>
				{/each}
			</div>

			<div class="filter-row">
				<input
					type="search"
					class="search"
					placeholder="Filter by account, loan type, or counterparty…"
					bind:value={searchTerm}
				/>
				{#if searchTerm}
					<button class="ghost reset" on:click={() => (searchTerm = '')} title="Clear filter">✕</button>
				{/if}
			</div>
		{/if}

		{#if !hasAnyAccount}
			<div class="loan-empty-state">
				<p class="empty-title">No loan-shaped accounts found.</p>
				<p class="muted">
					Add metadata to <code>open</code> directives in
					<code>{state.sourcePath || 'accounts.beancount'}</code> like:
				</p>
				<pre><code>2026-01-01 open Liabilities:Credit:Visa  USD
  loan-type: "credit-card"
  principal: 50000
  interest-rate: 29.5
  monthly-payment: 5000
  due-day: 10
  counterparty: "Banco Santander"</code></pre>
				<p class="muted small">
					Recognised keys: <code>loan-type</code>, <code>principal</code>,
					<code>interest-rate</code>, <code>monthly-payment</code>,
					<code>due-day</code>, <code>counterparty</code>,
					<code>funding-account</code>. All are optional; an account is
					also picked up automatically if its name starts with
					<code>Liabilities:</code> or <code>Assets:Receivables</code>.
				</p>
			</div>
		{/if}

		{#each [
			{ title: 'Liabilities', rows: filteredLiabilities, accentClass: 'role-liability', total: state.liabilities.length },
			{ title: 'Receivables', rows: filteredReceivables, accentClass: 'role-receivable', total: state.receivables.length },
		] as section}
			{#if section.total > 0}
				<section class={section.accentClass}>
					<div class="section-header">
						<h4>{section.title}</h4>
						<span class="muted small">
							{#if searchTerm && section.rows.length !== section.total}
								{section.rows.length} of {section.total}
							{:else}
								{section.total} {section.total === 1 ? 'account' : 'accounts'}
							{/if}
						</span>
					</div>

					{#if section.rows.length === 0}
						<p class="muted small">No matches.</p>
					{:else}
						<div class="loan-grid">
							{#each section.rows as row (row.account)}
								{@const pct = payoffPct(row)}
								{@const above = isAboveBudget(row)}
								{@const abovePct = aboveBudgetPct(row)}
								<article class="loan-card {urgencyClass(row.dueDay)}" class:above-principal={above}>
									<header class="loan-card-header">
										<div class="account">
											<div class="account-name-row">
												<span class="account-name" title={row.account}>{row.account}</span>
												{#if plugin && row.sourceLine}
													<button class="ghost small-btn" on:click={() => openSource(row)} title="Open accounts file at line {row.sourceLine}">↗</button>
												{/if}
											</div>
											{#if row.loanType}<span class="badge">{row.loanType}</span>{/if}
										</div>
									</header>

									<div class="balance-block">
										<span class="balance-label">Balance</span>
										<span class="balance">{row.currentBalanceDisplay}</span>
									</div>

									<dl class="meta">
										{#if row.counterparty}
											<dt>Counterparty</dt><dd>{row.counterparty}</dd>
										{/if}
										{#if row.principal !== null}
											<dt>Principal</dt><dd>{formatCurrencyAmount(row.principal, row.currency)}</dd>
										{/if}
										{#if row.interestRate !== null}
											<dt>Interest</dt><dd>{formatPercent(row.interestRate)} APR</dd>
										{/if}
										{#if row.monthlyPayment !== null}
											<dt>Monthly</dt><dd>{formatCurrencyAmount(row.monthlyPayment, row.currency)}</dd>
										{/if}
										{#if row.dueDay !== null}
											<dt>Next due</dt>
											<dd>
												{nextDueLabel(row.dueDay)}
												<span class="due-rel">({relativeDue(row.dueDay)})</span>
											</dd>
										{/if}
									</dl>

									{#if pct !== null}
										<div class="payoff" title={above ? `${abovePct?.toFixed(1)}% above principal` : `${pct.toFixed(1)}% paid off vs. principal`}>
											<div class="payoff-bar">
												<div class="payoff-fill" style="width: {pct}%"></div>
											</div>
											{#if above}
												<span class="payoff-label warn">+{abovePct?.toFixed(0)}% above principal</span>
											{:else}
												<span class="payoff-label">{pct.toFixed(0)}% paid off</span>
											{/if}
										</div>
									{/if}
								</article>
							{/each}
						</div>
					{/if}
				</section>
			{/if}
		{/each}
	{/if}
</div>

<style>
	.liabilities-tab {
		padding: var(--size-4-4);
		display: flex;
		flex-direction: column;
		gap: var(--size-4-3);
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-bottom: var(--size-4-2);
		border-bottom: 1px solid var(--background-modifier-border);
	}
	.header h3 { margin: 0; font-size: var(--font-ui-larger); }

	.refresh-button {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: var(--size-4-1) var(--size-4-3);
		background: var(--interactive-normal);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		color: var(--text-normal);
		cursor: pointer;
		font-size: var(--font-ui-small);
	}
	.refresh-button:hover:not(:disabled) { background: var(--interactive-hover); }
	.refresh-button:disabled { opacity: 0.6; cursor: not-allowed; }
	.spinner { animation: spin 1s linear infinite; }
	@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

	.error-msg { color: var(--color-red); }
	.muted { color: var(--text-muted); }
	.small { font-size: var(--font-ui-smaller); }

	/* Currency-grouped totals row — variable number of tiles, wraps. */
	.totals-row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--size-4-3);
	}
	.total-tile {
		flex: 1 1 200px;
		min-width: 200px;
		padding: var(--size-4-3) var(--size-4-4);
		background: var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		border-left: 3px solid var(--background-modifier-border);
	}
	.total-tile.total-liability { border-left-color: var(--color-red); }
	.total-tile.total-receivable { border-left-color: var(--color-green); }
	.total-label {
		font-size: var(--font-ui-small);
		color: var(--text-muted);
		margin-bottom: 2px;
	}
	.total-value {
		font-size: 1.4em;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.total-value .ccy {
		font-size: 0.6em;
		font-weight: 600;
		color: var(--text-muted);
		margin-left: 4px;
	}
	.total-meta {
		margin-top: var(--size-4-1);
		font-size: var(--font-ui-smaller);
		color: var(--text-faint);
	}

	/* Filter row */
	.filter-row {
		display: flex;
		gap: 6px;
		align-items: center;
	}
	.search {
		flex: 1;
		padding: 6px 10px;
		border-radius: var(--radius-s);
		border: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
		color: var(--text-normal);
		font-size: var(--font-ui-small);
	}
	.reset {
		padding: 4px 10px;
		border-radius: var(--radius-s);
	}

	/* Empty state — scoped class to avoid colliding with Obsidian's
	   global .empty-state rule. */
	.loan-empty-state {
		padding: var(--size-4-4);
		border: 1px dashed var(--background-modifier-border);
		border-radius: var(--radius-m);
		background: var(--background-secondary);
	}
	.loan-empty-state .empty-title {
		margin-top: 0;
		font-weight: 600;
	}
	.loan-empty-state pre {
		background: var(--background-primary);
		padding: var(--size-4-3);
		border-radius: var(--radius-s);
		overflow-x: auto;
	}

	/* Section blocks */
	section {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-2);
	}
	.section-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
	}
	.section-header h4 { margin: 0; }

	/* Card grid */
	.loan-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: var(--size-4-3);
	}

	.loan-card {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-2);
		padding: var(--size-4-3);
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		border-left: 3px solid var(--background-modifier-border);
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
	}
	.role-liability .loan-card { border-left-color: var(--color-red); }
	.role-receivable .loan-card { border-left-color: var(--color-green); }

	/* Urgency overrides — overdue is the strongest cue, then due-soon. */
	.loan-card.urgency-overdue {
		border-left-color: var(--color-red);
		box-shadow: inset 4px 0 0 var(--color-red), 0 0 0 1px var(--color-red);
	}
	.loan-card.urgency-soon {
		border-left-color: var(--color-orange, var(--text-warning));
		box-shadow: inset 4px 0 0 var(--color-orange, var(--text-warning));
	}
	.loan-card.above-principal { background: color-mix(in srgb, var(--color-red), transparent 95%); }

	.loan-card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 8px;
	}
	.account {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
		flex: 1;
	}
	.account-name-row {
		display: flex;
		align-items: center;
		gap: 4px;
		min-width: 0;
	}
	.account-name {
		font-weight: 600;
		font-size: var(--font-ui-small);
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.badge {
		display: inline-block;
		padding: 2px 8px;
		border-radius: 999px;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		background: var(--background-modifier-hover);
		color: var(--text-muted);
		width: fit-content;
	}

	.balance-block {
		display: flex;
		flex-direction: column;
	}
	.balance-label {
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
	}
	.balance {
		font-size: 1.4em;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	dl.meta {
		display: grid;
		grid-template-columns: max-content 1fr;
		column-gap: var(--size-4-3);
		row-gap: 4px;
		margin: 0;
		font-size: var(--font-ui-small);
	}
	dl.meta dt { color: var(--text-muted); }
	dl.meta dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
	}
	.due-rel {
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
		margin-left: 4px;
	}

	.payoff {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.payoff-bar {
		flex: 1;
		height: 6px;
		background: var(--background-modifier-border);
		border-radius: 999px;
		overflow: hidden;
	}
	.payoff-fill {
		height: 100%;
		background: var(--interactive-accent);
		transition: width 0.3s ease;
	}
	.payoff-label {
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.payoff-label.warn { color: var(--color-red); font-weight: 600; }

	.ghost {
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 4px 6px;
		border-radius: var(--radius-s);
	}
	.ghost:hover {
		color: var(--text-normal);
		background: var(--background-modifier-hover);
	}
	.small-btn { padding: 0 6px; font-size: var(--font-ui-small); }
</style>
