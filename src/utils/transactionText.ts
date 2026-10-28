// src/utils/transactionText.ts
// Parses the plain text of a single beancount transaction — header line plus
// its indented metadata and posting lines — back into its parts. The inverse
// of generateTransactionText().

import type { JournalTransaction } from '../models/journal';

export interface ParsedCost {
	number: string;
	currency: string;
	date: string;
	label: string;
	isTotal: boolean;
}

export interface ParsedPrice {
	amount: string;
	currency: string;
	isTotal: boolean;
}

export interface ParsedPosting {
	account: string;
	/** '' for an elided (auto-balanced) posting. */
	amount: string;
	currency: string;
	flag: string | null;
	comment: string;
	metadata: Record<string, string>;
	cost: ParsedCost | null;
	price: ParsedPrice | null;
}

export interface ParsedTransaction {
	date: string;
	flag: string;
	payee: string;
	narration: string;
	tags: string[];
	links: string[];
	metadata: Record<string, string>;
	postings: ParsedPosting[];
}

/** A beancount string literal, allowing `\"` and `\\` escapes inside. */
const STRING_LITERAL = /"((?:[^"\\]|\\.)*)"/g;

function unescapeString(s: string): string {
	return s.replace(/\\(.)/g, '$1');
}

/** Index of the first `;` that isn't inside a string literal, or -1. */
function commentIndex(line: string): number {
	let inString = false;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (inString && ch === '\\') { i++; continue; }
		if (ch === '"') inString = !inString;
		else if (ch === ';' && !inString) return i;
	}
	return -1;
}

/** Splits on commas outside string literals. */
function splitOutsideStrings(s: string): string[] {
	const parts: string[] = [];
	let inString = false;
	let current = '';
	for (let i = 0; i < s.length; i++) {
		const ch = s[i];
		if (inString && ch === '\\') { current += ch + (s[i + 1] ?? ''); i++; continue; }
		if (ch === '"') inString = !inString;
		if (ch === ',' && !inString) { parts.push(current.trim()); current = ''; continue; }
		current += ch;
	}
	parts.push(current.trim());
	return parts;
}

/** A metadata value: quoted strings are unescaped, anything else (numbers, dates, accounts) is kept as written. */
function parseMetadataValue(raw: string): string {
	const value = raw.trim();
	const m = value.match(/^"((?:[^"\\]|\\.)*)"$/);
	return m ? unescapeString(m[1]) : value;
}

function parseCost(costStr: string): ParsedCost {
	const isTotal = costStr.startsWith('{{');
	const inner = costStr.replace(/^\{+/, '').replace(/\}+$/, '').trim();
	const cost: ParsedCost = { number: '', currency: '', date: '', label: '', isTotal };
	for (const part of splitOutsideStrings(inner)) {
		if (!part) continue;
		if (/^\d{4}-\d{2}-\d{2}$/.test(part)) cost.date = part;
		else if (part.startsWith('"')) cost.label = parseMetadataValue(part);
		else {
			const [num, curr] = part.split(/\s+/);
			cost.number = num ?? '';
			cost.currency = curr ?? '';
		}
	}
	return cost;
}

function parsePostingLine(line: string): ParsedPosting | null {
	const ci = commentIndex(line);
	let main = (ci >= 0 ? line.slice(0, ci) : line).trim();
	const comment = ci >= 0 ? line.slice(ci + 1).trim() : '';

	let flag: string | null = null;
	if (/^[*!]\s/.test(main)) {
		flag = main[0];
		main = main.slice(2).trim();
	}

	const accountMatch = main.match(/^([\p{Lu}\p{N}][\p{L}\p{N}:-]*)/u);
	if (!accountMatch) return null;
	const account = accountMatch[1];
	let rest = main.slice(account.length).trim();

	// Cost first, so an `@` inside a cost label isn't mistaken for a price.
	let cost: ParsedCost | null = null;
	const costStart = rest.indexOf('{');
	const costEnd = rest.lastIndexOf('}');
	if (costStart >= 0 && costEnd > costStart) {
		cost = parseCost(rest.slice(costStart, costEnd + 1));
		rest = `${rest.slice(0, costStart)} ${rest.slice(costEnd + 1)}`.trim();
	}

	let price: ParsedPrice | null = null;
	const priceStart = rest.indexOf('@');
	if (priceStart >= 0) {
		const priceStr = rest.slice(priceStart);
		const [amount = '', currency = ''] = priceStr.replace(/^@@?/, '').trim().split(/\s+/);
		price = { amount, currency, isTotal: priceStr.startsWith('@@') };
		rest = rest.slice(0, priceStart).trim();
	}

	const [amount = '', currency = ''] = rest ? rest.split(/\s+/) : [];
	return { account, amount, currency, flag, comment, metadata: {}, cost, price };
}

