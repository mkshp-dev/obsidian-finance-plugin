// src/utils/import/mapping.ts
// Turning statement rows into draft transactions using an ImportMapping.

import {
	FILE_NAME_FIELD,
	IMPORT_REF_KEY,
	type AccountMatcher,
	type BalanceCheck,
	type ColumnType,
	type FieldValue,
	type ImportDraft,
	type ImportMapping,
} from '../../models/import';
import type { PostingData } from '../directives/types';
import { addAmounts, addDays, amountsEqual, negateAmount, parseAmount, parseDate } from './values';
import { detectColumnTypes, readNumber } from './columns';

const COLUMN_REF = /^=\s*\{\{\s*([^{}]+?)\s*\}\}\s*$/;

/**
 * Reads a template field: plain text is used as written, `={{Column}}`
 * names a column. Anything else starting with `=` isn't supported yet.
 */
export function parseField(value: FieldValue): { text: string } | { column: string } | { error: string } {
	const v = value.trim();
	if (!v.startsWith('=')) return { text: v };
	const m = COLUMN_REF.exec(v);
	return m ? { column: m[1] } : { error: `"${v}" isn't supported yet. Use ={{Column name}}` };
}

/** The column a field takes its value from, or null for plain text. */
export function fieldColumn(value: FieldValue): string | null {
	const f = parseField(value);
	return 'column' in f ? f.column : null;
}

/**
 * Checks each row's running balance equals the previous balance plus its
 * amount, trying the rows oldest-first and then newest-first. A match
 * confirms the signs are read correctly and no row is missing.
 */
export function checkBalanceChain(amounts: string[], balances: string[]): BalanceCheck {
	const firstBreak = (am: string[], bal: string[]) => {
		for (let i = 1; i < am.length; i++) {
			if (!amountsEqual(addAmounts(bal[i - 1], am[i]), bal[i])) return i;
		}
		return -1;
	};
	const summary = (am: string[], bal: string[]) => ({
		opening: addAmounts(bal[0], negateAmount(am[0])),
		closing: bal[bal.length - 1],
	});

	if (amounts.length === 0) return { ok: true, order: 'asc' };

	const asc = firstBreak(amounts, balances);
	if (asc < 0) return { ok: true, order: 'asc', ...summary(amounts, balances) };

	const revA = [...amounts].reverse();
	const revB = [...balances].reverse();
	const desc = firstBreak(revA, revB);
	if (desc < 0) return { ok: true, order: 'desc', ...summary(revA, revB) };

	// Report whichever direction got further, as an index in file order.
	return asc >= desc
		? { ok: false, order: 'asc', breakAt: asc }
		: { ok: false, order: 'desc', breakAt: amounts.length - 1 - desc };
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
	/** Null when the mapping has no balance column. */
	balance: BalanceCheck | null;
	/** Balance after the last transaction, dated the next day (beancount checks at the start of the day). */
	closingBalance: { date: string; amount: string } | null;
}

export interface DraftContext {
	/** Finds the account for text taken from a column, e.g. by aliases. */
	matchAccount?: AccountMatcher;
	/** Open accounts: column text that is exactly one of these is used as the account. */
	accounts?: string[];
	/** The statement file's name, for `={{File name}}`. */
	fileName?: string;
}

