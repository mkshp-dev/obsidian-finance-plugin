// src/utils/accountQuery.ts
//
// Converts between a list of individual account names (what the "Add Budget"/"Add Target"
// UI lets a user pick) and the single accountQuery string stored on an Indicator directive
// and matched via beancount's `account ~ '^${accountString}'` regex operator.

/** Longest ':'-terminated segment-prefix shared by every account, or '' if none. */
function commonPrefix(accounts: string[]): string {
	const segmentLists = accounts.map((a) => a.split(':'));
	const shortest = Math.min(...segmentLists.map((s) => s.length));
	let shared = 0;
	for (let i = 0; i < shortest - 1; i++) {
		const segment = segmentLists[0][i];
		if (segmentLists.every((s) => s[i] === segment)) {
			shared++;
		} else {
			break;
		}
	}
	return shared > 0 ? segmentLists[0].slice(0, shared).join(':') + ':' : '';
}

/** Joins one or more account names into the accountQuery string used for BQL matching. */
export function buildAccountQuery(accounts: string[]): string {
	const cleaned = [...new Set(accounts.map((a) => a.trim()).filter(Boolean))];
	if (cleaned.length === 0) return '';
	if (cleaned.length === 1) return cleaned[0];

	const prefix = commonPrefix(cleaned);
	if (prefix) {
		const suffixes = cleaned.map((a) => a.slice(prefix.length));
		if (suffixes.every((s) => s.length > 0)) {
			return `${prefix}(${suffixes.join('|')})`;
		}
	}
	return `(${cleaned.join('|')})`;
}

/**
 * Reverses buildAccountQuery for editing. Falls back to a single raw entry when the
 * stored string doesn't match either pattern produced above (e.g. hand-authored regex),
 * so editing never silently drops or corrupts it.
 */
export function parseAccountQuery(query: string): string[] {
	const trimmed = query.trim();
	if (!trimmed) return [];

	const prefixed = trimmed.match(/^([\w.-]+(?::[\w.-]+)*:)\(([^()]*)\)$/);
	if (prefixed) {
		const [, prefix, group] = prefixed;
		return group.split('|').map((alt) => `${prefix}${alt}`);
	}

	const bare = trimmed.match(/^\(([^()]*)\)$/);
	if (bare) {
		return bare[1].split('|');
	}

	return [trimmed];
}
