import { describe, it, expect } from 'vitest';
import { parseTransactionText, toJournalTransaction } from '../src/utils/transactionText';
import { generateTransactionText } from '../src/utils/directives/transactionDirectives';
import { scheduleFromTransaction, scheduleToTransactionData } from '../src/utils/directives/scheduleDirectives';
import { MAX_SCHEDULE_POSTINGS } from '../src/queries';

const INVESTMENT = [
	'2026-09-15 ! "Broker \\"X\\"" "Buy VTI; monthly" #invest #tax-2026 ^order-1 ; header comment',
	'  source: "auto-invest"',
	'  scheduled: "Old schedule"',
	'  batch: 42',
	'  ! Assets:Broker:VTI  10 VTI {{2500.00 USD, 2026-09-15, "lot, @a"}}  ; first lot',
	'    lot: "A"',
	'  Assets:Broker:EUR  -100 EUR @@ 109.00 USD',
	'  Expenses:Fees  1.50 USD',
	'  Assets:Broker:Cash',
].join('\n');

describe('parseTransactionText', () => {
	it('reads every part of a transaction as written', () => {
		const t = parseTransactionText(INVESTMENT);

		expect(t).toMatchObject({
			date: '2026-09-15',
			flag: '!',
			payee: 'Broker "X"',
			narration: 'Buy VTI; monthly',
			tags: ['invest', 'tax-2026'],
			links: ['order-1'],
			metadata: { source: 'auto-invest', scheduled: 'Old schedule', batch: '42' },
		});
		expect(t.postings).toEqual([
			{
				account: 'Assets:Broker:VTI', amount: '10', currency: 'VTI', flag: '!', comment: 'first lot',
				metadata: { lot: 'A' },
				cost: { number: '2500.00', currency: 'USD', date: '2026-09-15', label: 'lot, @a', isTotal: true },
				price: null,
			},
			{
				account: 'Assets:Broker:EUR', amount: '-100', currency: 'EUR', flag: null, comment: '', metadata: {},
				cost: null, price: { amount: '109.00', currency: 'USD', isTotal: true },
			},
			{ account: 'Expenses:Fees', amount: '1.50', currency: 'USD', flag: null, comment: '', metadata: {}, cost: null, price: null },
			{ account: 'Assets:Broker:Cash', amount: '', currency: '', flag: null, comment: '', metadata: {}, cost: null, price: null },
		]);
	});

	it("doesn't read a # or ^ inside the payee as a tag or link", () => {
		const t = parseTransactionText('2026-01-01 * "Store #12" "Order ^5" #real\n  Expenses:Food  5 USD\n  Assets:Cash');
		expect(t.tags).toEqual(['real']);
		expect(t.links).toEqual([]);
	});

	it('accepts the txn keyword and a narration-only header', () => {
		const t = parseTransactionText('2026-01-01 txn "Coffee"\n  Expenses:Food  5 USD\n  Assets:Cash');
		expect(t).toMatchObject({ flag: '*', payee: '', narration: 'Coffee' });
	});

	it('round-trips through generateTransactionText', () => {
		const text = [
			'2026-01-01 * "Shop \\"A\\"" "a \\\\ b" #t',
			'  note: "x \\"y\\""',
			'  ! Assets:Broker:VTI  10 VTI {250 USD, "lot"} @ 251 USD  ; c',
			'    lot: "A"',
			'  Assets:Cash',
		].join('\n');
		const t = parseTransactionText(text);
		const regenerated = generateTransactionText({
			date: t.date, flag: t.flag, payee: t.payee, narration: t.narration, tags: t.tags, links: t.links,
			metadata: t.metadata,
			postings: t.postings.map((p) => ({ ...p, cost: p.cost ?? undefined, price: p.price ?? undefined, flag: p.flag ?? undefined })),
		});
		expect(regenerated).toBe(text);
	});
});

