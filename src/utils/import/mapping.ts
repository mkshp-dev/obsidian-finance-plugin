// src/utils/import/mapping.ts
// Turning statement rows into draft transactions using an ImportMapping.

import {
	IMPORT_REF_KEY,
	type AccountMatcher,
	type AmountSource,
	type BalanceCheck,
	type ImportDraft,
	type ImportMapping,
} from '../../models/import';
import { addAmounts, amountsEqual, detectDateOrder, isAmountLike, negateAmount, parseAmount, parseDate } from './values';

const TEMPLATE_FIELD = /\{\{\s*(.+?)\s*\}\}/g;

/**
 * Replaces each `{{Column label}}` with that column's value and collapses
 * runs of whitespace (banks pad truncated names: "ASHISH   NARAY").
 * Unknown labels are reported in `missing` and left empty.
 */
export function renderTemplate(template: string, labels: string[], cells: string[]): { text: string; missing: string[] } {
	const missing: string[] = [];
	const text = template.replace(TEMPLATE_FIELD, (_, label: string) => {
		const i = labels.indexOf(label);
		if (i < 0) { missing.push(label); return ''; }
		return cells[i] ?? '';
	});
	return { text: text.replace(/\s+/g, ' ').trim(), missing };
}

/** Reads a signed amount (positive = money in) from a row, or an error message. */
export function readAmount(source: AmountSource, cells: string[], decimalMark: '.' | ','): { amount: string } | { error: string } {
	const cell = (i: number) => cells[i] ?? '';

	if (source.mode === 'signed') {
		const a = parseAmount(cell(source.column), decimalMark);
		if (a === null) return { error: `Can't read amount "${cell(source.column)}"` };
		return { amount: source.invert ? negateAmount(a) : a };
	}

	if (source.mode === 'indicator') {
		const a = parseAmount(cell(source.column), decimalMark);
		if (a === null) return { error: `Can't read amount "${cell(source.column)}"` };
		const ind = cell(source.indicatorColumn).toUpperCase();
		if (ind === source.debitValue.toUpperCase()) return { amount: negateAmount(a) };
		if (ind === source.creditValue.toUpperCase()) return { amount: a };
		return { error: `Expected "${source.debitValue}" or "${source.creditValue}", found "${cell(source.indicatorColumn)}"` };
	}

	const debit = cell(source.debitColumn) ? parseAmount(cell(source.debitColumn), decimalMark) : '0';
	const credit = cell(source.creditColumn) ? parseAmount(cell(source.creditColumn), decimalMark) : '0';
	if (debit === null) return { error: `Can't read debit "${cell(source.debitColumn)}"` };
	if (credit === null) return { error: `Can't read credit "${cell(source.creditColumn)}"` };
	if (!cell(source.debitColumn) && !cell(source.creditColumn)) return { error: 'Both debit and credit are empty' };
	return { amount: addAmounts(credit, negateAmount(debit)) };
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

function nextDay(date: string): string {
	const d = new Date(`${date}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + 1);
	return d.toISOString().slice(0, 10);
}

/** Converts table rows (without the header) into draft transactions for review. */
export function buildDrafts(
	rows: string[][],
	labels: string[],
	mapping: ImportMapping,
	matchAccount?: AccountMatcher,
): DraftResult {
	const seenRefs = new Map<string, number>();
	const amounts: (string | null)[] = [];
	const balances: (string | null)[] = [];

	const drafts: (ImportDraft & { date: string })[] = rows.map((cells, sourceIndex) => {
		const errors: string[] = [];
		const render = (template: string) => {
			const r = renderTemplate(template, labels, cells);
			for (const m of r.missing) errors.push(`Unknown column "${m}"`);
			return r.text;
		};

		const dateCell = cells[mapping.date.column] ?? '';
		const date = parseDate(dateCell, mapping.date.order);
		if (!date) errors.push(`Can't read date "${dateCell}"`);

		const read = readAmount(mapping.amount, cells, mapping.decimalMark);
		const amount = 'amount' in read ? read.amount : null;
		if ('error' in read) errors.push(read.error);
		amounts.push(amount);

		let balance: string | null = null;
		if (mapping.balance) {
			const b = readAmount(mapping.balance, cells, mapping.decimalMark);
			balance = 'amount' in b ? b.amount : null;
		}
		balances.push(balance);

		const narration = render(mapping.narration);
		const refCell = mapping.importRef.mode === 'column' ? (cells[mapping.importRef.column] ?? '') : '';
		const importRef = refCell || generateImportRef([date ?? dateCell, amount ?? '', narration, balance ?? ''], seenRefs);

		let counter: string;
		let matchedAlias: string | undefined;
		if (mapping.counterAccount.mode === 'fixed') {
			counter = mapping.counterAccount.account;
		} else {
			const match = matchAccount?.(render(mapping.matchText)) ?? null;
			counter = match?.account ?? mapping.counterAccount.fallback;
			matchedAlias = match?.alias;
		}
		const payee = mapping.payeeFromAlias && matchedAlias ? matchedAlias : render(mapping.payee);

		const txn = date && amount !== null && errors.length === 0
			? {
				date,
				flag: mapping.counterAccount.mode === 'aliases' && !matchedAlias ? '!' : '*',
				payee,
				narration,
				tags: mapping.tags ?? [],
				links: [],
				metadata: { [IMPORT_REF_KEY]: importRef },
				postings: [
					{ account: mapping.account, amount, currency: mapping.currency },
					{ account: counter },
				],
			}
			: null;

		return { sourceIndex, cells, txn, importRef, matchedAlias, errors, date: date ?? '' };
	});

	let balance: BalanceCheck | null = null;
	if (mapping.balance) {
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
		? { date: nextDay(lastDate), amount: balance.closing }
		: null;

	return { drafts: ordered.map(({ date: _date, ...d }) => d), balance, closingBalance };
}

const DEBIT_WORDS = ['DR', 'D', 'DEBIT', 'WITHDRAWAL'];
const CREDIT_WORDS = ['CR', 'C', 'CREDIT', 'DEPOSIT'];

/**
 * A first guess at the mapping from the header and rows, for the user to
 * confirm. `account` is left empty; `currency` too unless given.
 */
export function suggestMapping(labels: string[], rows: string[][], currency = ''): ImportMapping {
	const column = (i: number) => rows.map((r) => r[i] ?? '');
	const filled = (i: number) => column(i).filter(Boolean);
	const cols = labels.map((_, i) => i);
	const named = (re: RegExp, among = cols) => among.find((i) => re.test(labels[i]));

	const dateCols = cols.filter((i) => filled(i).length > 0 && detectDateOrder(filled(i)).order !== null);
	const dateCol = named(/value\s*date/i, dateCols) ?? named(/date/i, dateCols) ?? dateCols[0] ?? 0;

	const indicatorOf = (i: number) => {
		const vals = filled(i).map((v) => v.toUpperCase());
		if (vals.length === 0) return null;
		const debit = DEBIT_WORDS.find((w) => vals.includes(w));
		const credit = CREDIT_WORDS.find((w) => vals.includes(w));
		const allKnown = vals.every((v) => DEBIT_WORDS.includes(v) || CREDIT_WORDS.includes(v));
		return allKnown ? { debitValue: debit ?? 'DR', creditValue: credit ?? 'CR' } : null;
	};
	const serial = (i: number) => /^(s\.?\s*no|sl|sr|serial|#)/i.test(labels[i]) || filled(i).every((v, n) => v === String(n + 1));
	const numericCols = cols.filter((i) =>
		!dateCols.includes(i) && !serial(i) && !indicatorOf(i) && filled(i).length > 0 && filled(i).every(isAmountLike));

	// A number column followed by an indicator column, e.g. Kotak's "Amount","Dr / Cr".
	const sourceFor = (i: number): AmountSource => {
		const ind = indicatorOf(i + 1);
		return ind ? { mode: 'indicator', column: i, indicatorColumn: i + 1, ...ind } : { mode: 'signed', column: i };
	};

	const balanceCol = named(/balance/i, numericCols);
	const amountCols = numericCols.filter((i) => i !== balanceCol);
	const amountLikeOrEmpty = cols.filter((i) => !dateCols.includes(i) && !indicatorOf(i) && column(i).every((v) => !v || isAmountLike(v)));
	const debitCol = named(/debit|withdraw|paid out|money out/i, amountLikeOrEmpty);
	const creditCol = named(/credit|deposit|paid in|money in/i, amountLikeOrEmpty);

	const amount: AmountSource = debitCol !== undefined && creditCol !== undefined && debitCol !== creditCol
		? { mode: 'split', debitColumn: debitCol, creditColumn: creditCol }
		: sourceFor(named(/amount/i, amountCols) ?? amountCols[0] ?? 0);

	const textCols = cols.filter((i) => !dateCols.includes(i) && !numericCols.includes(i) && !indicatorOf(i));
	const avgLength = (i: number) => column(i).reduce((s, v) => s + v.length, 0) / Math.max(rows.length, 1);
	const descCol = named(/desc|narration|particular|detail|remark|memo/i, textCols)
		?? [...textCols].sort((a, b) => avgLength(b) - avgLength(a))[0];
	const refCol = named(/ref|chq|cheque|utr|transaction id|txn id/i, textCols.filter((i) => i !== descCol));

	const desc = descCol !== undefined ? `{{${labels[descCol]}}}` : '';
	const dateValues = filled(dateCol);

	return {
		account: '',
		currency,
		decimalMark: '.',
		date: { column: dateCol, order: detectDateOrder(dateValues).order ?? 'DMY' },
		amount,
		balance: balanceCol !== undefined ? sourceFor(balanceCol) : undefined,
		payee: '',
		narration: desc,
		matchText: desc,
		payeeFromAlias: true,
		counterAccount: { mode: 'aliases', fallback: 'Expenses:Uncategorized' },
		importRef: refCol !== undefined ? { mode: 'column', column: refCol } : { mode: 'generate' },
	};
}
