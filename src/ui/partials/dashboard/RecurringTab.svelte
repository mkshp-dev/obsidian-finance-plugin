<!-- src/ui/partials/dashboard/RecurringTab.svelte -->
<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import { Notice, MarkdownView } from 'obsidian';
	import type { RecurringController } from '../../../controllers/RecurringController';
	import type {
		RecurringRule,
		RecurringCadence,
	} from '../../../services/recurring.service';
	import { occurrencesInWindow } from '../../../services/recurring.service';
	import { RecurringEditModal } from '../../modals/RecurringEditModal';

	export let controller: RecurringController;
	export let plugin: any = null;

	const dispatch = createEventDispatcher();

	$: rulesStore = controller.rules;
	$: loadingStore = controller.loading;
	$: errorStore = controller.error;

	onMount(() => {
		controller.loadData();
	});

	// --- filter state ---
	let searchQuery = '';
	let cadenceFilter: 'all' | RecurringCadence = 'all';
	let patternFilter: 'all' | 'expense' | 'income' | 'liability' | 'equity' | 'transfer' | 'custom' = 'all';
	let showSynthetic = true;
	let sortMode: 'next' | 'name' | 'amount' = 'next';

	const CADENCE_OPTIONS: { value: 'all' | RecurringCadence; label: string }[] = [
		{ value: 'all', label: 'All cadences' },
		{ value: 'daily', label: 'Daily' },
		{ value: 'weekly', label: 'Weekly' },
		{ value: 'biweekly', label: 'Biweekly' },
		{ value: 'monthly', label: 'Monthly' },
		{ value: 'quarterly', label: 'Quarterly' },
		{ value: 'semiannual', label: 'Semiannual' },
		{ value: 'yearly', label: 'Yearly' },
	];

	function todayIso(): string {
		return new Date().toISOString().slice(0, 10);
	}
	function isoPlusYears(iso: string, years: number): string {
		const d = new Date(iso + 'T00:00:00Z');
		d.setUTCFullYear(d.getUTCFullYear() + years);
		return d.toISOString().slice(0, 10);
	}

	function nextOccurrenceFor(rule: RecurringRule): string | null {
		const today = todayIso();
		const window = occurrencesInWindow(rule, today, isoPlusYears(today, 2));
		return window.length > 0 ? window[0] : null;
	}

	function daysUntil(iso: string): number {
		const today = new Date();
		const d = new Date(iso + 'T00:00:00');
		const ms =
			d.getTime() -
			new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
		return Math.round(ms / 86_400_000);
	}

	function dueLabel(iso: string): string {
		const n = daysUntil(iso);
		if (n === 0) return 'today';
		if (n === 1) return 'tomorrow';
		if (n < 0) return `${-n}d overdue`;
		if (n < 7) return `in ${n}d`;
		if (n < 30) return `in ${Math.round(n / 7)}w`;
		return `in ${Math.round(n / 30)}mo`;
	}

	function formatDate(iso: string): string {
		const d = new Date(iso + 'T00:00:00');
		return d.toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
		});
	}

	function formatAmount(value: number, currency: string): string {
		const fmt = value.toLocaleString(undefined, {
			minimumFractionDigits: 0,
			maximumFractionDigits: 4,
		});
		return `${fmt} ${currency}`;
	}

	type Pattern = 'expense' | 'income' | 'liability' | 'equity' | 'transfer' | 'custom';

	function detectPattern(rule: RecurringRule): Pattern {
		const f = (rule.fundingAccount ?? '').trim();
		const e = (rule.expenseAccount ?? '').trim();
		const fromIs = (root: string) => f === root || f.startsWith(root + ':');
		const toIs = (root: string) => e === root || e.startsWith(root + ':');
		if (fromIs('Income') && toIs('Assets')) return 'income';
		if (fromIs('Assets') && toIs('Liabilities')) return 'liability';
		if (fromIs('Assets') && toIs('Equity')) return 'equity';
		if (fromIs('Assets') && toIs('Assets')) return 'transfer';
		if (fromIs('Assets') && toIs('Expenses')) return 'expense';
		return 'custom';
	}

	const PATTERN_LABEL: Record<Pattern, { icon: string; label: string }> = {
		expense:   { icon: '💸', label: 'Expense' },
		income:    { icon: '💰', label: 'Income' },
		liability: { icon: '🏦', label: 'Liability' },
		equity:    { icon: '📈', label: 'Equity' },
		transfer:  { icon: '↔',  label: 'Transfer' },
		custom:    { icon: '🛠', label: 'Custom' },
	};

	type Decorated = RecurringRule & { _next: string | null; _pattern: Pattern };

	$: decorated = ($rulesStore ?? []).map((r) => ({
		...r,
		_next: nextOccurrenceFor(r),
		_pattern: detectPattern(r),
	})) as Decorated[];

	$: filtered = decorated.filter((r) => {
		if (!showSynthetic && r.synthetic) return false;
		if (cadenceFilter !== 'all' && r.cadence !== cadenceFilter) return false;
		if (patternFilter !== 'all' && r._pattern !== patternFilter) return false;
		if (searchQuery.trim()) {
			const q = searchQuery.trim().toLowerCase();
			const hay = [
				r.nickname,
				r.expenseAccount,
				r.fundingAccount,
				r.currency,
				r.cadence,
			]
				.join(' ')
				.toLowerCase();
			if (!hay.includes(q)) return false;
		}
		return true;
	});

	$: sorted = [...filtered].sort((a, b) => {
		if (sortMode === 'name') return a.nickname.localeCompare(b.nickname);
		if (sortMode === 'amount') return Math.abs(b.amount) - Math.abs(a.amount);
		// 'next': nulls last, then ascending date
		if (a._next === null && b._next === null)
			return a.nickname.localeCompare(b.nickname);
		if (a._next === null) return 1;
		if (b._next === null) return -1;
		if (a._next === b._next) return a.nickname.localeCompare(b.nickname);
		return a._next < b._next ? -1 : 1;
	});

	$: explicitCount = ($rulesStore ?? []).filter((r) => !r.synthetic).length;
	$: syntheticCount = ($rulesStore ?? []).filter((r) => r.synthetic).length;

	function resolveRecurringPath(): string {
		const explicit = plugin?.settings?.recurringFilePath?.trim();
		if (explicit) return explicit;
		const folder = plugin?.settings?.structuredFolderName?.trim() || 'Finances';
		return `${folder}/recurring.beancount`;
	}

	async function openFileAtRule(rule: RecurringRule) {
		if (!plugin) return;
		const path = resolveRecurringPath();
		const file = plugin.app.vault.getAbstractFileByPath(path);
		if (!file) {
			new Notice(`File not found: ${path}`);
			return;
		}
		const leaf = plugin.app.workspace.getLeaf(true);
		await leaf.openFile(file as any);
		if (rule.sourceLine) {
			const view = leaf.view;
			if (view instanceof MarkdownView) {
				const editor = view.editor;
				const line = Math.max(0, rule.sourceLine - 1);
				editor.setCursor({ line, ch: 0 });
				editor.scrollIntoView(
					{ from: { line, ch: 0 }, to: { line, ch: 0 } },
					true,
				);
			}
		}
	}

	function openAddModal() {
		if (!plugin) return;
		const op = plugin.settings.operatingCurrency || 'USD';
		const initial: RecurringRule = {
			nickname: '',
			cadence: 'monthly',
			expenseAccount: '',
			fundingAccount: '',
			amount: 0,
			currency: op,
			startDate: todayIso(),
		};
		const modal = new RecurringEditModal(plugin.app, plugin, {
			mode: 'add',
			initial,
			onSaved: () => controller.refresh(),
		});
		modal.open();
	}

	function openEditModal(rule: RecurringRule) {
		if (!plugin) return;
		if (rule.synthetic) {
			// Synthetic rules come from loan-account metadata; sending the
			// user there is more useful than a no-op confirm dialog. The
			// dashboard listens for this and switches to Liabilities tab.
			dispatch('editLoan', { account: rule.fromLoanAccount });
			return;
		}
		const modal = new RecurringEditModal(plugin.app, plugin, {
			mode: 'edit',
			initial: { ...rule },
			onSaved: () => controller.refresh(),
		});
		modal.open();
	}

	function openOverrideForSynthetic(rule: RecurringRule) {
		// Author an explicit rule that takes precedence over the auto-
		// generated one. Pre-filled with the synthetic's values so the
		// user only edits what they want to change.
		if (!plugin) return;
		const initial: RecurringRule = {
			nickname: rule.nickname,
			cadence: rule.cadence,
			expenseAccount: rule.expenseAccount,
			fundingAccount: rule.fundingAccount,
			amount: rule.amount,
			currency: rule.currency,
			startDate: rule.startDate,
		};
		const modal = new RecurringEditModal(plugin.app, plugin, {
			mode: 'add',
			initial,
			onSaved: () => controller.refresh(),
		});
		modal.open();
	}
