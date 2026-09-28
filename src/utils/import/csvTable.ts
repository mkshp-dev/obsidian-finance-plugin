// src/utils/import/csvTable.ts
// Finding the transaction table inside a bank's CSV export, which often has
// account details above it and notes or a closing balance below it.

import { parse as parseCsv } from 'csv-parse/sync';
import type { TableBounds } from '../../models/import';
import { isAmountLike, isDateLike } from './values';

/** Parses CSV text into trimmed rows, dropping blank lines. Rows may differ in length. */
export function readCsvRows(text: string): string[][] {
	const rows: string[][] = parseCsv(text, {
		bom: true,
		columns: false,
		skip_empty_lines: true,
		relax_column_count: true,
		relax_quotes: true,
	});
	return rows
		.map((row) => row.map((cell) => cell.trim()))
		.filter((row) => row.some(Boolean));
}

function filledCount(row: string[]): number {
	return row.filter(Boolean).length;
}

/** A row that looks like a transaction: at least one date cell and one amount cell. */
function isDataRow(row: string[]): boolean {
	return row.some(isDateLike) && row.some((c) => !isDateLike(c) && isAmountLike(c));
}

function isHeaderRow(row: string[]): boolean {
	return filledCount(row) >= 3 && !row.some((c) => c && (isDateLike(c) || isAmountLike(c)));
}

/**
 * Suggests where the table is: the header row followed by the longest run
 * of transaction-like rows. The run ends at the first row that isn't one
 * (e.g. Kotak's "Closing Balance" line). Returns null if nothing looks like
 * a table.
 */
export function detectTable(rows: string[][]): TableBounds | null {
	let best: TableBounds | null = null;

	for (let h = 0; h < rows.length - 1; h++) {
		if (!isHeaderRow(rows[h])) continue;
		let last = h;
		while (last + 1 < rows.length && isDataRow(rows[last + 1])) last++;
		if (last > h && (!best || last - h > best.lastRow - best.headerRow)) {
			best = { headerRow: h, firstRow: h + 1, lastRow: last };
		}
	}
	return best;
}

/**
 * Display labels for the header's columns, used in `{{…}}` templates.
 * Blank headers become "Column N" and repeated ones get a number, e.g.
 * "Dr / Cr (1)" and "Dr / Cr (2)".
 */
export function columnLabels(header: string[]): string[] {
	const base = header.map((h, i) => h.replace(/\s+/g, ' ').trim() || `Column ${i + 1}`);
	const counts = new Map<string, number>();
	for (const b of base) counts.set(b, (counts.get(b) ?? 0) + 1);

	const seen = new Map<string, number>();
	return base.map((b) => {
		if (counts.get(b) === 1) return b;
		const n = (seen.get(b) ?? 0) + 1;
		seen.set(b, n);
		return `${b} (${n})`;
	});
}

/** Identifies a bank's export format by its header, to find a saved profile for it. */
export function headerSignature(header: string[]): string {
	return header.map((h) => h.replace(/\s+/g, ' ').trim().toLowerCase()).join('|');
}

/**
 * Looks above the table for the statement's currency, e.g. Kotak's
 * `"Currency","INR"` line.
 */
export function detectCurrency(rows: string[][], headerRow: number): string | null {
	for (const row of rows.slice(0, headerRow)) {
		const i = row.findIndex((c) => /^currency$/i.test(c));
		const code = i >= 0 ? row.slice(i + 1).find(Boolean) : undefined;
		if (code && /^[A-Z]{3}$/.test(code)) return code;
	}
	return null;
}
