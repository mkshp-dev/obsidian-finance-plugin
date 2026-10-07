import { describe, it, expect, vi } from 'vitest';
import { addAlias, createAliasMatcher, parseAliases } from '../src/utils/import/aliases';
import { findDuplicates, type LedgerPosting } from '../src/utils/import/duplicates';
import { checkOpeningBalance, loadAccountAliases, lookupDuplicates } from '../src/services/import.service';
import type { ImportDraft } from '../src/models/import';
import type BeancountPlugin from '../src/main';

// Responses copied from bean-query 0.2.0 (beancount 3.2.3), including its padded numbers.
vi.mock('../src/utils/queryRunner', () => ({
	runQuery: vi.fn((_plugin: unknown, query: string) => {
		if (query.includes("open.meta['aliases']")) {
			return Promise.resolve('account,aliases\nLiabilities:CreditCard,CRED Club|cred\nExpenses:Food:EatingOut,CAMPUS CANTEEN\n');
		}
		if (query.includes('SELECT DISTINCT')) {
			expect(query).toContain('date >= 2026-08-26 AND date <= 2026-09-22');
			return Promise.resolve('ref\nUPI-4\n');
		}
		if (query.includes('filename, lineno')) {
			return Promise.resolve([
				'date,number,currency,payee,narration,ref,filename,lineno',
				'2026-09-02,   -10.00,INR,CAMPUS CANTEEN,UPI/CAMPUS CANTEEN/...,UPI-4,/v/2026.beancount,15',
				'2026-09-14,-53615.76,INR,Card bill,manual entry,,/v/2026.beancount,19',
			].join('\n'));
		}
		if (query.includes('sum(number)')) {
			return Promise.resolve(query.includes('2026-09-01') ? 'balance\n1450.00\n' : 'balance\n');
		}
		throw new Error(`Unexpected query: ${query}`);
	}),
}));

const plugin = {} as BeancountPlugin;

function draft(date: string, amount: string, importRef: string): ImportDraft {
	return {
		sourceIndex: 0, cells: [], importRef, errors: [],
		txn: { date, postings: [{ account: 'Assets:Bank:Kotak', amount, currency: 'INR' }, { account: 'Expenses:Uncategorized' }] },
	};
}

function posting(date: string, amount: string, importRef = ''): LedgerPosting {
	return { date, amount, currency: 'INR', payee: '', narration: '', importRef, filename: 'f', lineno: 1 };
}

describe('aliases', () => {
	it('parses and extends an aliases value', () => {
		expect(parseAliases(' CRED Club | cred ||')).toEqual(['CRED Club', 'cred']);
		expect(addAlias('CRED Club', 'City  Mall')).toBe('CRED Club|City Mall');
		expect(addAlias('CRED Club', 'cred club')).toBe('CRED Club');
		expect(addAlias('', 'a|b')).toBe('a b');
	});

	const match = createAliasMatcher([
		{ account: 'Liabilities:CreditCard', aliases: ['cred'] },
		{ account: 'Expenses:Food:EatingOut', aliases: ['CAMPUS CANTEEN', 'Priya Sharma'] },
		{ account: 'Expenses:Food:Snacks', aliases: ['campus canteen juice'] },
	]);

	it('matches ignoring case and extra spaces', () => {
		expect(match('UPI/PRIYA  SHARMA/CBIN/100000000007/Returning CH')).toEqual({ account: 'Expenses:Food:EatingOut', alias: 'Priya Sharma' });
	});

	it("doesn't match inside a longer word", () => {
		expect(match('UPI/CRED Club/UTIB/1/payment on C')?.account).toBe('Liabilities:CreditCard');
		expect(match('CREDIT INTEREST CAPITALISED')).toBeNull();
	});

	it('prefers the longest alias', () => {
		expect(match('UPI/CAMPUS CANTEEN JUICE/UTIB')?.account).toBe('Expenses:Food:Snacks');
		expect(match('UPI/CAMPUS CANTEEN/UTIB')?.account).toBe('Expenses:Food:EatingOut');
	});

	it('loads aliases from open directives', async () => {
		expect(await loadAccountAliases(plugin)).toEqual([
			{ account: 'Liabilities:CreditCard', aliases: ['CRED Club', 'cred'] },
			{ account: 'Expenses:Food:EatingOut', aliases: ['CAMPUS CANTEEN'] },
		]);
	});
});

describe('findDuplicates', () => {
	it('marks rows whose ref is already in the ledger', () => {
		expect(findDuplicates([draft('2026-09-02', '-10.00', 'UPI-4')], new Set(['UPI-4']), [])).toEqual([{ kind: 'imported' }]);
	});

	it('flags a same-amount posting within the window, closest date first', () => {
		const near = posting('2026-09-14', '-53615.76');
		const [status] = findDuplicates([draft('2026-09-13', '-53615.76', 'UPI-6')], new Set(), [posting('2026-09-10', '-53615.76'), near]);
		expect(status).toEqual({ kind: 'possible', match: near });
	});

	it('ignores other amounts and dates outside the window', () => {
		const statuses = findDuplicates(
			[draft('2026-09-13', '-100.00', 'a'), draft('2026-09-20', '-5.00', 'b')],
			new Set(),
			[posting('2026-09-13', '-100.01'), posting('2026-09-16', '-5.00')],
		);
		expect(statuses).toEqual([{ kind: 'new' }, { kind: 'new' }]);
	});

	it('matches each ledger posting to one row only', () => {
		const statuses = findDuplicates(
			[draft('2026-09-02', '-10.00', 'a'), draft('2026-09-02', '-10.00', 'b')],
			new Set(),
			[posting('2026-09-02', '-10')],
		);
		expect(statuses.map((s) => s.kind)).toEqual(['possible', 'new']);
	});

	it("doesn't offer a posting already claimed by a ref match", () => {
		const statuses = findDuplicates(
			[draft('2026-09-02', '-10.00', 'UPI-3'), draft('2026-09-02', '-10.00', 'UPI-4')],
			new Set(['UPI-4']),
			[posting('2026-09-02', '-10.00', 'UPI-4')],
		);
		expect(statuses.map((s) => s.kind)).toEqual(['new', 'imported']);
	});
});

describe('ledger lookups', () => {
	it('checks the statement against the ledger around its dates', async () => {
		const statuses = await lookupDuplicates(plugin, 'Assets:Bank:Kotak', [
			draft('2026-09-02', '-10.00', 'UPI-3'),
			draft('2026-09-02', '-10.00', 'UPI-4'),
			draft('2026-09-13', '-53615.76', 'UPI-6'),
			draft('2026-09-15', '-10994.04', 'UPI-8'),
		]);
		expect(statuses.map((s) => s.kind)).toEqual(['new', 'imported', 'possible', 'new']);
		expect(statuses[2]).toMatchObject({ match: { payee: 'Card bill', filename: '/v/2026.beancount', lineno: 19 } });
	});

	it('compares the opening balance with the ledger', async () => {
		expect(await checkOpeningBalance(plugin, 'Assets:Bank:Kotak', 'INR', '2026-09-01', '1500.00'))
			.toEqual({ ok: false, ledger: '1450.00', statement: '1500.00', difference: '50.00' });
	});

	it('treats an account with no history as zero', async () => {
		expect(await checkOpeningBalance(plugin, 'Assets:Bank:Kotak', 'INR', '2020-01-01', '0.00'))
			.toMatchObject({ ok: true, ledger: '0' });
	});
});
