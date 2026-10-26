<script lang="ts">
	import type { ColumnType, DateOrder, TableBounds } from '../../../models/import';
	import { columnCheck } from '../../../utils/import/columns';
	import { detectDateOrder, parseAmount } from '../../../utils/import/values';
	import BalanceField from './BalanceField.svelte';
	import HelpTip from '../../common/HelpTip.svelte';

	export let rows: string[][] = [];
	/** False when the table wasn't found and its rows have to be marked by hand. */
	export let tableFound = true;
	export let bounds: TableBounds;
	export let labels: string[] = [];
	export let dataRows: string[][] = [];
	export let columnTypes: ColumnType[] = [];
	export let decimalMark: '.' | ',' = '.';
	/** Open accounts, offered for the statement account. */
	export let accounts: string[] = [];
	/** The account this statement belongs to; '' when the file has several. */
	export let statementAccount = '';
	/** The balances before and after the statement, optional. */
	export let openingBalance = '';
	export let closingBalance = '';
	/** The rows they were found on in the file, or null if typed in or not found. */
	export let openingRow: number | null = null;
	export let closingRow: number | null = null;
	export let onEditOpening: () => void = () => {};
	export let onEditClosing: () => void = () => {};
	export let onBack: () => void;
	export let onNext: () => void;

	const KIND_LABELS: Record<ColumnType['kind'], string> = {
		date: 'Date',
		datetime: 'Date & time',
		number: 'Number',
		text: 'Text',
		ignore: 'Ignore',
	};
	const ORDER_LABELS: Record<DateOrder, string> = { DMY: 'Day-Month-Year', MDY: 'Month-Day-Year', YMD: 'Year-Month-Day' };
	const SAMPLE_COUNT = 2;
	let selected: number | null = null;

	$: width = Math.max(1, ...rows.map((r) => r.length));
	$: count = bounds.lastRow - bounds.firstRow + 1;

	function setHeader(i: number) {
		bounds = { headerRow: i, firstRow: i + 1, lastRow: Math.max(bounds.lastRow, i + 1) };
		selected = null;
	}

	function setLast(i: number) {
		bounds = { ...bounds, lastRow: i };
		selected = null;
	}

	function rowKind(i: number, b: TableBounds): string {
		if (i === b.headerRow) return 'is-header';
		return i >= b.firstRow && i <= b.lastRow ? 'is-data' : 'is-outside';
	}

	function columnValues(column: number, data: string[][] = dataRows): string[] {
		return data.map((r) => r[column] ?? '').filter(Boolean);
	}

	function setKind(column: number, kind: ColumnType['kind']) {
		const current = columnTypes[column];
		columnTypes[column] = kind === 'date' || kind === 'datetime'
			? { kind, order: current && 'order' in current ? current.order : detectDateOrder(columnValues(column)).order ?? 'DMY' }
			: { kind };
		columnTypes = columnTypes;
	}

	function setOrder(column: number, order: DateOrder) {
		const current = columnTypes[column];
		if (current && 'order' in current) columnTypes[column] = { ...current, order };
		columnTypes = columnTypes;
	}

	const TYPE_WORDS: Record<ColumnType['kind'], string> = { date: 'a date', datetime: 'a date', number: 'a number', text: 'text', ignore: '' };

	/** How the column's cells read as its type, for the count; nothing for ignored columns. */
	function checkOf(column: number, type: ColumnType | undefined, mark: '.' | ',', data: string[][]) {
		if (!type || type.kind === 'ignore') return null;
		const check = columnCheck(data, column, type, mark);
		const notes = [
			`${check.readable} of ${data.length} rows read as ${TYPE_WORDS[type.kind]}`,
			check.unreadable.length > 0 ? `${check.unreadable.length} don't, e.g. "${check.unreadable[0]}"` : '',
			check.empty > 0 ? `${check.empty} empty` : '',
		].filter(Boolean);
		return { ...check, total: data.length, title: notes.join('; ') };
	}

	function otherOrders(column: number, type: ColumnType | undefined, data: string[][]): DateOrder[] {
		if (!type || !('order' in type)) return [];
		return detectDateOrder(columnValues(column, data)).candidates.filter((o) => o !== type.order);
	}

	function unreadable(text: string, mark: '.' | ','): boolean {
		return !!text.trim() && parseAmount(text, mark) === null && parseAmount(text, '.') === null;
	}
	// Balances belong to one account, so they only count when one is chosen.
	$: openingUnreadable = !!statementAccount.trim() && unreadable(openingBalance, decimalMark);
	$: closingUnreadable = !!statementAccount.trim() && unreadable(closingBalance, decimalMark);
	$: accountMissing = !!statementAccount.trim() && accounts.length > 0 && !accounts.includes(statementAccount.trim());

	$: hasDate = columnTypes.some((t) => t.kind === 'date' || t.kind === 'datetime');
	$: hasNumber = columnTypes.some((t) => t.kind === 'number');
