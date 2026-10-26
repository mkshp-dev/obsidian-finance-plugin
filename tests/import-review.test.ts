import { describe, it, expect } from 'vitest';
import type { ImportDraft } from '../src/models/import';
import { createReviewRows, filterRows } from '../src/utils/import/review';


function draft(text: string, account = 'Expenses:Uncategorized', readable = true): ImportDraft {
	return {
		sourceIndex: 0, cells: [], importRef: text, errors: readable ? [] : ['bad'], match: { posting: 1, text, mode: 'contains', matched: account !== 'Expenses:Uncategorized', fallback: 'Expenses:Uncategorized' },
		txn: readable
			? { date: '2026-09-01', flag: account === 'Expenses:Uncategorized' ? '!' : '*', payee: '', narration: text,
				postings: [{ account: 'Assets:Bank', amount: '-1', currency: 'INR' }, { account }] }
			: null,
	};
}

function rows() {
	const drafts = [
		draft('UPI/City Mall/ICIC/1/UPI'),
		draft('UPI/CITY MALL/ICIC/2/UPI'),
		draft('UPI/CRED Club/UTIB/3', 'Liabilities:CreditCard'),
		draft('garbage', undefined, false),
		draft('UPI/Canteen/UTIB/4'),
	];
	return createReviewRows(drafts, [
		{ kind: 'new' }, { kind: 'new' }, { kind: 'imported' }, { kind: 'new' },
		{ kind: 'possible', match: {} as never },
	]);
}

describe('review rows', () => {
	it('leaves out unreadable and already imported rows', () => {
		expect(rows().map((r) => r.include)).toEqual([true, true, false, false, true]);
	});

	it('filters rows needing attention and duplicates', () => {
		const r = rows();
		expect(filterRows(r, 'all')).toEqual([0, 1, 2, 3, 4]);
		expect(filterRows(r, 'attention')).toEqual([0, 1, 3, 4]);
		expect(filterRows(r, 'duplicates')).toEqual([2, 4]);
	});
});
