// src/utils/import/aliases.ts
// Matching statement text to accounts via `aliases` metadata on open directives:
//   2020-01-01 open Expenses:Food:EatingOut
//     aliases: "CAMPUS CANTEEN|Ice cream"

import type { AccountMatcher } from '../../models/import';

export const ALIASES_KEY = 'aliases';

export interface AccountAliases {
	account: string;
	aliases: string[];
}

/** Splits an `aliases` value on `|`, dropping blanks. */
export function parseAliases(value: string): string[] {
	return value.split('|').map((a) => a.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

/** Adds `alias` to an `aliases` value unless it's already there (ignoring case and spacing). */
export function addAlias(value: string, alias: string): string {
	const existing = parseAliases(value);
	const clean = parseAliases(alias.replace(/\|/g, ' '))[0];
	if (!clean || existing.some((a) => normalize(a) === normalize(clean))) return existing.join('|');
	return [...existing, clean].join('|');
}

function normalize(text: string): string {
	return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

function isWordChar(ch: string | undefined): boolean {
	return !!ch && (/[a-z0-9]/i.test(ch) || ch.toLowerCase() !== ch.toUpperCase());
}

/**
 * Finds `alias` in `text` where it isn't part of a longer word, so "cred"
 * matches "UPI/CRED/..." but not "CREDIT INTEREST". Both are normalized.
 */
function containsAlias(text: string, alias: string): boolean {
	for (let i = text.indexOf(alias); i >= 0; i = text.indexOf(alias, i + 1)) {
		const before = isWordChar(alias[0]) && isWordChar(text[i - 1]);
		const after = isWordChar(alias[alias.length - 1]) && isWordChar(text[i + alias.length]);
		if (!before && !after) return true;
	}
	return false;
}

/** How an alias has to appear in the text: anywhere as whole words, or as the whole text. */
export type AliasMatchMode = 'contains' | 'exact';

/**
 * Builds a matcher that returns the account whose alias matches the text,
 * ignoring case and extra spaces. With `contains`, several aliases can
 * match and the longest wins, as the most specific; ties go to the account
 * listed first.
 */
export function createAliasMatcher(entries: AccountAliases[], mode: AliasMatchMode = 'contains'): AccountMatcher {
	const candidates = entries
		.flatMap((e) => e.aliases.map((alias) => ({ account: e.account, alias, key: normalize(alias) })))
		.filter((c) => c.key);

	return (text) => {
		const haystack = normalize(text);
		let best: (typeof candidates)[number] | null = null;
		for (const c of candidates) {
			const matches = mode === 'exact' ? haystack === c.key : containsAlias(haystack, c.key);
			if (matches && (!best || c.key.length > best.key.length)) best = c;
		}
		return best ? { account: best.account, alias: best.alias } : null;
	};
}
