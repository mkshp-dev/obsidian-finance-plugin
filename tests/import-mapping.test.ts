import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { readCsvRows, detectTable, columnLabels, headerSignature, detectStatementBalance } from '../src/utils/import/csvTable';
import { blankMapping, buildDrafts, checkField, formatLookup, impliedOpening, isAccountName, parseField, statementAssertions, statementDifference, typeEnv } from '../src/utils/import/mapping';
import { detectColumnTypes } from '../src/utils/import/columns';
import { generateTransactionText } from '../src/utils/directives/transactionDirectives';
import type { ImportMapping } from '../src/models/import';
import type { AccountAliases } from '../src/utils/import/aliases';

const KOTAK = readFileSync(path.join(__dirname, 'fixtures/kotak-statement.csv'), 'utf8');

function loadKotak(text = KOTAK) {
	const rows = readCsvRows(text);
	const bounds = detectTable(rows)!;
	const labels = columnLabels(rows[bounds.headerRow]);
	const data = rows.slice(bounds.firstRow, bounds.lastRow + 1);
	return { rows, bounds, labels, data };
}

function kotakMapping(): ImportMapping {
	const { labels, data } = loadKotak();
	return {
		version: 5,
		decimalMark: '.',
		columnTypes: detectColumnTypes(data, labels.length),
		date: '=FORMAT_DATE({{Value Date}}, "YYYY-MM-DD")',
		flag: '*',
		payee: '=ALIAS WHERE {{Description}} CONTAINS ALIAS',
		narration: '={{Description}}',
		tags: [],
		links: ['={{File name}}'],
		metadata: { 'import-ref': '={{Chq /Ref No.}}' },
		postings: [
			{ account: 'Assets:Bank:Kotak', amount: '=IF {{Dr / Cr (1)}} == "DR" THEN -{{Amount}} ELSE {{Amount}}', currency: 'INR' },
			{ account: '=ACCOUNT WHERE {{Description}} CONTAINS ALIAS ELSE "Expenses:Uncategorized"', amount: '', currency: '' },
		],
	};
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

	it('finds the closing balance below the table', () => {
		const { rows, bounds } = loadKotak();
		expect(detectStatementBalance(rows, bounds, '.', 'closing')).toEqual({ amount: '49448.24', row: bounds.lastRow + 1 });
		expect(detectStatementBalance(rows, bounds, '.', 'opening')).toBeNull();
	});

	it('finds the balances before and after wherever they are, or nothing', () => {
		const rows = [
			['Opening Balance as on 01/09/2026', '1.000,00'], ['Closing balance', '1.234,50'],
			['Date', 'Text', 'Amount'], ['2026-09-01', 'x', '1,00'], ['Balance B/F', '7,00'],
		];
		const bounds = { headerRow: 2, firstRow: 3, lastRow: 3 };
		expect(detectStatementBalance(rows, bounds, ',', 'opening')).toEqual({ amount: '1000.00', row: 0 });
		expect(detectStatementBalance(rows, bounds, ',', 'closing')).toEqual({ amount: '1234.50', row: 1 });
		expect(detectStatementBalance(rows.slice(2, 4), { headerRow: 0, firstRow: 1, lastRow: 1 }, ',', 'closing')).toBeNull();
		// An opening line that says "as on" isn't taken for the closing balance.
		expect(detectStatementBalance([rows[0], ...rows.slice(2, 4)], { headerRow: 1, firstRow: 2, lastRow: 2 }, ',', 'closing')).toBeNull();
	});

	it('identifies the format by its header, ignoring case and spacing', () => {
		expect(headerSignature(['Date ', 'Amount'])).toBe(headerSignature(['date', '  AMOUNT']));
	});
});

