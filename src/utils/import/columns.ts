// src/utils/import/columns.ts
// What each statement column holds (date, number, text…), guessed for the
// user to confirm in the Table step. Values are only read, never changed.

import type { ColumnType } from '../../models/import';
import { detectDateOrder, isAmountLike, parseAmount, parseDate } from './values';

const TIME = /\d{1,2}:\d{2}/;

function columnValues(rows: string[][], column: number): string[] {
	return rows.map((r) => (r[column] ?? '').trim()).filter(Boolean);
}

/** Best guess for each of `width` columns from the table rows. */
export function detectColumnTypes(rows: string[][], width: number): ColumnType[] {
	return Array.from({ length: width }, (_, i): ColumnType => {
		const values = columnValues(rows, i);
		if (values.length === 0) return { kind: 'ignore' };

		const order = detectDateOrder(values).order;
		if (order) return { kind: values.some((v) => TIME.test(v)) ? 'datetime' : 'date', order };
		return values.every(isAmountLike) ? { kind: 'number' } : { kind: 'text' };
	});
}

/**
 * Guesses the decimal mark from the number columns: `,` when values end in
 * a comma and two digits (`1.234,56`) and none end in a dot and two digits.
 */
export function detectDecimalMark(rows: string[][], types: ColumnType[]): '.' | ',' {
	const values = types.flatMap((t, i) => (t.kind === 'number' ? columnValues(rows, i) : []));
	const comma = values.some((v) => /,\d{1,2}\)?-?$/.test(v));
	const dot = values.some((v) => /\.\d{1,2}\)?-?$/.test(v));
	return comma && !dot ? ',' : '.';
}

/** Reads a number cell as written, e.g. "1,00,000.00" → "100000.00". */
export function readNumber(raw: string, decimalMark: '.' | ','): { amount: string } | { error: string } {
	if (!raw.trim()) return { error: 'empty number' };
	const amount = parseAmount(raw, decimalMark);
	return amount === null ? { error: `can't read the number "${raw}"` } : { amount };
}

/** Values in a column that don't read as its type, for the Table step to point at. */
export function unreadableValues(rows: string[][], column: number, type: ColumnType, decimalMark: '.' | ','): string[] {
	if (type.kind === 'date' || type.kind === 'datetime') {
		return columnValues(rows, column).filter((v) => parseDate(v, type.order) === null);
	}
	if (type.kind === 'number') return columnValues(rows, column).filter((v) => parseAmount(v, decimalMark) === null);
	return [];
}

/**
 * How a column's cells read as its type: how many do, which ones don't, and
 * how many are empty. Text reads any filled cell.
 */
export function columnCheck(rows: string[][], column: number, type: ColumnType, decimalMark: '.' | ','): { readable: number; unreadable: string[]; empty: number } {
	const cells = rows.map((r) => (r[column] ?? '').trim());
	const filled = cells.filter(Boolean);
	const unreadable = unreadableValues(rows, column, type, decimalMark);
	return { readable: filled.length - unreadable.length, unreadable, empty: cells.length - filled.length };
}

/** True for columns whose type makes them a choice for `want`. */
export function columnFits(type: ColumnType | undefined, want: 'date' | 'number' | 'any'): boolean {
	if (!type) return true;
	if (type.kind === 'ignore') return false;
	if (want === 'date') return type.kind === 'date' || type.kind === 'datetime';
	if (want === 'number') return type.kind === 'number';
	return true;
}
