import { describe, it, expect } from 'vitest';
import { addAmounts, amountsEqual, detectDateOrder, isDateLike, parseAmount, parseDate } from '../src/utils/import/values';

describe('parseDate', () => {
	it('reads day-first dates, ignoring a trailing time', () => {
		expect(parseDate('22-09-2026 11:54:56', 'DMY')).toBe('2026-09-22');
		expect(parseDate('22/09/26', 'DMY')).toBe('2026-09-22');
		expect(parseDate('22 Sep 2026', 'DMY')).toBe('2026-09-22');
	});

	it('reads month-first and year-first dates', () => {
		expect(parseDate('9/22/2026 3:05 PM', 'MDY')).toBe('2026-09-22');
		expect(parseDate('Sep 22, 2026', 'MDY')).toBe('2026-09-22');
		expect(parseDate('2026-09-22T11:54:00Z', 'YMD')).toBe('2026-09-22');
	});

	it('rejects impossible dates and non-dates', () => {
		expect(parseDate('31-02-2026', 'DMY')).toBeNull();
		expect(parseDate('22-09-2026', 'MDY')).toBeNull();
		expect(parseDate('9,656.51', 'DMY')).toBeNull();
		expect(parseDate('as on 28/09/2026 INR 9,656.51', 'DMY')).toBeNull();
		expect(isDateLike('10,994.04')).toBe(false);
		expect(isDateLike('1,00,000.00')).toBe(false);
	});
});

describe('detectDateOrder', () => {
	it('finds the only order that reads every value', () => {
		expect(detectDateOrder(['01-09-2026', '22-09-2026'])).toEqual({ order: 'DMY', candidates: ['DMY'], ambiguous: false });
	});

	it('flags dates that read both ways', () => {
		const r = detectDateOrder(['01-09-2026', '05-09-2026']);
		expect(r.ambiguous).toBe(true);
		expect(r.candidates).toEqual(['DMY', 'MDY']);
	});

	it("doesn't read a 2-digit year first", () => {
		expect(detectDateOrder(['01/09/26']).candidates).toEqual(['DMY', 'MDY']);
	});
});

describe('parseAmount', () => {
	it('removes thousands separators, including lakh grouping', () => {
		expect(parseAmount('10,994.04')).toBe('10994.04');
		expect(parseAmount('1,00,000.00')).toBe('100000.00');
	});

	it('reads negative forms and strips currency', () => {
		expect(parseAmount('-12.50')).toBe('-12.50');
		expect(parseAmount('(12.50)')).toBe('-12.50');
		expect(parseAmount('12.50-')).toBe('-12.50');
		expect(parseAmount('₹ 1,200')).toBe('1200');
		expect(parseAmount('INR 5.00')).toBe('5.00');
		expect(parseAmount('-0.00')).toBe('0.00');
	});

	it('reads a comma decimal mark', () => {
		expect(parseAmount('1.234,56', ',')).toBe('1234.56');
	});

	it('rejects text', () => {
		expect(parseAmount('')).toBeNull();
		expect(parseAmount('DR')).toBeNull();
		expect(parseAmount('UPI-626464798044')).toBeNull();
	});
});

describe('decimal arithmetic', () => {
	it('adds exactly', () => {
		expect(addAmounts('0.1', '0.2')).toBe('0.3');
		expect(addAmounts('100952.00', '-53615.76')).toBe('47336.24');
		expect(addAmounts('4.96', '-4.96')).toBe('0.00');
		expect(addAmounts('1', '-2.5')).toBe('-1.5');
	});

	it('compares across decimal places', () => {
		expect(amountsEqual('5', '5.00')).toBe(true);
		expect(amountsEqual('5.01', '5.00')).toBe(false);
	});
});
