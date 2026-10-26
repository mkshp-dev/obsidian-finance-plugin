// src/utils/directives/accountDirectives.ts

import type BeancountPlugin from '../../main';
import { getTargetFile } from '../structuredLayout';
import { atomicFileWrite, createBackupFile, convertWslPathToWindows, getNewlineCharacter, readFileContent } from '../fileEditor';
import { Logger } from '../logger';
import { quote } from './directiveText';

export async function saveOpenDirective(
	plugin: BeancountPlugin,
	date: string,
	account: string,
	currencies?: string[],
	booking?: string,
	metadata?: Record<string, string>,
	createBackup = true
): Promise<{ success: boolean; error?: string }> {
	try {
		const filePath = getTargetFile(plugin, 'account', date);
		if (!filePath) return { success: false, error: 'Beancount file path not set' };

		const normalizedPath = convertWslPathToWindows(filePath);
		const parts = [date, 'open', account];
		if (currencies && currencies.length > 0) parts.push(currencies.join(','));
		if (booking) parts.push(`"${booking}"`);

		const directiveLines = [parts.join(' ')];
		if (metadata) {
			for (const [key, value] of Object.entries(metadata)) {
				directiveLines.push(`  ${key}: ${value}`);
			}
		}
		const directiveText = directiveLines.join('\n');

		await createBackupFile(plugin, normalizedPath, createBackup, 'saveOpenDirective');
		const content = await readFileContent(plugin, normalizedPath);
		const newline = getNewlineCharacter(content);
		const newContent = content.endsWith(newline) ? `${content}${directiveText}${newline}` : `${content}${newline}${directiveText}${newline}`;
		await atomicFileWrite(plugin, normalizedPath, newContent);

		Logger.log(`[saveOpenDirective] Saved open directive for ${account}`);
		return { success: true };
	} catch (error) {
		Logger.error('[saveOpenDirective] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function saveCloseDirective(
	plugin: BeancountPlugin,
	date: string,
	account: string,
	createBackup = true
): Promise<{ success: boolean; error?: string }> {
	try {
		const filePath = getTargetFile(plugin, 'account', date);
		if (!filePath) return { success: false, error: 'Beancount file path not set' };

		const normalizedPath = convertWslPathToWindows(filePath);
		const directiveText = `${date} close ${account}`;

		await createBackupFile(plugin, normalizedPath, createBackup, 'saveCloseDirective');
		const content = await readFileContent(plugin, normalizedPath);
		const newline = getNewlineCharacter(content);
		const newContent = content.endsWith(newline) ? `${content}${directiveText}${newline}` : `${content}${newline}${directiveText}${newline}`;
		await atomicFileWrite(plugin, normalizedPath, newContent);

		Logger.log(`[saveCloseDirective] Saved close directive for ${account}`);
		return { success: true };
	} catch (error) {
		Logger.error('[saveCloseDirective] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

/**
 * Updates (adds, changes, or clears) just the `reconcile:` metadata line on
 * an already-open account's `open` directive, without disturbing any other
 * metadata keys that directive may carry.
 *
 * Unlike saveCommodityMetadata/updateScheduleDirective (which rebuild the
 * whole metadata block from a full metadata object — safe there because the
 * plugin owns that whole block), an `open` directive's metadata is not fully
 * plugin-managed, so this only ever touches the single `reconcile:` line,
 * leaving every other existing metadata line byte-for-byte untouched.
 */
export async function updateAccountReconcileMetadata(
	plugin: BeancountPlugin,
	account: string,
	filename: string,
	lineno: number,
	reconcileDays: number | null, // null => clear the key
	createBackup = true
): Promise<{ success: boolean; error?: string }> {
	try {
		const normalizedPath = convertWslPathToWindows(filename);
		const content = await readFileContent(plugin, normalizedPath);
		const newline = getNewlineCharacter(content);
		const lines = content.split(/\r?\n/);

		const lineIndex = lineno - 1;
		if (lineIndex < 0 || lineIndex >= lines.length) {
			return { success: false, error: `Invalid line number ${lineno} for ${filename}` };
		}

		const openLine = lines[lineIndex];
		if (!openLine.includes('open') || !openLine.includes(account)) {
			return { success: false, error: `Open directive for ${account} not found at ${filename}:${lineno} (file may have changed)` };
		}

		// Capture the existing metadata block (indented, non-blank lines right below the open line) verbatim.
		let endIndex = lineIndex + 1;
		while (endIndex < lines.length && /^[ \t]+\S/.test(lines[endIndex])) {
			endIndex++;
		}
		const metaLines = lines.slice(lineIndex + 1, endIndex);

		const reconcileIdx = metaLines.findIndex(l => /^\s*reconcile\s*:/.test(l));
		const indent = metaLines.length > 0 ? (metaLines[0].match(/^\s*/)?.[0] ?? '  ') : '  ';

		if (reconcileDays === null) {
			// Clear: nothing to do if there's no reconcile line already.
			if (reconcileIdx === -1) {
				Logger.log(`[updateAccountReconcileMetadata] No reconcile metadata to clear for ${account}`);
				return { success: true };
			}
			metaLines.splice(reconcileIdx, 1);
		} else if (reconcileIdx !== -1) {
			metaLines[reconcileIdx] = `${indent}reconcile: ${reconcileDays}`;
		} else {
			metaLines.push(`${indent}reconcile: ${reconcileDays}`);
		}

		await createBackupFile(plugin, normalizedPath, createBackup, 'updateAccountReconcileMetadata');
		lines.splice(lineIndex + 1, endIndex - (lineIndex + 1), ...metaLines);
		await atomicFileWrite(plugin, normalizedPath, lines.join(newline));

		Logger.log(`[updateAccountReconcileMetadata] Updated reconcile metadata for ${account}`);
		return { success: true };
	} catch (error) {
		Logger.error('[updateAccountReconcileMetadata] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A trailing `; comment` after a metadata value, if any. */
function trailingComment(raw: string): string {
	const s = raw.trim();
	const str = /^"(?:[^"\\]|\\.)*"/.exec(s);
	const rest = str ? s.slice(str[0].length).trim() : s.slice(Math.max(0, s.indexOf(';')));
	return rest.startsWith(';') ? rest : '';
}

/**
 * Sets (or with `null`, removes) one metadata key on the open directive of
 * `account` starting on `lineno` (1-based), keeping every other line as
 * written, and a trailing comment on the key's own line. A new key goes
 * after the directive's metadata. Returns null when that line doesn't hold
 * the account's open directive (the file changed since it was read).
 */
export function setOpenDirectiveMetadata(
	content: string,
	account: string,
	lineno: number,
	key: string,
	value: string | null,
	newline: string
): string | null {
	const lines = content.split(/\r?\n/);
	const index = lineno - 1;
	const open = new RegExp(`^\\d{4}-\\d{2}-\\d{2}\\s+open\\s+${escapeRegExp(account)}(\\s|;|$)`);
	if (index < 0 || index >= lines.length || !open.test(lines[index])) return null;

	let end = index + 1;
	while (end < lines.length && /^[ \t]+\S/.test(lines[end])) end++;
	const keyPattern = new RegExp(`^([ \\t]+)${escapeRegExp(key)}\\s*:(.*)$`);
	const at = lines.slice(index + 1, end).findIndex((l) => keyPattern.test(l));

	if (value === null) {
		if (at >= 0) lines.splice(index + 1 + at, 1);
	} else if (at >= 0) {
		const [, indent, raw] = keyPattern.exec(lines[index + 1 + at])!;
		const comment = trailingComment(raw);
		lines[index + 1 + at] = `${indent}${key}: ${quote(value)}${comment ? ` ${comment}` : ''}`;
	} else {
		const indent = lines.slice(index + 1, end).find((l) => /^[ \t]+[a-z][\w-]*\s*:/.test(l))?.match(/^[ \t]+/)?.[0] ?? '  ';
		// After the last metadata line, before indented comments trailing the directive.
		let insertAt = end;
		while (insertAt > index + 1 && /^[ \t]+;/.test(lines[insertAt - 1])) insertAt--;
		lines.splice(insertAt, 0, `${indent}${key}: ${quote(value)}`);
	}
	return lines.join(newline);
}

/**
 * Replaces an account's `aliases` metadata (removing it when the list is
 * empty) on its open directive at `filename`:`lineno`, as reported by
 * bean-query.
 */
export async function updateAccountAliases(
	plugin: BeancountPlugin,
	account: string,
	filename: string,
	lineno: number,
	aliases: string[],
	createBackup = plugin.settings.createBackups ?? true
): Promise<{ success: boolean; error?: string }> {
	try {
		const normalizedPath = convertWslPathToWindows(filename);
		const content = await readFileContent(plugin, normalizedPath);
		const value = aliases.length > 0 ? aliases.join('|') : null;
		const updated = setOpenDirectiveMetadata(content, account, lineno, 'aliases', value, getNewlineCharacter(content));
		if (updated === null) {
			return { success: false, error: `Open directive for ${account} not found at ${filename}:${lineno} (file may have changed)` };
		}
		if (updated !== content) {
			await createBackupFile(plugin, normalizedPath, createBackup, 'updateAccountAliases');
			await atomicFileWrite(plugin, normalizedPath, updated);
		}
		Logger.log(`[updateAccountAliases] Updated aliases for ${account}`);
		return { success: true };
	} catch (error) {
		Logger.error('[updateAccountAliases] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function updateOperatingCurrency(
	plugin: BeancountPlugin,
	currency: string,
	createBackup = true
): Promise<{ success: boolean; error?: string }> {
	try {
		const { getMainLedgerPath } = await import('../structuredLayout');
		const ledgerPath = getMainLedgerPath(plugin);
		if (!ledgerPath) return { success: false, error: 'Main ledger path not set' };

		const normalizedPath = convertWslPathToWindows(ledgerPath);
		await createBackupFile(plugin, normalizedPath, createBackup, 'updateOperatingCurrency');

		const content = await readFileContent(plugin, normalizedPath);
		const pattern = /^(option\s+"operating_currency"\s+)"[^"]*"/m;

		if (!pattern.test(content)) {
			return { success: false, error: 'Could not find option "operating_currency" in ledger file' };
		}

		const updated = content.replace(pattern, `$1"${currency}"`);
		await atomicFileWrite(plugin, normalizedPath, updated);

		Logger.log(`[updateOperatingCurrency] Updated operating_currency to ${currency}`);
		return { success: true };
	} catch (error) {
		Logger.error('[updateOperatingCurrency] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}
