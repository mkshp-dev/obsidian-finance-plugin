// src/utils/import/review.ts
// State for the import modal's review step: which rows get added, which
// need a look, and applying a newly remembered alias to the other rows.

import type { ImportDraft } from '../../models/import';
import { createAliasMatcher } from './aliases';
import type { DuplicateStatus } from './duplicates';

export interface ReviewRow {
	draft: ImportDraft;
	status: DuplicateStatus;
	/** The "Add to ledger" toggle. */
	include: boolean;
	/** The column text the categorized posting's account was looked up from. */
	matchText: string;
	/** Set once the user changes the row, so later alias matches leave it alone. */
	edited: boolean;
}

export type ReviewFilter = 'all' | 'attention' | 'duplicates';

/** Rows start included unless they couldn't be read or are already in the ledger. */
export function createReviewRows(drafts: ImportDraft[], statuses: DuplicateStatus[]): ReviewRow[] {
	return drafts.map((draft, i) => ({
		draft,
		status: statuses[i] ?? { kind: 'new' },
		include: draft.txn !== null && statuses[i]?.kind !== 'imported',
		matchText: draft.match?.text ?? '',
		edited: false,
	}));
}

/** The posting being categorized: the one whose account came from an alias lookup, else the second. */
export function categoryPosting(row: ReviewRow): number {
	return row.draft.match?.posting ?? 1;
}

export function counterAccount(row: ReviewRow): string {
	return row.draft.txn?.postings?.[categoryPosting(row)]?.account ?? '';
}

/** No alias matched and the row is still on its lookup's ELSE account, waiting for a category. */
export function isUncategorized(row: ReviewRow): boolean {
	const match = row.draft.match;
	return !!match && !match.matched && counterAccount(row) === match.fallback;
}

export function needsAttention(row: ReviewRow): boolean {
	return row.draft.txn === null || row.status.kind === 'possible' || (row.include && isUncategorized(row));
}

export function isDuplicate(row: ReviewRow): boolean {
	return row.status.kind !== 'new';
}

export function filterRows(rows: ReviewRow[], filter: ReviewFilter): number[] {
	return rows.flatMap((row, i) =>
		filter === 'all' || (filter === 'attention' ? needsAttention(row) : isDuplicate(row)) ? [i] : []);
}

/** Uncategorized rows, other than `except`, that `alias` would match, each in its own lookup's mode. */
export function rowsMatchingAlias(rows: ReviewRow[], alias: string, except = -1): number[] {
	const entries = [{ account: '_', aliases: [alias] }];
	const matchers = { contains: createAliasMatcher(entries, 'contains'), exact: createAliasMatcher(entries, 'exact') };
	return rows.flatMap((row, i) =>
		i !== except && row.draft.txn && !row.edited && isUncategorized(row) && matchers[row.draft.match!.mode](row.matchText) ? [i] : []);
}

/**
 * Moves the uncategorized rows matching a newly remembered alias to
 * `account`, as if the alias had been there from the start. Returns the
 * indexes of the rows it changed.
 */
export function applyAlias(rows: ReviewRow[], account: string, alias: string, except = -1): number[] {
	const changed = rowsMatchingAlias(rows, alias, except);
	for (const i of changed) {
		const txn = rows[i].draft.txn!;
		const p = categoryPosting(rows[i]);
		txn.postings![p] = { ...txn.postings![p], account };
		txn.flag = '*';
		const match = rows[i].draft.match!;
		if (match.payeeIsAlias) txn.payee = alias;
		match.matched = true;
		rows[i].draft.matchedAlias = alias;
	}
	return changed;
}

/**
 * A starting point for a new alias from the statement text: the name in
 * payment strings like `UPI/City Mall/ICIC/…` or `NEFT-ACME LTD-…`. An exact
 * lookup needs the whole text, so it gets that instead.
 */
export function aliasSuggestion(row: ReviewRow): string {
	return row.draft.match?.mode === 'exact' ? row.matchText : suggestAliasText(row.matchText);
}

/**
 * The name inside payment strings like `UPI/City Mall/ICIC/…` or
 * `NEFT-ACME LTD-…`, or '' if the text isn't one.
 */
export function suggestAliasText(matchText: string): string {
	const parts = matchText.split(/[/-]/).map((p) => p.replace(/\s+/g, ' ').trim());
	return parts.length > 1 && /^[A-Z]{2,6}$/.test(parts[0]) && /[A-Za-z]/.test(parts[1]) ? parts[1] : '';
}
