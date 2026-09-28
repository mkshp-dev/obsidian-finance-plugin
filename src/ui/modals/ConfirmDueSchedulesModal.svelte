<!-- src/ui/modals/ConfirmDueSchedulesModal.svelte -->
<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { nativeDatePicker } from '../actions/nativeDatePicker';
	import type { ScheduledTransactionItem, DueOccurrence } from '../../models/schedule';
	import type { PostingStub } from '../../utils/directives/types';

	const dispatch = createEventDispatcher();

	export let plugin: any = null;
	export let dueOccurrences: DueOccurrence[] = [];

	type Decision = 'insert' | 'skip' | 'hold';

	interface OccRow {
		date: string;
		decision: Decision;
	}

	interface Group {
		schedule: ScheduledTransactionItem;
		rows: OccRow[];
	}

	let groups: Group[] = [];

	onMount(() => {
		const byKey = new Map<string, Group>();
		for (const occ of dueOccurrences) {
			const key = `${occ.schedule.filename}:${occ.schedule.lineno}`;
			let group = byKey.get(key);
			if (!group) {
				group = { schedule: occ.schedule, rows: [] };
				byKey.set(key, group);
			}
			group.rows.push({ date: occ.date, decision: 'insert' });
		}
		for (const group of byKey.values()) {
			group.rows.sort((a, b) => a.date.localeCompare(b.date));
		}
		groups = [...byKey.values()];
	});

	function formatAmount(amount: number, currency: string): string {
		const decimals = plugin?.currencyPrecisionService?.getDecimals(currency) ?? 2;
		return `${amount.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${currency}`;
	}

	/** Beancount-style cost/price suffix for a posting chip, e.g. " {250 USD} @ 251 USD". */
	function costPriceSuffix(posting: PostingStub): string {
		let suffix = '';
		const { cost, price } = posting;
		if (cost) {
			const parts = [cost.number !== undefined ? `${cost.number} ${cost.currency ?? ''}`.trim() : '', cost.date ?? '', cost.label ? `"${cost.label}"` : ''].filter(Boolean);
			suffix += cost.isTotal ? ` {{${parts.join(', ')}}}` : ` {${parts.join(', ')}}`;
		}
		if (price) suffix += ` ${price.isTotal ? '@@' : '@'} ${price.amount} ${price.currency ?? ''}`.trimEnd();
		return suffix;
	}

	/** A Hold on an earlier occurrence blocks nextDate from advancing past it,
	 * so later occurrences of the same schedule can't be resolved in this
	 * batch — their effective decision is forced to Hold regardless of what's
	 * stored, and the row is disabled in the UI. */
	function isGated(group: Group, index: number): boolean {
		for (let i = 0; i < index; i++) {
			if (group.rows[i].decision === 'hold') return true;
		}
		return false;
	}

	function effectiveDecision(group: Group, index: number): Decision {
		return isGated(group, index) ? 'hold' : group.rows[index].decision;
	}

	function setDecision(group: Group, index: number, decision: Decision) {
		group.rows[index].decision = decision;
		groups = groups; // reassign for reactivity (deep mutation)
	}

	function toggleInsert(group: Group, index: number, checked: boolean) {
		setDecision(group, index, checked ? 'insert' : 'hold');
	}

	$: insertCount = groups.reduce(
		(sum, g) => sum + g.rows.filter((_, i) => effectiveDecision(g, i) === 'insert').length,
		0
	);
	$: skipCount = groups.reduce(
		(sum, g) => sum + g.rows.filter((_, i) => effectiveDecision(g, i) === 'skip').length,
		0
	);

	function handleConfirm() {
		const payload = groups.flatMap((g) =>
			g.rows.map((r, i) => ({ schedule: g.schedule, date: r.date, decision: effectiveDecision(g, i) }))
		);
		dispatch('confirm', payload);
	}

	function handleCancel() {
		dispatch('cancel');
	}
</script>

