<!-- src/ui/modals/AddScheduleModal.svelte -->
<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { nativeDatePicker } from '../actions/nativeDatePicker';
	import PostingRow from './transaction-edit/PostingRow.svelte';
	import TagLinkInput from './transaction-edit/TagLinkInput.svelte';
	import type { JournalPosting } from '../../models/journal';
	import type { PostingStub } from '../../utils/directives/types';
	import type { ScheduledTransactionItem } from '../../models/schedule';
	import { advanceScheduleDate, type SchedulePrefill } from '../../utils/directives/scheduleDirectives';
	import { MAX_SCHEDULE_POSTINGS } from '../../queries';

	const dispatch = createEventDispatcher();

	// Props
	export let accounts: string[] = [];
	export let payees: string[] = [];
	export let currencies: string[] = ['INR', 'USD', 'EUR', 'GBP'];
	export let defaultCurrency: string = 'USD';
	export let editingSchedule: ScheduledTransactionItem | null = null;
	/** Starting values copied from an existing transaction (create mode only). */
	export let prefill: SchedulePrefill | null = null;

	function blankPosting(): JournalPosting {
		return { account: '', amount: '', currency: defaultCurrency, flag: null, comment: null, metadata: {} };
	}

	// Form state
	let name: string = '';
	let frequency: 'One-time' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly' = 'Monthly';
	let startDate: string = new Date().toISOString().split('T')[0];
	let payee: string = '';
	let narration: string = '';
	let flag: '*' | '!' = '*';
	let selectedTags: string[] = [];
	let selectedLinks: string[] = [];
	let transactionMetadata: Record<string, string> = {};
	let postings: JournalPosting[] = [blankPosting(), blankPosting()];

	// Per-posting visibility of the optional sections. Hiding a section drops
	// it from the saved schedule, so what's visible is what gets saved.
	let showCost: boolean[] = [false, false];
	let showPrice: boolean[] = [false, false];
	let showPostingFlag: boolean[] = [false, false];
	let showPostingComment: boolean[] = [false, false];
	let showPostingMetadata: boolean[] = [false, false];
	let showTransactionMetadata = false;

	// UI state
	let nameError: string = '';
	let postingsError: string = '';
	let metadataError: string = '';

	function str(value: unknown): string {
		return value === undefined || value === null ? '' : String(value);
	}

	// Copying a transaction: the first occurrence follows the source transaction
	// by one cycle of the chosen frequency, until the date is edited by hand.
	let startDateEdited = false;
	$: if (prefill && !startDateEdited) {
		startDate = advanceScheduleDate(prefill.anchorDate, frequency === 'One-time' ? 'Monthly' : frequency) ?? startDate;
	}

	onMount(() => {
		const source: ScheduledTransactionItem | SchedulePrefill | null = editingSchedule ?? prefill;
		if (source) {
			name = source.name || '';
			if (editingSchedule) {
				frequency = editingSchedule.frequency || 'Monthly';
				startDate = editingSchedule.startDate || new Date().toISOString().split('T')[0];
			}
			payee = source.payee || '';
			narration = source.narration || '';
			flag = source.flag === '!' ? '!' : '*';
			selectedTags = [...(source.tags || [])];
			selectedLinks = [...(source.links || [])];
			transactionMetadata = { ...(source.metadata || {}) };
			showTransactionMetadata = Object.keys(transactionMetadata).length > 0;
			if (source.postings && source.postings.length > 0) {
				postings = source.postings.map((p: PostingStub): JournalPosting => ({
					account: p.account,
					amount: str(p.amount),
					currency: p.currency || defaultCurrency,
					cost: p.cost ? {
						number: str(p.cost.number),
						currency: p.cost.currency || defaultCurrency,
						date: p.cost.date || '',
						label: p.cost.label || '',
						isTotal: !!p.cost.isTotal,
					} : undefined,
					price: p.price ? {
						amount: str(p.price.amount),
						currency: p.price.currency || defaultCurrency,
						isTotal: !!p.price.isTotal,
					} : undefined,
					flag: p.flag || null,
					comment: p.comment || null,
					metadata: { ...(p.metadata || {}) },
				}));
				showCost = postings.map((p) => !!p.cost);
				showPrice = postings.map((p) => !!p.price);
				showPostingFlag = postings.map((p) => !!p.flag);
				showPostingComment = postings.map((p) => !!p.comment);
				showPostingMetadata = postings.map((p) => Object.keys(p.metadata || {}).length > 0);
			}
		}
	});

	function addPosting() {
		postings = [...postings, blankPosting()];
		showCost = [...showCost, false];
		showPrice = [...showPrice, false];
		showPostingFlag = [...showPostingFlag, false];
		showPostingComment = [...showPostingComment, false];
		showPostingMetadata = [...showPostingMetadata, false];
	}

	function removePosting(index: number) {
		if (postings.length <= 2) return;
		const keep = (_: unknown, i: number) => i !== index;
		postings = postings.filter(keep);
		showCost = showCost.filter(keep);
		showPrice = showPrice.filter(keep);
		showPostingFlag = showPostingFlag.filter(keep);
		showPostingComment = showPostingComment.filter(keep);
		showPostingMetadata = showPostingMetadata.filter(keep);
	}

	function toggleCost(index: number) {
		showCost[index] = !showCost[index];
		if (!postings[index].cost) {
			postings[index].cost = { number: '', currency: defaultCurrency, date: '', label: '', isTotal: false };
		}
	}

	function togglePrice(index: number) {
		showPrice[index] = !showPrice[index];
		if (!postings[index].price) {
			postings[index].price = { amount: '', currency: defaultCurrency, isTotal: false };
		}
	}

	function togglePostingFlag(index: number) {
		showPostingFlag[index] = !showPostingFlag[index];
		if (!postings[index].flag) postings[index].flag = '!';
	}

	function togglePostingComment(index: number) {
		showPostingComment[index] = !showPostingComment[index];
		if (!postings[index].comment) postings[index].comment = '';
	}

	function togglePostingMetadata(index: number) {
		showPostingMetadata[index] = !showPostingMetadata[index];
		if (!postings[index].metadata) postings[index].metadata = {};
	}

	/** Next unused `keyN` placeholder, so adding after a removal can't collide. */
	function nextMetadataKey(map: Record<string, string>): string {
		let n = Object.keys(map).length + 1;
		while (`key${n}` in map) n++;
		return `key${n}`;
	}

	function renameKey(map: Record<string, string>, oldKey: string, newKey: string): Record<string, string> {
		if (oldKey === newKey || newKey in map) return map;
		// Rebuild rather than delete+add so the entry keeps its position.
		return Object.fromEntries(Object.entries(map).map(([k, v]) => [k === oldKey ? newKey : k, v]));
	}

	function addPostingMetadata(index: number) {
		const map = postings[index].metadata || {};
		postings[index].metadata = { ...map, [nextMetadataKey(map)]: '' };
	}

	function withoutKey(map: Record<string, string>, key: string): Record<string, string> {
		return Object.fromEntries(Object.entries(map).filter(([k]) => k !== key));
	}

	function removePostingMetadata(index: number, key: string) {
		postings[index].metadata = withoutKey(postings[index].metadata || {}, key);
	}

	function updatePostingMetadataKey(index: number, oldKey: string, newKey: string) {
		postings[index].metadata = renameKey(postings[index].metadata || {}, oldKey, newKey.trim());
	}

	function addTransactionMetadata() {
		transactionMetadata = { ...transactionMetadata, [nextMetadataKey(transactionMetadata)]: '' };
	}

	function removeTransactionMetadata(key: string) {
		transactionMetadata = withoutKey(transactionMetadata, key);
	}

	function updateTransactionMetadataKey(oldKey: string, newKey: string) {
		transactionMetadata = renameKey(transactionMetadata, oldKey, newKey.trim());
	}

	// A posting's amount is blank/elided when left empty — beancount infers it
	// so the transaction balances. At most ONE posting per schedule may be
	// blank (beancount can't infer two unknowns at once).
	function isBlank(p: JournalPosting): boolean {
		return p.amount === null || p.amount === undefined || String(p.amount).trim() === '';
	}

	// Beancount metadata key syntax.
	const METADATA_KEY = /^[a-z][a-zA-Z0-9_-]*$/;

	function filled(value: unknown): boolean {
		return str(value).trim() !== '';
	}

	// Cost counts as set when any of its identifying fields is filled —
	// matching TransactionEditModal, a date- or label-only cost is valid.
	function hasCost(i: number): boolean {
		const c = postings[i].cost;
		return showCost[i] && !!c && (filled(c.number) || filled(c.date) || filled(c.label));
	}

	function hasPrice(i: number): boolean {
		const p = postings[i].price;
		return showPrice[i] && !!p && filled(p.amount);
	}

	function validateMetadataMap(map: Record<string, string>, where: string): string {
		for (const key of Object.keys(map)) {
			if (!METADATA_KEY.test(key)) {
				return `${where} metadata key "${key}" must start with a lowercase letter and use only letters, digits, "-" or "_"`;
			}
		}
		return '';
	}

	function validate(): boolean {
		let valid = true;
		nameError = '';
		postingsError = '';
		metadataError = '';

		if (!name.trim()) {
			nameError = 'Name is required';
			valid = false;
		}
		if (postings.length < 2) {
			postingsError = 'At least two postings are required';
			valid = false;
		}
		if (postings.length > MAX_SCHEDULE_POSTINGS) {
			postingsError = `A schedule can have at most ${MAX_SCHEDULE_POSTINGS} postings`;
			valid = false;
		}

		let blankCount = 0;
		postings.forEach((p, i) => {
			if (!p.account || !p.account.trim()) {
				postingsError = 'Every posting needs an account';
				valid = false;
			}
			if (isBlank(p)) {
				blankCount++;
				if (hasCost(i) || hasPrice(i)) {
					postingsError = 'A posting left blank to auto-balance can\'t have a cost or price';
					valid = false;
				}
			} else {
				if (isNaN(Number(p.amount))) {
					postingsError = 'Posting amounts must be numbers';
					valid = false;
				}
				if (!p.currency || !p.currency.trim()) {
					postingsError = 'A posting with an amount needs a currency';
					valid = false;
				}
			}
			if (hasCost(i)) {
				const c = p.cost!;
				if (filled(c.number) && (isNaN(Number(c.number)) || !filled(c.currency))) {
					postingsError = 'A cost needs a numeric amount and a currency';
					valid = false;
				}
			}
			if (hasPrice(i)) {
				const pr = p.price!;
				if (isNaN(Number(pr.amount)) || !filled(pr.currency)) {
					postingsError = 'A price needs a numeric amount and a currency';
					valid = false;
				}
			}
			if (showPostingMetadata[i]) {
				const err = validateMetadataMap(p.metadata || {}, `Posting ${i + 1}`);
				if (err) { metadataError = err; valid = false; }
			}
		});
		if (blankCount > 1) {
			postingsError = 'Only one posting may be left blank to auto-balance';
			valid = false;
		}
		if (showTransactionMetadata) {
			const err = validateMetadataMap(transactionMetadata, 'Transaction');
			if (err) { metadataError = err; valid = false; }
			if ('scheduled' in transactionMetadata) {
				metadataError = '"scheduled" is set automatically on every inserted transaction — use another key';
				valid = false;
			}
		}
		return valid;
	}

	/** Non-empty entries of a metadata map, or undefined when none. */
	function cleanMetadata(map: Record<string, string> | undefined): Record<string, string> | undefined {
		const entries = Object.entries(map || {}).filter(([k]) => k.trim() !== '');
		return entries.length > 0 ? Object.fromEntries(entries) : undefined;
	}

	function toPostingStub(p: JournalPosting, i: number): PostingStub {
		const stub: PostingStub = { account: p.account.trim() };
		if (!isBlank(p)) {
			stub.amount = Number(p.amount);
			stub.currency = (p.currency || defaultCurrency).trim();
		}
		if (showPostingFlag[i] && p.flag) stub.flag = p.flag;
		if (showPostingComment[i] && filled(p.comment)) stub.comment = str(p.comment).trim();
		if (hasCost(i)) {
			const c = p.cost!;
			stub.cost = {
				number: filled(c.number) ? str(c.number).trim() : undefined,
				currency: filled(c.number) ? str(c.currency).trim() : undefined,
				date: filled(c.date) ? str(c.date) : undefined,
				label: filled(c.label) ? str(c.label).trim() : undefined,
				isTotal: !!c.isTotal,
			};
		}
		if (hasPrice(i)) {
			const pr = p.price!;
			stub.price = { amount: str(pr.amount).trim(), currency: str(pr.currency).trim(), isTotal: !!pr.isTotal };
		}
		if (showPostingMetadata[i]) stub.metadata = cleanMetadata(p.metadata);
		return stub;
	}

	function handleSave() {
		if (!validate()) return;
		dispatch('save', {
			name: name.trim(),
			frequency,
			startDate,
			payee: payee.trim() || undefined,
			narration: narration.trim() || undefined,
			flag,
			tags: selectedTags,
			links: selectedLinks,
			metadata: showTransactionMetadata ? cleanMetadata(transactionMetadata) : undefined,
			postings: postings.map(toPostingStub),
		});
	}

	function handleCancel() {
		dispatch('cancel');
	}
