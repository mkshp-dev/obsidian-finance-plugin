// src/utils/import/csvTable.ts
// Finding the transaction table inside a bank's CSV export, which often has
// account details above it and notes or a closing balance below it.

import { parse as parseCsv } from 'csv-parse/sync';
import type { TableBounds } from '../../models/import';
import { isAmountLike, isDateLike, parseAmount } from './values';

/** Field separators a statement may use: `;` is common where `,` is the decimal mark. */
export const DELIMITERS = [',', ';', '\t', '|'] as const;
export type Delimiter = (typeof DELIMITERS)[number];

/**
 * Decodes a file's bytes: by its byte order mark when it has one, else as
 * UTF-16 when every other byte is zero, else as UTF-8, falling back to
 * Windows-1252 (what Excel and many banks write) when it isn't valid UTF-8.
 */
export function decodeText(bytes: Uint8Array): string {
	if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
	if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes);
	const sample = bytes.subarray(0, 512);
	const zeros = (offset: number) => sample.filter((b, i) => i % 2 === offset && b === 0).length;
	if (sample.length >= 4) {
		const half = Math.floor(sample.length / 2);
		if (zeros(1) >= half * 0.9) return new TextDecoder('utf-16le').decode(bytes);
		if (zeros(0) >= half * 0.9) return new TextDecoder('utf-16be').decode(bytes);
	}
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		return new TextDecoder('windows-1252').decode(bytes);
	}
}

function parseRows(text: string, delimiter: Delimiter): string[][] {
	const rows: string[][] = parseCsv(text, {
		bom: true,
		delimiter,
		columns: false,
		skip_empty_lines: true,
		relax_column_count: true,
		relax_quotes: true,
	});
	return rows
		.map((row) => row.map((cell) => cell.trim()))
		.filter((row) => row.some(Boolean));
}

/**
 * Guesses the field separator: the one that splits the most rows into the
 * same number of cells, weighted by that number, so "1,50" in a `;` file
 * doesn't make it look comma-separated. Comma wins ties.
 */
export function detectDelimiter(text: string): Delimiter {
	let best: Delimiter = ',';
	let bestScore = 0;
	for (const d of DELIMITERS) {
		let rows: string[][];
		try {
			rows = parseRows(text, d);
		} catch {
			continue; // Quotes that don't fit this separator.
		}
		const widths = new Map<number, number>();
		for (const row of rows) if (row.length > 1) widths.set(row.length, (widths.get(row.length) ?? 0) + 1);
		const score = Math.max(0, ...[...widths].map(([width, count]) => width * count));
		if (score > bestScore) {
			best = d;
			bestScore = score;
		}
	}
	return best;
}

/** Parses CSV text into trimmed rows, dropping blank lines. Rows may differ in length. */
export function readCsvRows(text: string, delimiter: Delimiter = detectDelimiter(text)): string[][] {
	return parseRows(text, delimiter);
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
 * A table with no header row: the longest run of transaction-like rows,
 * the first one wins a tie. Returns null if no row looks like a transaction.
 */
export function detectHeaderlessTable(rows: string[][]): TableBounds | null {
	let best: TableBounds | null = null;
	for (let first = 0; first < rows.length; first++) {
		if (!isDataRow(rows[first]) || (first > 0 && isDataRow(rows[first - 1]))) continue;
		let last = first;
		while (last + 1 < rows.length && isDataRow(rows[last + 1])) last++;
		if (!best || last - first > best.lastRow - best.firstRow) best = { headerRow: null, firstRow: first, lastRow: last };
	}
	return best;
}

/**
 * Suggests where the table is: the header row followed by the longest run
 * of transaction-like rows. The run ends at the first row that isn't one
 * (e.g. Kotak's "Closing Balance" line). Without a header row, it's the
 * longest run of transaction-like rows on its own (see
 * detectHeaderlessTable). Returns null if nothing looks like a table.
 */
export function detectTable(rows: string[][]): TableBounds | null {
	let best: TableBounds | null = null;

	for (let h = 0; h < rows.length - 1; h++) {
		if (!isHeaderRow(rows[h]) || !isDataRow(rows[h + 1])) continue;
		const table = tableFromHeader(rows, h);
		if (!best || table.lastRow - table.firstRow > best.lastRow - best.firstRow) best = table;
	}
	return best ?? detectHeaderlessTable(rows);
}

/** How many columns a table's rows have: its header's, or without one, its widest row's. */
export function tableWidth(rows: string[][], bounds: TableBounds): number {
	if (bounds.headerRow !== null) return rows[bounds.headerRow]?.length ?? 0;
	return Math.max(0, ...rows.slice(bounds.firstRow, bounds.lastRow + 1).map((r) => r.length));
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
	const top = bounds.headerRow ?? bounds.firstRow;
	const above = rows.map((_, i) => i).filter((i) => i < top).reverse();
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