describe('parseField', () => {
	it('tells plain text from a formula', () => {
		expect(parseField(' Assets:Bank ')).toEqual({ text: 'Assets:Bank' });
		expect(parseField('= {{ Value Date }}')).toEqual({ expr: { type: 'column', name: 'Value Date' } });
		expect(parseField('={{Dr / Cr (1)}}')).toEqual({ expr: { type: 'column', name: 'Dr / Cr (1)' } });
	});

	it('reads alias lookups', () => {
		expect(parseField('=alias where {{ Payee }} equals alias else {{Description}}')).toEqual({
			expr: { type: 'lookup', returns: 'alias', operand: { type: 'column', name: 'Payee' }, mode: 'exact', fallback: { type: 'column', name: 'Description' } },
		});
	});

	it('reports formulas it can\'t read', () => {
		expect(parseField('=SUM(A)')).toEqual({ error: "There's no function SUM" });
		expect(parseField('=ACCOUNT WHERE {{A}} LIKE ALIAS')).toHaveProperty('error');
		expect(parseField('=ACCOUNT WHERE {{A}} = ALIAS')).toEqual({ error: 'Use == to compare' });
	});

	it('builds lookups that read back', () => {
		const text = formatLookup({ returns: 'account', column: 'Description', mode: 'contains', fallback: { text: 'Say "hi"' } });
		expect(text).toBe('=ACCOUNT WHERE {{Description}} CONTAINS ALIAS ELSE "Say \\"hi\\""');
		expect(parseField(text)).toMatchObject({ expr: { type: 'lookup', fallback: { type: 'text', value: 'Say "hi"' } } });
	});
});

describe('checkField', () => {
	const { labels } = loadKotak();
	const env = typeEnv(labels, kotakMapping().columnTypes);

	it('checks a formula fits its field', () => {
		expect(checkField('={{Value Date}}', 'date', env)).toBe('');
		expect(checkField('={{Description}}', 'date', env)).toBe('"Description" isn\'t a Date column');
		expect(checkField('={{Amount}} - {{Balance}}', 'number', env)).toBe('');
		expect(checkField('={{Amount}} + " INR"', 'number', env)).toBe('This gives text, but a number is needed here');
		expect(checkField('={{Amount}} > 0', 'text', env)).toBe('This gives true/false. Use IF … THEN … ELSE to choose a value');
		expect(checkField('=ALIAS WHERE {{Description}} CONTAINS ALIAS', 'number', env)).toBe('Alias lookups only give text, not dates or numbers');
		expect(checkField('={{File name}}', 'text', env)).toBe('');
	});

	it('refuses ignored columns', () => {
		const types = kotakMapping().columnTypes;
		types[0] = { kind: 'ignore' };
		expect(checkField('={{Sl. No.}}', 'text', typeEnv(labels, types))).toBe('"Sl. No." is set to Ignore in the Table step');
	});
});

describe('isAccountName', () => {
	it('follows beancount account syntax', () => {
		for (const a of ['Assets:Bank', 'Expenses:Food-2026:Café', 'Liabilities:CC:2026']) expect(isAccountName(a)).toBe(true);
		for (const a of ['Assets', 'assets:bank', 'Assets:bank', 'Assets:Bank ', 'Expenses:…', 'Assets::Bank', 'Assets:Bank:']) expect(isAccountName(a)).toBe(false);
	});
});