</script>

<div class="recurring-tab">
	<header class="tab-header">
		<div class="tab-title-row">
			<h3>Recurring rules</h3>
			<span class="count-badge" title="{explicitCount} explicit + {syntheticCount} synthetic">
				{$rulesStore?.length ?? 0}
				{#if syntheticCount > 0}
					<span class="count-split">({explicitCount} + {syntheticCount} auto)</span>
				{/if}
			</span>
		</div>
		<div class="tab-actions">
			<button class="action-btn primary" type="button" on:click={openAddModal}>
				＋ Add rule
			</button>
			<button
				class="action-btn"
				type="button"
				on:click={() => controller.refresh()}
				title="Reload from disk"
			>
				↻
			</button>
		</div>
	</header>

	<div class="filters-bar">
		<input
			type="search"
			class="search-input"
			placeholder="Search nickname, account, currency…"
			bind:value={searchQuery}
		/>
		<select class="filter-select" bind:value={patternFilter}>
			<option value="all">All flows</option>
			<option value="expense">💸 Expense</option>
			<option value="income">💰 Income</option>
			<option value="liability">🏦 Liability</option>
			<option value="equity">📈 Equity</option>
			<option value="transfer">↔ Transfer</option>
			<option value="custom">🛠 Custom</option>
		</select>
		<select class="filter-select" bind:value={cadenceFilter}>
			{#each CADENCE_OPTIONS as opt}
				<option value={opt.value}>{opt.label}</option>
			{/each}
		</select>
		<select class="filter-select" bind:value={sortMode} title="Sort order">
			<option value="next">Sort: next due</option>
			<option value="name">Sort: name</option>
			<option value="amount">Sort: amount</option>
		</select>
		<label class="toggle">
			<input type="checkbox" bind:checked={showSynthetic} />
			<span>Show auto-generated</span>
		</label>
	</div>

	{#if $loadingStore}
		<div class="state-block">Loading…</div>
	{:else if $errorStore}
		<div class="state-block error">⚠️ {$errorStore}</div>
	{:else if ($rulesStore ?? []).length === 0}
		<div class="state-block empty">
			<p>No recurring rules yet.</p>
			<p class="hint">
				Define rules here for predictable income/expenses (rent, salary,
				subscriptions). Loans with <code>monthly-payment</code> + <code>due-day</code>
				metadata appear automatically.
			</p>
			<button class="action-btn primary" type="button" on:click={openAddModal}>
				＋ Create your first rule
			</button>
		</div>
	{:else if sorted.length === 0}
		<div class="state-block empty">
			<p>No rules match the current filters.</p>
			<button
				class="action-btn"
				type="button"
				on:click={() => {
					searchQuery = '';
					cadenceFilter = 'all';
					showSynthetic = true;
				}}
			>
				Clear filters
			</button>
		</div>
	{:else}
		<ul class="rules-list">
			{#each sorted as rule (rule.synthetic ? 'syn:' + rule.fromLoanAccount : 'exp:' + rule.nickname + ':' + (rule.sourceLine ?? 0))}
				<li
					class="rule-card pattern-{rule._pattern}"
					class:synthetic={rule.synthetic}
					class:overdue={rule._next !== null && daysUntil(rule._next) < 0}
				>
					<div class="rule-main">
						<div class="rule-name-row">
							<span class="pattern-badge" title={PATTERN_LABEL[rule._pattern].label + ' flow'}>
								{PATTERN_LABEL[rule._pattern].icon}
							</span>
							<span class="rule-nickname">{rule.nickname}</span>
							<span class="cadence-pill">{rule.cadence}</span>
							<span class="pattern-pill" title="{PATTERN_LABEL[rule._pattern].label} flow">
								{PATTERN_LABEL[rule._pattern].label}
							</span>
							{#if rule.synthetic}
								<span class="synthetic-badge" title="Auto-generated from {rule.fromLoanAccount}">
									auto
								</span>
							{/if}
						</div>
						<div class="rule-flow">
							<span class="rule-account funding">{rule.fundingAccount}</span>
							<span class="rule-arrow">→</span>
							<span class="rule-account expense">{rule.expenseAccount}</span>
						</div>
						{#if rule._next}
							<div class="rule-next">
								<span class="next-date">{formatDate(rule._next)}</span>
								<span class="next-rel" class:overdue={daysUntil(rule._next) < 0}>
									{dueLabel(rule._next)}
								</span>
							</div>
						{:else}
							<div class="rule-next no-next">no upcoming occurrence</div>
						{/if}
					</div>

					<div class="rule-side">
						<div class="rule-amount">
							{formatAmount(rule.amount, rule.currency)}
						</div>
						<div class="rule-actions">
							{#if rule.synthetic}
								<button
									class="rule-action"
									type="button"
									title="Edit the underlying loan in the Liabilities tab"
									on:click={() => openEditModal(rule)}
								>
									Edit loan
								</button>
								<button
									class="rule-action"
									type="button"
									title="Author an explicit rule that overrides this auto-generated one"
									on:click={() => openOverrideForSynthetic(rule)}
								>
									Override
								</button>
							{:else}
								<button
									class="rule-action"
									type="button"
									title="Edit this rule"
									on:click={() => openEditModal(rule)}
								>
									Edit
								</button>
								<button
									class="rule-action"
									type="button"
									title="Open recurring.beancount at this rule's line"
									on:click={() => openFileAtRule(rule)}
								>
									Open
								</button>
							{/if}
						</div>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.recurring-tab {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 16px;
		max-width: 960px;
		margin: 0 auto;
	}

	.tab-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}
	.tab-title-row {
		display: flex;
		align-items: baseline;
		gap: 10px;
	}
	.tab-title-row h3 {
		margin: 0;
		font-size: 16px;
		color: var(--text-normal);
	}
	.count-badge {
		font-size: 12px;
		color: var(--text-muted);
		background: var(--background-secondary);
		padding: 2px 8px;
		border-radius: 999px;
	}
	.count-split {
		color: var(--text-faint);
		font-size: 11px;
	}

	.tab-actions {
		display: flex;
		gap: 6px;
	}

	.action-btn {
		padding: 6px 12px;
		font-size: 12px;
		font-weight: 600;
		border-radius: 6px;
		border: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
		color: var(--text-normal);
		cursor: pointer;
	}
	.action-btn:hover { background: var(--background-modifier-hover); }
	.action-btn.primary {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		border-color: transparent;
	}
	.action-btn.primary:hover { background: var(--interactive-accent-hover); }

	.filters-bar {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		align-items: center;
		padding: 8px 10px;
		background: var(--background-secondary);
		border-radius: 8px;
	}
	.search-input,
	.filter-select {
		padding: 5px 8px;
		font-size: 12px;
		border: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
		color: var(--text-normal);
		border-radius: 6px;
	}
	.search-input {
		flex: 1 1 220px;
		min-width: 180px;
	}
	.filter-select { min-width: 140px; }
	.toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--text-muted);
		cursor: pointer;
	}

	.state-block {
		padding: 24px;
		text-align: center;
		border: 1px dashed var(--background-modifier-border);
		border-radius: 8px;
		color: var(--text-muted);
		font-size: 13px;
	}
	.state-block.error { color: var(--text-error); border-color: var(--text-error); }
	.state-block.empty p { margin: 0 0 8px; }
	.state-block .hint {
		color: var(--text-faint);
		font-size: 12px;
		max-width: 460px;
		margin: 0 auto 14px;
		line-height: 1.5;
	}

	.rules-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.rule-card {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 16px;
		padding: 12px 14px;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: 10px;
		transition: border-color 0.12s, background 0.12s;
	}
	.rule-card:hover {
		border-color: var(--text-accent);
	}
	.rule-card.synthetic {
		background: color-mix(in srgb, var(--text-faint), transparent 92%);
	}
	.rule-card.overdue {
		border-left: 3px solid var(--text-warning);
	}

	.rule-main {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
	}

	.rule-name-row {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.rule-nickname {
		font-weight: 700;
		font-size: 14px;
		color: var(--text-normal);
	}
	.cadence-pill,
	.pattern-pill {
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted);
		background: var(--background-secondary);
		padding: 2px 7px;
		border-radius: 999px;
	}
	.pattern-badge {
		font-size: 14px;
		line-height: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: 6px;
		background: var(--background-secondary);
	}
	.rule-card.pattern-expense   { border-left: 3px solid #d97757; }
	.rule-card.pattern-income    { border-left: 3px solid #5fb878; }
	.rule-card.pattern-liability { border-left: 3px solid #c14e63; }
	.rule-card.pattern-equity    { border-left: 3px solid #6b8cae; }
	.rule-card.pattern-transfer  { border-left: 3px solid #b88a4f; }
	.rule-card.pattern-custom    { border-left: 3px solid var(--text-faint); }
	.rule-card.overdue.pattern-expense,
	.rule-card.overdue.pattern-income,
	.rule-card.overdue.pattern-liability,
	.rule-card.overdue.pattern-equity,
	.rule-card.overdue.pattern-transfer,
	.rule-card.overdue.pattern-custom {
		/* Overdue takes precedence — warning border wins. */
		border-left-color: var(--text-warning);
	}
	.synthetic-badge {
		font-size: 9px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-on-accent);
		background: var(--text-faint);
		padding: 2px 7px;
		border-radius: 999px;
	}

	.rule-flow {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
		font-family: var(--font-monospace);
		color: var(--text-muted);
		flex-wrap: wrap;
	}
	.rule-account {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 240px;
	}
	.rule-account.funding { color: var(--text-faint); }
	.rule-account.expense { color: var(--text-normal); }
	.rule-arrow { color: var(--text-faint); }

	.rule-next {
		display: flex;
		gap: 8px;
		align-items: baseline;
		font-size: 12px;
	}
	.next-date {
		color: var(--text-normal);
		font-variant-numeric: tabular-nums;
	}
	.next-rel { color: var(--text-muted); }
	.next-rel.overdue { color: var(--text-warning); font-weight: 600; }
	.no-next { color: var(--text-faint); font-style: italic; }

	.rule-side {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 8px;
		min-width: 140px;
	}

	.rule-amount {
		font-weight: 700;
		font-size: 15px;
		color: var(--text-accent);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.rule-actions {
		display: flex;
		gap: 4px;
	}
	.rule-action {
		padding: 4px 10px;
		font-size: 11px;
		font-weight: 600;
		border-radius: 5px;
		border: 1px solid var(--background-modifier-border);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
	}
	.rule-action:hover {
		background: var(--background-modifier-hover);
		color: var(--text-normal);
	}
</style>
