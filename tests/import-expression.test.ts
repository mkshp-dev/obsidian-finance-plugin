import { describe, it, expect } from 'vitest';
import {
	evaluate, findLookups, FormulaError, parseExpression, printExpression, resultTexts, typeOf, valueText,
	type EvalContext, type TypeEnv, type Value, type ValueType,
} from '../src/utils/import/expression';
import { addAmounts, compareAmounts, divideAmounts, multiplyAmounts, negateAmount, roundAmount } from '../src/utils/import/values';

const columns: Record<string, { type: ValueType; value: Value | null }> = {
	Description: { type: 'text', value: { type: 'text', text: 'UPI/City Mall/ICIC/123/UPI' } },
	Ref: { type: 'text', value: null },
	Amount: { type: 'number', value: { type: 'number', amount: '-889.00', raw: '889.00' } },
	Deposit: { type: 'number', value: null },
	Withdrawal: { type: 'number', value: { type: 'number', amount: '120.50', raw: '120.50' } },
	Date: { type: 'date', value: { type: 'date', date: '2026-09-20', raw: '20-09-2026' } },
};

const env: TypeEnv = { columnType: (name) => columns[name]?.type ?? null };

const lookups: { text: string; matched: boolean }[] = [];
const ctx: EvalContext = {
	column: (name) => columns[name].value,
	lookup: (mode, text) => (mode === 'contains' ? text.includes('City Mall') : text === 'City Mall') ? { account: 'Expenses:Shopping', alias: 'City Mall' } : null,
	onLookup: (info) => lookups.push(info),
	add: (a, b) => addAmounts(a, b),
	subtract: (a, b) => addAmounts(a, negateAmount(b)),
	multiply: multiplyAmounts,
	divide: divideAmounts,
	compare: compareAmounts,
	round: roundAmount,
};

function run(source: string): string {
	const e = parseExpression(source);
	typeOf(e, env);
	return valueText(evaluate(e, ctx));
}

function typeError(source: string): string {
	try {
		typeOf(parseExpression(source), env);
	} catch (err) {
		if (err instanceof FormulaError) return err.message;
		throw err;
	}
	return '';
}

describe('arithmetic and text', () => {
	it('subtracts split columns, counting an empty cell as 0', () => {
		expect(run('{{Deposit}} - {{Withdrawal}}')).toBe('-120.50');
	});

	it('follows precedence and brackets', () => {
		expect(run('1 + 2 * 3')).toBe('7');
		expect(run('(1 + 2) * 3')).toBe('9');
		expect(run('-{{Amount}}')).toBe('889.00');
		expect(run('10 / 4')).toBe('2.50');
		expect(run('ROUND(10 / 3, 1)')).toBe('3.3');
	});

	it('joins text with +, showing numbers as written', () => {
		expect(run('"Paid " + {{Amount}} + " INR"')).toBe('Paid 889.00 INR');
	});

	it('reports division by zero', () => {
		expect(() => run('1 / 0')).toThrow('Division by zero');
	});
});

describe('IF', () => {
	it('picks a branch', () => {
		expect(run('IF {{Amount}} < 0 THEN "out" ELSE "in"')).toBe('out');
		expect(run('IF {{Description}} STARTS WITH "upi/" AND NOT {{Ref}} IS NOT EMPTY THEN "upi" ELSE "other"')).toBe('upi');
	});

	it('chains with ELSE IF', () => {
		expect(run('IF {{Amount}} > 0 THEN "a" ELSE IF {{Amount}} < -1000 THEN "b" ELSE "c"')).toBe('c');
	});

	it('compares text ignoring case and spacing, and dates', () => {
		expect(run('IF {{Description}} CONTAINS "city  mall" THEN "y" ELSE "n"')).toBe('y');
		expect(run('IF {{Ref}} == "" THEN "blank" ELSE "x"')).toBe('blank');
		expect(run('IF {{Date}} >= {{Date}} THEN "same day" ELSE "x"')).toBe('same day');
	});

	it('gives nothing without ELSE', () => {
		expect(run('IF {{Amount}} > 0 THEN "in"')).toBe('');
	});
});

describe('lookups inside formulas', () => {
	it('works in an ELSE branch and reports what it searched', () => {
		lookups.length = 0;
		expect(run('IF {{Amount}} > 0 THEN "Income:Other" ELSE ACCOUNT WHERE {{Description}} CONTAINS ALIAS ELSE "Expenses:Uncategorized"')).toBe('Expenses:Shopping');
		expect(lookups).toEqual([{ returns: 'account', mode: 'contains', text: 'UPI/City Mall/ICIC/123/UPI', matched: true, alias: 'City Mall' }]);
	});

	it('searches a computed text', () => {
		expect(run('ALIAS WHERE SPLIT({{Description}}, "/", 2) EQUALS ALIAS')).toBe('City Mall');
		expect(run('ACCOUNT WHERE {{Description}} EQUALS ALIAS ELSE SPLIT({{Description}}, "/", 2)')).toBe('City Mall');
	});
});

