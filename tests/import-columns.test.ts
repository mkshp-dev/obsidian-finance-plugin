import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { readCsvRows, detectTable, columnLabels, findHeaderRow, headerSignature, tableFromHeader } from '../src/utils/import/csvTable';
import { columnCheck, columnFits, detectColumnTypes, detectDecimalMark, readNumber, unreadableValues } from '../src/utils/import/columns';
import type { ColumnType } from '../src/models/import';

const rows = readCsvRows(readFileSync(path.join(__dirname, 'fixtures/kotak-statement.csv'), 'utf8'));
const bounds = detectTable(rows)!;
const labels = columnLabels(rows[bounds.headerRow]);
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
		const signature = headerSignature(rows[bounds.headerRow]);
		const h = findHeaderRow(rows, signature);
		expect(h).toBe(bounds.headerRow);
		expect(tableFromHeader(rows, h)).toEqual(bounds);
		expect(findHeaderRow(rows, 'nope')).toBe(-1);
	});
});
