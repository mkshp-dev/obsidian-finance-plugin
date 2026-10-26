// src/utils/import/review.ts
// State for the import modal's review step: which rows get added and which
// need a look.

import { IMPORT_REF_KEY, type ImportDraft } from '../../models/import';
import type { PostingData, TransactionData } from '../directives/types';
import type { JournalPosting } from '../../models/journal';
import type { DuplicateStatus } from './duplicates';
import { isAccountName } from './mapping';
import { isIsoDate } from './values';

export interface ReviewRow {
	draft: ImportDraft;
	status: DuplicateStatus;
	/** The "Add to ledger" toggle. Only a resolved row can be added. */
	include: boolean;
}

export type ReviewFilter = 'all' | 'attention' | 'duplicates';

/** Something a transaction needs before it can be added, named by its field (as in mapping errors). */
export interface Unresolved {
	field: string;
	message: string;
}

const AMOUNT = /^-?\d+(\.\d+)?$/;
// Beancount's currency syntax, e.g. INR, USD, VBTLX, HOOL.B.
const CURRENCY = /^[A-Z]([A-Z0-9'._-]{0,22}[A-Z0-9])?$/;

function filled(value: string | number | null | undefined): boolean {
	return value !== undefined && value !== null && String(value).trim() !== '';
}

/**
 * What a transaction still needs before it can go into the ledger: a date,
 * at least two postings each with a valid account, at least one amount
 * with a currency (and at most one posting left for Beancount to
 * balance), and an import-ref. Empty when it's resolved.
 */
export function unresolvedReasons(txn: TransactionData): Unresolved[] {
	const reasons: Unresolved[] = [];
	if (!isIsoDate((txn.date ?? '').trim())) reasons.push({ field: 'Date', message: 'Date: needs a date (YYYY-MM-DD)' });

	const postings = txn.postings ?? [];
	if (postings.length < 2) reasons.push({ field: 'Postings', message: 'Needs at least two postings' });
	postings.forEach((p, i) => {
		const what = `Posting ${i + 1}`;
		const account = (p.account ?? '').trim();
		if (!account) reasons.push({ field: `${what} account`, message: `${what} account: needs an account` });
		else if (!isAccountName(account)) reasons.push({ field: `${what} account`, message: `${what} account: "${account}" isn't an account name` });

		if (!filled(p.amount)) return;
		const currency = (p.currency ?? '').trim();
		if (!AMOUNT.test(String(p.amount).trim())) reasons.push({ field: `${what} amount`, message: `${what} amount: "${p.amount}" isn't a number` });
		if (!currency) reasons.push({ field: `${what} currency`, message: `${what} currency: needs a currency` });
		else if (!CURRENCY.test(currency)) reasons.push({ field: `${what} currency`, message: `${what} currency: "${currency}" isn't a currency` });
	});
	const blank = postings.filter((p) => !filled(p.amount)).length;
	if (postings.length > 0 && blank === postings.length) reasons.push({ field: 'Postings', message: 'Needs at least one amount' });
	else if (blank > 1) reasons.push({ field: 'Postings', message: 'Only one posting can be left without an amount' });

	if (!filled(txn.metadata?.[IMPORT_REF_KEY])) reasons.push({ field: IMPORT_REF_KEY, message: `${IMPORT_REF_KEY}: needs a reference` });
	return reasons;
}

export function isResolved(row: ReviewRow): boolean {
	return unresolvedReasons(row.draft.txn).length === 0;
}

/**
 * Why a draft is unresolved, using the mapping's own error for a field
 * when it has one (it says what in the file couldn't be read), and the
 * mapping's other errors as notes about fields that aren't required.
 */
export function draftProblems(draft: ImportDraft): { unresolved: string[]; notes: string[] } {
	const reasons = unresolvedReasons(draft.txn);
	const errorFor = (field: string) => draft.errors.find((e) => e.startsWith(`${field}:`));
	return {
		unresolved: reasons.map((r) => errorFor(r.field) ?? r.message),
		notes: draft.errors.filter((e) => !reasons.some((r) => e.startsWith(`${r.field}:`))),
	};
}

/** Rows start included when they're resolved and not already in the ledger. */
export function createReviewRows(drafts: ImportDraft[], statuses: DuplicateStatus[]): ReviewRow[] {
	return drafts.map((draft, i) => ({
		draft,
		status: statuses[i] ?? { kind: 'new' },
		include: unresolvedReasons(draft.txn).length === 0 && statuses[i]?.kind !== 'imported',
	}));
}

/** Unticks rows that have become unresolved, e.g. after an edit. */
export function untickUnresolved(rows: ReviewRow[]): void {
	for (const row of rows) if (row.include && !isResolved(row)) row.include = false;
}

/** The account shown in the review list: the posting whose account came from an alias lookup, else the second. */
export function counterAccount(row: ReviewRow): string {
	return row.draft.txn.postings?.[row.draft.match?.posting ?? 1]?.account ?? '';
}

export function needsAttention(row: ReviewRow): boolean {
	return !isResolved(row) || row.status.kind === 'possible';
}

export function isDuplicate(row: ReviewRow): boolean {
	return row.status.kind !== 'new';
}

export function filterRows(rows: ReviewRow[], filter: ReviewFilter): number[] {
	return rows.flatMap((row, i) =>
		filter === 'all' || (filter === 'attention' ? needsAttention(row) : isDuplicate(row)) ? [i] : []);
}

// --- Editing a transaction with the Add Transaction form's posting rows ---

function text(value: string | number | null | undefined): string {
	return value === undefined || value === null ? '' : String(value);
}

/** A posting as the Add Transaction form edits it. */
export function toFormPosting(p: PostingData): JournalPosting {
	return {
		account: p.account ?? '',
		amount: text(p.amount),
		currency: p.currency ?? '',
		flag: p.flag ?? null,
		comment: p.comment ?? null,
		metadata: { ...(p.metadata ?? {}) },
		cost: p.cost ? { number: text(p.cost.number) || null, currency: p.cost.currency ?? null, date: p.cost.date ?? null, label: p.cost.label ?? null, isTotal: p.cost.isTotal } : undefined,
		price: p.price ? { amount: text(p.price.amount), currency: p.price.currency ?? '', isTotal: p.price.isTotal } : undefined,
	};
}

/** Which optional parts of a posting are shown in the form; a hidden part isn't kept. */
export interface PostingParts {
	cost: boolean;
	price: boolean;
	flag: boolean;
	comment: boolean;
	metadata: boolean;
}

export function postingParts(p: JournalPosting): PostingParts {
	return { cost: !!p.cost, price: !!p.price, flag: !!p.flag, comment: !!p.comment, metadata: Object.keys(p.metadata ?? {}).length > 0 };
}

/** Metadata without blank keys. */
export function cleanMetadata(map: Record<string, string> | undefined): Record<string, string> {
	return Object.fromEntries(Object.entries(map ?? {}).filter(([k]) => k.trim()).map(([k, v]) => [k.trim(), text(v).trim()]));
}

/** A posting from the form, keeping only the parts that are shown and filled in. */
export function fromFormPosting(p: JournalPosting, parts: PostingParts): PostingData {
	const out: PostingData = { account: p.account.trim() };
	if (filled(p.amount)) out.amount = text(p.amount).trim();
	// Kept without an amount too (it isn't written then), so it's there once an amount is filled in.
	if (filled(p.currency)) out.currency = text(p.currency).trim();
	const c = p.cost;
	if (parts.cost && c && (filled(c.number) || filled(c.date) || filled(c.label))) {
		out.cost = {
			...(filled(c.number) ? { number: text(c.number).trim(), currency: text(c.currency).trim() } : {}),
			...(filled(c.date) ? { date: text(c.date) } : {}),
			...(filled(c.label) ? { label: text(c.label).trim() } : {}),
			isTotal: !!c.isTotal,
		};
	}
	if (parts.price && p.price && filled(p.price.amount)) {
		out.price = { amount: text(p.price.amount).trim(), currency: text(p.price.currency).trim(), isTotal: !!p.price.isTotal };
	}
	if (parts.flag && p.flag) out.flag = p.flag;
	if (parts.comment && filled(p.comment)) out.comment = text(p.comment).trim();
	const metadata = cleanMetadata(p.metadata);
	if (parts.metadata && Object.keys(metadata).length > 0) out.metadata = metadata;
	return out;
}
