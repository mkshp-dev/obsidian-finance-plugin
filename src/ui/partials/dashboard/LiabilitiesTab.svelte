<!-- src/ui/partials/dashboard/LiabilitiesTab.svelte -->
<script lang="ts">
	import { writable, type Writable } from 'svelte/store';
	import { MarkdownView } from 'obsidian';
	import type { LiabilitiesController, LiabilitiesState, LoanRow } from '../../../controllers/LiabilitiesController';
	import { nextDueDate, daysBetween, payoffFraction } from '../../../services/liabilities.service';

	export let controller: LiabilitiesController;
	export let plugin: any = null;

	const placeholderState: Writable<LiabilitiesState> = writable({
		isLoading: true, error: null, liabilities: [], receivables: [], sourcePath: '',
		totalLiabilities: null, totalReceivables: null, currency: 'USD',
	});

	$: stateStore = controller ? controller.state : placeholderState;
	$: state = $stateStore;

	function formatNumber(n: number | null, opts: { signed?: boolean } = {}): string {
		if (n === null) return '—';
		const v = n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
		return opts.signed && n > 0 ? `+${v}` : v;
	}

	function formatPercent(n: number | null): string {
		if (n === null) return '—';
		return `${n.toFixed(2)}%`;
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

	function payoffPct(row: LoanRow): number | null {
		const f = payoffFraction(row.currentBalance, row.principal);
		return f === null ? null : f * 100;
	}

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
		<button class="refresh-button" on:click={handleRefresh} disabled={state.isLoading} title="Reload accounts file and balances">
			{#if state.isLoading}
				Refreshing…
			{:else}
				Refresh
			{/if}
		</button>
	</div>

	{#if state.error}
		<p class="error-msg">Error: {state.error}</p>
	{/if}

	{#if state.isLoading && state.liabilities.length === 0 && state.receivables.length === 0}
		<p class="muted">Loading…</p>
	{:else}
		<div class="kpis">
			<div class="kpi-card">
				<div class="kpi-label">Total liabilities</div>
				<div class="kpi-value">{formatNumber(state.totalLiabilities)}</div>
				<div class="kpi-foot">Sum of current balances</div>
			</div>
			<div class="kpi-card">
				<div class="kpi-label">Total receivables</div>
				<div class="kpi-value">{formatNumber(state.totalReceivables)}</div>
				<div class="kpi-foot">Sum of current balances</div>
			</div>
		</div>

		{#if state.liabilities.length === 0 && state.receivables.length === 0}
			<div class="loan-empty-state">
				<p>No loan-shaped accounts found.</p>
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
			</div>
		{/if}

		{#each [
			{ title: 'Liabilities', rows: state.liabilities, accentClass: 'role-liability' },
			{ title: 'Receivables', rows: state.receivables, accentClass: 'role-receivable' },
		] as section}
			{#if section.rows.length > 0}
				<section class={section.accentClass}>
					<h4>{section.title}</h4>
					<div class="loan-grid">
						{#each section.rows as row (row.account)}
							{@const pct = payoffPct(row)}
							<article class="loan-card">
								<header class="loan-card-header">
									<div class="account">
										<span class="account-name">{row.account}</span>
										{#if row.loanType}<span class="badge">{row.loanType}</span>{/if}
									</div>
									{#if plugin && row.sourceLine}
										<button class="ghost" on:click={() => openSource(row)} title="Open accounts file at line {row.sourceLine}">↗</button>
									{/if}
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
										<dt>Principal</dt><dd>{formatNumber(row.principal)} {row.currency}</dd>
									{/if}
									{#if row.interestRate !== null}
										<dt>Interest</dt><dd>{formatPercent(row.interestRate)} APR</dd>
									{/if}
									{#if row.monthlyPayment !== null}
										<dt>Monthly</dt><dd>{formatNumber(row.monthlyPayment)} {row.currency}</dd>
									{/if}
									{#if row.dueDay !== null}
										<dt>Next due</dt>
										<dd>
											{nextDueLabel(row.dueDay)}
											<span class="muted small">({relativeDue(row.dueDay)})</span>
										</dd>
									{/if}
								</dl>

								{#if pct !== null}
									<div class="payoff" title="{pct.toFixed(1)}% paid off vs. principal">
										<div class="payoff-bar"><div class="payoff-fill" style="width: {pct}%"></div></div>
										<span class="payoff-label">{pct.toFixed(0)}% paid off</span>
									</div>
								{/if}
							</article>
						{/each}
					</div>
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

	.refresh-button {
		padding: 4px 10px;
		border-radius: var(--radius-s);
	}

	.error-msg { color: var(--color-red); }
	.muted { color: var(--text-muted); }
	.small { font-size: var(--font-ui-smaller); }

	.kpis {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: var(--size-4-3);
	}
	.kpi-card {
		padding: var(--size-4-4);
		background: var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
	}
	.kpi-label {
		font-size: var(--font-ui-small);
		color: var(--text-muted);
		margin-bottom: var(--size-4-2);
	}
	.kpi-value {
		font-size: 1.6em;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.kpi-foot {
		margin-top: var(--size-4-1);
		font-size: var(--font-ui-smaller);
		color: var(--text-faint);
	}

	.loan-empty-state {
		padding: var(--size-4-4);
		border: 1px dashed var(--background-modifier-border);
		border-radius: var(--radius-m);
		background: var(--background-secondary);
	}
	.loan-empty-state pre {
		background: var(--background-primary);
		padding: var(--size-4-3);
		border-radius: var(--radius-s);
		overflow-x: auto;
	}

	section {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-2);
	}

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
		border-top: 3px solid var(--background-modifier-border);
	}
	.role-liability .loan-card {
		border-top-color: var(--color-red);
	}
	.role-receivable .loan-card {
		border-top-color: var(--color-green);
	}

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
	}
	.account-name {
		font-weight: 600;
		font-size: var(--font-ui-small);
		word-break: break-word;
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
	dl.meta dt {
		color: var(--text-muted);
	}
	dl.meta dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
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
</style>