describe('buildDrafts on the Kotak statement', () => {
	const { labels, data } = loadKotak();
	const aliases: AccountAliases[] = [
		{ account: 'Liabilities:CreditCard', aliases: ['CRED Club'] },
		{ account: 'Expenses:Food:EatingOut', aliases: ['CAMPUS CANTEEN'] },
	];
	const result = buildDrafts(data, labels, kotakMapping(), { aliases, fileName: 'Docs/Kotak Sep 2026.csv' });

	it('orders drafts oldest first', () => {
		expect(result.drafts.map((d) => d.txn!.date)).toEqual([
			'2026-08-29', '2026-09-01', '2026-09-02', '2026-09-02', '2026-09-05',
			'2026-09-13', '2026-09-15', '2026-09-15', '2026-09-20', '2026-09-22',
		]);
		// Same-day rows keep the bank's order: the 14,000 credit landed before the 10,994.04 payment.
		expect(result.drafts[6].txn!.postings![0].amount).toBe('14000.00');
		expect(result.drafts[7].txn!.postings![0].amount).toBe('-10994.04');
	});

	it('dates balance assertions around the transactions', () => {
		expect(statementAssertions(result.drafts, '1500.00', '49448.24')).toEqual([
			{ kind: 'opening', date: '2026-08-29', amount: '1500.00', include: true },
			{ kind: 'closing', date: '2026-09-23', amount: '49448.24', include: true },
		]);
		expect(statementAssertions(result.drafts, null, '49448.24').map((a) => a.kind)).toEqual(['closing']);
		expect(statementAssertions(result.drafts, null, null)).toEqual([]);
	});

	it('checks the rows explain the balances before and after', () => {
		expect(impliedOpening(result.drafts, '49448.24')).toBe('1500.00');
		expect(statementDifference(result.drafts, '1500.00', '49448.24')).toBe('0.00');
		expect(statementDifference(result.drafts, '1600.00', '49448.24')).toBe('-100.00');
		const m = kotakMapping();
		m.date = '={{Description}}';
		expect(impliedOpening(buildDrafts(data, labels, m).drafts, '49448.24')).toBeNull();
	});

	it('writes matched rows with the alias as payee and the file as link', () => {
		expect(generateTransactionText(result.drafts[7].txn!)).toBe([
			'2026-09-15 * "CRED Club" "UPI/CRED Club/UTIB/100000000008/payment on C" ^Kotak-Sep-2026',
			'  import-ref: "UPI-200000000008"',
			'  Assets:Bank:Kotak  -10994.04 INR',
			'  Liabilities:CreditCard',
		].join('\n'));
		expect(result.drafts[7].match).toEqual({
			posting: 1, text: 'UPI/CRED Club/UTIB/100000000008/payment on C', mode: 'contains', matched: true, fallback: '', payeeIsAlias: true,
		});
		expect(result.drafts[7].lookups).toEqual({ Payee: true, 'Posting 2 account': true });
	});

	it('flags unmatched rows and sends them to the ELSE account', () => {
		expect(generateTransactionText(result.drafts[4].txn!)).toBe([
			'2026-09-05 ! "UPI/RAHUL VERMA/SBIN/100000000005/UPI" ^Kotak-Sep-2026',
			'  import-ref: "UPI-200000000005"',
			'  Assets:Bank:Kotak  100000.00 INR',
			'  Expenses:Uncategorized',
		].join('\n'));
	});

	it('records which rows each field gave a value for', () => {
		const count = (what: string) => result.drafts.filter((d) => d.filled?.[what]).length;
		expect(count('Date')).toBe(10);
		expect(count('Payee')).toBe(4);
		expect(count('import-ref')).toBe(9);
		expect(count('Posting 2 account')).toBe(10);
		expect(count('Posting 2 amount')).toBe(0);
	});

	it('generates a ref when the reference cell is blank', () => {
		const charge = result.drafts[9];
		expect(charge.importRef).toMatch(/^gen-[0-9a-z]+$/);
		expect(buildDrafts(data, labels, kotakMapping()).drafts[9].importRef).toBe(charge.importRef);
		expect(charge.errors).toEqual([]);
	});

	it('uses a plain column as the account name, without looking up aliases', () => {
		const m = kotakMapping();
		m.postings[1].account = '={{Dr / Cr (1)}}';
		const [draft] = buildDrafts(data.slice(0, 1), labels, m, { aliases }).drafts;
		expect(draft.match).toBeUndefined();
		// "DR" is used as written, so it isn't an account.
		expect(draft.txn).toBeNull();
		expect(draft.errors).toEqual(['Posting 2 account: "DR" isn\'t an account name']);
	});

	it("rejects an ELSE that isn't an account yet, like the ACCOUNT WHERE button's placeholder", () => {
		const m = kotakMapping();
		m.postings[1].account = '=ACCOUNT WHERE {{Description}} CONTAINS ALIAS ELSE "Expenses:…"';
		const drafts = buildDrafts(data, labels, m, { aliases }).drafts;
		expect(drafts.some((d) => d.txn?.postings![1].account === 'Expenses:Food:EatingOut')).toBe(true);
		expect(drafts.filter((d) => !d.txn).every((d) => d.errors[0] === 'Posting 2 account: "Expenses:…" isn\'t an account name')).toBe(true);
		expect(drafts.some((d) => !d.txn)).toBe(true);
	});

	it('matches the whole text with EQUALS', () => {
		const m = kotakMapping();
		m.postings[1].account = '=ACCOUNT WHERE {{Description}} EQUALS ALIAS ELSE "Expenses:Uncategorized"';
		const exact: AccountAliases[] = [{ account: 'Expenses:Bank:Fees', aliases: ['chrg:sms  alert fee for the month of aug26'] }, ...aliases];
		const drafts = buildDrafts(data, labels, m, { aliases: exact }).drafts;
		expect(drafts[9].txn!.postings![1].account).toBe('Expenses:Bank:Fees');
		// "CRED Club" is only part of the text, so EQUALS doesn't match it.
		expect(drafts[7].txn!.postings![1].account).toBe('Expenses:Uncategorized');
	});

	it('falls back to another column, or reports a lookup with nowhere to go', () => {
		const m = kotakMapping();
		m.payee = '=ALIAS WHERE {{Description}} CONTAINS ALIAS ELSE {{Chq /Ref No.}}';
		m.postings[1].account = '=ACCOUNT WHERE {{Description}} CONTAINS ALIAS';
		const [draft] = buildDrafts(data.slice(1, 2), labels, m, { aliases }).drafts;
		expect(draft.errors).toEqual(['Posting 2: no alias matched "UPI/City Mall/ICIC/100000000009/UPI" and there\'s no ELSE']);
		expect(buildDrafts(data.slice(2, 3), labels, m, { aliases }).drafts[0].txn!.payee).toBe('CRED Club');
	});

	it('refuses lookups in dates and amounts', () => {
		const m = kotakMapping();
		m.postings[0].amount = '=ALIAS WHERE {{Description}} CONTAINS ALIAS';
		expect(buildDrafts(data.slice(0, 1), labels, m).drafts[0].errors).toEqual(['Posting 1 amount: Alias lookups only give text, not dates or numbers']);
	});
});