</script>

<div class="schedule-modal">
	<h2>{editingSchedule ? 'Edit Scheduled Transaction' : 'Add Scheduled Transaction'}</h2>

	<div class="form-grid">
		<div class="form-group full-width">
			<label for="schedule-name">Name <span class="required">*</span></label>
			<input
				id="schedule-name"
				type="text"
				bind:value={name}
				placeholder="e.g. Rent Payment"
				class:error={nameError}
			/>
			{#if nameError}<span class="error-msg">{nameError}</span>{/if}
		</div>

		<div class="form-group">
			<label for="schedule-frequency">Frequency</label>
			<select id="schedule-frequency" bind:value={frequency}>
				<option value="One-time">One-time</option>
				<option value="Weekly">Weekly</option>
				<option value="Monthly">Monthly</option>
				<option value="Quarterly">Quarterly</option>
				<option value="Yearly">Yearly</option>
			</select>
		</div>

		<div class="form-group">
			<label for="schedule-start">{frequency === 'One-time' ? 'Date' : 'Start Date'}</label>
			<input id="schedule-start" type="date" bind:value={startDate} use:nativeDatePicker on:input={() => (startDateEdited = true)} on:change={() => (startDateEdited = true)} />
			{#if prefill && !startDateEdited}
				<span class="field-hint">One {frequency === 'One-time' ? 'month' : frequency.toLowerCase().replace(/ly$/, '')} after the copied transaction ({prefill.anchorDate})</span>
			{/if}
		</div>

		<div class="form-group">
			<label for="schedule-payee">Payee</label>
			<input id="schedule-payee" type="text" bind:value={payee} list="payees-list" placeholder="e.g. Landlord" />
			<datalist id="payees-list">
				{#each payees as p}<option value={p} />{/each}
			</datalist>
		</div>

		<div class="form-group">
			<label for="schedule-narration">Narration</label>
			<input id="schedule-narration" type="text" bind:value={narration} placeholder="e.g. Monthly rent" />
		</div>
	</div>

	<div class="postings-section">
		<div class="postings-header">
			<h3>Postings</h3>
			<button type="button" class="add-posting-btn" on:click={addPosting}>+ Add Posting</button>
		</div>
		{#if postingsError}<span class="error-msg">{postingsError}</span>{/if}
		<datalist id="accounts-list">
			{#each accounts as acc}<option value={acc} />{/each}
		</datalist>
		<datalist id="currencies-list">
			{#each currencies as c}<option value={c} />{/each}
		</datalist>
		{#each postings as posting, index (index)}
			<PostingRow
				{posting}
				{index}
				totalPostings={postings.length}
				date={startDate}
				operatingCurrency={defaultCurrency}
				showCost={showCost[index]}
				showPrice={showPrice[index]}
				showPostingFlag={showPostingFlag[index]}
				showPostingComment={showPostingComment[index]}
				showPostingMetadata={showPostingMetadata[index]}
				onToggleCost={toggleCost}
				onTogglePrice={togglePrice}
				onToggleFlag={togglePostingFlag}
				onToggleComment={togglePostingComment}
				onToggleMetadata={togglePostingMetadata}
				onRemovePosting={removePosting}
				onAddMetadata={addPostingMetadata}
				onRemoveMetadata={removePostingMetadata}
				onUpdateMetadataKey={updatePostingMetadataKey}
			/>
		{/each}
	</div>

	<div class="txn-metadata-section">
		<button
			type="button"
			class="txn-metadata-toggle"
			class:active={showTransactionMetadata}
			on:click={() => (showTransactionMetadata = !showTransactionMetadata)}
			aria-expanded={showTransactionMetadata}
		>📋 Transaction metadata</button>
		{#if showTransactionMetadata}
			<div class="metadata-list">
				{#each Object.keys(transactionMetadata) as key (key)}
					<div class="metadata-item">
						<input
							type="text"
							value={key}
							placeholder="key"
							class="metadata-key"
							on:change={(e) => updateTransactionMetadataKey(key, e.currentTarget.value)}
						/>
						<input
							type="text"
							bind:value={transactionMetadata[key]}
							placeholder="value"
							class="metadata-value"
						/>
						<button
							type="button"
							class="remove-metadata"
							on:click={() => removeTransactionMetadata(key)}
							aria-label="Remove {key}"
						>&times;</button>
					</div>
				{/each}
				<button type="button" class="add-metadata-btn" on:click={addTransactionMetadata}>+ Add Metadata</button>
			</div>
		{/if}
	</div>
	{#if metadataError}<span class="error-msg">{metadataError}</span>{/if}

	<div class="tags-links-wrapper">
		<TagLinkInput bind:selectedTags bind:selectedLinks tags={[]} />
	</div>

	<div class="modal-footer">
		<button class="cancel-btn" on:click={handleCancel}>Cancel</button>
		<button class="save-btn" on:click={handleSave}>{editingSchedule ? 'Save Changes' : 'Save Schedule'}</button>
	</div>
</div>

<style>
	.schedule-modal {
		padding: var(--size-4-6) var(--size-4-6) var(--size-4-5);
		max-height: 82vh;
		overflow-y: auto;
	}

	.schedule-modal h2 {
		margin: 0 0 var(--size-4-6);
		font-size: var(--font-ui-larger);
		color: var(--text-normal);
	}

	.form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--size-4-4) var(--size-4-5);
		margin-bottom: var(--size-4-5);
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.form-group.full-width {
		grid-column: 1 / -1;
	}

	label {
		font-size: var(--font-ui-small);
		color: var(--text-muted);
	}

	.required { color: var(--text-error); }

	input[type='text'],
	input[type='date'],
	select {
		padding: var(--size-4-2) var(--size-4-3);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		background: var(--background-primary);
		color: var(--text-normal);
		font-size: var(--font-ui-small);
		width: 100%;
		box-sizing: border-box;
		min-height: 36px;
	}

	input.error { border-color: var(--text-error); }

	.field-hint {
		color: var(--text-faint);
		font-size: var(--font-ui-smaller);
	}

	.error-msg {
		color: var(--text-error);
		font-size: var(--font-ui-smaller);
	}

	.postings-section {
		margin-top: var(--size-4-5);
		padding-top: var(--size-4-5);
		border-top: 1px solid var(--background-modifier-border);
	}

	.postings-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--size-4-3);
	}

	.postings-header h3 {
		margin: 0;
		font-size: var(--font-ui-medium);
		color: var(--text-normal);
	}

	.add-posting-btn {
		font-size: var(--font-ui-small);
		background: transparent;
		border: 1px dashed var(--background-modifier-border);
		border-radius: var(--radius-s);
		padding: 5px 14px;
		color: var(--text-accent);
		cursor: pointer;
	}

	/* Extra breathing room around the shared PostingRow component's own
	   (scoped-elsewhere) markup, without modifying that shared component. */
	:global(.schedule-modal .posting-container) {
		padding: var(--size-4-4);
		margin-bottom: var(--size-4-3);
	}

	:global(.schedule-modal .posting-row) {
		gap: var(--size-4-3);
	}

	.txn-metadata-section {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-2);
		margin-top: var(--size-4-2);
	}

	.txn-metadata-toggle {
		align-self: flex-start;
		font-size: var(--font-ui-small);
		padding: 4px 12px;
		border-radius: var(--radius-s);
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		color: var(--text-muted);
		cursor: pointer;
	}

	.txn-metadata-toggle.active {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		border-color: var(--interactive-accent);
	}

	.metadata-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: var(--size-4-3);
		background: var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
	}

	.metadata-item {
		display: flex;
		gap: 6px;
		align-items: center;
	}

	.metadata-item input {
		flex: 1;
		min-height: 30px;
	}

	.remove-metadata {
		background: transparent;
		border: none;
		box-shadow: none;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 14px;
	}

	.add-metadata-btn {
		align-self: flex-start;
		font-size: var(--font-ui-smaller);
		background: transparent;
		border: 1px dashed var(--background-modifier-border);
		border-radius: var(--radius-s);
		padding: 2px 8px;
		color: var(--text-accent);
		cursor: pointer;
	}

	.tags-links-wrapper {
		margin-top: var(--size-4-3);
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: var(--size-4-3);
		margin-top: var(--size-4-5);
		padding-top: var(--size-4-4);
		border-top: 1px solid var(--background-modifier-border);
	}

	.cancel-btn {
		padding: var(--size-4-2) var(--size-4-5);
		background: var(--interactive-normal);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		color: var(--text-normal);
		cursor: pointer;
		font-size: var(--font-ui-small);
	}

	.save-btn {
		padding: var(--size-4-2) var(--size-4-5);
		background: var(--interactive-accent);
		border: none;
		border-radius: var(--radius-s);
		color: var(--text-on-accent);
		cursor: pointer;
		font-size: var(--font-ui-small);
	}

	.save-btn:hover { background: var(--interactive-accent-hover); }
</style>
