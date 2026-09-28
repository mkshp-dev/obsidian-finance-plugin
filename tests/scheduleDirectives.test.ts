import { describe, it, expect } from 'vitest';
import {
	buildDirectiveLines,
	parseScheduleRow,
	scheduleToTransactionData,
} from '../src/utils/directives/scheduleDirectives';
import { generateTransactionText } from '../src/utils/directives/transactionDirectives';
import { MAX_SCHEDULE_POSTINGS } from '../src/queries';
import type { ScheduleDirectiveParams } from '../src/utils/directives/types';

/** Unescape a beancount string literal the way beancount does on load. */
function unquote(literal: string): string {
	return literal.slice(1, -1).replace(/\\(.)/g, '$1');
}

/**
 * Simulates the getScheduleListQuery() CSV row bean-query would return for a
 * directive: each `key: value` metadata line becomes the matching `_…` column.
 */
function rowFromDirective(lines: string[]): Record<string, string> {
	const meta: Record<string, string> = {};
	for (const line of lines.slice(1)) {
		const m = line.match(/^\t(\w+):\s(.*)$/);
		if (!m) continue;
		meta[m[1]] = m[2].startsWith('"') ? unquote(m[2]) : m[2];
	}
	const row: Record<string, string> = {
		_name: unquote(lines[0].match(/event "Recurring" (".*")$/)![1]),
		_frequency: meta.frequency ?? '',
		_startdate: meta.startDate ?? '',
		_nextdate: meta.nextDate ?? '',
		_lastgenerated: meta.lastGenerated ?? '',
		_active: meta.active === '1' ? 'TRUE' : 'FALSE',
		_payee: meta.payee ?? '',
		_narration: meta.narration ?? '',
		_flag: meta.flag ?? '',
		_tags: meta.tags ?? '',
		_links: meta.links ?? '',
		_txnmeta: meta.txnMeta ?? '',
		_displayamount: meta.displayAmount ?? '',
		_displaycurrency: meta.displayCurrency ?? '',
		_filename: '/vault/Finances/events.beancount',
		_lineno: '12',
	};
	for (const [key, value] of Object.entries(meta)) {
		const m = key.match(/^posting(\d+)(\w+)$/);
		if (m) row[`_p${m[1]}${m[2].toLowerCase()}`] = value;
	}
	return row;
}

const base: ScheduleDirectiveParams = {
	name: 'Monthly ETF buy',
	frequency: 'Monthly',
	startDate: '2026-10-01',
	nextDate: '2026-10-01',
	active: true,
	payee: 'Broker',
	narration: 'Buy VTI',
	flag: '*',
	tags: ['invest'],
	links: [],
	postings: [],
};

