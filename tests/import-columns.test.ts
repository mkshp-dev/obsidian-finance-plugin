import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { readCsvRows, decodeText, detectDelimiter, detectTable, detectHeaderlessTable, detectStatementBalance, columnLabels, findHeaderRow, headerSignature, tableFromHeader, tableWidth } from '../src/utils/import/csvTable';
import { columnCheck, columnFits, detectColumnTypes, detectDecimalMark, readNumber, unreadableValues } from '../src/utils/import/columns';
import type { ColumnType } from '../src/models/import';

const rows = readCsvRows(readFileSync(path.join(__dirname, 'fixtures/kotak-statement.csv'), 'utf8'));
const bounds = detectTable(rows)!;
const labels = columnLabels(rows[bounds.headerRow!]);
const data = rows.slice(bounds.firstRow, bounds.lastRow + 1);

describe('detectColumnTypes', () => {
	it('guesses each Kotak column, without changing any values', () => {
		expect(detectColumnTypes(data, labels.length)).toEqual([
			{ kind: 'number' },
			{ kind: 'datetime', order: 'DMY' },
			{ kind: 'date', order: 'DMY' },
			{ kind: 'text' },
			{ kind: 'text' },
			{ kind: 'number' },
			{ kind: 'text' },
			{ kind: 'number' },
			{ kind: 'text' },
		]);
	});

	it('ignores empty columns', () => {
		expect(detectColumnTypes([['a', ''], ['b', '']], 3)).toEqual([{ kind: 'text' }, { kind: 'ignore' }, { kind: 'ignore' }]);
	});
});

describe('detectDecimalMark', () => {
	const types: ColumnType[] = [{ kind: 'number' }];
	it('spots a comma decimal mark', () => {
		expect(detectDecimalMark([['1.234,56'], ['12,00']], types)).toBe(',');
		expect(detectDecimalMark([['1,234.56'], ['12']], types)).toBe('.');
		expect(detectDecimalMark([['12']], types)).toBe('.');
	});
});

describe('unreadableValues', () => {
	it('lists values that do not fit the type', () => {
		expect(unreadableValues([['22-09-2026'], ['soon']], 0, { kind: 'date', order: 'DMY' }, '.')).toEqual(['soon']);
		expect(unreadableValues([['1,234.56']], 0, { kind: 'number' }, ',')).toEqual(['1,234.56']);
		expect(unreadableValues([['anything']], 0, { kind: 'text' }, '.')).toEqual([]);
	});

	it('filters columns by what a field needs', () => {
		expect(columnFits({ kind: 'datetime', order: 'DMY' }, 'date')).toBe(true);
		expect(columnFits({ kind: 'text' }, 'number')).toBe(false);
		expect(columnFits({ kind: 'ignore' }, 'any')).toBe(false);
		expect(columnFits(undefined, 'number')).toBe(true);
	});
});

describe('columnCheck', () => {
	it('counts the rows that read as the column type', () => {
		expect(columnCheck(data, 4, { kind: 'text' }, '.')).toEqual({ readable: 9, unreadable: [], empty: 1 });
		expect(columnCheck(data, 5, { kind: 'number' }, '.')).toEqual({ readable: 10, unreadable: [], empty: 0 });
		expect(columnCheck(data, 3, { kind: 'number' }, '.').readable).toBe(0);
		expect(columnCheck(data, 2, { kind: 'date', order: 'MDY' }, '.').readable).toBeLessThan(10);
	});
});

describe('readNumber', () => {
	it('reads numbers as written', () => {
		expect(readNumber('1,00,000.00', '.')).toEqual({ amount: '100000.00' });
		expect(readNumber('-5', '.')).toEqual({ amount: '-5' });
		expect(readNumber('', '.')).toEqual({ error: 'empty number' });
		expect(readNumber('abc', '.')).toEqual({ error: 'can\'t read the number "abc"' });
	});
});

describe('finding a saved header', () => {
	it('locates the table from a profile header', () => {
		const signature = headerSignature(rows[bounds.headerRow!]);
		const h = findHeaderRow(rows, signature);
		expect(h).toBe(bounds.headerRow);
		expect(tableFromHeader(rows, h)).toEqual(bounds);
		expect(findHeaderRow(rows, 'nope')).toBe(-1);
	});
});

describe('reading other kinds of CSV files', () => {
	it('detects the separator, keeping comma decimals in a semicolon file', () => {
		const semicolon = 'Account;12345\nDate;Description;Amount;Balance\n01.09.2026;Coffee;-3,50;100,00\n02.09.2026;Rent;-500,00;-400,00\n';
		expect(detectDelimiter(semicolon)).toBe(';');
		expect(readCsvRows(semicolon)[2]).toEqual(['01.09.2026', 'Coffee', '-3,50', '100,00']);
		expect(detectDelimiter('Date\tDescription\tAmount\n2026-09-01\tCoffee\t1,234.50\n')).toBe('\t');
		expect(detectDelimiter(readFileSync(path.join(__dirname, 'fixtures/kotak-statement.csv'), 'utf8'))).toBe(',');
	});

	it('decodes UTF-16 and Windows-1252 files', () => {
		const text = 'Date,Payee\n2026-09-01,Café\n';
		const utf16 = new Uint8Array([0xff, 0xfe, ...[...text].flatMap((c) => [c.charCodeAt(0), 0])]);
		expect(decodeText(utf16)).toBe(text);
		expect(decodeText(new Uint8Array([...text].map((c) => c.charCodeAt(0))))).toBe(text);
		expect(decodeText(new TextEncoder().encode(text))).toBe(text);
	});
});

describe('files with no header row', () => {
	// Laid out like a Raiffeisen (Austria) export: transactions from the first row, with trailing empty cells.
	const RAIFFEISEN = [
		'18.09.2017;"HOFER DANKT  0527  K2   18.09. 17:20";18.09.2017;-33,87;EUR;;',
		'18.09.2017;"LIDL DANKT   0391  K2   16.09. 17:10";16.09.2017;-24,11;EUR;;',
		'20.09.2017;"Überweisung";20.09.2017;24,00;EUR;;',
	].join('\n');

	it('finds the transactions from the first row', () => {
		const rows = readCsvRows(RAIFFEISEN);
		const bounds = detectTable(rows);
		expect(bounds).toEqual({ headerRow: null, firstRow: 0, lastRow: 2 });
		expect(tableWidth(rows, bounds!)).toBe(7);
		expect(columnLabels(['Date', '', 'Value date'])).toEqual(['Date', 'Column 2', 'Value date']);
	});

	it('takes the longest run of transactions, below any account details', () => {
		const rows = readCsvRows(`Opening balance;1.000,00\n\n${RAIFFEISEN}\nClosing balance;966,02`);
		const bounds = detectHeaderlessTable(rows)!;
		expect(bounds).toEqual({ headerRow: null, firstRow: 1, lastRow: 3 });
		expect(detectStatementBalance(rows, bounds, ',', 'opening')?.amount).toBe('1000.00');
		expect(detectStatementBalance(rows, bounds, ',', 'closing')?.amount).toBe('966.02');
	});

	it('still prefers a header row when there is one', () => {
		expect(detectTable(rows)?.headerRow).not.toBeNull();
	});
});
