// src/utils/directives/scheduleDirectives.ts

import type BeancountPlugin from '../../main';
import type { ScheduleDirectiveParams, PostingStub, TransactionData } from './types';
import type { ScheduledTransactionItem } from '../../models/schedule';
import type { ParsedTransaction } from '../transactionText';
import { getTargetFile } from '../structuredLayout';
import { atomicFileWrite, createBackupFile, convertWslPathToWindows, getNewlineCharacter, readFileContent } from '../fileEditor';
import { Logger } from '../logger';
import { quote } from './directiveText';

/**
 * A single representative "amount" for a schedule with multiple postings:
 * the sum of every positive-amount posting that shares the currency of the
 * first positive posting encountered (postings in other currencies, or with
 * a negative/blank amount, don't contribute). Returns `null` when no posting
 * has an explicit positive amount (e.g. every leg is blank or negative).
 */
export function computeScheduleDisplayAmount(postings: PostingStub[]): { amount: number; currency: string } | null {
	const positiveLegs = postings.filter((p) => p.amount !== undefined && p.amount > 0 && p.currency);
	if (positiveLegs.length === 0) return null;
	const currency = positiveLegs[0].currency as string;
	const amount = positiveLegs
		.filter((p) => p.currency === currency)
		.reduce((sum, p) => sum + (p.amount ?? 0), 0);
	return { amount, currency };
}

function hasEntries(map: Record<string, string> | undefined): map is Record<string, string> {
	return !!map && Object.keys(map).length > 0;
}

export function buildDirectiveLines(params: ScheduleDirectiveParams): string[] {
	const lines = [
		`${params.startDate} event "Recurring" ${quote(params.name)}`,
		`\tfrequency: "${params.frequency}"`,
		`\tstartDate: "${params.startDate}"`,
		`\tnextDate: "${params.nextDate}"`,
		`\tactive: ${params.active ? 1 : 0}`,
	];
	if (params.lastGenerated) lines.push(`\tlastGenerated: "${params.lastGenerated}"`);
	if (params.payee) lines.push(`\tpayee: ${quote(params.payee)}`);
	if (params.narration) lines.push(`\tnarration: ${quote(params.narration)}`);
	lines.push(`\tflag: "${params.flag || '*'}"`);
	if (params.tags && params.tags.length > 0) lines.push(`\ttags: "${params.tags.join(',')}"`);
	if (params.links && params.links.length > 0) lines.push(`\tlinks: "${params.links.join(',')}"`);
	// Arbitrary key/value maps are stored as one JSON string: BQL can only
	// select metadata keys it knows by name, so per-key entries couldn't be
	// read back.
	if (hasEntries(params.metadata)) lines.push(`\ttxnMeta: ${quote(JSON.stringify(params.metadata))}`);
	if (params.displayAmount !== undefined && params.displayCurrency) {
		lines.push(`\tdisplayAmount: ${params.displayAmount}`);
		lines.push(`\tdisplayCurrency: "${params.displayCurrency}"`);
	}
	lines.push(`\tpostingCount: ${params.postings.length}`);
	params.postings.forEach((posting, i) => {
		const key = `\tposting${i + 1}`;
		lines.push(`${key}Account: ${quote(posting.account)}`);
		// Blank/elided posting (beancount infers the amount to balance the
		// transaction) — omit Amount/Currency entirely, mirroring how
		// generateTransactionText() omits them for a real transaction posting.
		if (posting.amount !== undefined && posting.currency) {
			lines.push(`${key}Amount: ${posting.amount}`);
			lines.push(`${key}Currency: "${posting.currency}"`);
		}
		if (posting.flag) lines.push(`${key}Flag: "${posting.flag}"`);
		if (posting.comment) lines.push(`${key}Comment: ${quote(posting.comment)}`);
		const { cost, price } = posting;
		if (cost) {
			if (cost.number !== undefined && cost.number !== '') lines.push(`${key}CostNumber: ${cost.number}`);
			if (cost.currency) lines.push(`${key}CostCurrency: "${cost.currency}"`);
			if (cost.date) lines.push(`${key}CostDate: "${cost.date}"`);
			if (cost.label) lines.push(`${key}CostLabel: ${quote(cost.label)}`);
			if (cost.isTotal) lines.push(`${key}CostTotal: 1`);
		}
		if (price && price.amount !== undefined && price.amount !== '') {
			lines.push(`${key}PriceAmount: ${price.amount}`);
			if (price.currency) lines.push(`${key}PriceCurrency: "${price.currency}"`);
			if (price.isTotal) lines.push(`${key}PriceTotal: 1`);
		}
		if (hasEntries(posting.metadata)) lines.push(`${key}Meta: ${quote(JSON.stringify(posting.metadata))}`);
	});
	return lines;
}

