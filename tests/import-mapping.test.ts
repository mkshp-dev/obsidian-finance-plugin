import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { readCsvRows, detectTable, columnLabels, headerSignature, detectCurrency } from '../src/utils/import/csvTable';
import { buildDrafts, checkBalanceChain, parseField, suggestMapping } from '../src/utils/import/mapping';
import { generateTransactionText } from '../src/utils/directives/transactionDirectives';
import type { AccountMatcher, ImportMapping } from '../src/models/import';

const KOTAK = readFileSync(path.join(__dirname, 'fixtures/kotak-statement.csv'), 'utf8');

function loadKotak(text = KOTAK) {
	const rows = readCsvRows(text);
	const bounds = detectTable(rows)!;
	const labels = columnLabels(rows[bounds.headerRow]);
	const data = rows.slice(bounds.firstRow, bounds.lastRow + 1);
	return { rows, bounds, labels, data };
}

function kotakMapping(): ImportMapping {
	const { rows, bounds, labels, data } = loadKotak();
	const m = suggestMapping(labels, data, detectCurrency(rows, bounds.headerRow) ?? '');
	m.postings[0].account = 'Assets:Bank:Kotak';
	return m;
}

describe('finding the table', () => {
	it('skips the account details above and the closing balance and notes below', () => {
		const { rows, bounds, data } = loadKotak();
		expect(rows[bounds.headerRow][0]).toBe('Sl. No.');
		expect(data).toHaveLength(10);
		expect(data[0][0]).toBe('1');
		expect(data[9][0]).toBe('10');
	});

	it('works with Windows line endings and a byte-order mark', () => {
		const { data } = loadKotak('﻿' + KOTAK.replace(/\n/g, '\r\n'));
		expect(data).toHaveLength(10);
	});

	it('numbers repeated column names', () => {
		const { labels } = loadKotak();
		expect(labels).toEqual([
			'Sl. No.', 'Transaction Date', 'Value Date', 'Description', 'Chq /Ref No.',
			'Amount', 'Dr / Cr (1)', 'Balance', 'Dr / Cr (2)',
		]);
		expect(columnLabels(['Date', '', 'Date'])).toEqual(['Date (1)', 'Column 2', 'Date (2)']);
	});

	it('reads the currency from above the table', () => {
		const { rows, bounds } = loadKotak();
		expect(detectCurrency(rows, bounds.headerRow)).toBe('INR');
	});

	it('identifies the format by its header, ignoring case and spacing', () => {
		expect(headerSignature(['Date ', 'Amount'])).toBe(headerSignature(['date', '  AMOUNT']));
	});
});

describe('parseField', () => {
	it('tells plain text from a column', () => {
		expect(parseField(' Assets:Bank ')).toEqual({ text: 'Assets:Bank' });
		expect(parseField('= {{ Value Date }}')).toEqual({ column: 'Value Date' });
		expect(parseField('={{Dr / Cr (1)}}')).toEqual({ column: 'Dr / Cr (1)' });
	});

	it('rejects formulas beyond a single column for now', () => {
		expect(parseField('={{A}} - {{B}}')).toHaveProperty('error');
		expect(parseField('=SUM(A)')).toHaveProperty('error');
	});
});

describe('suggestMapping', () => {
	it('fills the Kotak template', () => {
		const m = kotakMapping();
		expect(m).toMatchObject({
			version: 2,
			date: '={{Value Date}}',
			flag: '*',
			payee: '',
			narration: '={{Description}}',
			tags: [],
			links: ['={{File name}}'],
			metadata: { 'import-ref': '={{Chq /Ref No.}}' },
			postings: [
				{ account: 'Assets:Bank:Kotak', amount: '={{Amount}}', currency: 'INR' },
				{ account: '={{Description}}', amount: '', currency: '' },
			],
			unmatchedAccount: 'Expenses:Uncategorized',
			balanceColumn: 7,
		});
		expect(m.columnTypes[5]).toEqual({ kind: 'number', sign: { mode: 'indicator', column: 6, debitValue: 'DR', creditValue: 'CR' } });
	});

	it('treats a withdrawal column as money out', () => {
		const labels = ['Date', 'Narration', 'Withdrawal Amt.', 'Deposit Amt.', 'Closing Balance'];
		const rows = [
			['01/09/26', 'Coffee', '120.00', '', '880.00'],
			['02/09/26', 'Salary', '', '5,000.00', '5,880.00'],
		];
		const m = suggestMapping(labels, rows);
		expect(m.columnTypes[2]).toEqual({ kind: 'number', sign: { mode: 'negate' } });
		expect(m).toMatchObject({ date: '={{Date}}', narration: '={{Narration}}', balanceColumn: 4, metadata: { 'import-ref': '' } });
	});
});