describe('the Date field', () => {
	const { labels, data } = loadKotak();

	it('takes a date column as written, so it has to be a Beancount date', () => {
		const m = kotakMapping();
		m.date = '={{Value Date}}';
		const [draft] = buildDrafts(data.slice(0, 1), labels, m).drafts;
		expect(draft.txn).toBeNull();
		expect(draft.errors).toEqual([`Date: "22-09-2026" isn't a Beancount date (YYYY-MM-DD). Try =FORMAT_DATE({{Value Date}}, "YYYY-MM-DD")`]);
		expect(draft.filled?.Date).toBe(false);
	});

	it('works with date functions', () => {
		const m = kotakMapping();
		m.date = '=ADD_DAYS({{Value Date}}, 1)';
		m.narration = '=FORMAT_DATE({{Transaction Date}}, "D MMM YYYY") + " · " + {{Value Date}}';
		m.tags = ['=FORMAT_DATE({{Value Date}}, "YYYY-MM")'];
		const [draft] = buildDrafts(data.slice(0, 1), labels, m).drafts;
		expect(draft.txn).toMatchObject({ date: '2026-09-23', narration: '22 Sep 2026 · 22-09-2026', tags: ['2026-09'] });
	});

	it('reads dates out of text with DATE', () => {
		const m = kotakMapping();
		m.date = '=FORMAT_DATE(DATE(SPLIT({{Transaction Date}}, " ", 1), "DD-MM-YYYY"), "YYYY-MM-DD")';
		m.payee = '=IF MONTH({{Value Date}}) == 9 AND YEAR({{Value Date}}) == 2026 THEN "September" ELSE "other"';
		const [draft] = buildDrafts(data.slice(0, 1), labels, m).drafts;
		expect(draft.txn).toMatchObject({ date: '2026-09-22', payee: 'September' });
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

	it('reports unknown columns, unreadable formulas and missing pieces', () => {
		const m = kotakMapping();
		m.payee = '={{Nope}}';
		m.narration = '={{A}} {{B}}';
		m.postings[0].account = '';
		m.postings[0].currency = '';
		m.postings[1].amount = '';
		const [draft] = buildDrafts(data.slice(0, 1), labels, m).drafts;
		expect(draft.errors).toEqual([
			'Narration: Unexpected {{B}}',
			'Payee: There\'s no column "Nope"',
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

describe('buildDrafts with constants', () => {
	const labels = ['Date', 'Text', 'Amount'];
	const mapping: ImportMapping = {
		version: 5,
		decimalMark: ',',
		columnTypes: [{ kind: 'date', order: 'YMD' }, { kind: 'text' }, { kind: 'number' }],
		date: '={{Date}}', flag: '*', payee: 'Canteen', narration: '={{Text}}',
		tags: ['imported', '={{Text}}'], links: [],
		metadata: { 'import-ref': '', source: 'bank' },
		postings: [
			{ account: 'Assets:Bank', amount: '={{Amount}}', currency: 'EUR' },
			{ account: 'Expenses:Misc', amount: '', currency: '' },
		],
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
		expect(draft.errors).toEqual(['Date: can\'t read the date "2026-13-40"', 'Posting 1 amount: can\'t read the number "abc"']);
	});
});

describe('formulas in the template', () => {
	const { labels, data } = loadKotak();
	const aliases: AccountAliases[] = [{ account: 'Liabilities:CreditCard', aliases: ['CRED Club'] }];

	it('routes charges, income and aliases with IF', () => {
		const m = kotakMapping();
		m.postings[1].account = '=IF {{Description}} STARTS WITH "CHRG:" THEN "Expenses:Bank:Fees" '
			+ 'ELSE IF {{Dr / Cr (1)}} == "CR" THEN "Income:Transfers" '
			+ 'ELSE ACCOUNT WHERE {{Description}} CONTAINS ALIAS ELSE "Expenses:Uncategorized"';
		m.payee = '=ALIAS WHERE {{Description}} CONTAINS ALIAS ELSE SPLIT({{Description}}, "/", 2)';
		const drafts = buildDrafts(data, labels, m, { aliases }).drafts;
		const byRef = (ref: string) => drafts.find((d) => d.importRef === ref)!.txn!;

		expect(drafts[9].txn).toMatchObject({ flag: '*', postings: [{}, { account: 'Expenses:Bank:Fees' }] });
		expect(byRef('UPI-200000000005')).toMatchObject({ flag: '*', payee: 'RAHUL VERMA', postings: [{}, { account: 'Income:Transfers' }] });
		expect(byRef('UPI-200000000008')).toMatchObject({ flag: '*', payee: 'CRED Club', postings: [{}, { account: 'Liabilities:CreditCard' }] });
		expect(byRef('UPI-200000000009')).toMatchObject({ flag: '!', payee: 'City Mall', postings: [{}, { account: 'Expenses:Uncategorized' }] });
		// Rows decided by IF before the lookup aren't offered for categorizing.
		expect(drafts[9].match).toBeUndefined();
		expect(byRef('UPI-200000000009').postings![1].account).toBe('Expenses:Uncategorized');
	});

	it('combines split withdrawal and deposit columns', () => {
		const splitLabels = ['Date', 'Narration', 'Withdrawal Amt.', 'Deposit Amt.'];
		const rows = [['01/09/26', 'Coffee', '120.00', ''], ['02/09/26', 'Salary', '', '5,000.00']];
		const m = blankMapping(detectColumnTypes(rows, splitLabels.length));
		m.date = '=FORMAT_DATE({{Date}}, "YYYY-MM-DD")';
		m.postings[0] = { account: 'Assets:Bank:HDFC', amount: '={{Deposit Amt.}} - {{Withdrawal Amt.}}', currency: 'INR' };
		m.postings[1].account = 'Expenses:Misc';
		const drafts = buildDrafts(rows, splitLabels, m).drafts;
		expect(drafts.map((d) => d.txn!.postings![0].amount)).toEqual(['-120.00', '5000.00']);
	});

	it('joins text with + in the narration', () => {
		const m = kotakMapping();
		m.narration = '=SPLIT({{Description}}, "/", 2) + " (" + {{Chq /Ref No.}} + ")"';
		expect(buildDrafts(data.slice(1, 2), labels, m).drafts[0].txn!.narration).toBe('City Mall (UPI-200000000009)');
	});
});

describe('starting blank', () => {
	const types = kotakMapping().columnTypes;

	it('starts like an empty Add Transaction form', () => {
		expect(blankMapping(types)).toMatchObject({
			date: '', payee: '', narration: '', tags: [], links: ['={{File name}}'],
			metadata: { 'import-ref': '' },
			postings: [{ account: '', amount: '', currency: '' }, { account: '', amount: '', currency: '' }],
		});
	});
});
