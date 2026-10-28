// src/utils/import/duplicates.ts
// Deciding which statement rows are already in the ledger.

import type { ImportDraft } from '../../models/import';
import { amountsEqual, daysBetween } from './values';

/** A posting on one of the statement's accounts, as found in the ledger. */
export interface LedgerPosting {
	account: string;
	date: string;
	amount: string;
	currency: string;
	payee: string;
	narration: string;
	importRef: string;
	filename: string;
	lineno: number;
}

export type DuplicateStatus =
	| { kind: 'new' }
	/** The row's `import-ref` is already in the ledger. */
	| { kind: 'imported' }
	/** Same account (the row's posting 1), amount and currency within a few days, e.g. entered by hand or imported from the other side of a transfer. */
	| { kind: 'possible'; match: LedgerPosting };

/**
 * Classifies each draft (same order as `drafts`). A ledger posting is
 * matched to at most one draft, so two identical ₹10 payments against one
 * ledger entry flag only one of them. Postings claimed by an `import-ref`
 * match aren't offered as possible duplicates of other rows.
 */
export function findDuplicates(
	drafts: ImportDraft[],
	existingRefs: Set<string>,
	postings: LedgerPosting[],
	windowDays = 3,
): DuplicateStatus[] {
	const draftRefs = new Set(drafts.map((d) => d.importRef));
	const available = postings.filter((p) => !p.importRef || !draftRefs.has(p.importRef));

	return drafts.map((draft): DuplicateStatus => {
		if (existingRefs.has(draft.importRef)) return { kind: 'imported' };

		const own = draft.txn?.postings?.[0];
		if (!draft.txn || !own?.amount || !own.currency) return { kind: 'new' };

		let bestIndex = -1;
		let bestDistance = Infinity;
		available.forEach((p, i) => {
			const distance = Math.abs(daysBetween(draft.txn.date, p.date));
			if (distance <= windowDays && distance < bestDistance && p.account === own.account
				&& p.currency === own.currency && amountsEqual(p.amount, String(own.amount))) {
				bestIndex = i;
				bestDistance = distance;
			}
		});
		if (bestIndex < 0) return { kind: 'new' };

		const [match] = available.splice(bestIndex, 1);
		return { kind: 'possible', match };
	});
}