describe('checkBalanceChain', () => {
	it('finds the order and the opening and closing balances', () => {
		expect(checkBalanceChain(['-10', '5'], ['90', '95'])).toEqual({ ok: true, order: 'asc', opening: '100', closing: '95' });
		expect(checkBalanceChain(['5', '-10'], ['95', '90'])).toEqual({ ok: true, order: 'desc', opening: '100', closing: '95' });
	});

	it('points at the row that breaks the chain', () => {
		expect(checkBalanceChain(['-10', '5', '1'], ['90', '95', '99'])).toMatchObject({ ok: false, breakAt: 2 });
	});
});

describe('buildDrafts on the Kotak statement', () => {
	const { labels, data } = loadKotak();
	const aliases: Record<string, string> = { 'CRED Club': 'Liabilities:CreditCard', 'CAMPUS CANTEEN': 'Expenses:Food:EatingOut' };
	const matcher: AccountMatcher = (text) => {
		const alias = Object.keys(aliases).find((a) => text.includes(a));
		return alias ? { account: aliases[alias], alias } : null;
	};
	const result = buildDrafts(data, labels, kotakMapping(), { matchAccount: matcher, fileName: 'Docs/Kotak Sep 2026.csv' });

	it('confirms the balances add up and orders drafts oldest first', () => {
		expect(result.balance).toEqual({ ok: true, order: 'desc', opening: '1500.00', closing: '49448.24' });
		expect(result.drafts.map((d) => d.txn!.date)).toEqual([
			'2026-08-29', '2026-09-01', '2026-09-02', '2026-09-02', '2026-09-05',
			'2026-09-13', '2026-09-15', '2026-09-15', '2026-09-20', '2026-09-22',
		]);
		// Same-day rows keep the bank's order: the 14,000 credit landed before the 10,994.04 payment.
		expect(result.drafts[6].txn!.postings![0].amount).toBe('14000.00');
		expect(result.drafts[7].txn!.postings![0].amount).toBe('-10994.04');
	});

	it('suggests a closing balance assertion for the day after the last transaction', () => {
		expect(result.closingBalance).toEqual({ date: '2026-09-23', amount: '49448.24' });
	});

	it('writes matched rows with the alias as payee and the file as link', () => {
		expect(generateTransactionText(result.drafts[7].txn!)).toBe([
			'2026-09-15 * "CRED Club" "UPI/CRED Club/UTIB/100000000008/payment on C" ^Kotak-Sep-2026',
			'  import-ref: "UPI-200000000008"',
			'  Assets:Bank:Kotak  -10994.04 INR',
			'  Liabilities:CreditCard',
		].join('\n'));
		expect(result.drafts[7].match).toEqual({ posting: 1, text: 'UPI/CRED Club/UTIB/100000000008/payment on C' });
	});

	it('flags unmatched rows and sends them to the unmatched account', () => {
		expect(generateTransactionText(result.drafts[4].txn!)).toBe([
			'2026-09-05 ! "UPI/RAHUL VERMA/SBIN/100000000005/UPI" ^Kotak-Sep-2026',
			'  import-ref: "UPI-200000000005"',
			'  Assets:Bank:Kotak  100000.00 INR',
			'  Expenses:Uncategorized',
		].join('\n'));
	});

	it('generates a ref when the reference cell is blank', () => {
		const charge = result.drafts[9];
		expect(charge.importRef).toMatch(/^gen-[0-9a-z]+$/);
		expect(buildDrafts(data, labels, kotakMapping()).drafts[9].importRef).toBe(charge.importRef);
		expect(charge.errors).toEqual([]);
	});

	it('uses column text that names an open account as is', () => {
		const m = kotakMapping();
		m.postings[1].account = '={{Dr / Cr (1)}}';
		const [draft] = buildDrafts(data.slice(0, 1), labels, m, { accounts: ['DR'] }).drafts;
		expect(draft.txn!.postings![1].account).toBe('DR');
		expect(draft.txn!.flag).toBe('*');
	});
});

