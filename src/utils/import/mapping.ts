// src/utils/import/mapping.ts
// Turning statement rows into draft transactions using an ImportMapping.

import {
	FILE_NAME_FIELD,
	IMPORT_REF_KEY,
	MAPPING_VERSION,
	type AccountLookupResult,
	type ColumnType,
	type FieldValue,
	type ImportDraft,
	type ImportMapping,
} from '../../models/import';
import type { PostingData } from '../directives/types';
import {
	addAmounts, addDays, compareAmounts, divideAmounts, isIsoDate, multiplyAmounts, negateAmount, parseAmount, parseDate, roundAmount,
} from './values';
import { readNumber } from './columns';
import { createAliasMatcher, type AccountAliases, type AliasMatchMode } from './aliases';
import {
	evaluate, FormulaError, parseExpression, typeOf, valueText,
	type EvalContext, type Expr, type TypeEnv, type Value,
} from './expression';

/** An alias lookup, for building lookup formulas. */
export interface Lookup {
	returns: 'account' | 'alias';
	column: string;
	mode: AliasMatchMode;
	/** Used when no alias matches; none means empty. */
	fallback?: { text: string } | { column: string };
}

export type ParsedField = { text: string } | { expr: Expr } | { error: string };

/** What a field has to produce. */
export type FieldWant = 'text' | 'number' | 'date';

/**
 * Reads a template field: plain text is used as written for every row;
 * text starting with `=` is a formula (see expression.ts).
 */
export function parseField(value: FieldValue): ParsedField {
	const v = value.trim();
	if (!v.startsWith('=')) return { text: v };
	try {
		return { expr: parseExpression(v.slice(1)) };
	} catch (e) {
		if (e instanceof FormulaError) return { error: e.message };
		throw e;
	}
}

/** The column types formulas see, from the Table step. */
export function typeEnv(labels: string[], types: ColumnType[]): TypeEnv {
	return {
		columnType(name) {
			const i = labels.indexOf(name);
			if (i < 0) return name === FILE_NAME_FIELD ? 'text' : null;
			const t = types[i];
			if (t?.kind === 'ignore') throw new FormulaError(`"${name}" is set to Ignore in the Table step`);
			return t?.kind === 'number' ? 'number' : t?.kind === 'date' || t?.kind === 'datetime' ? 'date' : 'text';
		},
	};
}

/** What's wrong with a field where it's used, or '' if nothing. */
export function checkField(value: FieldValue, want: FieldWant, env: TypeEnv): string {
	const f = parseField(value);
	if ('error' in f) return f.error;
	if ('text' in f) return '';
	try {
		const type = typeOf(f.expr, env);
		if (type === want || (want === 'text' && type !== 'bool')) return '';
		if (type === 'bool') return 'This gives true/false. Use IF … THEN … ELSE to choose a value';
		if (f.expr.type === 'lookup') return 'Alias lookups only give text, not dates or numbers';
		if (f.expr.type === 'column') return `"${f.expr.name}" isn't a ${want === 'date' ? 'Date' : 'Number'} column`;
		if (want === 'date' && type === 'text') return ''; // e.g. ="2026-09-01", checked per row
		return `This gives ${type === 'text' ? 'text' : `a ${type}`}, but ${want === 'date' ? 'a date' : 'a number'} is needed here`;
	} catch (e) {
		if (e instanceof FormulaError) return e.message;
		throw e;
	}
}

/** Writes a lookup back as field text. */
export function formatLookup(l: Lookup): string {
	const fallback = !l.fallback ? ''
		: 'column' in l.fallback ? ` ELSE {{${l.fallback.column}}}`
		: ` ELSE "${l.fallback.text.replace(/["\\]/g, '\\$&')}"`;
	return `=${l.returns === 'account' ? 'ACCOUNT' : 'ALIAS'} WHERE {{${l.column}}} ${l.mode === 'exact' ? 'EQUALS' : 'CONTAINS'} ALIAS${fallback}`;
}

/** True when a field is plain text, the same for every row. */
export function isPlainField(value: FieldValue): boolean {
	return 'text' in parseField(value);
}