// --- Reading schedules back from getScheduleListQuery() rows ---

type Row = Record<string, unknown>;

/** Column lookup tolerant of bean-query's column-name casing. */
function col(row: Row, name: string): string {
	const bare = name.startsWith('_') ? name.slice(1) : name;
	for (const candidate of [name.toLowerCase(), name, bare.toLowerCase(), bare]) {
		const value = row[candidate];
		if (typeof value === 'string') return value;
		if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	}
	return '';
}

function parseBool(val: string): boolean {
	const s = val.toLowerCase();
	return s === 'true' || s === '1';
}

function parseNumericValue(val: string): number {
	const match = val.match(/[+-]?[\d.]+/);
	return match ? parseFloat(match[0]) : 0;
}

/** A stored JSON metadata map, or undefined when absent/unparseable. */
function parseMetaJson(raw: string): Record<string, string> | undefined {
	if (!raw) return undefined;
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
		const map: Record<string, string> = {};
		for (const [k, v] of Object.entries(parsed)) map[k] = String(v);
		return Object.keys(map).length > 0 ? map : undefined;
	} catch {
		return undefined;
	}
}

function parsePostingColumns(row: Row, n: number): PostingStub | null {
	const c = (field: string) => col(row, `_p${n}${field}`);
	const account = c('account');
	if (!account) return null;

	const amountRaw = c('amount');
	const posting: PostingStub = { account };
	if (amountRaw) {
		posting.amount = parseNumericValue(amountRaw);
		posting.currency = c('currency');
	}
	if (c('flag')) posting.flag = c('flag');
	if (c('comment')) posting.comment = c('comment');
	if (c('costnumber') || c('costdate') || c('costlabel')) {
		posting.cost = {
			number: c('costnumber') || undefined,
			currency: c('costcurrency') || undefined,
			date: c('costdate') || undefined,
			label: c('costlabel') || undefined,
			isTotal: parseBool(c('costtotal')),
		};
	}
	if (c('priceamount')) {
		posting.price = {
			amount: c('priceamount'),
			currency: c('pricecurrency') || undefined,
			isTotal: parseBool(c('pricetotal')),
		};
	}
	const metadata = parseMetaJson(c('meta'));
	if (metadata) posting.metadata = metadata;
	return posting;
}

/** One getScheduleListQuery() CSV row → a schedule, with `isDue` evaluated against `todayISO`. */
export function parseScheduleRow(row: Row, maxPostings: number, todayISO: string): ScheduledTransactionItem {
	const postings: PostingStub[] = [];
	for (let n = 1; n <= maxPostings; n++) {
		const posting = parsePostingColumns(row, n);
		if (posting) postings.push(posting);
	}
	const tagsRaw = col(row, '_tags');
	const linksRaw = col(row, '_links');
	const active = parseBool(col(row, '_active'));
	const nextDate = col(row, '_nextDate');
	const displayAmountRaw = col(row, '_displayAmount');
	return {
		name: col(row, '_name'),
		frequency: col(row, '_frequency') || 'Monthly',
		startDate: col(row, '_startDate'),
		nextDate,
		lastGenerated: col(row, '_lastGenerated') || undefined,
		active,
		payee: col(row, '_payee') || undefined,
		narration: col(row, '_narration') || undefined,
		flag: col(row, '_flag') || '*',
		tags: tagsRaw ? tagsRaw.split(',').filter(Boolean) : [],
		links: linksRaw ? linksRaw.split(',').filter(Boolean) : [],
		metadata: parseMetaJson(col(row, '_txnMeta')),
		postings,
		displayAmount: displayAmountRaw ? parseNumericValue(displayAmountRaw) : undefined,
		displayCurrency: col(row, '_displayCurrency') || undefined,
		filename: col(row, '_filename'),
		lineno: parseNumericValue(col(row, '_lineno')) || 0,
		isDue: active && !!nextDate && nextDate <= todayISO,
	};
}

/** Starting values for a new schedule copied from an existing transaction. */
export interface SchedulePrefill {
	name: string;
	payee?: string;
	narration?: string;
	flag: string;
	tags: string[];
	links: string[];
	metadata?: Record<string, string>;
	postings: PostingStub[];
	/** Date of the source transaction — the first occurrence defaults to one cycle after it. */
	anchorDate: string;
}

function isNumeric(value: string): boolean {
	return value.trim() !== '' && !isNaN(Number(value));
}

/**
 * Turns a transaction's parsed text into schedule fields. Everything is
 * copied as written except:
 * - `scheduled` metadata (set by the schedule itself on each insert — the
 *   source may have come from another schedule);
 * - the date of a priced cost (`{250 USD, 2026-01-15}`), so each inserted
 *   lot is dated by its own transaction rather than all sharing the original's.
 * Returns an error for what a schedule can't represent.
 */