describe('buildDrafts errors', () => {
	const { labels, data } = loadKotak();

	it('reports fields that point at the wrong kind of column', () => {
		const m = kotakMapping();
		m.date = '={{Description}}';
		m.postings[0].amount = '={{Description}}';
		const [draft] = buildDrafts(data.slice(0, 1), labels, m).drafts;
		expect(draft.txn).toBeNull();
		expect(draft.errors).toEqual([
			'Date: "Description" isn\'t a Date column',
			'Posting 1 amount: "Description" isn\'t a Number column',
		]);
	});

	it('reports unknown columns, unsupported formulas and missing pieces', () => {
		const m = kotakMapping();
		m.payee = '={{Nope}}';
		m.narration = '={{A}} {{B}}';
		m.postings[0].account = '';
		m.postings[0].currency = '';
		m.postings[1].amount = '';
		const [draft] = buildDrafts(data.slice(0, 1), labels, m).drafts;
		expect(draft.errors).toEqual([
			'Narration: "={{A}} {{B}}" isn\'t supported yet. Use ={{Column name}}',
			'Payee: there\'s no column "Nope"',
			'Posting 1 needs an account',
			'Posting 1 needs a currency',
		]);
	});

	it('allows only one posting without an amount', () => {
		const m = kotakMapping();
		m.postings[0].amount = '';
		expect(buildDrafts(data.slice(0, 1), labels, m).drafts[0].errors).toEqual(['Only one posting can be left without an amount']);
	});
});

describe('buildDrafts with constants and no balance column', () => {
	const labels = ['Date', 'Text', 'Amount'];
	const mapping: ImportMapping = {
		version: 2,
		decimalMark: ',',
		columnTypes: [{ kind: 'date', order: 'YMD' }, { kind: 'text' }, { kind: 'number', sign: { mode: 'asis' } }],
		date: '={{Date}}', flag: '*', payee: 'Canteen', narration: '={{Text}}',
		tags: ['imported', '={{Text}}'], links: [],
		metadata: { 'import-ref': '', source: 'bank' },
		postings: [
			{ account: 'Assets:Bank', amount: '={{Amount}}', currency: 'EUR' },
			{ account: 'Expenses:Misc', amount: '', currency: '' },
		],
		unmatchedAccount: 'Expenses:Uncategorized', payeeFromAlias: true, balanceColumn: null,
	};

	it('uses plain text as written for every row', () => {
		const [d] = buildDrafts([['2026-09-02', 'Lunch out', '-10,00']], labels, mapping).drafts;
		expect(generateTransactionText(d.txn!)).toBe([
			'2026-09-02 * "Canteen" "Lunch out" #imported #Lunch-out',
			`  import-ref: "${d.importRef}"`,
			'  source: "bank"',
			'  Assets:Bank  -10.00 EUR',
			'  Expenses:Misc',
		].join('\n'));
	});

	it('numbers identical rows so both are kept', () => {
		const rows = [['2026-09-02', 'Canteen', '-10,00'], ['2026-09-02', 'Canteen', '-10,00']];
		const [a, b] = buildDrafts(rows, labels, mapping).drafts;
		expect(b.importRef).toBe(`${a.importRef}-2`);
	});

	it('orders a newest-first file by date', () => {
		const rows = [['2026-09-03', 'B', '-1,00'], ['2026-09-01', 'A', '-2,00']];
		expect(buildDrafts(rows, labels, mapping).drafts.map((d) => d.txn!.narration)).toEqual(['A', 'B']);
	});

	it('keeps unreadable rows with their errors', () => {
		const [draft] = buildDrafts([['2026-13-40', 'X', 'abc']], labels, mapping).drafts;
		expect(draft.txn).toBeNull();
		expect(draft.errors).toEqual(['Date: can\'t read "2026-13-40"', 'Posting 1 amount: can\'t read the number "abc"']);
	});
});
