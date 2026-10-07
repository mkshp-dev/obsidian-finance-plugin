// src/utils/import/review.ts
// State for the import modal's review step: which rows get added, which
// need a look, and applying a newly remembered alias to the other rows.

import type { ImportDraft, ImportMapping } from '../../models/import';
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

/** The posting being categorized: the one whose account came from a column, else the second. */
export function categoryPosting(row: ReviewRow): number {
	return row.draft.match?.posting ?? 1;
}

export function counterAccount(row: ReviewRow): string {
	return row.draft.txn?.postings?.[categoryPosting(row)]?.account ?? '';
}

/** Still on the unmatched account, waiting for a category. */
export function isUncategorized(row: ReviewRow, mapping: ImportMapping): boolean {
	return !!row.draft.match && counterAccount(row) === mapping.unmatchedAccount;
}

export function needsAttention(row: ReviewRow, mapping: ImportMapping): boolean {
	return row.draft.txn === null || row.status.kind === 'possible' || (row.include && isUncategorized(row, mapping));
}

export function isDuplicate(row: ReviewRow): boolean {
	return row.status.kind !== 'new';
}

export function filterRows(rows: ReviewRow[], filter: ReviewFilter, mapping: ImportMapping): number[] {
	return rows.flatMap((row, i) =>
		filter === 'all' || (filter === 'attention' ? needsAttention(row, mapping) : isDuplicate(row)) ? [i] : []);
}

/** Uncategorized rows, other than `except`, that `alias` would match. */
export function rowsMatchingAlias(rows: ReviewRow[], alias: string, mapping: ImportMapping, except = -1): number[] {
	const match = createAliasMatcher([{ account: '_', aliases: [alias] }]);
	return rows.flatMap((row, i) =>
		i !== except && row.draft.txn && !row.edited && isUncategorized(row, mapping) && match(row.matchText) ? [i] : []);
}

/**
 * Moves the uncategorized rows matching a newly remembered alias to
 * `account`, as if the alias had been there from the start. Returns the
 * indexes of the rows it changed.
 */
export function applyAlias(rows: ReviewRow[], account: string, alias: string, mapping: ImportMapping, except = -1): number[] {
	const changed = rowsMatchingAlias(rows, alias, mapping, except);
	for (const i of changed) {
		const txn = rows[i].draft.txn!;
		const p = categoryPosting(rows[i]);
		txn.postings![p] = { ...txn.postings![p], account };
		txn.flag = '*';
		if (mapping.payeeFromAlias) txn.payee = alias;
		rows[i].draft.matchedAlias = alias;
	}
	return changed;
}

/**
 * A starting point for a new alias from the statement text: the name in
 * payment strings like `UPI/City Mall/ICIC/…` or `NEFT-ACME LTD-…`.
 */
export function suggestAliasText(matchText: string): string {
	const parts = matchText.split(/[/-]/).map((p) => p.replace(/\s+/g, ' ').trim());
	return parts.length > 1 && /^[A-Z]{2,6}$/.test(parts[0]) && /[A-Za-z]/.test(parts[1]) ? parts[1] : '';
}