<div class="confirm-modal">
	<h2>Transactions due</h2>
	<p class="subtitle">
		Review each occurrence: <strong>Insert</strong> adds it to the ledger,
		<strong>Skip</strong> dismisses it without adding, and leaving it
		unchecked <strong>holds</strong> it for next time.
	</p>

	<div class="due-groups">
		{#each groups as group (group.schedule.filename + ':' + group.schedule.lineno)}
			<div class="due-group">
				<div class="group-header">
					<span class="group-name">{group.schedule.name}</span>
					<span class="group-frequency">{group.schedule.frequency}</span>
				</div>
				{#if group.schedule.payee || group.schedule.narration}
					<div class="group-narration">{group.schedule.payee || ''}{group.schedule.payee && group.schedule.narration ? ' — ' : ''}{group.schedule.narration || ''}</div>
				{/if}
				<div class="postings-summary">
					{#each group.schedule.postings as posting, i}
						<span class="posting-chip">{posting.account}: {posting.amount !== undefined ? formatAmount(posting.amount, posting.currency || '') + costPriceSuffix(posting) : 'auto-balance'}</span>
						{#if i < group.schedule.postings.length - 1}<span class="posting-sep">→</span>{/if}
					{/each}
				</div>

				<div class="occurrence-list">
					{#each group.rows as row, i (row.date)}
						{@const decision = effectiveDecision(group, i)}
						{@const gated = isGated(group, i)}
						<div class="occurrence-row" class:gated>
							<label class="checkbox-label">
								<input
									type="checkbox"
									checked={decision === 'insert'}
									disabled={gated}
									on:change={(e) => toggleInsert(group, i, e.currentTarget.checked)}
								/>
							</label>
							<input
								class="occurrence-date"
								type="date"
								bind:value={row.date}
								use:nativeDatePicker
								disabled={gated || decision !== 'insert'}
							/>
							<span class="decision-label" class:label-skip={decision === 'skip'} class:label-hold={decision === 'hold'}>
								{#if gated}Blocked by hold above
								{:else if decision === 'insert'}Will add
								{:else if decision === 'skip'}Skipped
								{:else}On hold{/if}
							</span>
							<button
								type="button"
								class="skip-link"
								disabled={gated}
								on:click={() => setDecision(group, i, decision === 'skip' ? 'insert' : 'skip')}
							>
								{decision === 'skip' ? 'Undo skip' : 'Skip'}
							</button>
						</div>
					{/each}
				</div>
			</div>
		{/each}
	</div>

	<div class="modal-footer">
		<button class="cancel-btn" on:click={handleCancel}>Cancel</button>
		<button class="save-btn" on:click={handleConfirm} disabled={insertCount === 0 && skipCount === 0}>
			Confirm ({insertCount} insert{insertCount === 1 ? '' : 's'}{skipCount > 0 ? `, ${skipCount} skip${skipCount === 1 ? '' : 's'}` : ''})
		</button>
	</div>
</div>

<style>
	.confirm-modal {
		padding: var(--size-4-4);
		max-height: 80vh;
		overflow-y: auto;
	}

	.confirm-modal h2 {
		margin: 0 0 var(--size-4-2);
		font-size: var(--font-ui-larger);
		color: var(--text-normal);
	}

	.subtitle {
		margin: 0 0 var(--size-4-4);
		color: var(--text-muted);
		font-size: var(--font-ui-small);
		line-height: 1.5;
	}

	.due-groups {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-3);
	}

	.due-group {
		padding: var(--size-4-3);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		background: var(--background-primary);
	}

	.group-header {
		display: flex;
		align-items: center;
		gap: var(--size-4-2);
	}

	.group-name {
		font-weight: 700;
		color: var(--text-normal);
		font-size: var(--font-ui-medium);
	}

	.group-frequency {
		font-size: 11px;
		color: var(--text-muted);
	}

	.group-narration {
		margin-top: 2px;
		font-size: var(--font-ui-small);
		color: var(--text-muted);
	}

	.postings-summary {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		margin-top: 4px;
		font-size: var(--font-ui-smaller);
		color: var(--text-normal);
	}

	.posting-sep {
		color: var(--text-faint);
		font-size: 11px;
	}

	.occurrence-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: var(--size-4-2);
		padding-top: var(--size-4-2);
		border-top: 1px solid var(--background-modifier-border);
	}

	.occurrence-row {
		display: flex;
		align-items: center;
		gap: var(--size-4-2);
	}

	.occurrence-row.gated {
		opacity: 0.5;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
	}

	.occurrence-date {
		padding: var(--size-4-1) var(--size-4-2);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		background: var(--background-primary);
		color: var(--text-normal);
		font-size: var(--font-ui-small);
	}

	.decision-label {
		flex: 1;
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
	}

	.decision-label.label-skip {
		color: var(--text-error);
	}

	.decision-label.label-hold {
		color: var(--color-orange);
	}

	.skip-link {
		background: transparent;
		border: none;
		box-shadow: none;
		padding: 0;
		margin: 0;
		height: auto;
		color: var(--text-accent);
		font-size: var(--font-ui-smaller);
		cursor: pointer;
	}

	.skip-link:hover:not(:disabled) {
		text-decoration: underline;
		background: transparent;
		box-shadow: none;
	}

	.skip-link:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: var(--size-4-2);
		margin-top: var(--size-4-4);
		padding-top: var(--size-4-3);
		border-top: 1px solid var(--background-modifier-border);
	}

	.cancel-btn {
		padding: var(--size-4-1) var(--size-4-4);
		background: var(--interactive-normal);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		color: var(--text-normal);
		cursor: pointer;
		font-size: var(--font-ui-small);
	}

	.save-btn {
		padding: var(--size-4-1) var(--size-4-4);
		background: var(--interactive-accent);
		border: none;
		border-radius: var(--radius-s);
		color: var(--text-on-accent);
		cursor: pointer;
		font-size: var(--font-ui-small);
	}

	.save-btn:hover:not(:disabled) { background: var(--interactive-accent-hover); }
	.save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
