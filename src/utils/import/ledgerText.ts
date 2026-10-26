// src/utils/import/ledgerText.ts
// Text edits for writing an import into ledger files: appending entries,
// and adding remembered aliases to accounts' open directives.

import { quote } from '../directives/directiveText';
import { addAlias, ALIASES_KEY } from './aliases';

/**
 * Appends entries to a file's content. Transactions are separated by a
 * blank line; single-line entries like balance assertions aren't.
 */
export function appendEntries(content: string, entries: string[], newline: string, blankLine: boolean): string {
	if (entries.length === 0) return content;
	let out = content && !content.endsWith(newline) ? content + newline : content;
	for (const entry of entries) {
		if (blankLine && out && !out.endsWith(newline + newline)) out += newline;
		out += entry + newline;
	}
	return out;
}

/** Aliases to add to the open directive starting on `lineno` (1-based). */
export interface AliasEdit {
	account: string;
	lineno: number;
	aliases: string[];
}

const STRING = /^"((?:[^"\\]|\\.)*)"/;

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** An `aliases:` metadata value as written: a quoted string, or bare text. Returns the value and any trailing comment. */
function readValue(raw: string): { value: string; comment: string } {
	const s = raw.trim();
	const str = STRING.exec(s);
	if (str) {
		const rest = s.slice(str[0].length).trim();
		return { value: str[1].replace(/\\([\s\S])/g, '$1'), comment: rest.startsWith(';') ? rest : '' };
	}
	const semi = s.indexOf(';');
	return semi < 0 ? { value: s, comment: '' } : { value: s.slice(0, semi).trim(), comment: s.slice(semi) };
}

/**
 * Adds aliases to accounts' open directives, keeping every other line as
 * written. An existing `aliases:` line is extended (skipping aliases it
 * already has); otherwise one is added after the directive's metadata.
 * An edit whose line no longer holds that account's open directive (the
 * file changed since it was read) is skipped, and its account returned in
 * `missing`.
 */
export function addAliasesToOpenDirectives(content: string, edits: AliasEdit[], newline: string): { content: string; missing: string[] } {
	const lines = content.split(/\r?\n/);
	const missing: string[] = [];

	// Bottom-up, so lines added for one directive don't move the ones above it.
	for (const edit of [...edits].sort((a, b) => b.lineno - a.lineno)) {
		const index = edit.lineno - 1;
		const open = new RegExp(`^\\d{4}-\\d{2}-\\d{2}\\s+open\\s+${escapeRegExp(edit.account)}(\\s|;|$)`);
		if (index < 0 || index >= lines.length || !open.test(lines[index])) {
			missing.push(edit.account);
			continue;
		}

		let end = index + 1;
		while (end < lines.length && /^[ \t]+\S/.test(lines[end])) end++;
		const meta = lines.slice(index + 1, end);
		const keyPattern = new RegExp(`^([ \\t]+)${ALIASES_KEY}:(.*)$`);
		const at = meta.findIndex((l) => keyPattern.test(l));

		if (at >= 0) {
			const [, indent, raw] = keyPattern.exec(meta[at])!;
			const { value, comment } = readValue(raw);
			const merged = edit.aliases.reduce(addAlias, value);
			if (merged === value) continue;
			lines[index + 1 + at] = `${indent}${ALIASES_KEY}: ${quote(merged)}${comment ? ` ${comment}` : ''}`;
		} else {
			const merged = edit.aliases.reduce(addAlias, '');
			if (!merged) continue;
			const indent = meta.find((l) => /^[ \t]+[a-z][\w-]*:/.test(l))?.match(/^[ \t]+/)?.[0] ?? '  ';
			// After the last metadata line, before any indented comments trailing the directive.
			let insertAt = end;
			while (insertAt > index + 1 && /^[ \t]+;/.test(lines[insertAt - 1])) insertAt--;
			lines.splice(insertAt, 0, `${indent}${ALIASES_KEY}: ${quote(merged)}`);
		}
	}

	return { content: lines.join(newline), missing };
}
