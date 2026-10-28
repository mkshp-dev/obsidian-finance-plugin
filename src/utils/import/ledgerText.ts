// src/utils/import/ledgerText.ts
// Text edits for writing an import into ledger files.

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