/** Tags and links can only hold letters, digits and `-_/.`. */
function slug(text: string): string {
	return text.replace(/^[#^]/, '').replace(/[^A-Za-z0-9\-_/.]+/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');
}

/** Converts table rows (without the header) into draft transactions for review. */
export function buildDrafts(rows: string[][], labels: string[], mapping: ImportMapping, ctx: DraftContext = {}): DraftResult {
	const seenRefs = new Map<string, number>();
	const amounts: (string | null)[] = [];
	const balances: (string | null)[] = [];
	const types = mapping.columnTypes;
	const fileName = (ctx.fileName ?? '').split('/').pop()!.replace(/\.[^.]+$/, '');

	const drafts: (ImportDraft & { date: string })[] = rows.map((cells, sourceIndex) => {
		const errors: string[] = [];

		/** A field's value for this row and the column it came from (-1 for plain text), or null after an error. */
		const resolve = (value: FieldValue, what: string): [string, number] | null => {
			const f = parseField(value);
			if ('error' in f) { errors.push(`${what}: ${f.error}`); return null; }
			if ('text' in f) return [f.text, -1];
			const i = labels.indexOf(f.column);
			if (i >= 0) return [(cells[i] ?? '').replace(/\s+/g, ' ').trim(), i];
			if (f.column === FILE_NAME_FIELD) return [fileName, -1];
			errors.push(`${what}: there's no column "${f.column}"`);
			return null;
		};
		const text = (value: FieldValue, what: string) => resolve(value, what)?.[0] ?? '';

		/** The number for this row, null when the field is empty, undefined after an error. */
		const number = (value: FieldValue, what: string): string | null | undefined => {
			const r = resolve(value, what);
			if (!r) return undefined;
			if (r[0] === '') return null;
			const [raw, column] = r;
			if (column < 0) {
				const n = parseAmount(raw, mapping.decimalMark);
				if (n === null) errors.push(`${what}: "${raw}" isn't a number`);
				return n ?? undefined;
			}
			if (types[column]?.kind !== 'number') { errors.push(`${what}: "${labels[column]}" isn't a Number column`); return undefined; }
			const n = readNumber(cells, column, types[column], mapping.decimalMark);
			if ('error' in n) { errors.push(`${what}: ${n.error}`); return undefined; }
			return n.amount;
		};

		const dateOf = (): string | null => {
			const r = resolve(mapping.date, 'Date');
			if (!r) return null;
			const [raw, column] = r;
			const type = column >= 0 ? types[column] : undefined;
			if (column >= 0 && !(type && 'order' in type)) { errors.push(`Date: "${labels[column]}" isn't a Date column`); return null; }
			const date = type && 'order' in type ? parseDate(raw, type.order) : /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
			if (!date) errors.push(`Date: can't read "${raw}"`);
			return date;
		};

		const date = dateOf();
		const narration = text(mapping.narration, 'Narration');
		let payee = text(mapping.payee, 'Payee');

		let matchedAlias: string | undefined;
		let match: ImportDraft['match'];
		let unmatched = false;
		let emptyAmounts = 0;
		const postings: PostingData[] = mapping.postings.map((p, i) => {
			const what = `Posting ${i + 1}`;
			const resolved = resolve(p.account, `${what} account`);
			let account = resolved?.[0] ?? '';
			// An account taken from a column (other than the statement's own) is looked up by name, then by alias.
			if (resolved && resolved[1] >= 0 && i > 0 && !match) {
				match = { posting: i, text: account };
				if (!ctx.accounts?.includes(account)) {
					const found = ctx.matchAccount?.(account) ?? null;
					matchedAlias = found?.alias;
					account = found?.account ?? mapping.unmatchedAccount;
					unmatched = !found;
				}
			}
			if (!account) errors.push(`${what} needs an account`);

			const amount = number(p.amount, `${what} amount`);
			const currency = text(p.currency, `${what} currency`);
			if (amount === null) emptyAmounts++;
			else if (amount !== undefined && !currency) errors.push(`${what} needs a currency`);
			return amount == null ? { account } : { account, amount, currency };
		});
		if (emptyAmounts > 1) errors.push('Only one posting can be left without an amount');

		const own = postings[0]?.amount;
		const amount = own === undefined ? null : String(own);
		amounts.push(amount);

		let balance: string | null = null;
		if (mapping.balanceColumn !== null) {
			const b = readNumber(cells, mapping.balanceColumn, types[mapping.balanceColumn], mapping.decimalMark);
			balance = 'amount' in b ? b.amount : null;
		}
		balances.push(balance);

		const metadata: Record<string, string> = {};
		for (const [key, value] of Object.entries(mapping.metadata)) {
			if (key !== IMPORT_REF_KEY && key.trim()) metadata[key.trim()] = text(value, `Metadata "${key}"`);
		}
		const importRef = text(mapping.metadata[IMPORT_REF_KEY] ?? '', IMPORT_REF_KEY)
			|| generateImportRef([date ?? '', amount ?? '', narration, balance ?? ''], seenRefs);

		if (mapping.payeeFromAlias && matchedAlias) payee = matchedAlias;
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

		return { sourceIndex, cells, txn, importRef, matchedAlias, match, errors, date: date ?? '' };
	});

	let balance: BalanceCheck | null = null;
	if (mapping.balanceColumn !== null) {
		const unreadable = balances.findIndex((b, i) => b === null || amounts[i] === null);
		balance = unreadable >= 0
			? { ok: false, order: 'asc', breakAt: unreadable }
			: checkBalanceChain(amounts as string[], balances as string[]);
	}

	// Oldest first: follow the balance chain's order if known, else the dates.
	const ordered = balance?.ok && balance.order === 'desc'
		? [...drafts].reverse()
		: !balance?.ok && drafts.length > 1 && drafts[0].date > drafts[drafts.length - 1].date
			? [...drafts].reverse()
			: [...drafts];
	ordered.sort((a, b) => (a.date && b.date ? a.date.localeCompare(b.date) : 0));

	const lastDate = ordered.filter((d) => d.date).map((d) => d.date).pop();
	const closingBalance = balance?.ok && balance.closing !== undefined && lastDate
		? { date: addDays(lastDate, 1), amount: balance.closing }
		: null;

	return { drafts: ordered.map(({ date: _date, ...d }) => d), balance, closingBalance };
}

/**
 * A first guess at the template from the header, rows and column types,
 * for the user to confirm. The statement account is left empty.
 */
export function suggestMapping(
	labels: string[],
	rows: string[][],
	currency = '',
	types: ColumnType[] = detectColumnTypes(rows, labels.length, labels),
	decimalMark: '.' | ',' = '.',
): ImportMapping {
	const column = (i: number) => rows.map((r) => r[i] ?? '');
	const filled = (i: number) => column(i).filter(Boolean);
	const cols = labels.map((_, i) => i);
	const named = (re: RegExp, among = cols) => among.find((i) => re.test(labels[i]));
	const kind = (i: number) => types[i]?.kind;
	const ref = (i: number | undefined) => (i === undefined ? '' : `={{${labels[i]}}}`);

	const dateCols = cols.filter((i) => kind(i) === 'date' || kind(i) === 'datetime');
	const dateCol = named(/value\s*date/i, dateCols) ?? named(/date/i, dateCols) ?? dateCols[0];

	const serial = (i: number) => /^(s\.?\s*no|sl|sr|serial|#)/i.test(labels[i]) || filled(i).every((v, n) => v === String(n + 1));
	const numberCols = cols.filter((i) => kind(i) === 'number' && !serial(i));
	const fullNumberCols = numberCols.filter((i) => filled(i).length === rows.length);
	const balanceCol = named(/balance/i, fullNumberCols);
	const amountCols = fullNumberCols.filter((i) => i !== balanceCol);
	const amountCol = named(/amount/i, amountCols) ?? amountCols[0] ?? numberCols.find((i) => i !== balanceCol);

	const signColumns = new Set(types.flatMap((t) => (t.kind === 'number' && t.sign?.mode === 'indicator' ? [t.sign.column] : [])));
	const textCols = cols.filter((i) => kind(i) === 'text' && !signColumns.has(i));
	const avgLength = (i: number) => column(i).reduce((sum, v) => sum + v.length, 0) / Math.max(rows.length, 1);
	const descCol = named(/desc|narration|particular|detail|remark|memo/i, textCols)
		?? [...textCols].sort((a, b) => avgLength(b) - avgLength(a))[0];
	const refCol = named(/ref|chq|cheque|utr|transaction id|txn id/i, textCols.filter((i) => i !== descCol));

	return {
		version: 2,
		decimalMark,
		columnTypes: types,
		date: ref(dateCol),
		flag: '*',
		payee: '',
		narration: ref(descCol),
		tags: [],
		links: [`={{${FILE_NAME_FIELD}}}`],
		metadata: { [IMPORT_REF_KEY]: ref(refCol) },
		postings: [
			{ account: '', amount: ref(amountCol), currency },
			{ account: ref(descCol), amount: '', currency: '' },
		],
		unmatchedAccount: 'Expenses:Uncategorized',
		payeeFromAlias: true,
		balanceColumn: balanceCol ?? null,
	};
}