describe('toJournalTransaction (Edit)', () => {
	it('an unchanged edit writes back the original text', () => {
		const original = [
			'2026-01-01 * "Shop" "Lunch" #food',
			'  receipt: "r1"',
			'  ! Expenses:Food  5.00 USD  ; tip incl',
			'    item: "soup"',
			'  Assets:Broker:VTI  -1 VTI {250 USD, "lot-1"} @ 260 USD',
			'  Assets:Cash',
		].join('\n');
		const t = toJournalTransaction(parseTransactionText(original), 'abc123');

		expect(t.id).toBe('abc123');
		expect(t.metadata).toEqual({ receipt: 'r1' });
		expect(t.postings[2]).toMatchObject({ account: 'Assets:Cash', amount: null, currency: null });

		// Same inclusion rules as TransactionEditModal.saveEntry().
		const saved = generateTransactionText({
			date: t.date, flag: t.flag, payee: t.payee ?? undefined, narration: t.narration, tags: t.tags, links: t.links,
			metadata: t.metadata as Record<string, string>,
			postings: t.postings.map((p) => ({
				account: p.account,
				amount: p.amount ?? undefined,
				currency: p.currency ?? undefined,
				...(p.cost && (p.cost.number || p.cost.date || p.cost.label) ? { cost: { number: p.cost.number ?? undefined, currency: p.cost.currency ?? undefined, date: p.cost.date ?? undefined, label: p.cost.label ?? undefined, isTotal: p.cost.isTotal } } : {}),
				...(p.price && p.price.amount ? { price: p.price } : {}),
				...(p.flag ? { flag: p.flag } : {}),
				...(p.comment ? { comment: p.comment } : {}),
				...(p.metadata && Object.keys(p.metadata).length > 0 ? { metadata: p.metadata } : {}),
			})),
		});
		expect(saved).toBe(original);
	});
});

describe('scheduleFromTransaction', () => {
	it('copies everything except the scheduled key and a priced lot date', () => {
		const result = scheduleFromTransaction(parseTransactionText(INVESTMENT), MAX_SCHEDULE_POSTINGS);
		if (!result.success) throw new Error(result.error);
		const { prefill } = result;

		expect(prefill).toMatchObject({
			name: 'Broker "X"',
			payee: 'Broker "X"',
			narration: 'Buy VTI; monthly',
			flag: '!',
			tags: ['invest', 'tax-2026'],
			links: ['order-1'],
			metadata: { source: 'auto-invest', batch: '42' },
			anchorDate: '2026-09-15',
		});
		expect(prefill.postings).toEqual([
			{
				account: 'Assets:Broker:VTI', amount: 10, currency: 'VTI', flag: '!', comment: 'first lot',
				cost: { number: '2500.00', currency: 'USD', date: undefined, label: 'lot, @a', isTotal: true },
				metadata: { lot: 'A' },
			},
			{ account: 'Assets:Broker:EUR', amount: -100, currency: 'EUR', price: { amount: '109.00', currency: 'USD', isTotal: true } },
			{ account: 'Expenses:Fees', amount: 1.5, currency: 'USD' },
			{ account: 'Assets:Broker:Cash' },
		]);
	});

	it('keeps the date of a date-only cost (it selects an existing lot)', () => {
		const result = scheduleFromTransaction(
			parseTransactionText('2026-01-01 * "Sell"\n  Assets:Broker:VTI  -1 VTI {2025-06-01}\n  Assets:Cash'),
			MAX_SCHEDULE_POSTINGS
		);
		expect(result.success && result.prefill.postings[0].cost?.date).toBe('2025-06-01');
	});

	it('materializes back to the original transaction on a new date', () => {
		const result = scheduleFromTransaction(parseTransactionText(INVESTMENT), MAX_SCHEDULE_POSTINGS);
		if (!result.success) throw new Error(result.error);
		const schedule = { ...result.prefill, frequency: 'Monthly', startDate: '2026-10-15', nextDate: '2026-10-15', active: true, isDue: false };
		expect(generateTransactionText(scheduleToTransactionData(schedule, '2026-10-15'))).toBe([
			'2026-10-15 ! "Broker \\"X\\"" "Buy VTI; monthly" #invest #tax-2026 ^order-1',
			'  source: "auto-invest"',
			'  batch: "42"',
			'  scheduled: "Broker \\"X\\""',
			'  ! Assets:Broker:VTI  10 VTI {{2500.00 USD, "lot, @a"}}  ; first lot',
			'    lot: "A"',
			'  Assets:Broker:EUR  -100 EUR @@ 109.00 USD',
			'  Expenses:Fees  1.5 USD',
			'  Assets:Broker:Cash',
		].join('\n'));
	});

	it('rejects what a schedule cannot store', () => {
		const tooMany = ['2026-01-01 * "Split"', ...Array.from({ length: 9 }, (_, i) => `  Expenses:E${i}  1 USD`), '  Assets:Cash'].join('\n');
		const cases: Array<[string, RegExp]> = [
			[tooMany, /up to 8 postings/],
			['2026-01-01 * "Math"\n  Expenses:Food  (10/3) USD\n  Assets:Cash', /arithmetic expression/],
			['2026-01-01 * "Sell"\n  Assets:Broker:VTI  -1 VTI {}\n  Assets:Cash', /empty cost/],
			['2026-01-01 * "Broken"', /postings/],
		];
		for (const [text, error] of cases) {
			const result = scheduleFromTransaction(parseTransactionText(text), MAX_SCHEDULE_POSTINGS);
			expect(result.success ? '' : result.error).toMatch(error);
		}
	});
});
