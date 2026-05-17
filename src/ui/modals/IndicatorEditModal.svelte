<!-- src/ui/modals/IndicatorEditModal.svelte -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import {
		validateIndicator,
		type Indicator,
		type IndicatorType,
	} from '../../services/indicators.service';

	export let initial: Indicator;
	export let mode: 'add' | 'edit' = 'add';
	export let kind: IndicatorType = 'Budget';
	export let accounts: string[] = [];
	export let currencies: string[] = [];

	const dispatch = createEventDispatcher();

	// Each kind drives the wording and the preferred account prefixes.
	// Savings accepts both Assets:Savings:* and Assets:Investments:* as
	// natural roots; advanced users can still type any path that starts
	// with a capital letter.
	interface KindConfig {
		label: string;
		icon: string;
		blurb: string;
		accountFilter: (a: string) => boolean;
		accountPlaceholder: string;
		amountLabel: string;
		amountHint: string;
		nameSuggest: string;
	}

	const KIND_CONFIG: Record<IndicatorType, KindConfig> = {
		Budget: {
			label: 'Budget',
			icon: '💸',
			blurb: 'Cap-and-monitor an Expense category over a period.',
			accountFilter: (a) => a.startsWith('Expenses'),
			accountPlaceholder: 'Expenses:Food',
			amountLabel: 'Spending cap',
			amountHint: 'Max you intend to spend each cycle.',
			nameSuggest: 'Groceries',
		},
		Target: {
			label: 'Target',
			icon: '🎯',
			blurb: 'Track growth on any Asset toward a goal.',
			accountFilter: (a) => a.startsWith('Assets'),
			accountPlaceholder: 'Assets:Bank:Savings',
			amountLabel: 'Goal amount',
			amountHint: 'How much you want this account to reach.',
			nameSuggest: 'Emergency Fund',
		},
		Savings: {
			label: 'Savings / Investment',
			icon: '📈',
			blurb: 'Track contributions to a savings or investment account.',
			accountFilter: (a) =>
				a.startsWith('Assets:Savings') ||
				a.startsWith('Assets:Investments') ||
				a.startsWith('Assets:Investment'),
			accountPlaceholder: 'Assets:Savings:Emergency',
			amountLabel: 'Contribution / goal',
			amountHint: 'Per-period contribution (rollover ON) or final goal (rollover OFF).',
			nameSuggest: 'Roth IRA contribution',
		},
	};

	$: cfg = KIND_CONFIG[kind] ?? KIND_CONFIG.Budget;

	let draft: Indicator = {
		type: initial.type,
		name: initial.name ?? '',
		accountQuery: initial.accountQuery ?? '',
		cycle: initial.cycle ?? 'Monthly',
		target: initial.target ?? 0,
		currency: initial.currency ?? (currencies[0] ?? 'USD'),
		isRollover: initial.isRollover ?? false,
		startDate: initial.startDate ?? new Date().toISOString().slice(0, 10),
		sourceLine: initial.sourceLine,
		sourceEndLine: initial.sourceEndLine,
		...(initial.discretionary ? { discretionary: true } : {}),
		...(initial.targetPercent !== undefined ? { targetPercent: initial.targetPercent } : {}),
	};

	// Amount mode (fixed cap vs % of income). Only surfaced for Savings
	// today — Budget percent could be added later if the use case shows up.
	let targetMode: 'fixed' | 'percent' =
		initial.targetPercent !== undefined ? 'percent' : 'fixed';
	let percentDraft: number = initial.targetPercent ?? 20;
	$: percentModeAvailable = kind === 'Savings' || kind === 'Target';
	// Reset percent mode if user switches kind away from a percent-eligible one.
	$: if (!percentModeAvailable && targetMode === 'percent') targetMode = 'fixed';

	// --- account combobox ---
	let accountFocused = false;
	let accountIdx = -1;

	$: filteredAccounts = (() => {
		const q = (draft.accountQuery ?? '').trim().toLowerCase();
		const all = accounts.filter(cfg.accountFilter);
		const matched = q
			? all.filter((a) => a.toLowerCase().includes(q))
			: all;
		return matched.slice(0, 10);
	})();

	function pickAccount(a: string) {
		draft.accountQuery = a;
		accountFocused = false;
	}
	function isCreatable(): boolean {
		const v = (draft.accountQuery ?? '').trim();
		if (!v) return false;
		if (!/^[A-Z][A-Za-z0-9:_-]*(:[A-Za-z0-9_-]+)+$/.test(v)) return false;
		return !filteredAccounts.includes(v);
	}
	function handleAccountKey(event: KeyboardEvent) {
		const max = filteredAccounts.length + (isCreatable() ? 1 : 0) - 1;
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			accountFocused = true;
			accountIdx = Math.min(accountIdx + 1, max);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			accountIdx = Math.max(accountIdx - 1, -1);
		} else if (event.key === 'Enter') {
			if (!accountFocused) return;
			if (accountIdx >= 0 && accountIdx < filteredAccounts.length) {
				event.preventDefault();
				pickAccount(filteredAccounts[accountIdx]);
			}
		} else if (event.key === 'Escape') {
			accountFocused = false;
		}
	}

	// --- live preview of cycle effect ---
	$: previewLine = (() => {
		if (!draft.target || !draft.currency) return '';
		const cycleEN = draft.cycle === 'Weekly' ? 'week' : 'month';
		const amt = `${draft.target} ${draft.currency}`;
		if (draft.isRollover) {
			return `Each ${cycleEN}, available = previous unspent + ${amt}.`;
		}
		return `Each ${cycleEN} resets to ${amt} regardless of previous activity.`;
	})();

	// --- validation + dispatch ---
	let formError: string | null = null;

	function handleSave() {
		const usingPercent = percentModeAvailable && targetMode === 'percent';
		// Percent mode: zero out fixed target, store the percent in
		// `targetPercent`. Validation skips the >0 target check below
		// for percent-based indicators.
		const candidate: Indicator = {
			...draft,
			name: draft.name.trim(),
			accountQuery: draft.accountQuery.trim(),
			currency: draft.currency.trim().toUpperCase(),
			startDate: draft.startDate.trim(),
			target: usingPercent ? 0 : Number(draft.target),
			type: kind,
			...(usingPercent
				? { targetPercent: Number(percentDraft) }
				: { targetPercent: undefined }),
		};
		// Custom validation for percent mode (validateIndicator requires
		// target > 0, which doesn't apply when targetPercent drives it).
		if (usingPercent) {
			const pct = Number(percentDraft);
			if (!isFinite(pct) || pct <= 0 || pct > 100) {
				formError = 'Percent must be between 0 and 100';
				return;
			}
			// Run the rest of validation by temporarily setting target=1.
			const v = validateIndicator({ ...candidate, target: 1 });
			if (!v.ok) { formError = v.reason ?? 'Invalid form'; return; }
		} else {
			const v = validateIndicator(candidate);
			if (!v.ok) { formError = v.reason ?? 'Invalid form'; return; }
		}
		formError = null;
		dispatch('save', { indicator: candidate });
	}

	function handleCancel() {
		dispatch('cancel');
	}

	function handleDelete() {
		if (mode !== 'edit') return;
		if (
			!confirm(
				`Delete ${kind.toLowerCase()} "${initial.name}"?\n\nThis removes the directive block from events.beancount.`,
			)
		)
			return;
		dispatch('delete');
	}