/**
 * A parsed transaction in the Journal's shape, for editing. Built from the
 * ledger text rather than BQL, it keeps what BQL can't report: posting flags,
 * comments and metadata, cost labels, `{{}}`/`@@`, readable transaction
 * metadata, and a blank amount on the auto-balanced posting.
 */
export function toJournalTransaction(parsed: ParsedTransaction, id: string): JournalTransaction {
	return {
		id,
		type: 'transaction',
		date: parsed.date,
		flag: parsed.flag,
		payee: parsed.payee || null,
		narration: parsed.narration,
		tags: parsed.tags,
		links: parsed.links,
		metadata: { ...parsed.metadata },
		postings: parsed.postings.map((p) => ({
			account: p.account,
			amount: p.amount || null,
			currency: p.currency || null,
			flag: p.flag,
			comment: p.comment || null,
			metadata: { ...p.metadata },
			...(p.cost ? { cost: { ...p.cost } } : {}),
			...(p.price ? { price: { ...p.price } } : {}),
		})),
	};
}

export function parseTransactionText(text: string): ParsedTransaction {
	const lines = text.split(/\r?\n/);
	const result: ParsedTransaction = {
		date: '', flag: '*', payee: '', narration: '', tags: [], links: [], metadata: {}, postings: [],
	};
	if (lines.length === 0) return result;

	let header = lines[0].trim();
	const headerComment = commentIndex(header);
	if (headerComment >= 0) header = header.slice(0, headerComment).trim();

	const headerMatch = header.match(/^(\d{4}-\d{2}-\d{2})\s+([*!]|txn)?/);
	if (headerMatch) {
		result.date = headerMatch[1];
		if (headerMatch[2] === '!') result.flag = '!';
	}

	const strings = [...header.matchAll(STRING_LITERAL)].map((m) => unescapeString(m[1]));
	if (strings.length >= 2) {
		result.payee = strings[0];
		result.narration = strings[1];
	} else if (strings.length === 1) {
		result.narration = strings[0];
	}

	// Tags/links are matched with strings blanked out, so a "#" or "^" inside
	// a payee or narration isn't mistaken for one.
	const bare = header.replace(STRING_LITERAL, '""');
	result.tags = [...bare.matchAll(/(?:^|\s)#([A-Za-z0-9_/.-]+)/g)].map((m) => m[1]);
	result.links = [...bare.matchAll(/(?:^|\s)\^([A-Za-z0-9_/.-]+)/g)].map((m) => m[1]);

	let currentPosting: ParsedPosting | null = null;
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith(';')) continue;

		const metadataMatch = line.match(/^\s+([A-Za-z0-9_-]+):\s+(.+)$/);
		if (metadataMatch) {
			const ci = commentIndex(metadataMatch[2]);
			const value = parseMetadataValue(ci >= 0 ? metadataMatch[2].slice(0, ci) : metadataMatch[2]);
			// Metadata before the first posting belongs to the transaction.
			(currentPosting ? currentPosting.metadata : result.metadata)[metadataMatch[1]] = value;
			continue;
		}

		const posting = parsePostingLine(trimmed);
		if (posting) {
			result.postings.push(posting);
			currentPosting = posting;
		}
	}
	return result;
}