describe('Schedule directives: full posting support', () => {
	it('round-trips cost, price, flag, comment and metadata', () => {
		const params: ScheduleDirectiveParams = {
			...base,
			metadata: { source: 'auto-invest', note: 'says "hi" \\ bye' },
			postings: [
				{
					account: 'Assets:Broker:VTI',
					amount: 10,
					currency: 'VTI',
					flag: '!',
					comment: 'monthly lot',
					cost: { number: '250.00', currency: 'USD', date: '2026-01-15', label: 'lot "a"', isTotal: false },
					metadata: { lot: 'A' },
				},
				{
					account: 'Assets:Broker:EUR',
					amount: -100,
					currency: 'EUR',
					price: { amount: '1.09', currency: 'USD', isTotal: true },
				},
				{ account: 'Assets:Broker:Cash' },
			],
		};

		const lines = buildDirectiveLines(params);
		const parsed = parseScheduleRow(rowFromDirective(lines), MAX_SCHEDULE_POSTINGS, '2026-09-28');

		expect(parsed.metadata).toEqual(params.metadata);
		expect(parsed.postings).toEqual([
			{
				account: 'Assets:Broker:VTI',
				amount: 10,
				currency: 'VTI',
				flag: '!',
				comment: 'monthly lot',
				cost: { number: '250.00', currency: 'USD', date: '2026-01-15', label: 'lot "a"', isTotal: false },
				metadata: { lot: 'A' },
			},
			{
				account: 'Assets:Broker:EUR',
				amount: -100,
				currency: 'EUR',
				price: { amount: '1.09', currency: 'USD', isTotal: true },
			},
			{ account: 'Assets:Broker:Cash' },
		]);
	});

	it('escapes quotes and backslashes in string values', () => {
		const lines = buildDirectiveLines({ ...base, name: 'Say "hi"', narration: 'a\\b', postings: [{ account: 'Assets:Cash' }] });
		expect(lines[0]).toBe('2026-10-01 event "Recurring" "Say \\"hi\\""');
		expect(lines).toContain('\tnarration: "a\\\\b"');
	});

	it('writes no extra keys for a plain schedule (existing format unchanged)', () => {
		const lines = buildDirectiveLines({
			...base,
			postings: [
				{ account: 'Expenses:Rent', amount: 1200, currency: 'USD' },
				{ account: 'Assets:Checking' },
			],
		});
		expect(lines.filter((l) => l.startsWith('\tposting'))).toEqual([
			'\tpostingCount: 2',
			'\tposting1Account: "Expenses:Rent"',
			'\tposting1Amount: 1200',
			'\tposting1Currency: "USD"',
			'\tposting2Account: "Assets:Checking"',
		]);
		expect(lines.some((l) => l.includes('txnMeta'))).toBe(false);
	});

	it('reads a legacy row without any of the new columns', () => {
		const parsed = parseScheduleRow({
			_name: 'Rent', _frequency: 'Monthly', _startdate: '2026-01-01', _nextdate: '2026-09-01', _active: 'TRUE',
			_flag: '*', _p1account: 'Expenses:Rent', _p1amount: '1200', _p1currency: 'USD', _p2account: 'Assets:Checking',
			_filename: 'events.beancount', _lineno: '3',
		}, MAX_SCHEDULE_POSTINGS, '2026-09-28');

		expect(parsed.postings).toEqual([
			{ account: 'Expenses:Rent', amount: 1200, currency: 'USD' },
			{ account: 'Assets:Checking' },
		]);
		expect(parsed.metadata).toBeUndefined();
		expect(parsed.isDue).toBe(true);
	});

	it('ignores malformed metadata JSON instead of failing the whole list', () => {
		const parsed = parseScheduleRow({
			_name: 'Broken', _active: 'TRUE', _txnmeta: '{not json', _p1account: 'Assets:Cash', _p1meta: '[1,2]',
		}, MAX_SCHEDULE_POSTINGS, '2026-09-28');
		expect(parsed.metadata).toBeUndefined();
		expect(parsed.postings[0].metadata).toBeUndefined();
	});
});

describe('scheduleToTransactionData', () => {
	it('materializes every posting field and tags the transaction', () => {
		const lines = buildDirectiveLines({
			...base,
			metadata: { source: 'auto-invest', scheduled: 'stale' },
			postings: [
				{ account: 'Assets:Broker:VTI', amount: 10, currency: 'VTI', cost: { number: '250', currency: 'USD', isTotal: false }, metadata: { lot: 'A' } },
				{ account: 'Assets:Broker:EUR', amount: -100, currency: 'EUR', price: { amount: '1.09', currency: 'USD', isTotal: false }, flag: '!', comment: 'fx' },
				{ account: 'Assets:Broker:Cash' },
			],
		});
		const schedule = parseScheduleRow(rowFromDirective(lines), MAX_SCHEDULE_POSTINGS, '2026-09-28');
		const text = generateTransactionText(scheduleToTransactionData(schedule, '2026-10-01'));

		expect(text).toBe([
			'2026-10-01 * "Broker" "Buy VTI" #invest',
			'  source: "auto-invest"',
			'  scheduled: "Monthly ETF buy"',
			'  Assets:Broker:VTI  10 VTI {250 USD}',
			'    lot: "A"',
			'  ! Assets:Broker:EUR  -100 EUR @ 1.09 USD  ; fx',
			'  Assets:Broker:Cash',
		].join('\n'));
	});
});