/** cyrb53: a small, stable, non-cryptographic string hash. */
function hash(text: string): string {
	let h1 = 0xdeadbeef;
	let h2 = 0x41c6ce57;
	for (let i = 0; i < text.length; i++) {
		const ch = text.charCodeAt(i);
		h1 = Math.imul(h1 ^ ch, 2654435761);
		h2 = Math.imul(h2 ^ ch, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * A ref for rows without a bank reference, built from what identifies the
 * transaction rather than the whole row, since serial numbers change
 * between statements. Identical rows get `-2`, `-3`… in file order.
 */
export function generateImportRef(parts: string[], seen: Map<string, number>): string {
	const base = `gen-${hash(parts.join('\u0000'))}`;
	const n = (seen.get(base) ?? 0) + 1;
	seen.set(base, n);
	return n === 1 ? base : `${base}-${n}`;
}

export interface DraftResult {
	/** Drafts oldest first. */
	drafts: ImportDraft[];
}

export interface DraftContext {
	/** Aliases from open directives, for `=ACCOUNT WHERE …` and `=ALIAS WHERE …`. */
	aliases?: AccountAliases[];
	/** The statement file's name, for `={{File name}}`. */
	fileName?: string;
}

/**
 * Beancount's account syntax: colon-separated parts, each starting with a
 * capital letter or digit (the first with a capital) and holding letters,
 * digits and dashes, e.g. `Expenses:Food-2026`.
 */
export function isAccountName(text: string): boolean {
	return /^\p{Lu}[\p{L}\p{N}-]*(:[\p{Lu}\p{N}][\p{L}\p{N}-]*)+$/u.test(text);
}

/** Tags and links can only hold letters, digits and `-_/.`. */
function slug(text: string): string {
	return text.replace(/^[#^]/, '').replace(/[^A-Za-z0-9\-_/.]+/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');
}

/** Converts table rows (without the header) into draft transactions for review. */
export function buildDrafts(rows: string[][], labels: string[], mapping: ImportMapping, ctx: DraftContext = {}): DraftResult {
	const seenRefs = new Map<string, number>();
	const types = mapping.columnTypes;
	const fileName = (ctx.fileName ?? '').split('/').pop()!.replace(/\.[^.]+$/, '');
	const matchers = {
		contains: createAliasMatcher(ctx.aliases ?? [], 'contains'),
		exact: createAliasMatcher(ctx.aliases ?? [], 'exact'),
	};

	// Fields are parsed and type-checked once; rows only evaluate them.
	const env = typeEnv(labels, types);
	const compiled = new Map<string, { text: string } | { expr: Expr } | { error: string }>();
	const compile = (value: FieldValue, want: FieldWant) => {
		const key = `${want}\u0000${value}`;
		let field = compiled.get(key);
		if (!field) {
			const problem = checkField(value, want, env);
			const parsed = parseField(value);
			field = problem ? { error: problem } : 'error' in parsed ? { error: parsed.error } : parsed;
			compiled.set(key, field);
		}
		return field;
	};

	/** A column's value for a row, read with its type; null for an empty cell. */
	const columnValue = (cells: string[], name: string): Value | null => {
		const i = labels.indexOf(name);
		if (i < 0) return name === FILE_NAME_FIELD ? { type: 'text', text: fileName } : null;
		const cell = (cells[i] ?? '').replace(/\s+/g, ' ').trim();
		if (!cell) return null;
		const type = types[i];
		if (type?.kind === 'date' || type?.kind === 'datetime') {
			const iso = parseDate(cell, type.order);
			if (!iso) throw new FormulaError(`can't read the date "${cell}"`);
			return { type: 'date', date: iso, raw: cell };
		}
		if (type?.kind === 'number') {
			const n = readNumber(cell, mapping.decimalMark);
			if ('error' in n) throw new FormulaError(n.error);
			return { type: 'number', amount: n.amount, raw: cell };
		}
		return { type: 'text', text: cell };
	};

	const drafts: (ImportDraft & { date: string })[] = rows.map((cells, sourceIndex) => {
		const errors: string[] = [];
		const lookups: Record<string, boolean> = {};
		const filled: Record<string, boolean> = {};
		let lookupLog: { returns: 'account' | 'alias'; mode: AliasMatchMode; text: string; matched: boolean; alias?: string }[] = [];

		const ctx: EvalContext = {
			column: (name) => columnValue(cells, name),
			lookup: (mode, text) => matchers[mode](text),
			onLookup: (info) => lookupLog.push(info),
			add: (x, y) => addAmounts(x, y),
			subtract: (x, y) => addAmounts(x, negateAmount(y)),
			multiply: multiplyAmounts,
			divide: divideAmounts,
			compare: compareAmounts,
			round: roundAmount,
		};

		/** A field's value for this row; undefined after reporting an error. Records whether it gave anything. */
		const valueOf = (value: FieldValue, want: FieldWant, what: string): Value | null | undefined => {
			lookupLog = [];
			filled[what] = false;
			const field = compile(value, want);
			if ('error' in field) { errors.push(`${what}: ${field.error}`); return undefined; }
			if ('text' in field) {
				filled[what] = field.text !== '';
				return field.text === '' ? null : { type: 'text', text: field.text };
			}
			try {
				const v = evaluate(field.expr, ctx);
				if (lookupLog.length > 0) lookups[what] = lookupLog[lookupLog.length - 1].matched;
				filled[what] = valueText(v).trim() !== '';
				return v;
			} catch (e) {
				if (!(e instanceof FormulaError)) throw e;
				errors.push(`${what}: ${e.message}`);
				return undefined;
			}
		};
		const text = (value: FieldValue, what: string) => valueText(valueOf(value, 'text', what) ?? null).replace(/\s+/g, ' ').trim();

		/** The number for this row, null when the field is empty, undefined after an error. */
		const number = (value: FieldValue, what: string): string | null | undefined => {
			const v = valueOf(value, 'number', what);
			if (v == null) return v;
			if (v.type === 'number') return v.amount;
			const n = parseAmount(valueText(v), mapping.decimalMark);
			if (n === null) {
				errors.push(`${what}: "${valueText(v)}" isn't a number`);
				filled[what] = false;
			}
			return n ?? undefined;
		};

		/**
		 * The Date field has to give a Beancount date (YYYY-MM-DD) as written:
		 * a date column is taken as it is in the file, so one written another
		 * way needs FORMAT_DATE.
		 */
		const dateOf = (): string | null => {
			const v = valueOf(mapping.date, 'date', 'Date');
			if (v === undefined) return null;
			const written = valueText(v ?? null).trim();
			if (isIsoDate(written)) return written;
			const field = parseField(mapping.date);
			const column = 'expr' in field && field.expr.type === 'column' ? field.expr.name : null;
			// A value Beancount can't use as a date doesn't count as filled in.
			filled.Date = false;
			errors.push(column
				? `Date: "${written}" isn't a Beancount date (YYYY-MM-DD). Try =FORMAT_DATE({{${column}}}, "YYYY-MM-DD")`
				: `Date: "${written}" isn't a Beancount date (YYYY-MM-DD)`);
			return null;
		};

		const date = dateOf();
		const narration = text(mapping.narration, 'Narration');
		const payee = text(mapping.payee, 'Payee');

		let match: AccountLookupResult | undefined;
		let unmatched = false;
		let emptyAmounts = 0;
		const postings: PostingData[] = mapping.postings.map((p, i) => {
			const what = `Posting ${i + 1}`;
			const account = text(p.account, `${what} account`);
			const lookup = lookupLog.filter((l) => l.returns === 'account').pop();
			// The first account looked up by alias is the one review lets you categorize.
			if (lookup && !match) {
				match = { posting: i, text: lookup.text, mode: lookup.mode, matched: lookup.matched, fallback: lookup.matched ? '' : account };
			}
			if (lookup && !lookup.matched) unmatched = true;
			if (!account) errors.push(lookup && !lookup.matched ? `${what}: no alias matched "${lookup.text}" and there's no ELSE` : `${what} needs an account`);
			else if (!isAccountName(account)) errors.push(`${what} account: "${account}" isn't an account name`);

			const amount = number(p.amount, `${what} amount`);
			const currency = text(p.currency, `${what} currency`);
			if (amount === null) emptyAmounts++;
			else if (amount !== undefined && !currency) errors.push(`${what} needs a currency`);
			return amount == null ? { account } : { account, amount, currency };
		});
		if (emptyAmounts > 1) errors.push('Only one posting can be left without an amount');

		const own = postings[0]?.amount;
		const amount = own === undefined ? null : String(own);

		const metadata: Record<string, string> = {};
		for (const [key, value] of Object.entries(mapping.metadata)) {
			if (key !== IMPORT_REF_KEY && key.trim()) metadata[key.trim()] = text(value, `Metadata "${key}"`);
		}
		const importRef = text(mapping.metadata[IMPORT_REF_KEY] ?? '', IMPORT_REF_KEY)
			|| generateImportRef([date ?? '', amount ?? '', narration], seenRefs);

		const tags = mapping.tags.map((t) => slug(text(t, 'Tag'))).filter(Boolean);
		const links = mapping.links.map((l) => slug(text(l, 'Link'))).filter(Boolean);

		const txn = date && errors.length === 0
			? {
				date,
				flag: unmatched ? '!' : mapping.flag,
				payee,
				narration,
				tags,
				links,
				metadata: { [IMPORT_REF_KEY]: importRef, ...metadata },
				postings,
			}
			: null;

		return { sourceIndex, cells, txn, importRef, match, lookups, filled, errors, date: date ?? '' };
	});

	// Oldest first: a newest-first file is turned around, keeping same-day rows in the bank's order.
	const ordered = drafts.length > 1 && drafts[0].date > drafts[drafts.length - 1].date ? [...drafts].reverse() : [...drafts];
	ordered.sort((a, b) => (a.date && b.date ? a.date.localeCompare(b.date) : 0));

	return { drafts: ordered.map(({ date: _date, ...d }) => d) };
}

/** A balance assertion for the statement's account, offered in review. */
export interface StatementAssertion {
	kind: 'opening' | 'closing';
	date: string;
	amount: string;
	/** The "Add to ledger" toggle. */
	include: boolean;
}

function transactionDates(drafts: ImportDraft[]): string[] {
	return drafts.map((d) => d.txn?.date).filter((d): d is string => !!d).sort();
}

/**
 * Balance assertions for the balances before and after the statement.
 * Beancount checks a balance at the start of its day, so the one before is
 * dated the first transaction's day and the one after the day after the last.
 */
export function statementAssertions(drafts: ImportDraft[], opening: string | null, closing: string | null): StatementAssertion[] {
	const dates = transactionDates(drafts);
	if (dates.length === 0) return [];
	return [
		...(opening !== null ? [{ kind: 'opening' as const, date: dates[0], amount: opening, include: true }] : []),
		...(closing !== null ? [{ kind: 'closing' as const, date: addDays(dates[dates.length - 1], 1), amount: closing, include: true }] : []),
	];
}

/** The sum of the statement account's amounts, or null unless every row could be read. */
function statementTotal(drafts: ImportDraft[]): string | null {
	const amounts = drafts.map((d) => d.txn?.postings?.[0]?.amount);
	if (amounts.length === 0 || amounts.some((a) => a === undefined || a === '')) return null;
	return addAmounts('0', ...amounts.map((a) => String(a)));
}

/** The balance before the statement implied by the one after it: closing minus every row's amount. */
export function impliedOpening(drafts: ImportDraft[], closing: string): string | null {
	const total = statementTotal(drafts);
	return total === null ? null : addAmounts(closing, negateAmount(total));
}

/**
 * How far the rows are from explaining the two balances: closing − opening −
 * every row's amount. "0" when they agree; anything else means a missing
 * row or a wrong sign. Null when it can't be worked out.
 */
export function statementDifference(drafts: ImportDraft[], opening: string, closing: string): string | null {
	const total = statementTotal(drafts);
	return total === null ? null : addAmounts(closing, negateAmount(opening), negateAmount(total));
}

/**
 * An empty template, like a fresh Add Transaction form: two postings, the
 * required `import-ref`, and the file name as a link.
 */
export function blankMapping(types: ColumnType[], decimalMark: '.' | ',' = '.'): ImportMapping {
	return {
		version: MAPPING_VERSION,
		decimalMark,
		columnTypes: types,
		date: '',
		flag: '*',
		payee: '',
		narration: '',
		tags: [],
		links: [`={{${FILE_NAME_FIELD}}}`],
		metadata: { [IMPORT_REF_KEY]: '' },
		postings: [
			{ account: '', amount: '', currency: '' },
			{ account: '', amount: '', currency: '' },
		],
	};
}
