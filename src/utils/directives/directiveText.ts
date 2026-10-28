// src/utils/directives/directiveText.ts
// Low-level helpers for reading and rewriting single-line directives
// (balance, note) in place.

import type BeancountPlugin from '../../main';
import { convertWslPathToWindows, getNewlineCharacter, readFileContent } from '../fileEditor';

/** Beancount string literal — escapes `\` and `"`, which beancount unescapes on load. */
export function quote(value: string): string {
	return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function unescapeString(s: string): string {
	return s.replace(/\\([\s\S])/g, '$1');
}

const DATE = String.raw`\d{4}-\d{2}-\d{2}`;
const STRING = String.raw`"(?:[^"\\]|\\.)*"`;

/**
 * A balance header, split so any part can be replaced while `rest` (a
 * trailing comment) is kept as written. Beancount syntax:
 * `DATE balance ACCOUNT AMOUNT [~ TOLERANCE] CURRENCY`.
 */
export interface BalanceHeader {
	date: string;
	account: string;
	amount: string;
	tolerance: string | null;
	currency: string;
	rest: string;
}

const BALANCE_HEADER = new RegExp(String.raw`^(${DATE})\s+balance\s+(\S+)\s+(\S+)(?:\s*~\s*(\S+))?\s+([A-Z][A-Za-z0-9'._-]*)(.*)$`);

export function parseBalanceHeader(header: string): BalanceHeader | null {
	const m = header.match(BALANCE_HEADER);
	if (!m) return null;
	return { date: m[1], account: m[2], amount: m[3], tolerance: m[4] ?? null, currency: m[5], rest: m[6] };
}

export function formatBalanceHeader(b: BalanceHeader): string {
	return `${b.date} balance ${b.account}  ${b.amount}${b.tolerance ? ` ~ ${b.tolerance}` : ''} ${b.currency}${b.rest}`;
}

/** A note header; `rest` keeps its tags, links and trailing comment as written. */
export interface NoteHeader {
	date: string;
	account: string;
	comment: string;
	rest: string;
}

const NOTE_HEADER = new RegExp(String.raw`^(${DATE})\s+note\s+(\S+)\s+(${STRING})([\s\S]*)$`);

export function parseNoteHeader(header: string): NoteHeader | null {
	const m = header.match(NOTE_HEADER);
	if (!m) return null;
	return { date: m[1], account: m[2], comment: unescapeString(m[3].slice(1, -1)), rest: m[4] };
}

export function formatNoteHeader(n: NoteHeader): string {
	return `${n.date} note ${n.account} ${quote(n.comment)}${n.rest}`;
}

/** Where a directive lives, as reported by bean-query. */
export interface DirectiveLocation {
	filename: string;
	lineno: number;
}

/** The location stored in a Journal entry's metadata, if present. */
export function locationFromMetadata(metadata: Record<string, unknown>): DirectiveLocation | null {
	const { filename, lineno } = metadata;
	return typeof filename === 'string' && typeof lineno === 'number' ? { filename, lineno } : null;
}

/**
 * Index of the last line of the directive header starting at `start` — later
 * than `start` only when a string literal (e.g. a note's text) spans lines.
 */
export function headerEndIndex(lines: string[], start: number): number {
	let inString = false;
	for (let i = start; i < lines.length; i++) {
		const line = lines[i];
		for (let c = 0; c < line.length; c++) {
			const ch = line[c];
			if (inString && ch === '\\') { c++; continue; }
			if (ch === '"') inString = !inString;
			else if (ch === ';' && !inString) break; // rest of the line is a comment
		}
		if (!inString) return i;
	}
	return lines.length - 1;
}

/** Index of the last line of the directive block: its header plus indented metadata lines. */
export function blockEndIndex(lines: string[], start: number): number {
	let end = headerEndIndex(lines, start);
	while (end + 1 < lines.length && /^[ \t]+\S/.test(lines[end + 1])) end++;
	return end;
}

export interface LoadedDirective {
	path: string;
	lines: string[];
	newline: string;
	start: number;
	/** The header text — joined with '\n' when a string literal spans lines. */
	header: string;
	headerEnd: number;
}

/** Reads the file and returns the directive header at `location`. */
export async function loadDirective(plugin: BeancountPlugin, location: DirectiveLocation): Promise<LoadedDirective> {
	const path = convertWslPathToWindows(location.filename);
	const content = await readFileContent(plugin, path);
	const lines = content.split(/\r?\n/);
	const start = location.lineno - 1;
	if (!Number.isInteger(location.lineno) || start < 0 || start >= lines.length)
		throw new Error(`Invalid line number ${location.lineno}`);
	const headerEnd = headerEndIndex(lines, start);
	return {
		path,
		lines,
		newline: getNewlineCharacter(content),
		start,
		header: lines.slice(start, headerEnd + 1).join('\n'),
		headerEnd,
	};
}
