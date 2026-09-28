// src/utils/import/values.ts
// Parsing single CSV cells from bank statements: amounts and dates.

import type { DateOrder } from '../../models/import';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// A time after the date: "22-09-2026 11:54:56", "2026-09-22T11:54", "9/22/2026 3:05 PM".
const TIME_SUFFIX = /[T\s]+\d{1,2}:\d{2}(:\d{2}(\.\d+)?)?(\s*[AaPp][Mm])?(\s*(Z|[+-]\d{2}:?\d{2}))?$/;

function parseMonth(part: string): number | null {
	if (/^\d{1,2}$/.test(part)) return Number(part);
	const idx = MONTHS.indexOf(part.slice(0, 3).toLowerCase());
	return /^[A-Za-z]{3,9}$/.test(part) && idx >= 0 ? idx + 1 : null;
}

/** Returns the date as `YYYY-MM-DD`, or null if `value` isn't a valid date in `order`. */
export function parseDate(value: string, order: DateOrder): string | null {
	const parts = value.trim().replace(TIME_SUFFIX, '').split(/[-/.\s,]+/).filter(Boolean);
	if (parts.length !== 3) return null;

	const [yearPart, monthPart, dayPart] =
		order === 'YMD' ? [parts[0], parts[1], parts[2]] :
		order === 'DMY' ? [parts[2], parts[1], parts[0]] :
		[parts[2], parts[0], parts[1]];

	// Year-first needs a 4-digit year, or "01/09/26" would also read as 2001-09-26.
	const yearPattern = order === 'YMD' ? /^\d{4}$/ : /^(\d{2}|\d{4})$/;
	if (!yearPattern.test(yearPart) || !/^\d{1,2}$/.test(dayPart)) return null;
	const month = parseMonth(monthPart);
	if (month === null) return null;
	const year = yearPart.length === 2 ? 2000 + Number(yearPart) : Number(yearPart);
	const day = Number(dayPart);

	const d = new Date(Date.UTC(year, month - 1, day));
	if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
	return d.toISOString().slice(0, 10);
}

const ORDERS: DateOrder[] = ['YMD', 'DMY', 'MDY'];

export function isDateLike(value: string): boolean {
	return ORDERS.some((o) => parseDate(value, o) !== null);
}

/**
 * Finds the date orders that read every non-empty value. `ambiguous` when
 * more than one does (e.g. only days up to 12), so the user should confirm.
 */
export function detectDateOrder(values: string[]): { order: DateOrder | null; candidates: DateOrder[]; ambiguous: boolean } {
	const filled = values.map((v) => v.trim()).filter(Boolean);
	const candidates = filled.length === 0 ? [] : ORDERS.filter((o) => filled.every((v) => parseDate(v, o) !== null));
	return { order: candidates[0] ?? null, candidates, ambiguous: candidates.length > 1 };
}

/**
 * Normalizes an amount cell to a plain signed decimal string, e.g.
 * `"1,00,000.00"` → `"100000.00"`, `"(12.50)"` → `"-12.50"`. Returns null
 * for an empty or unreadable cell.
 */
export function parseAmount(value: string, decimalMark: '.' | ',' = '.'): string | null {
	let s = value.trim();
	if (!s) return null;

	let negative = false;
	if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1).trim(); }
	s = s.replace(/^[A-Z]{3}\s+|\s+[A-Z]{3}$/g, '').replace(/[₹$€£¥]/g, '').trim();
	if (s.startsWith('-')) { negative = !negative; s = s.slice(1); }
	else if (s.startsWith('+')) s = s.slice(1);
	else if (s.endsWith('-')) { negative = !negative; s = s.slice(0, -1); }

	s = decimalMark === '.' ? s.replace(/[,'\s]/g, '') : s.replace(/[.'\s]/g, '').replace(',', '.');
	if (!/^(\d+(\.\d*)?|\.\d+)$/.test(s)) return null;
	if (s.startsWith('.')) s = '0' + s;
	if (s.endsWith('.')) s = s.slice(0, -1);

	return negative && !/^0(\.0*)?$/.test(s) ? `-${s}` : s;
}

export function isAmountLike(value: string): boolean {
	return parseAmount(value, '.') !== null || parseAmount(value, ',') !== null;
}

function decimals(amount: string): number {
	const dot = amount.indexOf('.');
	return dot < 0 ? 0 : amount.length - dot - 1;
}

/** An amount as a whole number of 10^-scale units; exact for anything a statement holds. */
function toUnits(amount: string, scale: number): number {
	const negative = amount.startsWith('-');
	const [whole, frac = ''] = amount.replace('-', '').split('.');
	const units = Number(whole + frac.padEnd(scale, '0'));
	return negative ? -units : units;
}

function fromUnits(units: number, scale: number): string {
	const digits = String(Math.abs(units)).padStart(scale + 1, '0');
	const s = scale === 0 ? digits : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
	return units < 0 ? `-${s}` : s;
}

/** Exact sum of decimal strings, keeping the most decimal places among them. */
export function addAmounts(...amounts: string[]): string {
	const scale = Math.max(0, ...amounts.map(decimals));
	return fromUnits(amounts.reduce((sum, a) => sum + toUnits(a, scale), 0), scale);
}

export function negateAmount(amount: string): string {
	return amount.startsWith('-') ? amount.slice(1) : /^0(\.0*)?$/.test(amount) ? amount : `-${amount}`;
}

export function amountsEqual(a: string, b: string): boolean {
	const scale = Math.max(decimals(a), decimals(b));
	return toUnits(a, scale) === toUnits(b, scale);
}
