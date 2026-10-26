// src/utils/import/review.ts
// State for the import modal's review step: which rows get added and which
// need a look.

import type { ImportDraft } from '../../models/import';
import type { DuplicateStatus } from './duplicates';

export interface ReviewRow {
	draft: ImportDraft;
	status: DuplicateStatus;
	/** The "Add to ledger" toggle. */
	include: boolean;
}

export type ReviewFilter = 'all' | 'attention' | 'duplicates';

/** Rows start included unless they couldn't be read or are already in the ledger. */
export function createReviewRows(drafts: ImportDraft[], statuses: DuplicateStatus[]): ReviewRow[] {
	return drafts.map((draft, i) => ({
		draft,
		status: statuses[i] ?? { kind: 'new' },
		include: draft.txn !== null && statuses[i]?.kind !== 'imported',
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
