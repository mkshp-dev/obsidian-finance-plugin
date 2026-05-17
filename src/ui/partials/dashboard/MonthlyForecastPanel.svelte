<!-- src/ui/partials/dashboard/MonthlyForecastPanel.svelte -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { ForecastResult } from '../../../services/forecast.service';
	import type { IndicatorType } from '../../../services/indicators.service';
	import { formatCurrencyAmount } from '../../../utils/currency-precision';

	export let forecast: ForecastResult;

	const dispatch = createEventDispatcher<{
		// Toggle on a recurring rule (income or expense).
		'toggle-rule-discretionary': { nickname: string; value: boolean };
		// Toggle on an indicator (Budget / Target / Savings).
		'toggle-indicator-discretionary': {
			name: string; type: IndicatorType; value: boolean;
		};
	}>();

	// Round to fiat-display precision (2 decimals) for all monetary
	// values shown. Avoids FX-multiplication noise like 16608.953.
	const r2 = (n: number) => Math.round(n * 100) / 100;

	$: op = forecast.operatingCurrency;
	$: incomeActive = forecast.breakdown.filter(
		e => e.kind === 'income' && !e.discretionary,
	);
	$: incomeDiscretionary = forecast.breakdown.filter(
		e => e.kind === 'income' && e.discretionary,
	);
	$: fixed = forecast.breakdown.filter(
		e => e.kind === 'expense' && e.countsAsFixed && e.monthlyInOperating !== null,
	);
	$: discretionaryExp = forecast.breakdown.filter(
		e => e.kind === 'expense' && e.discretionary,
	);
	$: budgetsActive = forecast.commitments.filter(
		c => c.kind === 'budget' && !c.discretionary,
	);
	$: savingsActive = forecast.commitments.filter(
		c => c.kind === 'savings' && !c.discretionary,
	);
	$: commitmentsDiscretionary = forecast.commitments.filter(
		c => c.discretionary,
	);
	$: unconvertible = forecast.breakdown.filter(
		e => e.monthlyInOperating === null,
	);
	$: ratioPct = isFinite(forecast.fixedConsumptionRatio)
		? Math.round(forecast.fixedConsumptionRatio * 100)
		: 0;
	$: ratioClamped = Math.max(0, Math.min(100, ratioPct));

	function onToggleRule(nickname: string, becomeDiscretionary: boolean) {
		dispatch('toggle-rule-discretionary', { nickname, value: becomeDiscretionary });
	}
	function onToggleIndicator(name: string, type: IndicatorType, becomeDiscretionary: boolean) {
		dispatch('toggle-indicator-discretionary', {
			name, type, value: becomeDiscretionary,
		});
	}
</script>

