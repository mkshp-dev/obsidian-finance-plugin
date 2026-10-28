import { describe, it, expect } from 'vitest';
import type { ImportDraft } from '../src/models/import';
import type { TransactionData } from '../src/utils/directives/types';
import {
	createReviewRows, draftProblems, filterRows, fromFormPosting, isResolved, postingParts, toFormPosting, unresolvedReasons,
} from '../src/utils/import/review';

function txn(overrides: Partial<TransactionData> = {}): TransactionData {
	return {
		date: '2026-09-01', flag: '*', payee: '', narration: 'UPI/Cafe',
		metadata: { 'import-ref': 'r1' },
		postings: [{ account: 'Assets:Bank', amount: '-1', currency: 'INR' }, { account: 'Expenses:Food' }],
		...overrides,
	};
}

function draft(t: TransactionData, errors: string[] = []): ImportDraft {
	return { sourceIndex: 0, cells: [], importRef: 'r1', errors, txn: t };
}

const messages = (t: TransactionData) => unresolvedReasons(t).map((r) => r.message);

describe('unresolved transactions', () => {
	it('accepts a complete transaction', () => {
		expect(unresolvedReasons(txn())).toEqual([]);
	});

	it('needs a date, two valid accounts, an amount with a currency, and an import-ref', () => {
		expect(messages(txn({ date: '' }))).toEqual(['Date: needs a date (YYYY-MM-DD)']);
		expect(messages(txn({ postings: [{ account: 'Assets:Bank', amount: '-1', currency: 'INR' }] }))).toEqual(['Needs at least two postings']);
		expect(messages(txn({ postings: [{ account: 'Assets:Bank', amount: '-1', currency: 'INR' }, { account: '' }] }))).toEqual(['Posting 2 account: needs an account']);
		expect(messages(txn({ postings: [{ account: 'Assets:Bank', amount: '-1', currency: 'INR' }, { account: 'DR' }] }))).toEqual(['Posting 2 account: "DR" isn\'t an account name']);
		expect(messages(txn({ postings: [{ account: 'Assets:Bank' }, { account: 'Expenses:Food' }] }))).toEqual(['Needs at least one amount']);
		expect(messages(txn({ postings: [{ account: 'Assets:Bank', amount: '-1', currency: '' }, { account: 'Expenses:Food' }] }))).toEqual(['Posting 1 currency: needs a currency']);
		expect(messages(txn({ postings: [{ account: 'Assets:Bank', amount: 'x', currency: 'inr' }, { account: 'Expenses:Food' }] }))).toEqual([
			'Posting 1 amount: "x" isn\'t a number',
			'Posting 1 currency: "inr" isn\'t a currency',
		]);
		expect(messages(txn({ metadata: { 'import-ref': ' ' } }))).toEqual(['import-ref: needs a reference']);
	});

	it('needs accounts that are open in the ledger, when the open accounts are known', () => {
		expect(unresolvedReasons(txn(), new Set(['Assets:Bank', 'Expenses:Food']))).toEqual([]);
		expect(unresolvedReasons(txn(), new Set(['Assets:Bank'])).map((r) => r.message)).toEqual([
			'Posting 2 account: "Expenses:Food" isn\'t open in the ledger. Open it first, or pick another account',
		]);
		// Accounts that couldn't be loaded don't block anything.
		expect(unresolvedReasons(txn(), new Set())).toEqual([]);
	});

	it("explains a missing field with the mapping's error, and keeps other errors as notes", () => {
		const d = draft(txn({ date: '' }), ['Date: can\'t read the date "40/13/2026"', 'Payee: There\'s no column "Nope"']);
		expect(draftProblems(d)).toEqual({
			unresolved: ['Date: can\'t read the date "40/13/2026"'],
			notes: ['Payee: There\'s no column "Nope"'],
		});
	});
});

describe('review rows', () => {
	function rows() {
		const drafts = [
			draft(txn()),
			draft(txn({ date: '' })),
			draft(txn()),
			draft(txn()),
		];
		return createReviewRows(drafts, [{ kind: 'new' }, { kind: 'new' }, { kind: 'imported' }, { kind: 'possible', match: {} as never }]);
	}

	it('ticks only resolved rows that aren\'t already in the ledger', () => {
		const r = rows();
		expect(r.map((row) => row.include)).toEqual([true, false, false, true]);
		expect(r.map((row) => isResolved(row))).toEqual([true, false, true, true]);
	});

	it('filters unresolved rows and possible duplicates as needing attention', () => {
		const r = rows();
		expect(filterRows(r, 'all')).toEqual([0, 1, 2, 3]);
		expect(filterRows(r, 'attention')).toEqual([1, 3]);
		expect(filterRows(r, 'duplicates')).toEqual([2, 3]);
	});
});

describe('editing postings with the Add Transaction form', () => {
	it('round-trips a posting', () => {
		const p = { account: 'Assets:Broker', amount: '10', currency: 'HOOL', cost: { number: '500', currency: 'USD', isTotal: false }, price: { amount: '510', currency: 'USD', isTotal: false }, comment: 'lot', metadata: { note: 'x' } };
		const form = toFormPosting(p);
		expect(fromFormPosting(form, postingParts(form))).toEqual(p);
	});

	it('drops hidden parts, and keeps a currency for when an amount is filled in', () => {
		const form = toFormPosting({ account: ' Expenses:Food ', currency: 'INR', comment: 'c' });
		expect(fromFormPosting(form, { cost: false, price: false, flag: false, comment: false, metadata: false })).toEqual({ account: 'Expenses:Food', currency: 'INR' });
	});
});
