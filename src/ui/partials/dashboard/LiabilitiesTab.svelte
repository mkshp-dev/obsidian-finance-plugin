<!-- src/ui/partials/dashboard/LiabilitiesTab.svelte -->
<script lang="ts">
	import { writable, type Writable } from 'svelte/store';
	import { MarkdownView } from 'obsidian';
	import type { LiabilitiesController, LiabilitiesState, LoanRow } from '../../../controllers/LiabilitiesController';
	import {
		nextDueDate,
		daysBetween,
		payoffFraction,
		monthsRemaining,
		type LoanFormDraft,
	} from '../../../services/liabilities.service';
	import { formatCurrency, formatCurrencyAmount } from '../../../utils/currency-precision';
	import { LoanEditModal } from '../../modals/LoanEditModal';
	import { RecordPaymentModal } from '../../modals/RecordPaymentModal';

	export let controller: LiabilitiesController;
	export let plugin: any = null;

	const placeholderState: Writable<LiabilitiesState> = writable({
		isLoading: true, error: null, liabilities: [], receivables: [], sourcePath: '',
		totalLiabilities: null, totalReceivables: null, currency: 'USD',
	});

	$: stateStore = controller ? controller.state : placeholderState;
	$: state = $stateStore;

	let searchTerm = '';

	function rowToDraft(row: LoanRow): LoanFormDraft {
		return {
			account: row.account,
			currency: row.currency,
			openDate: row.openDate,
			loanType: row.loanType,
			counterparty: row.counterparty,
			principal: row.principal,
			interestRate: row.interestRate,
			monthlyPayment: row.monthlyPayment,
			dueDay: row.dueDay,
			fundingAccount: row.fundingAccount,
			paymentMode: row.paymentMode,
			payoffDate: row.payoffDate,
			payoffAmount: row.payoffAmount,
		};
	}

	function newDraftDefault(role: 'liability' | 'receivable' = 'liability'): LoanFormDraft {
		const today = new Date().toISOString().slice(0, 10);
		return {
			account: role === 'liability' ? 'Liabilities:' : 'Assets:Receivables:',
			currency: plugin?.settings?.operatingCurrency ?? 'USD',
			openDate: today,
			loanType: role === 'receivable' ? 'receivable' : 'credit-card',
			counterparty: null,
			principal: null,
			interestRate: null,
			monthlyPayment: null,
			dueDay: null,
			fundingAccount: null,
			paymentMode: 'recurring',
			payoffDate: null,
			payoffAmount: null,
		};
	}

	function openAddModal(role: 'liability' | 'receivable' = 'liability') {
		if (!plugin) return;
		new LoanEditModal(plugin.app, plugin, {
			mode: 'add',
			initial: newDraftDefault(role),
			onSaved: () => controller?.refresh(),
		}).open();
	}

	function openEditModal(row: LoanRow) {
		if (!plugin) return;
		new LoanEditModal(plugin.app, plugin, {
			mode: 'edit',
			initial: rowToDraft(row),
			onSaved: () => controller?.refresh(),
		}).open();
	}

	function openPaymentModal(row: LoanRow) {
		if (!plugin) return;
		new RecordPaymentModal(plugin.app, plugin, {
			loan: row,
			onSaved: () => controller?.refresh(),
		}).open();
	}

	function formatMonths(n: number | null): string {
		if (n === null) return '';
		if (n < 1) return '< 1 mo';
		if (n < 24) return `${Math.round(n)} mo`;
		const years = n / 12;
		return `${years.toFixed(years < 10 ? 1 : 0)} yr`;
	}

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

	/**
	 * The "next event" for a loan card depends on its payment mode:
	 *   - recurring → the next monthly due-day occurrence.
	 *   - one-time → the configured payoff date.
	 * Returns ISO YYYY-MM-DD or null when the loan has no schedule.
	 */
	function nextEventDate(row: LoanRow): string | null {
		if (row.paymentMode === 'one-time') return row.payoffDate;
		return nextDueDate(row.dueDay, todayIso());
	}

	function relativeDate(iso: string | null): string {
		if (!iso) return '';
		const days = daysBetween(todayIso(), iso);
		if (days === 0) return 'today';
		if (days === 1) return 'tomorrow';
		if (days < 0) return `${Math.abs(days)}d ago`;
		return `in ${days}d`;
	}

	function urgencyClassForRow(row: LoanRow): string {
		const next = nextEventDate(row);
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

	// Sort key: next-event ascending (overdue first), accounts without
	// any schedule sort to the end. Stable on account name.
	function sortKey(row: LoanRow): number {
		const next = nextEventDate(row);
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
		<div class="header-actions">
			<button class="add-button" on:click={() => openAddModal('liability')} disabled={!plugin} title="Add a new Liabilities:* account">+ Liability</button>
			<button class="add-button" on:click={() => openAddModal('receivable')} disabled={!plugin} title="Add a new Assets:Receivables:* account">+ Receivable</button>
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
					Click <strong>+ Liability</strong> or <strong>+ Receivable</strong> above to create the first one — or add metadata directly to an <code>open</code> directive in
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
								{@const months = monthsRemaining(row.currentBalance, row.monthlyPayment)}
								{@const isOneTime = row.paymentMode === 'one-time'}
								{@const eventDate = nextEventDate(row)}
								<article class="loan-card {urgencyClassForRow(row)}" class:above-principal={above} class:one-time={isOneTime}>
									<header class="loan-card-header">
										<div class="account">
											<span class="account-name" title={row.account}>{row.account}</span>
											<div class="badges">
												{#if row.loanType}<span class="badge">{row.loanType}</span>{/if}
												{#if isOneTime}<span class="badge schedule-badge">one-time</span>{/if}
											</div>
										</div>
										{#if plugin}
											<div class="card-actions">
												<button class="ghost small-btn" on:click={() => openPaymentModal(row)} title="Record a payment to this account">$</button>
												<button class="ghost small-btn" on:click={() => openEditModal(row)} title="Edit metadata in accounts.beancount">✎</button>
												{#if row.sourceLine}
													<button class="ghost small-btn" on:click={() => openSource(row)} title="Open accounts file at line {row.sourceLine}">↗</button>
												{/if}
											</div>
										{/if}
									</header>

									<div class="balance-block">
										<span class="balance-label">
											Balance
											{#if row.balanceSource === 'principal'}
												<span class="balance-source" title="No postings yet — showing the principal from the open-directive metadata">expected, from principal</span>
											{:else if row.balanceSource === 'unknown'}
												<span class="balance-source warn" title="Balance query failed — could not read postings">balance unavailable</span>
											{/if}
										</span>
										<span class="balance" class:expected={row.balanceSource === 'principal'}>{row.currentBalanceDisplay}</span>
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
										{#if isOneTime}
											{#if row.payoffAmount !== null}
												<dt>Payoff total</dt><dd>{formatCurrencyAmount(row.payoffAmount, row.currency)}</dd>
											{/if}
											{#if row.payoffDate}
												<dt>Pay off by</dt>
												<dd>
													{row.payoffDate}
													<span class="due-rel">({relativeDate(row.payoffDate)})</span>
												</dd>
											{/if}
										{:else}
											{#if row.monthlyPayment !== null}
												<dt>Monthly</dt><dd>{formatCurrencyAmount(row.monthlyPayment, row.currency)}</dd>
											{/if}
											{#if eventDate}
												<dt>Next due</dt>
												<dd>
													{eventDate}
													<span class="due-rel">({relativeDate(eventDate)})</span>
												</dd>
											{/if}
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

									{#if !isOneTime && months !== null}
										<div class="projection muted small" title="Naive ETA: |balance| / |monthly|. Doesn't account for interest.">
											{row.role === 'receivable' ? 'Recover in' : 'Payoff in'} ≈ {formatMonths(months)}
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

	.header-actions {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}
	.add-button {
		padding: var(--size-4-1) var(--size-4-3);
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		border: 1px solid var(--interactive-accent);
		border-radius: var(--radius-s);
		cursor: pointer;
		font-size: var(--font-ui-small);
	}
	.add-button:hover:not(:disabled) {
		filter: brightness(1.05);
	}
	.add-button:disabled { opacity: 0.5; cursor: not-allowed; }

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
	.account-name {
		font-weight: 600;
		font-size: var(--font-ui-small);
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		display: block;
	}
	.card-actions {
		display: flex;
		gap: 2px;
		flex-shrink: 0;
	}
	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
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
	.schedule-badge {
		background: color-mix(in srgb, var(--interactive-accent), transparent 80%);
		color: var(--interactive-accent);
	}
	.loan-card.one-time .balance {
		font-style: italic;
	}

	.balance-block {
		display: flex;
		flex-direction: column;
	}
	.balance-label {
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
	}
	.balance-source {
		font-style: italic;
		font-size: 10px;
		padding: 1px 8px;
		border-radius: 999px;
		background: var(--background-modifier-hover);
		color: var(--text-muted);
		text-transform: lowercase;
		letter-spacing: 0.02em;
	}
	.balance-source.warn {
		color: var(--color-orange, var(--text-warning));
		background: color-mix(in srgb, var(--color-orange, var(--text-warning)), transparent 88%);
	}
	.balance.expected {
		font-style: italic;
		opacity: 0.92;
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

	.projection {
		font-style: italic;
		opacity: 0.85;
	}

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