<div class="forecast-panel">
	<div class="forecast-header">
		<h3>Monthly Forecast</h3>
		<span class="forecast-subtitle">
			Projected from recurring rules — normalized to monthly cadence.
		</span>
	</div>

	<div class="forecast-totals">
		<div class="totals-row income">
			<span class="totals-label">Income</span>
			<span class="totals-value">
				+{formatCurrencyAmount(r2(forecast.monthlyIncome), op)}
			</span>
		</div>
		<div class="totals-row fixed">
			<span class="totals-label">Fixed obligations</span>
			<span class="totals-value">
				−{formatCurrencyAmount(r2(forecast.monthlyFixedExpenses), op)}
			</span>
		</div>
		{#if forecast.monthlyBudgetCommitments > 0}
			<div class="totals-row fixed">
				<span class="totals-label">Budgets</span>
				<span class="totals-value">
					−{formatCurrencyAmount(r2(forecast.monthlyBudgetCommitments), op)}
				</span>
			</div>
		{/if}
		{#if forecast.monthlySavingsCommitments > 0}
			<div class="totals-row fixed">
				<span class="totals-label">Savings</span>
				<span class="totals-value">
					−{formatCurrencyAmount(r2(forecast.monthlySavingsCommitments), op)}
				</span>
			</div>
		{/if}
		<div class="totals-row residual" class:negative={forecast.monthlyResidual < 0}>
			<span class="totals-label">Discretionary residual</span>
			<span class="totals-value">
				{formatCurrencyAmount(r2(forecast.monthlyResidual), op)}
			</span>
		</div>
	</div>

	{#if isFinite(forecast.fixedConsumptionRatio)}
		<div class="consumption-bar" aria-label="Income consumed by fixed obligations">
			<div
				class="consumption-fill"
				class:over-100={ratioPct > 100}
				style="width: {ratioClamped}%"
			></div>
			<span class="consumption-label">{ratioPct}% of income consumed</span>
		</div>
	{/if}

	{#if unconvertible.length > 0}
		<div class="missing-fx-warning">
			⚠ Missing FX rates for: {forecast.missingFxRates.join(', ')}.
			Rules in those currencies are NOT included in the totals above.
		</div>
	{/if}

	<div class="forecast-table-wrap">
		<table class="forecast-table">
			<thead>
				<tr>
					<th>Rule</th>
					<th class="num">Native</th>
					<th>Cadence</th>
					<th class="num">Monthly ({op})</th>
					<th class="toggle-col" title="Toggle to exclude from the Fixed total (treats the rule as discretionary)">Discr.</th>
				</tr>
			</thead>
			<tbody>
				{#if incomeActive.length > 0}
					<tr class="section-header"><td colspan="5">Income</td></tr>
					{#each incomeActive as e (e.nickname)}
						<tr>
							<td><code>{e.nickname}</code></td>
							<td class="num">{formatCurrencyAmount(e.nativeAmount, e.nativeCurrency)}</td>
							<td>{e.cadence}</td>
							<td class="num">
								{e.monthlyInOperating !== null
									? formatCurrencyAmount(r2(e.monthlyInOperating), op)
									: '—'}
							</td>
							<td class="toggle-col">
								<input type="checkbox" checked={false}
									aria-label="Mark {e.nickname} as discretionary income"
									title="Mark as discretionary — exclude from Income total (use for irregular income)"
									on:change={() => onToggleRule(e.nickname, true)} />
							</td>
						</tr>
					{/each}
				{/if}

				{#if fixed.length > 0}
					<tr class="section-header"><td colspan="5">Fixed expenses</td></tr>
					{#each fixed as e (e.nickname)}
						<tr>
							<td><code>{e.nickname}</code></td>
							<td class="num">{formatCurrencyAmount(e.nativeAmount, e.nativeCurrency)}</td>
							<td>{e.cadence}</td>
							<td class="num">
								{e.nativeCurrency !== op ? '≈ ' : ''}{formatCurrencyAmount(r2(e.monthlyInOperating ?? 0), op)}
							</td>
							<td class="toggle-col">
								<input type="checkbox" checked={false}
									aria-label="Mark {e.nickname} as discretionary"
									title="Mark as discretionary — exclude from Fixed total"
									on:change={() => onToggleRule(e.nickname, true)} />
							</td>
						</tr>
					{/each}
				{/if}

				{#if budgetsActive.length > 0}
					<tr class="section-header"><td colspan="5">Budgets (max of target vs actual spend)</td></tr>
					{#each budgetsActive as c (c.originalType + '|' + c.name)}
						<tr class:over-budget={c.actualSpend > c.target}>
							<td>
								<code>{c.name}</code>
								{#if c.actualSpend > c.target}
									<span class="over-tag" title="Actual spend exceeded target — overflow drained from discretionary">over</span>
								{/if}
							</td>
							<td class="num">
								{formatCurrencyAmount(c.target, c.nativeCurrency)}
								<span class="sub" title="Actual spend this {c.cycle.toLowerCase()} cycle">
									(spent {formatCurrencyAmount(r2(c.actualSpend), c.nativeCurrency)})
								</span>
							</td>
							<td>{c.cycle}</td>
							<td class="num">
								{c.monthlyInOperating !== null
									? `${c.nativeCurrency !== op ? '≈ ' : ''}${formatCurrencyAmount(r2(c.monthlyInOperating), op)}`
									: '—'}
							</td>
							<td class="toggle-col">
								<input type="checkbox" checked={false}
									aria-label="Mark budget {c.name} as discretionary"
									title="Mark as discretionary — exclude from Budgets total"
									on:change={() => onToggleIndicator(c.name, c.originalType, true)} />
							</td>
						</tr>
					{/each}
				{/if}

				{#if savingsActive.length > 0}
					<tr class="section-header"><td colspan="5">Savings (max of target vs actual accrued)</td></tr>
					{#each savingsActive as c (c.originalType + '|' + c.name)}
						<tr class:over-budget={c.actualSpend > c.target && c.targetPercent === undefined}>
							<td>
								<code>{c.name}</code>
								{#if c.originalType === 'Target'}
									<span class="legacy-tag" title="Legacy 'Target' indicator — treated as Savings">legacy</span>
								{/if}
								{#if c.targetPercent !== undefined}
									<span class="percent-tag" title="Percent of monthly income (resolved each month)">%</span>
								{/if}
							</td>
							<td class="num">
								{#if c.targetPercent !== undefined}
									<span class="percent-target">{c.targetPercent}% of income</span>
									<span class="sub" title="Actual accrual this {c.cycle.toLowerCase()} cycle">
										(accrued {formatCurrencyAmount(r2(c.actualSpend), c.nativeCurrency)})
									</span>
								{:else}
									{formatCurrencyAmount(c.target, c.nativeCurrency)}
									<span class="sub" title="Actual accrual this {c.cycle.toLowerCase()} cycle">
										(accrued {formatCurrencyAmount(r2(c.actualSpend), c.nativeCurrency)})
									</span>
								{/if}
							</td>
							<td>{c.cycle}</td>
							<td class="num">
								{c.monthlyInOperating !== null
									? `${(c.targetPercent === undefined && c.nativeCurrency !== op) ? '≈ ' : ''}${formatCurrencyAmount(r2(c.monthlyInOperating), op)}`
									: '—'}
							</td>
							<td class="toggle-col">
								<input type="checkbox" checked={false}
									aria-label="Mark savings {c.name} as discretionary"
									title="Mark as discretionary — exclude from Savings total"
									on:change={() => onToggleIndicator(c.name, c.originalType, true)} />
							</td>
						</tr>
					{/each}
				{/if}

				{#if discretionaryExp.length + commitmentsDiscretionary.length + incomeDiscretionary.length > 0}
					<tr class="section-header"><td colspan="5">Discretionary (excluded from residual)</td></tr>
					{#each incomeDiscretionary as e (e.nickname)}
						<tr class="discretionary-row">
							<td><code>{e.nickname}</code> <span class="kind-tag">income</span></td>
							<td class="num">{formatCurrencyAmount(e.nativeAmount, e.nativeCurrency)}</td>
							<td>{e.cadence}</td>
							<td class="num">
								{e.monthlyInOperating !== null
									? formatCurrencyAmount(r2(e.monthlyInOperating), op)
									: '—'}
							</td>
							<td class="toggle-col">
								<input type="checkbox" checked={true}
									aria-label="Restore {e.nickname} as guaranteed income"
									title="Uncheck to count as guaranteed income again"
									on:change={() => onToggleRule(e.nickname, false)} />
							</td>
						</tr>
					{/each}
					{#each discretionaryExp as e (e.nickname)}
						<tr class="discretionary-row">
							<td><code>{e.nickname}</code> <span class="kind-tag">expense</span></td>
							<td class="num">{formatCurrencyAmount(e.nativeAmount, e.nativeCurrency)}</td>
							<td>{e.cadence}</td>
							<td class="num">
								{e.monthlyInOperating !== null
									? `${e.nativeCurrency !== op ? '≈ ' : ''}${formatCurrencyAmount(r2(e.monthlyInOperating), op)}`
									: '—'}
							</td>
							<td class="toggle-col">
								<input type="checkbox" checked={true}
									aria-label="Restore {e.nickname} as fixed"
									title="Uncheck to count as fixed again"
									on:change={() => onToggleRule(e.nickname, false)} />
							</td>
						</tr>
					{/each}
					{#each commitmentsDiscretionary as c (c.originalType + '|' + c.name)}
						<tr class="discretionary-row">
							<td><code>{c.name}</code> <span class="kind-tag">{c.kind}</span></td>
							<td class="num">{formatCurrencyAmount(c.target, c.nativeCurrency)}</td>
							<td>{c.cycle}</td>
							<td class="num">
								{c.monthlyInOperating !== null
									? `${c.nativeCurrency !== op ? '≈ ' : ''}${formatCurrencyAmount(r2(c.monthlyInOperating), op)}`
									: '—'}
							</td>
							<td class="toggle-col">
								<input type="checkbox" checked={true}
									aria-label="Restore {c.kind} {c.name}"
									title="Uncheck to count as {c.kind} again"
									on:change={() => onToggleIndicator(c.name, c.originalType, false)} />
							</td>
						</tr>
					{/each}
				{/if}

				{#if unconvertible.length > 0}
					<tr class="section-header"><td colspan="5">Missing FX (not counted)</td></tr>
					{#each unconvertible as e (e.nickname)}
						<tr class="missing-row">
							<td><code>{e.nickname}</code></td>
							<td class="num">{formatCurrencyAmount(e.nativeAmount, e.nativeCurrency)}</td>
							<td>{e.cadence}</td>
							<td class="num">—</td>
							<td class="toggle-col"></td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>

	<div class="forecast-footnote">
		Tick the <code>Discr.</code> checkbox on any row to exclude
		that item from the residual math. Edits write back to the
		source file (<code>recurring.beancount</code> for income/expense
		rules, <code>events.beancount</code> for budgets/savings) as an
		indented <code>discretionary: TRUE</code> metadata line.
		<br/>
		For Savings, add <code>targetPercent: 20</code> metadata in
		<code>events.beancount</code> (alongside <code>target: 0</code>)
		to dedicate a percentage of income instead of a fixed amount.
	</div>
</div>

<style>
	.forecast-panel {
		margin-top: var(--size-4-4);
		padding: var(--size-4-4);
		background-color: var(--background-secondary);
		border-radius: var(--radius-m);
		border: 1px solid var(--background-modifier-border);
	}

	.forecast-header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: var(--size-4-3);
	}
	.forecast-header h3 {
		margin: 0;
		font-size: var(--font-ui-medium);
	}
	.forecast-subtitle {
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
	}

	.forecast-totals {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--size-4-1);
		margin-bottom: var(--size-4-3);
		padding: var(--size-4-3);
		background: var(--background-primary);
		border-radius: var(--radius-s);
	}
	.totals-row {
		display: flex;
		justify-content: space-between;
		font-size: var(--font-ui-small);
	}
	.totals-row.income .totals-value { color: var(--color-green); }
	.totals-row.fixed .totals-value { color: var(--color-orange); }
	.totals-row.residual {
		border-top: 1px solid var(--background-modifier-border);
		padding-top: var(--size-4-1);
		margin-top: var(--size-4-1);
		font-weight: 600;
		font-size: var(--font-ui-medium);
	}
	.totals-row.residual.negative .totals-value { color: var(--color-red); }

	.consumption-bar {
		position: relative;
		height: 22px;
		background: var(--background-modifier-border);
		border-radius: var(--radius-s);
		overflow: hidden;
		margin-bottom: var(--size-4-3);
	}
	.consumption-fill {
		height: 100%;
		background: var(--color-orange);
		transition: width 0.3s ease;
	}
	.consumption-fill.over-100 { background: var(--color-red); }
	.consumption-label {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: var(--font-ui-smaller);
		color: var(--text-on-accent);
		mix-blend-mode: difference;
	}

	.missing-fx-warning {
		padding: var(--size-4-2) var(--size-4-3);
		background: var(--background-modifier-error);
		color: var(--text-error);
		border-radius: var(--radius-s);
		font-size: var(--font-ui-small);
		margin-bottom: var(--size-4-3);
	}

	.forecast-table-wrap {
		overflow-x: auto;
		margin-bottom: var(--size-4-2);
	}
	.forecast-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--font-ui-small);
	}
	.forecast-table th,
	.forecast-table td {
		padding: var(--size-4-1) var(--size-4-2);
		text-align: left;
		border-bottom: 1px solid var(--background-modifier-border);
	}
	.forecast-table th { color: var(--text-muted); font-weight: 500; }
	.forecast-table td.num,
	.forecast-table th.num { text-align: right; font-variant-numeric: tabular-nums; }
	.forecast-table .section-header td {
		font-weight: 600;
		color: var(--text-muted);
		background: var(--background-primary);
		padding-top: var(--size-4-2);
	}
	.discretionary-row { opacity: 0.7; }
	.discretionary-row td { font-style: italic; }
	.missing-row { color: var(--text-error); }

	.toggle-col { text-align: center; width: 60px; }
	.toggle-col input[type="checkbox"] {
		cursor: pointer;
		accent-color: var(--interactive-accent);
	}
	.na-tag {
		color: var(--text-faint);
		font-size: var(--font-ui-smaller);
	}
	.sub {
		display: block;
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
	}
	.over-tag {
		display: inline-block;
		margin-left: 4px;
		padding: 1px 5px;
		font-size: var(--font-ui-smaller);
		background: var(--background-modifier-error);
		color: var(--text-error);
		border-radius: var(--radius-s);
		font-weight: 600;
	}
	.over-budget td { color: var(--text-error); }
	.legacy-tag, .kind-tag, .percent-tag {
		display: inline-block;
		margin-left: 4px;
		padding: 1px 5px;
		font-size: var(--font-ui-smaller);
		background: var(--background-modifier-border);
		color: var(--text-muted);
		border-radius: var(--radius-s);
	}
	.legacy-tag { font-style: italic; }
	.percent-tag {
		background: var(--background-modifier-success);
		color: var(--text-success);
		font-weight: 600;
	}
	.percent-target {
		font-style: italic;
		color: var(--text-muted);
	}

	.forecast-footnote {
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
		margin-top: var(--size-4-2);
	}
	.forecast-footnote code {
		font-family: var(--font-monospace);
		font-size: 0.9em;
	}
</style>