describe('functions', () => {
	it('works on text', () => {
		expect(run('SPLIT({{Description}}, "/", 2)')).toBe('City Mall');
		expect(run('SPLIT({{Description}}, "/", 9)')).toBe('');
		expect(run('UPPER(TRIM("  a  b "))')).toBe('A B');
		expect(run('REPLACE({{Description}}, "/", " ")')).toBe('UPI City Mall ICIC 123 UPI');
		expect(run('FIRST({{Ref}}, {{Description}})')).toBe('UPI/City Mall/ICIC/123/UPI');
	});

	it('works on numbers', () => {
		expect(run('ABS({{Amount}})')).toBe('889.00');
		expect(run('ROUND(2.5)')).toBe('3');
		expect(run('ROUND(-2.345, 2)')).toBe('-2.35');
	});
});

describe('date functions', () => {
	it('formats, splits and shifts dates', () => {
		expect(run('FORMAT_DATE({{Date}}, "YYYY-MM-DD")')).toBe('2026-09-20');
		expect(run('FORMAT_DATE({{Date}}, "MMMM D, YYYY")')).toBe('September 20, 2026');
		expect(run('YEAR({{Date}}) + MONTH({{Date}}) + DAY({{Date}})')).toBe('2055');
		expect(run('ADD_DAYS({{Date}}, -20)')).toBe('2026-08-31');
		expect(run('FORMAT_DATE(DATE("1/2/26", "D/M/YY"), "YYYY-MM-DD")')).toBe('2026-02-01');
	});

	it('shows a date column as written, and a computed date as YYYY-MM-DD', () => {
		expect(run('{{Date}}')).toBe('20-09-2026');
		expect(run('"on " + {{Date}}')).toBe('on 20-09-2026');
		expect(run('ADD_DAYS({{Date}}, 0)')).toBe('2026-09-20');
	});

	it('checks dates are dates', () => {
		expect(typeError('FORMAT_DATE({{Description}}, "YYYY")')).toBe('FORMAT_DATE needs a date, not text');
		expect(typeError('YEAR({{Amount}})')).toBe('YEAR needs a date, not a number');
		expect(typeOf(parseExpression('DATE({{Description}}, "DD/MM/YYYY")'), env)).toBe('date');
		expect(() => run('DATE("soon", "DD/MM/YYYY")')).toThrow(`DATE: "soon" doesn't match the pattern "DD/MM/YYYY"`);
	});
});

describe('type checking', () => {
	it('knows what each formula produces', () => {
		expect(typeOf(parseExpression('{{Deposit}} - {{Withdrawal}}'), env)).toBe('number');
		expect(typeOf(parseExpression('{{Amount}} + " INR"'), env)).toBe('text');
		expect(typeOf(parseExpression('IF {{Amount}} > 0 THEN 1 ELSE "x"'), env)).toBe('text');
		expect(typeOf(parseExpression('FIRST({{Deposit}}, {{Withdrawal}})'), env)).toBe('number');
	});

	it('explains mismatches', () => {
		expect(typeError('{{Description}} > 0')).toBe('">" compares two numbers or two dates, not text and a number');
		expect(typeError('ABS({{Date}})')).toBe('ABS needs a number, not a date');
		expect(typeError('{{Description}} - 1')).toBe('"-" needs numbers, not text');
		expect(typeError('IF {{Amount}} THEN 1 ELSE 2')).toBe('IF needs true/false, not a number');
		expect(typeError('{{Nope}}')).toBe('There\'s no column "Nope"');
		expect(typeError('SPLIT({{Description}})')).toContain('SPLIT takes 3 values');
	});
});

describe('parse errors', () => {
	it('explains what is wrong', () => {
		expect(() => parseExpression('{{Amount}} = 0')).toThrow('Use == to compare');
		expect(() => parseExpression('{{Description}} EQUALS "x"')).toThrow('Use == to compare');
		expect(() => parseExpression('SUM({{Amount}})')).toThrow('There\'s no function SUM');
		expect(() => parseExpression('IF {{Amount}} > 0 "x"')).toThrow('Expected THEN');
		expect(() => parseExpression('"open')).toThrow('closing "');
		expect(() => parseExpression('{{Amount')).toThrow('closing }}');
		expect(() => parseExpression('Description')).toThrow('Columns go in {{ }}');
		expect(() => parseExpression('{{Description}} CONTAINS ALIAS')).toThrow('only works in a lookup');
	});
});

describe('inspecting and printing', () => {
	it('finds lookups and the fixed results', () => {
		const e = parseExpression('IF {{Amount}} > 0 THEN "Income:Other" ELSE ACCOUNT WHERE {{Description}} CONTAINS ALIAS ELSE "Expenses:Uncategorized"');
		expect(findLookups(e)).toHaveLength(1);
		expect(resultTexts(e)).toEqual(['Income:Other', 'Expenses:Uncategorized']);
	});

	it('prints formulas so they read back the same', () => {
		for (const source of [
			'{{Deposit}} - {{Withdrawal}}',
			'(1 + 2) * 3',
			'1 - (2 - 3)',
			'IF {{Amount}} > 0 AND {{Ref}} IS NOT EMPTY THEN "a" ELSE IF {{Amount}} < 0 THEN "b" ELSE "c"',
			'ACCOUNT WHERE SPLIT({{Description}}, "/", 2) EQUALS ALIAS ELSE "Say \\"hi\\""',
			'IF {{Amount}} > 0 THEN (ACCOUNT WHERE {{Description}} CONTAINS ALIAS) ELSE "x"',
			'NOT ({{Amount}} > 0 OR {{Amount}} < -5)',
		]) {
			expect(printExpression(parseExpression(source))).toBe(source);
		}
	});
});
