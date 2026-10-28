import { describe, it, expect } from 'vitest';
import {
	blockEndIndex,
	formatBalanceHeader,
	formatNoteHeader,
	headerEndIndex,
	parseBalanceHeader,
	parseNoteHeader,
} from '../src/utils/directives/directiveText';

describe('balance headers', () => {
	it('writes the tolerance between the number and the currency (beancount syntax)', () => {
		expect(formatBalanceHeader({ date: '2026-01-31', account: 'Assets:Cash', amount: '100.00', tolerance: '0.01', currency: 'USD', rest: '' }))
			.toBe('2026-01-31 balance Assets:Cash  100.00 ~ 0.01 USD');
	});

	it('parses with and without a tolerance, keeping a trailing comment', () => {
		expect(parseBalanceHeader('2026-01-31 balance Assets:Cash  100.00 ~ 0.01 USD ; statement')).toEqual({
			date: '2026-01-31', account: 'Assets:Cash', amount: '100.00', tolerance: '0.01', currency: 'USD', rest: ' ; statement',
		});
		expect(parseBalanceHeader('2026-01-31 balance Assets:Cash   -5 EUR')).toMatchObject({ amount: '-5', tolerance: null, currency: 'EUR', rest: '' });
	});

	it('round-trips an edit that changes only the amount', () => {
		const parsed = parseBalanceHeader('2026-01-31 balance Assets:Cash  100.00 ~ 0.01 USD ; statement')!;
		expect(formatBalanceHeader({ ...parsed, amount: '120.00' })).toBe('2026-01-31 balance Assets:Cash  120.00 ~ 0.01 USD ; statement');
	});

	it('rejects lines that are not balance assertions', () => {
		expect(parseBalanceHeader('2026-01-31 note Assets:Cash "x"')).toBeNull();
		expect(parseBalanceHeader('2026-01-31 * "Shop"')).toBeNull();
	});
});

describe('note headers', () => {
	it('keeps tags, links and a comment while escaping the text', () => {
		const parsed = parseNoteHeader('2026-01-31 note Assets:Cash "said \\"hi\\"" #t1 ^l1 ; c')!;
		expect(parsed).toEqual({ date: '2026-01-31', account: 'Assets:Cash', comment: 'said "hi"', rest: ' #t1 ^l1 ; c' });
		expect(formatNoteHeader({ ...parsed, comment: 'a \\ "b"' })).toBe('2026-01-31 note Assets:Cash "a \\\\ \\"b\\"" #t1 ^l1 ; c');
	});

	it('handles a multi-line note text', () => {
		const parsed = parseNoteHeader('2026-01-31 note Assets:Cash "line one\nline two" #t')!;
		expect(parsed.comment).toBe('line one\nline two');
		expect(parsed.rest).toBe(' #t');
	});
});

describe('directive block bounds', () => {
	const lines = [
		'2026-01-31 note Assets:Cash "multi',
		'line; not a comment" #t',
		'  source: "bank"',
		'2026-01-31 balance Assets:Cash  5 EUR',
		'',
		'  orphan: "not part of the balance"',
	];

	it('finds a header spanning lines inside a string', () => {
		expect(headerEndIndex(lines, 0)).toBe(1);
		expect(headerEndIndex(lines, 3)).toBe(3);
	});

	it('includes indented metadata but stops at a blank line', () => {
		expect(blockEndIndex(lines, 0)).toBe(2);
		expect(blockEndIndex(lines, 3)).toBe(3);
	});
});
