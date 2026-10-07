import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { readCsvRows, detectTable, columnLabels, findHeaderRow, headerSignature, tableFromHeader } from '../src/utils/import/csvTable';
import { columnFits, detectColumnTypes, detectDecimalMark, readNumber, unreadableValues } from '../src/utils/import/columns';
import { suggestMapping } from '../src/utils/import/mapping';
import type { ColumnType } from '../src/models/import';

const rows = readCsvRows(readFileSync(path.join(__dirname, 'fixtures/kotak-statement.csv'), 'utf8'));
const bounds = detectTable(rows)!;
const labels = columnLabels(rows[bounds.headerRow]);
const data = rows.slice(bounds.firstRow, bounds.lastRow + 1);

describe('detectColumnTypes', () => {
	it('guesses each Kotak column', () => {
		const asis = { mode: 'asis' };
		expect(detectColumnTypes(data, labels.length, labels)).toEqual([
			{ kind: 'number', sign: asis },
			{ kind: 'datetime', order: 'DMY' },
			{ kind: 'date', order: 'DMY' },
			{ kind: 'text' },
			{ kind: 'text' },
			{ kind: 'number', sign: { mode: 'indicator', column: 6, debitValue: 'DR', creditValue: 'CR' } },
			{ kind: 'text' },
			{ kind: 'number', sign: { mode: 'indicator', column: 8, debitValue: 'DR', creditValue: 'CR' } },
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

describe('suggestMapping with confirmed types', () => {
	it('uses the date order and decimal mark the user chose', () => {
		const types = detectColumnTypes(data, labels.length);
		types[2] = { kind: 'date', order: 'MDY' };
		const m = suggestMapping(labels, data, 'INR', types, ',');
		expect(m).toMatchObject({ date: '={{Value Date}}', decimalMark: ',', columnTypes: types });
	});

	it('picks another date column when Value Date is marked as text', () => {
		const types = detectColumnTypes(data, labels.length);
		types[2] = { kind: 'text' };
		expect(suggestMapping(labels, data, 'INR', types).date).toBe('={{Transaction Date}}');
	});

	it("doesn't use an ignored column for the amount", () => {
		const types = detectColumnTypes(data, labels.length);
		types[5] = { kind: 'ignore' };
		expect(suggestMapping(labels, data, 'INR', types).postings[0].amount).not.toBe('={{Amount}}');
	});
});

describe('readNumber', () => {
	const indicator = { kind: 'number', sign: { mode: 'indicator', column: 1, debitValue: 'DR', creditValue: 'CR' } } as const;

	it('applies the column sign rule', () => {
		expect(readNumber(['889.00', 'DR'], 0, indicator, '.')).toEqual({ amount: '-889.00' });
		expect(readNumber(['889.00', 'cr'], 0, indicator, '.')).toEqual({ amount: '889.00' });
		expect(readNumber(['250'], 0, { kind: 'number', sign: { mode: 'negate' } }, '.')).toEqual({ amount: '-250' });
		expect(readNumber(['-5'], 0, { kind: 'number' }, '.')).toEqual({ amount: '-5' });
	});

	it('explains what went wrong', () => {
		expect(readNumber(['889.00', ''], 0, indicator, '.')).toEqual({ error: 'expected "DR" or "CR" for the sign, found ""' });
		expect(readNumber([''], 0, { kind: 'number' }, '.')).toEqual({ error: 'empty number' });
	});

	it('flags numbers whose sign marker is missing', () => {
		expect(unreadableValues([['1.00', 'DR'], ['2.00', '?']], 0, indicator, '.')).toEqual(['2.00']);
	});
});

describe('finding a saved header', () => {
	it('locates the table from a profile header', () => {
		const signature = headerSignature(rows[bounds.headerRow]);
		const h = findHeaderRow(rows, signature);
		expect(h).toBe(bounds.headerRow);
		expect(tableFromHeader(rows, h)).toEqual(bounds);
		expect(findHeaderRow(rows, 'nope')).toBe(-1);
	});
});
