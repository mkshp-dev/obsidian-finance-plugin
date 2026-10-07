<script lang="ts">
	import type { ColumnType, DateOrder, NumberSign, TableBounds } from '../../../models/import';
	import { indicatorValues, readNumber, unreadableValues } from '../../../utils/import/columns';
	import { detectDateOrder } from '../../../utils/import/values';

	export let rows: string[][] = [];
	export let bounds: TableBounds;
	export let labels: string[] = [];
	export let dataRows: string[][] = [];
	export let columnTypes: ColumnType[] = [];
	export let decimalMark: '.' | ',' = '.';
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
	const SIGN_LABELS: Record<NumberSign['mode'], string> = {
		asis: 'Sign as written',
		negate: 'Flip sign (+ is money out)',
		indicator: 'Sign from column',
	};

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
			: kind === 'number' ? { kind, sign: { mode: 'asis' } }
			: { kind };
		columnTypes = columnTypes;
	}

	function signOf(type: ColumnType | undefined): NumberSign {
		return type?.kind === 'number' && type.sign ? type.sign : { mode: 'asis' };
	}

	function setSign(column: number, sign: NumberSign) {
		columnTypes[column] = { kind: 'number', sign };
		columnTypes = columnTypes;
	}

	function setSignMode(column: number, mode: NumberSign['mode']) {
		if (mode !== 'indicator') return setSign(column, { mode });
		// Default to the nearest column that looks like a debit/credit marker.
		const marker = labels.map((_, i) => i).filter((i) => i !== column)
			.sort((a, b) => Math.abs(a - column) - Math.abs(b - column))
			.find((i) => indicatorValues(dataRows, i)) ?? Math.min(column + 1, labels.length - 1);
		setSign(column, { mode, column: marker, ...(indicatorValues(dataRows, marker) ?? { debitValue: 'DR', creditValue: 'CR' }) });
	}

	function updateSign(column: number, change: Partial<{ column: number; debitValue: string; creditValue: string }>) {
		const sign = signOf(columnTypes[column]);
		if (sign.mode === 'indicator') setSign(column, { ...sign, ...change });
	}

	/** The first value read with the column's sign, to show the rule works. */
	function signedExample(column: number, type: ColumnType | undefined, mark: '.' | ',', data: string[][]): string {
		for (const row of data) {
			if (!(row[column] ?? '').trim()) continue;
			const n = readNumber(row, column, type, mark);
			return 'amount' in n ? n.amount : '';
		}
		return '';
	}

	function setOrder(column: number, order: DateOrder) {
		const current = columnTypes[column];
		if (current && 'order' in current) columnTypes[column] = { ...current, order };
		columnTypes = columnTypes;
	}

	function problemsOf(column: number, type: ColumnType | undefined, mark: '.' | ',', data: string[][]): string[] {
		return type ? unreadableValues(data, column, type, mark) : [];
	}

	function otherOrders(column: number, type: ColumnType | undefined, data: string[][]): DateOrder[] {
		if (!type || !('order' in type)) return [];
		return detectDateOrder(columnValues(column, data)).candidates.filter((o) => o !== type.order);
	}

	$: hasDate = columnTypes.some((t) => t.kind === 'date' || t.kind === 'datetime');
	$: hasNumber = columnTypes.some((t) => t.kind === 'number');
</script>

<div class="import-step">
	<details class="import-collapsible" open>
		<summary>
			<span class="summary-title">Table rows</span>
			<span class="import-hint">
				Header row {bounds.headerRow + 1} · last row {bounds.lastRow + 1} · {count} transaction{count === 1 ? '' : 's'}
			</span>
		</summary>
		<p class="import-hint">
			Rows outside the table, like account details or the closing balance line, are greyed out.
			Click a row to change the header or last row.
		</p>
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
			<span class="summary-title">Column types</span>
			<span class="import-hint">{labels.length} columns · numbers like {decimalMark === '.' ? '1,234.56' : '1.234,56'}</span>
		</summary>
		<p class="import-hint">
			What each column holds. These are best guesses; change any that are wrong. Ignored columns aren't offered in the mapping.
		</p>

		<div class="import-row tight">
			<span class="import-field-label">Numbers are written like</span>
			<label class="radio"><input type="radio" bind:group={decimalMark} value="." /> 1,234.56</label>
			<label class="radio"><input type="radio" bind:group={decimalMark} value="," /> 1.234,56</label>
		</div>

		<div class="import-table-wrap">
			<table class="types-table">
				<thead>
					<tr><th>Column</th><th>Example</th><th>Type</th><th></th></tr>
				</thead>
				<tbody>
					{#each labels as label, c}
						{@const type = columnTypes[c]}
						{@const problems = problemsOf(c, type, decimalMark, dataRows)}
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
									{:else if type?.kind === 'number'}
										{@const sign = signOf(type)}
										<select class="dropdown" value={sign.mode} aria-label="Sign of {label}"
											on:change={(e) => setSignMode(c, e.currentTarget.value)}>
											{#each Object.entries(SIGN_LABELS) as [mode, text]}<option value={mode}>{text}</option>{/each}
										</select>
										{#if sign.mode === 'indicator'}
											<select class="dropdown" value={sign.column} aria-label="Sign column of {label}"
												on:change={(e) => updateSign(c, { column: Number(e.currentTarget.value) })}>
												{#each labels as other, i}{#if i !== c && columnTypes[i]?.kind !== 'ignore'}<option value={i}>{other}</option>{/if}{/each}
											</select>
											<span class="import-hint">−</span>
											<input type="text" class="marker-input" value={sign.debitValue} aria-label="Money out marker for {label}"
												on:input={(e) => updateSign(c, { debitValue: e.currentTarget.value })} />
											<span class="import-hint">+</span>
											<input type="text" class="marker-input" value={sign.creditValue} aria-label="Money in marker for {label}"
												on:input={(e) => updateSign(c, { creditValue: e.currentTarget.value })} />
										{/if}
									{/if}
								</div>
							</td>
							<td class="check">
								{#if problems.length > 0}
									<span class="is-bad" title={problems.slice(0, 5).join('\n')}>✗ {problems.length} can't be read, e.g. "{problems[0]}"</span>
								{:else if others.length > 0}
									<span class="is-warn">Also reads as {others.map((o) => ORDER_LABELS[o]).join(', ')}: check the format</span>
								{:else if type?.kind === 'number'}
									<span class="is-ok">✓ e.g. {signedExample(c, type, decimalMark, dataRows)}</span>
								{:else if type && type.kind !== 'text' && type.kind !== 'ignore'}
									<span class="is-ok">✓</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</details>

	{#if !hasDate || !hasNumber}
		<div class="import-banner is-warning">Mark at least one date column and one number column to continue.</div>
	{/if}

	<div class="import-footer">
		<button type="button" on:click={onBack}>Back</button>
		<button type="button" class="mod-cta" disabled={count < 1 || !hasDate || !hasNumber} on:click={onNext}>Next</button>
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

	.marker-input {
		width: 3.5em;
	}

	.check {
		font-size: var(--font-ui-smaller);
	}

	.is-ok {
		color: var(--text-success);
	}

	.is-warn {
		color: var(--color-orange);
	}

	.is-bad {
		color: var(--text-error);
	}
</style>
