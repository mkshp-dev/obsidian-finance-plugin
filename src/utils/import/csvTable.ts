// src/utils/import/csvTable.ts
// Finding the transaction table inside a bank's CSV export, which often has
// account details above it and notes or a closing balance below it.

import { parse as parseCsv } from 'csv-parse/sync';
import type { TableBounds } from '../../models/import';
import { isAmountLike, isDateLike, parseAmount } from './values';

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

/** The table under a given header row: every transaction-like row up to the first one that isn't. */
export function tableFromHeader(rows: string[][], headerRow: number): TableBounds {
	let last = headerRow;
	while (last + 1 < rows.length && isDataRow(rows[last + 1])) last++;
	return { headerRow, firstRow: headerRow + 1, lastRow: Math.max(last, headerRow + 1) };
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
		if (!isHeaderRow(rows[h]) || !isDataRow(rows[h + 1])) continue;
		const table = tableFromHeader(rows, h);
		if (!best || table.lastRow - table.headerRow > best.lastRow - best.headerRow) best = table;
	}
	return best;
}

/** The row whose header matches `signature` (see headerSignature()), or -1. */
export function findHeaderRow(rows: string[][], signature: string): number {
	return rows.findIndex((row) => headerSignature(row) === signature);
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

const BALANCE_LABELS = {
	opening: /opening\s*bal|balance\s*b\/?f\b|brought\s*forward|previous\s*bal|beginning\s*bal|starting\s*bal|balance\s+before/i,
	closing: /closing\s*bal|ending\s*bal|balance\s+as\s+(on|of)|available\s*bal|ledger\s*bal|balance\s*c\/?f\b|carried\s*forward/i,
};
const DATE_IN_TEXT = /\d{1,4}[-/.]\d{1,2}[-/.]\d{2,4}/g;
const NUMBER_IN_TEXT = /\(?-?\d[\d,.']*\d\)?-?|\d/g;

/**
 * Looks outside the transaction table for the balance before or after the
 * statement, e.g. Kotak's `"Closing Balance","as on 28/09/2026 INR 9,656.51"`:
 * a row labelled like one, taking its last number that isn't part of a date.
 * The opening balance is looked for above the table first, the closing one
 * below it first. Returns the amount and the row it was found on, or null.
 */
export function detectStatementBalance(
	rows: string[][],
	bounds: TableBounds,
	decimalMark: '.' | ',',
	which: 'opening' | 'closing',
): { amount: string; row: number } | null {
	const above = rows.map((_, i) => i).filter((i) => i < bounds.headerRow).reverse();
	const below = rows.map((_, i) => i).filter((i) => i > bounds.lastRow);
	// "Opening balance as on …" also reads like a closing label, so the closing balance skips opening labels.
	const label = BALANCE_LABELS[which];
	const fits = (c: string) => label.test(c) && (which === 'opening' || !BALANCE_LABELS.opening.test(c));
	for (const i of which === 'opening' ? [...above, ...below] : [...below, ...above]) {
		if (!rows[i].some(fits)) continue;
		const numbers = rows[i].flatMap((c) => c.replace(DATE_IN_TEXT, ' ').match(NUMBER_IN_TEXT) ?? []);
		for (const n of numbers.reverse()) {
			const amount = parseAmount(n, decimalMark);
			if (amount !== null) return { amount, row: i };
		}
	}
	return null;
}
