<!-- src/ui/modals/LoanEditModal.svelte -->
<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import type { LoanFormDraft } from '../../services/liabilities.service';
	import { pruneDraftForMode } from '../../services/liabilities.service';

	export let initial: LoanFormDraft;
	export let mode: 'add' | 'edit' = 'add';
	export let accounts: string[] = [];
	export let currencies: string[] = [];

	const dispatch = createEventDispatcher();

	const LOAN_TYPES = [
		'credit-card', 'mortgage', 'personal-loan', 'auto-loan',
		'student-loan', 'line-of-credit', 'receivable', 'other',
	];

	// Pre-baked sub-paths per loan-type. Empty when the role prefix
	// already covers everything (e.g. receivables → Assets:Receivables:LEAF).
	const PATH_TEMPLATES: Record<string, string[]> = {
		'credit-card': ['Credit'],
		'mortgage': ['Loan', 'Mortgage'],
		'personal-loan': ['Loan', 'Personal'],
		'auto-loan': ['Loan', 'Auto'],
		'student-loan': ['Loan', 'Student'],
		'line-of-credit': ['Credit', 'Line'],
		'receivable': [],
		'other': [],
	};

	let draft: LoanFormDraft = {
		...initial,
		loanType: initial.loanType ?? 'credit-card',
		paymentMode: initial.paymentMode ?? 'recurring',
	};
	let errors: Record<string, string> = {};

	$: assetAccounts = accounts.filter(a => a.startsWith('Assets'));
	$: incomeAccounts = accounts.filter(a => a.startsWith('Income'));
	$: fundingPool = [...assetAccounts, ...incomeAccounts];

	// --- Account-path segment builder state ---
	// The role decides the locked top-level prefix that stays read-only
	// in the UI; all editable segments live below it.
	let prefix = 'Liabilities';
	let segments: string[] = [];

	function detectPrefix(path: string): string {
		if (path.startsWith('Assets:Receivables:') || path === 'Assets:Receivables') return 'Assets:Receivables';
		if (path.startsWith('Liabilities:') || path === 'Liabilities') return 'Liabilities';
		// Fallback for free-form paths (edit mode of an arbitrary account).
		const top = path.split(':')[0];
		return top || 'Liabilities';
	}

	function pathToSegments(path: string, p: string): string[] {
		if (!path || path === p) return [];
		if (path.startsWith(p + ':')) return path.slice(p.length + 1).split(':');
		// path doesn't sit under the prefix — surface every segment
		return path.split(':');
	}

	onMount(() => {
		const initialPath = (initial.account ?? '').trim();
		prefix = detectPrefix(initialPath);
		segments = pathToSegments(initialPath, prefix).filter(s => s.length > 0);
		// In add mode, prefill the segments from the loan-type template
		// when the user has nothing meaningful yet. An empty leaf gives
		// them a place to type immediately.
		if (mode === 'add' && segments.length === 0) {
			const tpl = PATH_TEMPLATES[draft.loanType ?? 'other'] ?? [];
			segments = [...tpl, ''];
		} else if (segments.length === 0) {
			segments = [''];
		}
	});

	$: fullPath = [prefix, ...segments.map(s => s.trim()).filter(Boolean)].join(':');
	$: draft.account = fullPath;

	function addSegment() {
		segments = [...segments, ''];
	}

	function removeSegment(idx: number) {
		segments = segments.filter((_, i) => i !== idx);
		if (segments.length === 0) segments = [''];
	}

	function setSegment(idx: number, value: string) {
		segments = segments.map((s, i) => (i === idx ? value : s));
	}

	/**
	 * Siblings at a given depth — the existing accounts that share the
	 * path up to (but not including) this segment. Used to surface
	 * "you've used these names before" chips beneath each segment input.
	 */
	function siblingsForSegment(idx: number): string[] {
		const parentPath = [prefix, ...segments.slice(0, idx).map(s => s.trim()).filter(Boolean)].join(':');
		const search = parentPath + ':';
		const matches = accounts.filter(a => a.startsWith(search));
		const names = matches
			.map(a => a.slice(search.length).split(':')[0])
			.filter(Boolean);
		const own = (segments[idx] ?? '').trim().toLowerCase();
		const seen = new Set<string>();
		const out: string[] = [];
		for (const n of names) {
			const key = n.toLowerCase();
			if (seen.has(key)) continue;
			if (key === own) continue; // hide the chip that matches the current value
			seen.add(key);
			out.push(n);
		}
		return out.sort().slice(0, 8);
	}

	function applyTemplate() {
		const tpl = PATH_TEMPLATES[draft.loanType ?? 'other'] ?? [];
		segments = [...tpl, ''];
	}

	function onLoanTypeChange() {
		// Auto-apply the template only when the segments are all empty
		// or match the previous template's leading entries — never clobber
		// what the user actually typed.
		if (mode !== 'add') return;
		const allEmpty = segments.every(s => !s.trim());
		if (allEmpty) {
			const tpl = PATH_TEMPLATES[draft.loanType ?? 'other'] ?? [];
			segments = [...tpl, ''];
		}
	}

	const PREFIX_OPTIONS = ['Liabilities', 'Assets:Receivables'];
	function changePrefix(value: string) {
		prefix = value;
	}

	// --- Funding-account segment builder (same shape as the path one,
	// but with a free top-level chosen from the user's existing accounts). ---

	let fundingPrefix = 'Assets';
	let fundingSegments: string[] = [];

	$: fundingPrefixOptions = (() => {
		const top = new Set<string>();
		for (const a of accounts) {
			const t = a.split(':')[0];
			if (t) top.add(t);
		}
		// Always offer the conventional ones even if the vault has none yet.
		top.add('Assets');
		top.add('Income');
		const arr = Array.from(top);
		arr.sort();
		return arr;
	})();

	function fundingPathToSegments(path: string, p: string): string[] {
		if (!path) return [];
		if (path.startsWith(p + ':')) return path.slice(p.length + 1).split(':');
		if (path === p) return [];
		// Path has a different top-level — surface every segment.
		const parts = path.split(':');
		fundingPrefix = parts[0];
		return parts.slice(1);
	}

	onMount(() => {
		const f = (initial.fundingAccount ?? '').trim();
		if (f) {
			fundingPrefix = f.split(':')[0];
			fundingSegments = fundingPathToSegments(f, fundingPrefix);
		} else {
			fundingPrefix = 'Assets';
			fundingSegments = [''];
		}
	});

	$: fullFundingPath = (() => {
		const segs = fundingSegments.map(s => s.trim()).filter(Boolean);
		if (segs.length === 0) return '';
		return [fundingPrefix, ...segs].join(':');
	})();
	$: draft.fundingAccount = fullFundingPath || null;

	function addFundingSegment() {
		fundingSegments = [...fundingSegments, ''];
	}
	function removeFundingSegment(idx: number) {
		fundingSegments = fundingSegments.filter((_, i) => i !== idx);
		if (fundingSegments.length === 0) fundingSegments = [''];
	}
	function setFundingSegment(idx: number, value: string) {
		fundingSegments = fundingSegments.map((s, i) => (i === idx ? value : s));
	}
	function changeFundingPrefix(value: string) {
		fundingPrefix = value;
	}
	function siblingsForFunding(idx: number): string[] {
		const parentPath = [fundingPrefix, ...fundingSegments.slice(0, idx).map(s => s.trim()).filter(Boolean)].join(':');
		const search = parentPath + ':';
		const matches = accounts.filter(a => a.startsWith(search));
		const names = matches
			.map(a => a.slice(search.length).split(':')[0])
			.filter(Boolean);
		const own = (fundingSegments[idx] ?? '').trim().toLowerCase();
		const seen = new Set<string>();
		const out: string[] = [];
		for (const n of names) {
			const key = n.toLowerCase();
			if (seen.has(key) || key === own) continue;
			seen.add(key);
			out.push(n);
		}
		return out.sort().slice(0, 8);
	}

	function validate(): boolean {
		errors = {};
		const path = (draft.account ?? '').trim();
		if (!path) errors.account = 'Account path is required';
		else if (!/^[A-Z][A-Za-z0-9:_-]*(:[A-Za-z0-9_-]+)+$/.test(path))
			errors.account = "Use at least 2 segments (e.g. 'Liabilities:Visa')";

		const ccy = (draft.currency ?? '').trim();
		if (!ccy) errors.currency = 'Currency is required';
		else if (!/^[A-Z][A-Z0-9'._-]*$/.test(ccy)) errors.currency = 'Currency must be uppercase code';

		if (!/^\d{4}-\d{2}-\d{2}$/.test((draft.openDate ?? '').trim())) errors.openDate = 'Must be YYYY-MM-DD';

		if (draft.principal !== null && draft.principal < 0) errors.principal = 'Must be ≥ 0';
		if (draft.interestRate !== null && draft.interestRate < 0) errors.interestRate = 'Must be ≥ 0';

		if (draft.paymentMode === 'recurring') {
			if (draft.dueDay !== null && (draft.dueDay < 1 || draft.dueDay > 31))
				errors.dueDay = 'Day must be 1–31';
			if (draft.monthlyPayment !== null && draft.monthlyPayment < 0)
				errors.monthlyPayment = 'Must be ≥ 0';
		} else {
			if (draft.payoffDate && !/^\d{4}-\d{2}-\d{2}$/.test(draft.payoffDate.trim()))
				errors.payoffDate = 'Must be YYYY-MM-DD';
			if (draft.payoffAmount !== null && draft.payoffAmount < 0)
				errors.payoffAmount = 'Must be ≥ 0';
		}

		return Object.keys(errors).length === 0;
	}

	function handleSave() {
		if (!validate()) return;
		const cleanedRaw: LoanFormDraft = {
			account: draft.account.trim(),
			currency: draft.currency.trim().toUpperCase(),
			openDate: draft.openDate.trim(),
			loanType: (draft.loanType ?? '').trim() || null,
			counterparty: (draft.counterparty ?? '').trim() || null,
			principal: numberOrNull(draft.principal),
			interestRate: numberOrNull(draft.interestRate),
			monthlyPayment: numberOrNull(draft.monthlyPayment),
			dueDay: draft.dueDay !== null && draft.dueDay !== undefined ? Math.round(Number(draft.dueDay)) : null,
			fundingAccount: (draft.fundingAccount ?? '').trim() || null,
			paymentMode: draft.paymentMode,
			payoffDate: (draft.payoffDate ?? '').trim() || null,
			payoffAmount: numberOrNull(draft.payoffAmount),
		};
		const cleaned = pruneDraftForMode(cleanedRaw);
		dispatch('save', { draft: cleaned, originalAccount: initial.account });
	}

	function numberOrNull(v: number | null | undefined): number | null {
		if (v === null || v === undefined || v === ('' as any)) return null;
		const n = Number(v);
		return isFinite(n) ? n : null;
	}

	function handleCancel() {
		dispatch('cancel');
	}

	function handleDelete() {
		if (mode !== 'edit') return;
		if (!confirm(`Remove loan account "${initial.account}"?\n\nThe open directive and metadata will be deleted from accounts.beancount. Past transactions referencing the account stay intact.`)) return;
		dispatch('delete', { originalAccount: initial.account });
	}

	// --- Reusable inline combobox state. We keep two so the path and
	// funding fields can each have their own open/highlight cursor. ---

	type ComboboxField = 'path' | 'funding';
	let comboboxOpen: Record<ComboboxField, boolean> = { path: false, funding: false };
	let comboboxIndex: Record<ComboboxField, number> = { path: -1, funding: -1 };

	function openCombobox(which: ComboboxField) {
		comboboxOpen = { ...comboboxOpen, [which]: true };
		comboboxIndex = { ...comboboxIndex, [which]: -1 };
	}
	function closeCombobox(which: ComboboxField) {
		comboboxOpen = { ...comboboxOpen, [which]: false };
		comboboxIndex = { ...comboboxIndex, [which]: -1 };
	}
	function suggestionsFor(which: ComboboxField): string[] {
		const pool = which === 'path' ? pathPool : fundingPool;
		const value = which === 'path' ? draft.account : (draft.fundingAccount ?? '');
		const q = (value ?? '').trim().toLowerCase();
		if (!q) return pool.slice(0, 12);
		return pool
			.filter(a => a.toLowerCase().includes(q))
			.slice(0, 12);
	}
	function pickSuggestion(which: ComboboxField, value: string) {
		if (which === 'path') {
			draft.account = value;
		} else {
			draft.fundingAccount = value;
		}
		closeCombobox(which);
	}
	function isCreatable(which: ComboboxField, suggestions: string[]): boolean {
		const value = which === 'path' ? draft.account : (draft.fundingAccount ?? '');
		const v = (value ?? '').trim();
		if (!v) return false;
		if (which === 'path' && !/^[A-Z][A-Za-z0-9:_-]*(:[A-Za-z0-9_-]+)+$/.test(v)) return false;
		if (which === 'funding' && !/^[A-Z][A-Za-z0-9:_-]*$/.test(v)) return false;
		// Don't show "create new" when the typed value matches an existing entry.
		return !suggestions.some(s => s === v);
	}
	async function handleComboboxKey(which: ComboboxField, event: KeyboardEvent) {
		const sugg = suggestionsFor(which);
		const creatable = isCreatable(which, sugg) ? 1 : 0;
		const max = sugg.length + creatable - 1;
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			comboboxOpen = { ...comboboxOpen, [which]: true };
			comboboxIndex = { ...comboboxIndex, [which]: Math.min(comboboxIndex[which] + 1, max) };
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			comboboxOpen = { ...comboboxOpen, [which]: true };
			comboboxIndex = { ...comboboxIndex, [which]: Math.max(comboboxIndex[which] - 1, -1) };
		} else if (event.key === 'Enter') {
			if (!comboboxOpen[which]) return;
			const idx = comboboxIndex[which];
			if (idx >= 0 && idx < sugg.length) {
				event.preventDefault();
				pickSuggestion(which, sugg[idx]);
			} else if (idx === sugg.length && creatable) {
				// "Create new" row — accept the typed value as-is.
				event.preventDefault();
				closeCombobox(which);
			}
		} else if (event.key === 'Escape') {
			closeCombobox(which);
		}
	}
</script>

<div class="loan-modal">
	<!-- Account path (segment builder) + currency -->
	<div class="row">
		<div class="field grow path-builder-field">
			<label class="field-label">Account path <em>*</em></label>
			<div class="segments-row" role="group" aria-label="Account path segments">
				<select
					class="prefix-select"
					value={prefix}
					on:change={(e) => changePrefix(e.currentTarget.value)}
					title="Top-level role of this account"
				>
					{#if !PREFIX_OPTIONS.includes(prefix)}
						<option value={prefix}>{prefix}</option>
					{/if}
					{#each PREFIX_OPTIONS as p}
						<option value={p}>{p}</option>
					{/each}
				</select>
				{#each segments as seg, idx}
					<span class="segment-sep">:</span>
					<div class="segment">
						<input
							type="text"
							class="segment-input"
							placeholder={idx === 0 ? 'Credit' : (idx === segments.length - 1 ? 'Visa' : 'segment')}
							value={seg}
							on:input={(e) => setSegment(idx, e.currentTarget.value)}
						/>
						{#if segments.length > 1}
							<button class="segment-remove" type="button" on:click={() => removeSegment(idx)} title="Remove this segment">×</button>
						{/if}
					</div>
				{/each}
				<button class="segment-add" type="button" on:click={addSegment} title="Add another segment">+</button>
			</div>

			<!-- Sibling chips: existing names at each depth that the user can pick with one click. -->
			{#each segments as seg, idx}
				{@const sib = siblingsForSegment(idx)}
				{#if sib.length > 0}
					<div class="sibling-chips">
						<span class="chips-label">depth {idx + 1}:</span>
						{#each sib as s}
							<button class="chip" type="button" on:click={() => setSegment(idx, s)}>{s}</button>
						{/each}
					</div>
				{/if}
			{/each}

			<!-- Live full-path preview + advanced edit-as-text toggle. -->
			<div class="path-preview">
				<span class="preview-label">Full path:</span>
				<code class:error={!!errors.account}>{fullPath || '—'}</code>
				{#if mode === 'add' && draft.loanType && (PATH_TEMPLATES[draft.loanType]?.length ?? 0) > 0}
					<button class="link-btn" type="button" on:click={applyTemplate} title="Reset segments to the loan-type's template">↻ template</button>
				{/if}
			</div>

			{#if errors.account}<span class="error-msg">{errors.account}</span>{/if}
		</div>

		<label class="field narrow">
			<span>Currency <em>*</em></span>
			<select
				bind:value={draft.currency}
				class:error={errors.currency}
			>
				{#if draft.currency && !currencies.includes(draft.currency)}
					<option value={draft.currency}>{draft.currency}</option>
				{/if}
				{#each currencies as c}
					<option value={c}>{c}</option>
				{/each}
			</select>
			{#if errors.currency}<span class="error-msg">{errors.currency}</span>{/if}
		</label>
	</div>

	<!-- Identity row -->
	<div class="row">
		<label class="field">
			<span>Open date <em>*</em></span>
			<input
				type="text"
				inputmode="numeric"
				placeholder="YYYY-MM-DD"
				pattern="\d{4}-\d{2}-\d{2}"
				bind:value={draft.openDate}
				class:error={errors.openDate}
			/>
			{#if errors.openDate}<span class="error-msg">{errors.openDate}</span>{/if}
		</label>

		<label class="field">
			<span>Loan type</span>
			<select bind:value={draft.loanType} on:change={onLoanTypeChange}>
				{#each LOAN_TYPES as t}<option value={t}>{t}</option>{/each}
			</select>
		</label>

		<label class="field grow">
			<span>Counterparty</span>
			<input type="text" placeholder="Banco Santander, Maria Esther, …" bind:value={draft.counterparty} />
		</label>
	</div>

	<!-- Headline numbers (apply to both modes) -->
	<div class="row">
		<label class="field">
			<span>Principal</span>
			<input type="number" step="any" placeholder="0" bind:value={draft.principal} class:error={errors.principal} />
			{#if errors.principal}<span class="error-msg">{errors.principal}</span>{/if}
		</label>

		<label class="field">
			<span>Interest rate (% APR)</span>
			<input type="number" step="any" placeholder="0" bind:value={draft.interestRate} class:error={errors.interestRate} />
			{#if errors.interestRate}<span class="error-msg">{errors.interestRate}</span>{/if}
		</label>
	</div>

	<!-- Payment schedule selector -->
	<fieldset class="payment-mode">
		<legend>Payment schedule</legend>
		<label class="radio">
			<input type="radio" bind:group={draft.paymentMode} value="recurring" />
			<span>
				<strong>Recurring monthly</strong>
				<span class="hint">a fixed amount every month on the same day</span>
			</span>
		</label>
		<label class="radio">
			<input type="radio" bind:group={draft.paymentMode} value="one-time" />
			<span>
				<strong>One-time payoff</strong>
				<span class="hint">a single lump-sum payment by a target date</span>
			</span>
		</label>
	</fieldset>

	<!-- Mode-specific fields -->
	{#if draft.paymentMode === 'recurring'}
		<div class="row">
			<label class="field">
				<span>Monthly payment</span>
				<input type="number" step="any" placeholder="0" bind:value={draft.monthlyPayment} class:error={errors.monthlyPayment} />
				{#if errors.monthlyPayment}<span class="error-msg">{errors.monthlyPayment}</span>{/if}
			</label>

			<label class="field narrow">
				<span>Due day</span>
				<input type="number" min="1" max="31" placeholder="1–31" bind:value={draft.dueDay} class:error={errors.dueDay} />
				{#if errors.dueDay}<span class="error-msg">{errors.dueDay}</span>{/if}
			</label>
		</div>
	{:else}
		<div class="row">
			<label class="field">
				<span>Payoff date</span>
				<input
					type="text"
					inputmode="numeric"
					placeholder="YYYY-MM-DD"
					pattern="\d{4}-\d{2}-\d{2}"
					bind:value={draft.payoffDate}
					class:error={errors.payoffDate}
				/>
				{#if errors.payoffDate}<span class="error-msg">{errors.payoffDate}</span>{/if}
			</label>

			<label class="field">
				<span>Payoff amount</span>
				<input type="number" step="any" placeholder="0" bind:value={draft.payoffAmount} class:error={errors.payoffAmount} />
				{#if errors.payoffAmount}<span class="error-msg">{errors.payoffAmount}</span>{/if}
			</label>
		</div>
	{/if}

	<!-- Funding account (segment builder) -->
	<div class="row">
		<div class="field grow path-builder-field">
			<label class="field-label">
				Funding account
				<span class="muted small">— used by the recurring widget when synthesising payment rules</span>
			</label>
			<div class="segments-row" role="group" aria-label="Funding account segments">
				<select
					class="prefix-select"
					value={fundingPrefix}
					on:change={(e) => changeFundingPrefix(e.currentTarget.value)}
					title="Top-level role of the funding account"
				>
					{#if !fundingPrefixOptions.includes(fundingPrefix)}
						<option value={fundingPrefix}>{fundingPrefix}</option>
					{/if}
					{#each fundingPrefixOptions as p}
						<option value={p}>{p}</option>
					{/each}
				</select>
				{#each fundingSegments as seg, idx}
					<span class="segment-sep">:</span>
					<div class="segment">
						<input
							type="text"
							class="segment-input"
							placeholder={idx === 0 ? 'Banking' : (idx === fundingSegments.length - 1 ? 'leaf' : 'segment')}
							value={seg}
							on:input={(e) => setFundingSegment(idx, e.currentTarget.value)}
						/>
						{#if fundingSegments.length > 1}
							<button class="segment-remove" type="button" on:click={() => removeFundingSegment(idx)} title="Remove this segment">×</button>
						{/if}
					</div>
				{/each}
				<button class="segment-add" type="button" on:click={addFundingSegment} title="Add another segment">+</button>
			</div>

			{#each fundingSegments as seg, idx}
				{@const sib = siblingsForFunding(idx)}
				{#if sib.length > 0}
					<div class="sibling-chips">
						<span class="chips-label">depth {idx + 1}:</span>
						{#each sib as s}
							<button class="chip" type="button" on:click={() => setFundingSegment(idx, s)}>{s}</button>
						{/each}
					</div>
				{/if}
			{/each}

			<div class="path-preview">
				<span class="preview-label">Full path:</span>
				<code>{fullFundingPath || '(none)'}</code>
			</div>
		</div>
	</div>

	<div class="footer">
		{#if mode === 'edit'}
			<button class="danger" on:click={handleDelete} title="Delete this account from accounts.beancount">Delete</button>
		{/if}
		<div class="footer-spacer"></div>
		<button on:click={handleCancel}>Cancel</button>
		<button class="cta" on:click={handleSave}>{mode === 'add' ? 'Add loan' : 'Save changes'}</button>
	</div>
</div>

<style>
	.loan-modal {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-3);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--size-4-3);
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex: 1 1 160px;
		min-width: 0;
	}
	.field.grow { flex: 1 1 240px; }
	.field.narrow { flex: 0 0 120px; }
	.field > label,
	.field > span {
		font-size: var(--font-ui-small);
		color: var(--text-muted);
	}
	.field em {
		color: var(--color-red);
		font-style: normal;
	}
	.muted { color: var(--text-faint); }
	.small { font-size: var(--font-ui-smaller); }
	.field input,
	.field select {
		width: 100%;
		padding: 6px 8px;
		border-radius: var(--radius-s);
		border: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
		color: var(--text-normal);
	}
	.field input.error,
	.field select.error {
		border-color: var(--color-red);
	}
	.error-msg {
		color: var(--color-red);
		font-size: var(--font-ui-smaller);
	}

	/* Account-path / funding segment builder */
	.path-builder-field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.field-label {
		font-size: var(--font-ui-small);
		color: var(--text-muted);
	}
	.segments-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
		padding: 4px 6px;
		background: var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
	}
	.prefix-select {
		padding: 4px 6px;
		border-radius: var(--radius-s);
		border: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
		color: var(--text-accent);
		font-family: var(--font-monospace);
		font-size: var(--font-ui-small);
		font-weight: 600;
	}
	.segment-sep {
		color: var(--text-muted);
		font-family: var(--font-monospace);
		font-weight: 600;
		padding: 0 2px;
	}
	.segment {
		display: flex;
		align-items: center;
		gap: 2px;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		padding: 0 4px;
		flex: 0 1 auto;
	}
	.segment-input {
		border: none !important;
		padding: 4px 6px !important;
		min-width: 80px;
		max-width: 160px;
		font-family: var(--font-monospace);
		background: transparent;
	}
	.segment-input:focus {
		outline: none;
	}
	.segment-remove,
	.segment-add {
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 2px 6px;
		border-radius: 4px;
		font-size: var(--font-ui-small);
		font-weight: 600;
		line-height: 1;
	}
	.segment-remove:hover {
		color: var(--color-red);
		background: color-mix(in srgb, var(--color-red), transparent 90%);
	}
	.segment-add {
		padding: 4px 10px;
		border: 1px dashed var(--background-modifier-border-hover);
		color: var(--text-muted);
	}
	.segment-add:hover {
		border-color: var(--interactive-accent);
		color: var(--interactive-accent);
	}

	.sibling-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		align-items: center;
		font-size: var(--font-ui-smaller);
	}
	.chips-label {
		color: var(--text-muted);
		font-family: var(--font-monospace);
		margin-right: 4px;
	}
	.chip {
		padding: 2px 8px;
		border-radius: 999px;
		border: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
		color: var(--text-normal);
		cursor: pointer;
		font-family: var(--font-monospace);
		font-size: 11px;
	}
	.chip:hover {
		border-color: var(--interactive-accent);
		color: var(--interactive-accent);
	}

	.path-preview {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
		font-size: var(--font-ui-smaller);
	}
	.preview-label {
		color: var(--text-muted);
	}
	.path-preview code {
		font-family: var(--font-monospace);
		color: var(--text-normal);
		background: var(--background-secondary);
		padding: 2px 8px;
		border-radius: 4px;
	}
	.path-preview code.error {
		color: var(--color-red);
	}
	.link-btn {
		background: transparent;
		border: none;
		color: var(--interactive-accent);
		cursor: pointer;
		font-size: var(--font-ui-smaller);
		padding: 0;
	}
	.link-btn:hover {
		text-decoration: underline;
	}

	/* Legacy combobox styles (kept for fallback / not used by current template). */
	.combobox-field {
		position: relative;
	}
	.combobox-list {
		position: absolute;
		top: calc(100% + 2px);
		left: 0;
		right: 0;
		max-height: 240px;
		overflow-y: auto;
		margin: 0;
		padding: 4px 0;
		list-style: none;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		box-shadow: var(--shadow-s);
		z-index: 50;
	}
	.combobox-list li {
		padding: 6px 10px;
		cursor: pointer;
		font-family: var(--font-monospace);
		font-size: var(--font-ui-small);
		color: var(--text-normal);
	}
	.combobox-list li:hover,
	.combobox-list li.active {
		background: var(--background-modifier-hover);
	}
	.combobox-list .combobox-create {
		font-family: var(--font-interface);
		color: var(--interactive-accent);
		border-top: 1px solid var(--background-modifier-border);
		padding-top: 8px;
		margin-top: 4px;
		font-style: italic;
	}
	.combobox-list .combobox-empty {
		font-family: var(--font-interface);
		color: var(--text-muted);
		font-style: italic;
		cursor: default;
	}
	.combobox-list .combobox-empty:hover {
		background: transparent;
	}
	.combobox-list .combobox-empty code {
		font-style: normal;
		font-family: var(--font-monospace);
		color: var(--text-normal);
		background: var(--background-secondary);
		padding: 1px 6px;
		border-radius: 4px;
	}
	.combobox-list .combobox-create code {
		font-style: normal;
		font-family: var(--font-monospace);
		color: var(--text-normal);
		background: var(--background-secondary);
		padding: 1px 6px;
		border-radius: 4px;
		margin-left: 4px;
	}

	/* Payment-mode fieldset */
	.payment-mode {
		margin: 0;
		padding: var(--size-4-3);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		background: var(--background-secondary);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.payment-mode legend {
		padding: 0 6px;
		font-size: var(--font-ui-small);
		color: var(--text-muted);
	}
	.payment-mode .radio {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		cursor: pointer;
	}
	.payment-mode .radio input { margin-top: 4px; }
	.payment-mode .radio strong {
		display: block;
		font-weight: 600;
		font-size: var(--font-ui-small);
		color: var(--text-normal);
	}
	.payment-mode .radio .hint {
		display: block;
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
	}

	.footer {
		display: flex;
		gap: 8px;
		padding-top: var(--size-4-3);
		border-top: 1px solid var(--background-modifier-border);
		align-items: center;
	}
	.footer-spacer { flex: 1; }
	button {
		padding: 6px 14px;
		border-radius: var(--radius-s);
		cursor: pointer;
	}
	.cta {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		border: 1px solid var(--interactive-accent);
	}
	.danger {
		background: transparent;
		color: var(--color-red);
		border: 1px solid var(--color-red);
	}
	.danger:hover {
		background: color-mix(in srgb, var(--color-red), transparent 92%);
	}
</style>