export function scheduleFromTransaction(
	parsed: ParsedTransaction,
	maxPostings: number
): { success: true; prefill: SchedulePrefill } | { success: false; error: string } {
	if (parsed.postings.length < 2)
		return { success: false, error: 'Could not read the transaction\'s postings' };
	if (parsed.postings.length > maxPostings)
		return { success: false, error: `Schedules support up to ${maxPostings} postings; this transaction has ${parsed.postings.length}` };

	const postings: PostingStub[] = [];
	for (const p of parsed.postings) {
		const numbers = [p.amount, p.cost?.number ?? '', p.price?.amount ?? ''].filter((n) => n !== '');
		if (numbers.some((n) => !isNumeric(n)))
			return { success: false, error: `Posting "${p.account}" uses an arithmetic expression, which schedules can't store` };

		const stub: PostingStub = { account: p.account };
		if (p.amount) {
			stub.amount = Number(p.amount);
			stub.currency = p.currency;
		}
		if (p.flag) stub.flag = p.flag;
		if (p.comment) stub.comment = p.comment;
		if (p.cost) {
			const { number, currency, date, label, isTotal } = p.cost;
			if (!number && !date && !label)
				return { success: false, error: `Posting "${p.account}" uses an empty cost {}, which can't be scheduled yet` };
			stub.cost = {
				number: number || undefined,
				currency: currency || undefined,
				// A priced lot gets the date of each inserted transaction; a
				// date-only cost selects an existing lot, so its date stays.
				date: number ? undefined : date || undefined,
				label: label || undefined,
				isTotal,
			};
		}
		if (p.price && p.price.amount) stub.price = { ...p.price };
		if (Object.keys(p.metadata).length > 0) stub.metadata = { ...p.metadata };
		postings.push(stub);
	}

	const metadata = Object.fromEntries(Object.entries(parsed.metadata).filter(([key]) => key !== 'scheduled'));
	return {
		success: true,
		prefill: {
			name: parsed.payee || parsed.narration || 'Recurring transaction',
			payee: parsed.payee || undefined,
			narration: parsed.narration || undefined,
			flag: parsed.flag,
			tags: parsed.tags,
			links: parsed.links,
			metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
			postings,
			anchorDate: parsed.date,
		},
	};
}

/** The transaction a schedule materializes to on `date`, tagged with
 * `scheduled: "<name>"` (which always wins over a copied `scheduled` key —
 * it's the dedupe/audit link back to this schedule). */
export function scheduleToTransactionData(schedule: ScheduledTransactionItem, date: string): TransactionData {
	return {
		date,
		flag: schedule.flag || '*',
		payee: schedule.payee,
		narration: schedule.narration,
		tags: schedule.tags,
		links: schedule.links,
		metadata: { ...(schedule.metadata || {}), scheduled: schedule.name },
		postings: schedule.postings.map((p) => ({ ...p })),
	};
}

