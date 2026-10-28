// src/utils/directives/balanceDirectives.ts

import type BeancountPlugin from '../../main';
import type { BalanceData } from './types';
import type { JournalBalance } from '../../models/journal';
import { getTargetFile } from '../structuredLayout';
import { atomicFileWrite, createBackupFile, convertWslPathToWindows, getNewlineCharacter, readFileContent } from '../fileEditor';
import { Logger } from '../logger';
import { blockEndIndex, formatBalanceHeader, loadDirective, locationFromMetadata, parseBalanceHeader, type BalanceHeader, type LoadedDirective } from './directiveText';

export async function createBalanceAssertion(
	plugin: BeancountPlugin,
	date: string,
	account: string,
	amount: string,
	currency: string,
	tolerance?: string,
	createBackup = true
): Promise<{ success: boolean; error?: string }> {
	try {
		const filePath = getTargetFile(plugin, 'balance', date);
		if (!filePath) return { success: false, error: 'Beancount file path not set' };

		const normalizedPath = convertWslPathToWindows(filePath);
		const directiveText = formatBalanceHeader({ date, account, amount, tolerance: tolerance || null, currency, rest: '' });

		await createBackupFile(plugin, normalizedPath, createBackup, 'createBalanceAssertion');
		const content = await readFileContent(plugin, normalizedPath);
		const newline = getNewlineCharacter(content);
		const newContent = content.endsWith(newline) ? `${content}${directiveText}${newline}` : `${content}${newline}${directiveText}${newline}`;
		await atomicFileWrite(plugin, normalizedPath, newContent);

		Logger.log(`[createBalanceAssertion] Saved balance for ${account}`);
		return { success: true };
	} catch (error) {
		Logger.error('[createBalanceAssertion] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

/**
 * Loads the balance assertion a Journal entry was read from, checking the
 * line still holds that assertion — the file may have changed since the
 * Journal loaded, and a stale line number must never rewrite another line.
 */
async function loadBalance(
	plugin: BeancountPlugin,
	entry: Pick<JournalBalance, 'date' | 'account' | 'metadata'>
): Promise<{ directive: LoadedDirective; parsed: BalanceHeader }> {
	const location = locationFromMetadata(entry.metadata);
	if (!location) throw new Error("Couldn't find this balance assertion in your ledger files. Refresh and try again.");
	const directive = await loadDirective(plugin, location);
	const parsed = parseBalanceHeader(directive.header);
	if (!parsed || parsed.date !== entry.date || parsed.account !== entry.account)
		throw new Error('This balance assertion has changed in your ledger since it was loaded. Refresh and try again.');
	return { directive, parsed };
}

/**
 * Rewrites date/account/amount/currency in place. The tolerance (unless
 * given), trailing comment and metadata lines are kept as written.
 */
export async function updateBalance(
	plugin: BeancountPlugin,
	entry: Pick<JournalBalance, 'date' | 'account' | 'metadata'>,
	balanceData: BalanceData
): Promise<{ success: boolean; error?: string }> {
	try {
		const { directive, parsed } = await loadBalance(plugin, entry);
		const { path, lines, newline, start, headerEnd } = directive;

		const header = formatBalanceHeader({
			...parsed,
			date: balanceData.date,
			account: balanceData.account,
			amount: String(balanceData.amount),
			currency: balanceData.currency,
			tolerance: balanceData.tolerance !== undefined ? String(balanceData.tolerance) : parsed.tolerance,
		});

		await createBackupFile(plugin, path, plugin.settings.createBackups ?? true, 'updateBalance');
		lines.splice(start, headerEnd - start + 1, ...header.split('\n'));
		await atomicFileWrite(plugin, path, lines.join(newline));
		Logger.log(`[updateBalance] Updated ${path}:${start + 1}`);
		return { success: true };
	} catch (error) {
		Logger.error('[updateBalance] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

/** Removes the assertion together with its metadata lines. */
export async function deleteBalance(
	plugin: BeancountPlugin,
	entry: Pick<JournalBalance, 'date' | 'account' | 'metadata'>
): Promise<{ success: boolean; error?: string }> {
	try {
		const { directive } = await loadBalance(plugin, entry);
		const { path, lines, newline, start } = directive;

		await createBackupFile(plugin, path, plugin.settings.createBackups ?? true, 'deleteBalance');
		lines.splice(start, blockEndIndex(lines, start) - start + 1);
		await atomicFileWrite(plugin, path, lines.join(newline));
		Logger.log(`[deleteBalance] Deleted ${path}:${start + 1}`);
		return { success: true };
	} catch (error) {
		Logger.error('[deleteBalance] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}
