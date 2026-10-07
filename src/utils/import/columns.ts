// src/utils/import/columns.ts
// What each statement column holds (date, number, text…), guessed for the
// user to confirm in the Table step, and reading numbers with their sign.

import type { ColumnType, NumberSign } from '../../models/import';
import { detectDateOrder, isAmountLike, negateAmount, parseAmount, parseDate } from './values';

const TIME = /\d{1,2}:\d{2}/;
const DEBIT_WORDS = ['DR', 'D', 'DEBIT', 'WITHDRAWAL'];
const CREDIT_WORDS = ['CR', 'C', 'CREDIT', 'DEPOSIT'];

function columnValues(rows: string[][], column: number): string[] {
	return rows.map((r) => (r[column] ?? '').trim()).filter(Boolean);
}

/** Debit/credit words used by an indicator column like Kotak's "Dr / Cr", or null if it isn't one. */
export function indicatorValues(rows: string[][], column: number): { debitValue: string; creditValue: string } | null {
	const values = columnValues(rows, column).map((v) => v.toUpperCase());
	if (values.length === 0 || !values.every((v) => DEBIT_WORDS.includes(v) || CREDIT_WORDS.includes(v))) return null;
	return {
		debitValue: DEBIT_WORDS.find((w) => values.includes(w)) ?? 'DR',
		creditValue: CREDIT_WORDS.find((w) => values.includes(w)) ?? 'CR',
	};
}

/**
 * Best guess for each of `width` columns from the table rows. A number
 * column followed by a debit/credit column takes its sign from it; one
 * labelled like "Withdrawal" or "Debit" counts as money out.
 */
export function detectColumnTypes(rows: string[][], width: number, labels: string[] = []): ColumnType[] {
	return Array.from({ length: width }, (_, i): ColumnType => {
		const values = columnValues(rows, i);
		if (values.length === 0) return { kind: 'ignore' };

		const order = detectDateOrder(values).order;
		if (order) return { kind: values.some((v) => TIME.test(v)) ? 'datetime' : 'date', order };
		if (!values.every(isAmountLike)) return { kind: 'text' };

		const indicator = indicatorValues(rows, i + 1);
		const sign: NumberSign = indicator ? { mode: 'indicator', column: i + 1, ...indicator }
			: /debit|withdraw|paid out|money out/i.test(labels[i] ?? '') ? { mode: 'negate' }
			: { mode: 'asis' };
		return { kind: 'number', sign };
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

/** Reads a number cell with its column's sign rule; positive means money in. */
export function readNumber(cells: string[], column: number, type: ColumnType | undefined, decimalMark: '.' | ','): { amount: string } | { error: string } {
	const raw = cells[column] ?? '';
	if (!raw.trim()) return { error: 'empty number' };
	const amount = parseAmount(raw, decimalMark);
	if (amount === null) return { error: `can't read the number "${raw}"` };

	const sign = type?.kind === 'number' ? type.sign : undefined;
	if (!sign || sign.mode === 'asis') return { amount };
	if (sign.mode === 'negate') return { amount: negateAmount(amount) };

	const marker = (cells[sign.column] ?? '').trim().toUpperCase();
	if (marker === sign.debitValue.toUpperCase()) return { amount: negateAmount(amount) };
	if (marker === sign.creditValue.toUpperCase()) return { amount };
	return { error: `expected "${sign.debitValue}" or "${sign.creditValue}" for the sign, found "${cells[sign.column] ?? ''}"` };
}

/** Values in a column that don't read as its type, for the Table step to point at. */
export function unreadableValues(rows: string[][], column: number, type: ColumnType, decimalMark: '.' | ','): string[] {
	if (type.kind === 'date' || type.kind === 'datetime') {
		return columnValues(rows, column).filter((v) => parseDate(v, type.order) === null);
	}
	if (type.kind === 'number') {
		return rows
			.filter((r) => (r[column] ?? '').trim() && 'error' in readNumber(r, column, type, decimalMark))
			.map((r) => r[column]);
	}
	return [];
}

/** True for columns whose type makes them a choice for `want`. */
export function columnFits(type: ColumnType | undefined, want: 'date' | 'number' | 'any'): boolean {
	if (!type) return true;
	if (type.kind === 'ignore') return false;
	if (want === 'date') return type.kind === 'date' || type.kind === 'datetime';
	if (want === 'number') return type.kind === 'number';
	return true;
}