</script>

<div class="import-step">
	<details class="import-collapsible" open>
		<summary>
			<span class="summary-title">Table rows <span class="help-in-summary" on:click|preventDefault role="presentation"><HelpTip topic="importTable" /></span></span>
			<span class="import-hint">
				Header row {bounds.headerRow + 1} · last row {bounds.lastRow + 1} · {count} transaction{count === 1 ? '' : 's'}
			</span>
		</summary>
		{#if !tableFound}
			<div class="import-banner is-warning">Couldn't find the transactions in this file. Click the header row and the last transaction row to mark them.</div>
		{/if}
		<div class="import-table-wrap">
			<table class="import-raw-table">
				<tbody>
					{#each rows as row, i}
						<tr class={rowKind(i, bounds)} class:is-selected={selected === i} on:click={() => (selected = selected === i ? null : i)}>
							<td class="row-number">{i + 1}</td>
							{#each Array(width) as _, c}
								<td title={row[c] ?? ''}>{row[c] ?? ''}</td>
							{/each}
						</tr>
						{#if selected === i}
							<tr class="row-actions">
								<td colspan={width + 1}>
									<button type="button" on:click={() => setHeader(i)} disabled={i >= rows.length - 1}>Set as header row</button>
									<button type="button" on:click={() => setLast(i)} disabled={i <= bounds.headerRow}>Set as last row</button>
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>
	</details>

	<details class="import-collapsible" open>
		<summary>
			<span class="summary-title">Column types <span class="help-in-summary" on:click|preventDefault role="presentation"><HelpTip topic="importColumns" /></span></span>
			<span class="import-hint">{labels.length} columns · numbers like {decimalMark === '.' ? '1,234.56' : '1.234,56'}</span>
		</summary>

		<div class="import-row tight">
			<span class="import-field-label">Numbers are written like</span>
			<label class="radio"><input type="radio" bind:group={decimalMark} value="." /> 1,234.56</label>
			<label class="radio"><input type="radio" bind:group={decimalMark} value="," /> 1.234,56</label>
		</div>

		<div class="import-table-wrap">
			<table class="types-table">
				<thead>
					<tr><th>Column</th><th>Example</th><th>Type</th><th>Fits</th></tr>
				</thead>
				<tbody>
					{#each labels as label, c}
						{@const type = columnTypes[c]}
						{@const check = checkOf(c, type, decimalMark, dataRows)}
						{@const others = otherOrders(c, type, dataRows)}
						{@const values = columnValues(c, dataRows)}
						<tr class:is-ignored={type?.kind === 'ignore'}>
							<td class="column-name">{label}</td>
							<td class="samples" title={values.slice(0, 5).join('\n')}>
								{values.slice(0, SAMPLE_COUNT).join(' · ') || '(empty)'}
							</td>
							<td>
								<div class="import-row tight">
									<select class="dropdown" value={type?.kind ?? 'text'} aria-label="Type of {label}"
										on:change={(e) => setKind(c, e.currentTarget.value)}>
										{#each Object.entries(KIND_LABELS) as [kind, text]}<option value={kind}>{text}</option>{/each}
									</select>
									{#if type && 'order' in type}
										<select class="dropdown" value={type.order} aria-label="Date format of {label}"
											on:change={(e) => setOrder(c, e.currentTarget.value)}>
											{#each Object.entries(ORDER_LABELS) as [order, text]}<option value={order}>{text}</option>{/each}
										</select>
									{/if}
								</div>
							</td>
							<td class="check">
								{#if check}
									<span class="type-count" class:is-full={check.readable === check.total} title={check.title}>{check.readable}/{check.total}</span>
								{/if}
								{#if others.length > 0}
									<span class="is-warn">Also reads as {others.map((o) => ORDER_LABELS[o]).join(', ')}: check the format</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</details>

	<h4 class="balances-title">This statement <HelpTip topic="importStatement" /></h4>
	<div class="import-row statement-balances">
		<div class="import-field statement-account">
			<label for="import-account">Statement account <span class="import-hint">(optional)</span></label>
			<input id="import-account" type="text" list="import-table-accounts" placeholder="Assets:Bank:Checking" bind:value={statementAccount} />
			<datalist id="import-table-accounts">
				{#each accounts as a}<option value={a} />{/each}
			</datalist>
			{#if accountMissing}<span class="import-hint is-warn">Not an open account yet.</span>{/if}
		</div>
		{#if statementAccount.trim()}
		<BalanceField id="import-opening" label="Balance before statement" bind:value={openingBalance} bind:foundRow={openingRow}
			unreadable={openingUnreadable} onEdit={onEditOpening} />
		<BalanceField id="import-closing" label="Balance after statement" bind:value={closingBalance} bind:foundRow={closingRow}
			unreadable={closingUnreadable} onEdit={onEditClosing} />
		{/if}
	</div>

	{#if !hasDate || !hasNumber}
		<div class="import-banner is-warning">Mark at least one date column and one number column to continue.</div>
	{/if}

	<div class="import-footer">
		<button type="button" on:click={onBack}>Back</button>
		<button type="button" class="mod-cta" disabled={count < 1 || !hasDate || !hasNumber || openingUnreadable || closingUnreadable} on:click={onNext}>Next</button>
	</div>
</div>

<style>
	.import-collapsible {
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		padding: var(--size-4-2) var(--size-4-3);
	}

	.import-collapsible > summary {
		display: flex;
		align-items: baseline;
		gap: var(--size-4-3);
		cursor: pointer;
		list-style: none;
	}

	.import-collapsible > summary::before {
		content: '▸';
		color: var(--text-muted);
		transition: transform 0.15s;
	}

	.import-collapsible[open] > summary::before {
		transform: rotate(90deg);
	}

	.import-collapsible[open] > summary {
		margin-bottom: var(--size-4-2);
	}

	.summary-title {
		font-weight: 600;
	}

	.import-collapsible .import-table-wrap {
		max-height: 35vh;
	}

	.import-raw-table td {
		max-width: 180px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		padding: 2px var(--size-4-2);
		font-size: var(--font-ui-smaller);
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.import-raw-table tr {
		cursor: pointer;
	}

	.import-raw-table tr:hover td {
		background: var(--background-modifier-hover);
	}

	.row-number {
		color: var(--text-faint);
		text-align: right;
	}

	.is-header td {
		font-weight: 600;
		background: var(--background-secondary-alt);
	}

	.is-data td:not(.row-number) {
		color: var(--text-normal);
	}

	.is-outside td {
		color: var(--text-faint);
	}

	.is-selected td {
		outline: 1px solid var(--interactive-accent);
		outline-offset: -1px;
	}

	.row-actions td {
		max-width: none;
		padding: var(--size-4-1) var(--size-4-2);
		background: var(--background-secondary);
		cursor: default;
	}

	.row-actions button {
		margin-right: var(--size-4-2);
	}

	.balances-title {
		margin: 0;
		font-size: var(--font-ui-small);
		color: var(--text-muted);
	}

	.statement-account {
		flex: 1;
		min-width: 220px;
	}

	.statement-balances {
		gap: var(--size-4-4);
	}

	.import-field-label {
		font-size: var(--font-ui-small);
		color: var(--text-muted);
	}

	.radio {
		display: flex;
		align-items: center;
		gap: var(--size-4-1);
		font-size: var(--font-ui-small);
	}

	.types-table {
		font-size: var(--font-ui-small);
	}

	.types-table th {
		text-align: left;
		font-weight: 600;
		color: var(--text-muted);
		position: sticky;
		top: 0;
		background: var(--background-primary);
	}

	.types-table td, .types-table th {
		padding: var(--size-4-1) var(--size-4-2);
		border-bottom: 1px solid var(--background-modifier-border);
		vertical-align: middle;
	}

	.column-name {
		font-weight: 600;
		white-space: nowrap;
	}

	.samples {
		max-width: 260px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--text-muted);
		font-family: var(--font-monospace);
		font-size: var(--font-ui-smaller);
	}

	.is-ignored .column-name, .is-ignored .samples {
		color: var(--text-faint);
		text-decoration: line-through;
	}

	.check {
		font-size: var(--font-ui-smaller);
	}

	.type-count {
		padding: 0 6px;
		margin-right: var(--size-4-1);
		border-radius: var(--radius-s);
		font-variant-numeric: tabular-nums;
		background: rgba(var(--color-yellow-rgb), 0.15);
		color: var(--color-yellow);
	}

	.type-count.is-full {
		background: rgba(var(--color-green-rgb), 0.15);
		color: var(--color-green);
	}

	.is-warn {
		color: var(--color-orange);
	}

</style>