export async function createScheduleDirective(
	plugin: BeancountPlugin,
	params: ScheduleDirectiveParams,
	createBackup = true
): Promise<{ success: boolean; error?: string }> {
	try {
		const filePath = getTargetFile(plugin, 'event');
		if (!filePath) return { success: false, error: 'Events file path not set. Please configure the plugin.' };

		const normalizedPath = convertWslPathToWindows(filePath);
		const directiveText = buildDirectiveLines(params).join('\n');

		await createBackupFile(plugin, normalizedPath, createBackup, 'createScheduleDirective');
		const content = await readFileContent(plugin, normalizedPath);
		const newContent = content.endsWith('\n')
			? `${content}${directiveText}\n`
			: `${content}\n${directiveText}\n`;
		await atomicFileWrite(plugin, normalizedPath, newContent);

		Logger.log(`[createScheduleDirective] Saved schedule "${params.name}"`);
		return { success: true };
	} catch (error) {
		Logger.error('[createScheduleDirective] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function updateScheduleDirective(
	plugin: BeancountPlugin,
	filename: string,
	lineno: number,
	params: ScheduleDirectiveParams,
	createBackup = true
): Promise<{ success: boolean; error?: string }> {
	try {
		const normalizedPath = convertWslPathToWindows(filename);
		await createBackupFile(plugin, normalizedPath, createBackup, 'updateScheduleDirective');

		const _rawContent = await readFileContent(plugin, normalizedPath);
		const newline = getNewlineCharacter(_rawContent);
		const lines = _rawContent.split(/\r?\n/);

		if (isNaN(lineno) || lineno < 1 || lineno > lines.length)
			return { success: false, error: `Invalid line number ${lineno}` };

		const lineIndex = lineno - 1;
		const startLine = lines[lineIndex];

		if (!startLine.includes('event') || !startLine.includes('"Recurring"'))
			return { success: false, error: `Line ${lineno} does not appear to be a Recurring event directive` };

		let endIndex = lineIndex + 1;
		while (endIndex < lines.length && (lines[endIndex].startsWith('  ') || lines[endIndex].startsWith('\t'))) {
			endIndex++;
		}

		const newDirectiveLines = buildDirectiveLines(params);
		lines.splice(lineIndex, endIndex - lineIndex, ...newDirectiveLines);
		await atomicFileWrite(plugin, normalizedPath, lines.join(newline));

		Logger.log(`[updateScheduleDirective] Updated schedule directive at line ${lineno}`);
		return { success: true };
	} catch (error) {
		Logger.error('[updateScheduleDirective] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function deleteScheduleDirective(
	plugin: BeancountPlugin,
	filename: string,
	lineno: number,
	createBackup = true
): Promise<{ success: boolean; error?: string }> {
	try {
		const normalizedPath = convertWslPathToWindows(filename);
		await createBackupFile(plugin, normalizedPath, createBackup, 'deleteScheduleDirective');

		const _rawContent = await readFileContent(plugin, normalizedPath);
		const newline = getNewlineCharacter(_rawContent);
		const lines = _rawContent.split(/\r?\n/);

		if (isNaN(lineno) || lineno < 1 || lineno > lines.length)
			return { success: false, error: `Invalid line number ${lineno}` };

		const lineIndex = lineno - 1;
		const startLine = lines[lineIndex];

		if (!startLine.includes('event') || !startLine.includes('"Recurring"'))
			return { success: false, error: `Line ${lineno} does not appear to be a Recurring event directive` };

		let endIndex = lineIndex + 1;
		while (endIndex < lines.length && (lines[endIndex].startsWith('  ') || lines[endIndex].startsWith('\t'))) {
			endIndex++;
		}

		let startIndex = lineIndex;
		if (startIndex > 0 && lines[startIndex - 1].trim() === '') {
			startIndex--;
		}

		lines.splice(startIndex, endIndex - startIndex);
		await atomicFileWrite(plugin, normalizedPath, lines.join(newline));

		Logger.log(`[deleteScheduleDirective] Deleted schedule directive at line ${lineno}`);
		return { success: true };
	} catch (error) {
		Logger.error('[deleteScheduleDirective] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

/**
 * Advances `dateStr` by one cycle of `frequency`. Returns `null` for
 * `'One-time'` (no further occurrence — caller should deactivate instead).
 *
 * Month/quarter/year arithmetic clamps the day-of-month into the target
 * month (e.g. Jan 31 + Monthly → Feb 28/29) and does NOT re-snap back to the
 * original day in a later, longer month — once clamped, the schedule keeps
 * advancing from the clamped day.
 */
export function advanceScheduleDate(dateStr: string, frequency: string): string | null {
	const [y, m, d] = dateStr.split('-').map(Number);
	if (!y || !m || !d) return null;

	const toISO = (date: Date) =>
		`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

	switch (frequency) {
		case 'One-time':
			return null;
		case 'Weekly': {
			const date = new Date(y, m - 1, d + 7);
			return toISO(date);
		}
		case 'Monthly':
			return addMonthsClamped(y, m, d, 1);
		case 'Quarterly':
			return addMonthsClamped(y, m, d, 3);
		case 'Yearly':
			return addMonthsClamped(y, m, d, 12);
		default:
			return null;
	}
}

function addMonthsClamped(year: number, month: number, day: number, monthsToAdd: number): string {
	const targetMonthIndex = month - 1 + monthsToAdd; // 0-based, may exceed 11
	const targetYear = year + Math.floor(targetMonthIndex / 12);
	const targetMonth = ((targetMonthIndex % 12) + 12) % 12; // 0-based, normalized
	const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
	const clampedDay = Math.min(day, daysInTargetMonth);
	return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

/**
 * Every occurrence of a schedule that's due as of `todayISO`, oldest first —
 * walks forward from `nextDate` via `advanceScheduleDate()` collecting every
 * date `<= todayISO`. A schedule that's fallen behind by several cycles
 * returns all of them (not just the next one), so the confirm-due UI can
 * offer each missed occurrence independently. `'One-time'` schedules return
 * at most one entry, since there's no further occurrence to advance to.
 */
export function computeDueOccurrences(nextDate: string, frequency: string, todayISO: string): string[] {
	const occurrences: string[] = [];
	let cursor: string | null = nextDate;
	while (cursor !== null && cursor <= todayISO) {
		occurrences.push(cursor);
		if (frequency === 'One-time') break;
		cursor = advanceScheduleDate(cursor, frequency);
	}
	return occurrences;
}
