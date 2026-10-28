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

// "Mon, 22 Sep 2026" and "22nd Sep 2026".
const WEEKDAY_PREFIX = /^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s+/i;
const ORDINAL_SUFFIX = /(\d)(st|nd|rd|th)\b/gi;

/**
 * Returns the date as `YYYY-MM-DD`, or null if `value` isn't a valid date in
 * `order`. Also reads compact year-first dates like "20260922".
 */
export function parseDate(value: string, order: DateOrder): string | null {
	const text = value.trim().replace(TIME_SUFFIX, '').replace(WEEKDAY_PREFIX, '').replace(ORDINAL_SUFFIX, '$1');
	const compact = /^((?:19|20)\d{2})(\d{2})(\d{2})$/.exec(text);
	const parts = compact && order === 'YMD' ? compact.slice(1) : text.split(/[-/.\s,]+/).filter(Boolean);
	if (parts.length !== 3) return null;

	const at = (letter: 'Y' | 'M' | 'D') => parts[order.indexOf(letter)];
	const [yearPart, monthPart, dayPart] = [at('Y'), at('M'), at('D')];

	// A 2-digit year only when it comes last, or "01/09/26" would also read as 2001-09-26.
	const yearPattern = order.endsWith('Y') ? /^(\d{2}|\d{4})$/ : /^\d{4}$/;
	if (!yearPattern.test(yearPart) || !/^\d{1,2}$/.test(dayPart)) return null;
	const month = parseMonth(monthPart);
	if (month === null) return null;
	const year = yearPart.length === 2 ? 2000 + Number(yearPart) : Number(yearPart);
	const day = Number(dayPart);

	const d = new Date(Date.UTC(year, month - 1, day));
	if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
	return d.toISOString().slice(0, 10);
}

/** Shifts a `YYYY-MM-DD` date by `days` (negative to go back). */
export function addDays(date: string, days: number): string {
	const d = new Date(`${date}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const PATTERN_TOKEN = /YYYY|YY|MMMM|MMM|MM|M|DD|D/g;

/** True for a real date written as Beancount writes them: YYYY-MM-DD. */
export function isIsoDate(text: string): boolean {
	return /^\d{4}-\d{2}-\d{2}$/.test(text) && parseDate(text, 'YMD') === text;
}

/**
 * Writes a `YYYY-MM-DD` date with a pattern: YYYY, YY, MMMM (September),
 * MMM (Sep), MM, M, DD, D; anything else is written as is.
 */
export function formatDatePattern(iso: string, pattern: string): string {
	const [y, m, d] = iso.split('-').map(Number);
	const parts: Record<string, string> = {
		YYYY: String(y), YY: String(y).slice(-2),
		MMMM: MONTH_NAMES[m - 1], MMM: MONTH_NAMES[m - 1].slice(0, 3), MM: String(m).padStart(2, '0'), M: String(m),
		DD: String(d).padStart(2, '0'), D: String(d),
	};
	return pattern.replace(PATTERN_TOKEN, (token) => parts[token]);
}

/** Reads a date written with a pattern (see formatDatePattern) as `YYYY-MM-DD`, or null. Month names ignore case. */
export function parseDatePattern(text: string, pattern: string): string | null {
	const order: string[] = [];
	const source = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(PATTERN_TOKEN, (token) => {
		order.push(token);
		return token === 'YYYY' ? '(\\d{4})' : token === 'MMMM' || token === 'MMM' ? '([A-Za-z]+)' : token.length === 2 ? '(\\d{2})' : '(\\d{1,2})';
	});
	const m = new RegExp(`^\\s*${source}\\s*$`, 'i').exec(text);
	if (!m) return null;
	let year = NaN;
	let month = NaN;
	let day = NaN;
	order.forEach((token, i) => {
		const v = m[i + 1];
		if (token === 'YYYY') year = Number(v);
		else if (token === 'YY') year = 2000 + Number(v);
		else if (token === 'MMMM' || token === 'MMM') month = (parseMonth(v) ?? NaN);
		else if (token.startsWith('M')) month = Number(v);
		else day = Number(v);
	});
	if ([year, month, day].some(Number.isNaN)) return null;
	const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
	return isIsoDate(iso) ? iso : null;
}

/** Whole days from `a` to `b`. */
export function daysBetween(a: string, b: string): number {
	return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

/** Most common first: when several orders read a column, the first one is suggested. */
const ORDERS: DateOrder[] = ['YMD', 'DMY', 'MDY', 'YDM', 'DYM', 'MYD'];

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

	// Thousands separators must sit between digit groups (2 or 3 digits for
	// Indian "1,00,000"), so "1,234.56" isn't read as 1.23456 with a comma mark.
	s = s.replace(/['\s]/g, '');
	const grouped = decimalMark === '.' ? /^(\d+(,\d{2,3})*(\.\d*)?|\.\d+)$/ : /^(\d+(\.\d{3})*(,\d*)?|,\d+)$/;
	if (!grouped.test(s)) return null;
	s = decimalMark === '.' ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.');
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

/** -1, 0 or 1 as `a` is less than, equal to or greater than `b`. */
export function compareAmounts(a: string, b: string): number {
	const scale = Math.max(decimals(a), decimals(b));
	return Math.sign(toUnits(a, scale) - toUnits(b, scale));
}

/** Exact product of two decimal strings. */
export function multiplyAmounts(a: string, b: string): string {
	return fromUnits(toUnits(a, decimals(a)) * toUnits(b, decimals(b)), decimals(a) + decimals(b));
}

/**
 * `a / b` rounded half away from zero to the larger of the inputs' decimal
 * places (at least 2), or null when dividing by zero.
 */
export function divideAmounts(a: string, b: string): string | null {
	if (compareAmounts(b, '0') === 0) return null;
	return roundAmount(String(Number(a) / Number(b)), Math.max(decimals(a), decimals(b), 2));
}

/** Rounds half away from zero to `places` decimals (0 or more). */
export function roundAmount(amount: string, places: number): string {
	const n = Number(amount);
	const factor = 10 ** places;
	const rounded = Math.sign(n) * Math.round(Math.abs(n) * factor + 1e-9) / factor;
	const s = rounded.toFixed(places);
	return /^-0(\.0*)?$/.test(s) ? s.slice(1) : s;
}