</script>

<div class="indicator-edit-modal">
	<!-- Kind banner: shown only in add mode (edit mode is locked to the existing kind). -->
	{#if mode === 'add'}
		<div class="kind-row">
			{#each ['Budget', 'Target', 'Savings'] as k}
				<button
					type="button"
					class="kind-chip"
					class:selected={kind === k}
					on:click={() => (kind = k)}
				>
					<span class="kind-icon">{KIND_CONFIG[k].icon}</span>
					<span class="kind-label">{KIND_CONFIG[k].label}</span>
				</button>
			{/each}
		</div>
		<p class="kind-blurb">{cfg.blurb}</p>
	{:else}
		<p class="kind-blurb"><span class="kind-icon">{cfg.icon}</span> {cfg.blurb}</p>
	{/if}

	<!-- Name -->
	<div class="field">
		<label class="field-label" for="ind-name">Name <em>*</em></label>
		<input
			id="ind-name"
			type="text"
			bind:value={draft.name}
			placeholder={cfg.nameSuggest}
		/>
		<span class="hint">A short label shown on the dashboard card.</span>
	</div>

	<!-- Account -->
	<div class="field">
		<label class="field-label" for="ind-account">Account <em>*</em></label>
		<div class="combobox-wrap">
			<input
				id="ind-account"
				type="text"
				bind:value={draft.accountQuery}
				on:focus={() => (accountFocused = true)}
				on:blur={() => setTimeout(() => (accountFocused = false), 150)}
				on:keydown={handleAccountKey}
				placeholder={cfg.accountPlaceholder}
				autocomplete="off"
			/>
			{#if accountFocused && (filteredAccounts.length > 0 || isCreatable())}
				<div class="combobox-menu">
					{#each filteredAccounts as a, i}
						<button
							type="button"
							class="combobox-item"
							class:active={accountIdx === i}
							on:mousedown|preventDefault={() => pickAccount(a)}
						>
							{a}
						</button>
					{/each}
					{#if isCreatable()}
						<button
							type="button"
							class="combobox-item create"
							class:active={accountIdx === filteredAccounts.length}
							on:mousedown|preventDefault={() => (accountFocused = false)}
						>
							＋ Use this path: <code>{draft.accountQuery}</code>
						</button>
					{/if}
				</div>
			{/if}
		</div>
		<span class="hint">
			{#if kind === 'Savings'}
				Suggested roots: <code>Assets:Savings</code>, <code>Assets:Investments</code>.
			{:else}
				Suggestions filtered to {kind === 'Budget' ? 'Expenses:*' : 'Assets:*'}.
			{/if}
		</span>
	</div>

	<!-- Amount-mode toggle (Savings / Target only) -->
	{#if percentModeAvailable}
		<div class="amount-mode">
			<label class="mode-chip" class:selected={targetMode === 'fixed'}>
				<input type="radio" name="amountMode" value="fixed" bind:group={targetMode} />
				Fixed amount
			</label>
			<label class="mode-chip" class:selected={targetMode === 'percent'}>
				<input type="radio" name="amountMode" value="percent" bind:group={targetMode} />
				% of income
			</label>
			<span class="hint mode-hint">
				{targetMode === 'percent'
					? 'Resolves each month against your projected income.'
					: 'A fixed amount per cycle in the chosen currency.'}
			</span>
		</div>
	{/if}

	<!-- Cycle + Target/Percent + Currency -->
	<div class="row">
		<label class="field narrow">
			<span class="field-label">Cycle</span>
			<select bind:value={draft.cycle} disabled={targetMode === 'percent'}>
				<option value="Monthly">Monthly</option>
				<option value="Weekly">Weekly</option>
			</select>
			{#if targetMode === 'percent'}
				<span class="hint">Percent is always per-month.</span>
			{/if}
		</label>
		{#if targetMode === 'percent'}
			<label class="field grow">
				<span class="field-label">% of income <em>*</em></span>
				<input
					type="number"
					step="any"
					min="0.1"
					max="100"
					bind:value={percentDraft}
					placeholder="20"
				/>
				<span class="hint">Drains {percentDraft || 0}% of projected monthly income from discretionary.</span>
			</label>
		{:else}
			<label class="field grow">
				<span class="field-label">{cfg.amountLabel} <em>*</em></span>
				<input
					type="number"
					step="any"
					min="0"
					bind:value={draft.target}
					placeholder="0.00"
				/>
				<span class="hint">{cfg.amountHint}</span>
			</label>
		{/if}
		<label class="field narrow">
			<span class="field-label">Currency</span>
			<select bind:value={draft.currency}>
				{#if draft.currency && !currencies.includes(draft.currency)}
					<option value={draft.currency}>{draft.currency}</option>
				{/if}
				{#each currencies as c}
					<option value={c}>{c}</option>
				{/each}
			</select>
		</label>
	</div>

	<!-- Rollover -->
	<div class="rollover-block">
		<label class="rollover-toggle">
			<input type="checkbox" bind:checked={draft.isRollover} />
			<span>
				<span class="rollover-title">Roll over unused amount</span>
				<span class="rollover-explainer">
					When ON, anything left over at the end of a cycle carries
					forward into the next one. Spend $300 of a $500 monthly
					budget in May, June starts with $700 available. When OFF,
					each cycle resets to the base amount regardless of prior
					activity.
				</span>
			</span>
		</label>

		{#if draft.isRollover}
			<label class="field" for="ind-start">
				<span class="field-label">Start date <em>*</em></span>
				<input
					id="ind-start"
					type="text"
					bind:value={draft.startDate}
					placeholder="YYYY-MM-DD"
					pattern="\d{'{4}'}-\d{'{2}'}-\d{'{2}'}"
				/>
				<span class="hint">Anchors the rollover accumulation.</span>
			</label>
		{:else}
			<input type="hidden" bind:value={draft.startDate} />
		{/if}

		{#if previewLine}
			<div class="preview-line">{previewLine}</div>
		{/if}
	</div>

	{#if formError}
		<div class="form-error">⚠ {formError}</div>
	{/if}

	<div class="modal-footer">
		{#if mode === 'edit'}
			<button type="button" class="btn-danger" on:click={handleDelete}>Delete</button>
		{/if}
		<span class="footer-spacer"></span>
		<button type="button" class="btn-ghost" on:click={handleCancel}>Cancel</button>
		<button type="button" class="btn-primary" on:click={handleSave}>
			{mode === 'add' ? 'Create' : 'Save'}
		</button>
	</div>
</div>

<style>
	.indicator-edit-modal {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 4px;
	}

	.kind-row {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}
	.kind-chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 999px;
		background: var(--background-primary);
		color: var(--text-normal);
		cursor: pointer;
		font-size: 12px;
	}
	.kind-chip:hover { background: var(--background-modifier-hover); }
	.kind-chip.selected {
		border-color: var(--text-accent);
		background: color-mix(in srgb, var(--text-accent), transparent 90%);
		color: var(--text-accent);
		font-weight: 600;
	}
	.kind-icon { font-size: 14px; }

	.amount-mode {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
		margin-bottom: 4px;
	}
	.mode-chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 4px 10px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 999px;
		background: var(--background-primary);
		color: var(--text-normal);
		cursor: pointer;
		font-size: 12px;
	}
	.mode-chip:hover { background: var(--background-modifier-hover); }
	.mode-chip.selected {
		border-color: var(--text-accent);
		background: color-mix(in srgb, var(--text-accent), transparent 90%);
		color: var(--text-accent);
		font-weight: 600;
	}
	.mode-chip input[type="radio"] {
		margin: 0;
		accent-color: var(--text-accent);
	}
	.mode-hint {
		flex: 1;
		min-width: 200px;
	}

	.kind-blurb {
		margin: 0;
		font-size: 12px;
		color: var(--text-muted);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}
	.field.grow { flex: 1 1 auto; }
	.field.narrow { flex: 0 0 130px; }
	.field-label {
		font-size: 11px;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.field-label em {
		color: var(--text-error);
		font-style: normal;
		margin-left: 2px;
	}
	.field input[type="text"],
	.field input[type="number"],
	.field select {
		width: 100%;
		padding: 6px 8px;
		font-size: 13px;
		border: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
		color: var(--text-normal);
		border-radius: 6px;
	}
	.field input:focus,
	.field select:focus {
		outline: none;
		border-color: var(--text-accent);
	}
	.hint {
		font-size: 11px;
		color: var(--text-faint);
	}

	.row {
		display: flex;
		gap: 10px;
		align-items: flex-start;
	}

	.combobox-wrap { position: relative; }
	.combobox-menu {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		right: 0;
		max-height: 220px;
		overflow-y: auto;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: 6px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
		z-index: 50;
		display: flex;
		flex-direction: column;
	}
	.combobox-item {
		text-align: left;
		padding: 6px 10px;
		font-size: 12px;
		font-family: var(--font-monospace);
		color: var(--text-normal);
		background: transparent;
		border: none;
		cursor: pointer;
	}
	.combobox-item:hover,
	.combobox-item.active { background: var(--background-modifier-hover); }
	.combobox-item.create {
		border-top: 1px solid var(--background-modifier-border);
		color: var(--text-accent);
	}
	.combobox-item.create code { color: var(--text-normal); }

	.rollover-block {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 10px 12px;
		background: var(--background-secondary);
		border-radius: 8px;
	}
	.rollover-toggle {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		cursor: pointer;
	}
	.rollover-toggle input { margin-top: 3px; }
	.rollover-title {
		display: block;
		font-weight: 600;
		font-size: 13px;
		color: var(--text-normal);
		margin-bottom: 2px;
	}
	.rollover-explainer {
		display: block;
		font-size: 11px;
		color: var(--text-faint);
		line-height: 1.5;
	}
	.preview-line {
		font-size: 12px;
		color: var(--text-muted);
		font-style: italic;
		padding: 6px 10px;
		border-left: 2px solid var(--text-accent);
		background: var(--background-primary);
		border-radius: 4px;
	}

	.form-error {
		font-size: 12px;
		color: var(--text-error);
		padding: 6px 10px;
		background: color-mix(in srgb, var(--text-error), transparent 92%);
		border-radius: 6px;
	}

	.modal-footer {
		display: flex;
		gap: 8px;
		align-items: center;
		padding-top: 8px;
		border-top: 1px solid var(--background-modifier-border);
	}
	.footer-spacer { flex: 1; }
	.btn-primary,
	.btn-ghost,
	.btn-danger {
		padding: 6px 14px;
		font-size: 13px;
		font-weight: 600;
		border-radius: 6px;
		cursor: pointer;
		border: 1px solid transparent;
	}
	.btn-primary {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
	}
	.btn-primary:hover { background: var(--interactive-accent-hover); }
	.btn-ghost {
		background: transparent;
		color: var(--text-muted);
		border-color: var(--background-modifier-border);
	}
	.btn-ghost:hover { background: var(--background-modifier-hover); }
	.btn-danger {
		background: transparent;
		color: var(--text-error);
		border-color: var(--background-modifier-border);
	}
	.btn-danger:hover {
		background: color-mix(in srgb, var(--text-error), transparent 88%);
		border-color: var(--text-error);
	}
</style>
