import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { readCsvRows, detectTable, columnLabels, headerSignature, detectCurrency } from '../src/utils/import/csvTable';
import { buildDrafts, checkBalanceChain, readAmount, renderTemplate, suggestMapping } from '../src/utils/import/mapping';
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
	return { ...suggestMapping(labels, data, detectCurrency(rows, bounds.headerRow) ?? ''), account: 'Assets:Bank:Kotak' };
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

describe('suggestMapping', () => {
	it('guesses the Kotak layout', () => {
		expect(kotakMapping()).toMatchObject({
			currency: 'INR',
			date: { column: 2, order: 'DMY' },
			amount: { mode: 'indicator', column: 5, indicatorColumn: 6, debitValue: 'DR', creditValue: 'CR' },
			balance: { mode: 'indicator', column: 7, indicatorColumn: 8 },
			narration: '{{Description}}',
			importRef: { mode: 'column', column: 4 },
			counterAccount: { mode: 'aliases', fallback: 'Expenses:Uncategorized' },
		});
	});

	it('detects separate withdrawal and deposit columns', () => {
		const labels = ['Date', 'Narration', 'Withdrawal Amt.', 'Deposit Amt.', 'Closing Balance'];
		const rows = [
			['01/09/26', 'Coffee', '120.00', '', '880.00'],
			['02/09/26', 'Salary', '', '5,000.00', '5,880.00'],
		];
		expect(suggestMapping(labels, rows)).toMatchObject({
			date: { column: 0, order: 'DMY' },
			amount: { mode: 'split', debitColumn: 2, creditColumn: 3 },
			balance: { mode: 'signed', column: 4 },
			narration: '{{Narration}}',
			importRef: { mode: 'generate' },
		});
	});
});

describe('readAmount', () => {
	it('signs amounts from an indicator column', () => {
		const src = { mode: 'indicator', column: 0, indicatorColumn: 1, debitValue: 'DR', creditValue: 'CR' } as const;
		expect(readAmount(src, ['889.00', 'DR'], '.')).toEqual({ amount: '-889.00' });
		expect(readAmount(src, ['889.00', 'cr'], '.')).toEqual({ amount: '889.00' });
		expect(readAmount(src, ['889.00', ''], '.')).toHaveProperty('error');
	});

	it('combines debit and credit columns', () => {
		const src = { mode: 'split', debitColumn: 0, creditColumn: 1 } as const;
		expect(readAmount(src, ['120.00', ''], '.')).toEqual({ amount: '-120.00' });
		expect(readAmount(src, ['', '5,000.00'], '.')).toEqual({ amount: '5000.00' });
		expect(readAmount(src, ['', ''], '.')).toHaveProperty('error');
	});

	it('can invert a signed column', () => {
		expect(readAmount({ mode: 'signed', column: 0, invert: true }, ['250.00'], '.')).toEqual({ amount: '-250.00' });
	});
});

describe('renderTemplate', () => {
	it('fills columns and collapses padding', () => {
		expect(renderTemplate('{{ Name }}: {{Note}}', ['Name', 'Note'], ['RAHUL   VERMA', 'rent'])).toEqual({ text: 'RAHUL VERMA: rent', missing: [] });
	});

	it('reports unknown columns', () => {
		expect(renderTemplate('{{Nope}}', ['Name'], ['x']).missing).toEqual(['Nope']);
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
	const result = buildDrafts(data, labels, kotakMapping(), matcher);

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

	it('writes matched rows with the alias as payee', () => {
		const text = generateTransactionText(result.drafts[7].txn!);
		expect(text).toBe([
			'2026-09-15 * "CRED Club" "UPI/CRED Club/UTIB/100000000008/payment on C"',
			'  import-ref: "UPI-200000000008"',
			'  Assets:Bank:Kotak  -10994.04 INR',
			'  Liabilities:CreditCard',
		].join('\n'));
	});

	it('flags unmatched rows and sends them to the fallback account', () => {
		const text = generateTransactionText(result.drafts[4].txn!);
		expect(text).toBe([
			'2026-09-05 ! "UPI/RAHUL VERMA/SBIN/100000000005/UPI"',
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
});

describe('buildDrafts without a balance column', () => {
	const mapping: ImportMapping = {
		account: 'Assets:Bank', currency: 'EUR', decimalMark: ',',
		date: { column: 0, order: 'YMD' },
		amount: { mode: 'signed', column: 2 },
		payee: '', narration: '{{Text}}', matchText: '{{Text}}', payeeFromAlias: true,
		counterAccount: { mode: 'fixed', account: 'Expenses:Misc' },
		importRef: { mode: 'generate' },
	};
	const labels = ['Date', 'Text', 'Amount'];

	it('numbers identical rows so both are kept', () => {
		const rows = [['2026-09-02', 'Canteen', '-10,00'], ['2026-09-02', 'Canteen', '-10,00']];
		const [a, b] = buildDrafts(rows, labels, mapping).drafts;
		expect(b.importRef).toBe(`${a.importRef}-2`);
		expect(a.txn!.flag).toBe('*');
	});

	it('orders a newest-first file by date', () => {
		const rows = [['2026-09-03', 'B', '-1,00'], ['2026-09-01', 'A', '-2,00']];
		expect(buildDrafts(rows, labels, mapping).drafts.map((d) => d.txn!.narration)).toEqual(['A', 'B']);
	});

	it('keeps unreadable rows with their errors', () => {
		const [draft] = buildDrafts([['2026-13-40', 'X', 'abc']], labels, mapping).drafts;
		expect(draft.txn).toBeNull();
		expect(draft.errors).toEqual(['Can\'t read date "2026-13-40"', 'Can\'t read amount "abc"']);
	});
});
