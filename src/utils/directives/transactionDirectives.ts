// src/utils/directives/transactionDirectives.ts

import { parse as parseCsv } from 'csv-parse/sync';
import type BeancountPlugin from '../../main';
import type { TransactionData, FileLineRow } from './types';
import { getTargetFile, ensureTransactionFile } from '../structuredLayout';
import { atomicFileWrite, createBackupFile, convertWslPathToWindows, getNewlineCharacter, readFileContent } from '../fileEditor';
import { runQuery } from '../queryRunner';
import { Logger } from '../logger';
import { quote } from './directiveText';

export function generateTransactionText(transactionData: TransactionData, newline = '\n'): string {
	const date = transactionData.date;
	const flag = transactionData.flag || '*';
	const payee = transactionData.payee || '';
	const narration = transactionData.narration || '';
	const tags: string[] = transactionData.tags || [];
	const links: string[] = transactionData.links || [];

	let payeeNarration = '';
	if (payee && narration) payeeNarration = `${quote(payee)} ${quote(narration)}`;
	else if (payee) payeeNarration = `${quote(payee)} ""`;
	else if (narration) payeeNarration = quote(narration);
	else payeeNarration = '""';

	const headerParts = [date, flag, payeeNarration];
	for (const tag of tags) { const c = tag.replace(/^#/, ''); if (c) headerParts.push(`#${c}`); }
	for (const link of links) headerParts.push(`^${link}`);

	const lines = [headerParts.join(' ')];

	for (const [key, value] of Object.entries(transactionData.metadata || {})) {
		if (key !== 'filename' && key !== 'lineno') lines.push(`  ${key}: ${quote(String(value))}`);
	}

	for (const posting of (transactionData.postings || [])) {
		let postingLine = '  ';
		if (posting.flag) postingLine += `${posting.flag} `;
		postingLine += posting.account;

		if (posting.amount && posting.currency) {
			postingLine += `  ${posting.amount} ${posting.currency}`;

			if (posting.cost?.number && posting.cost?.currency) {
				const ob = posting.cost.isTotal ? '{{' : '{';
				const cb = posting.cost.isTotal ? '}}' : '}';
				postingLine += ` ${ob}${posting.cost.number} ${posting.cost.currency}`;
				if (posting.cost.date) postingLine += `, ${posting.cost.date}`;
				if (posting.cost.label) postingLine += `, ${quote(posting.cost.label)}`;
				postingLine += cb;
			} else if (posting.cost?.date) {
				postingLine += ` {${posting.cost.date}}`;
			} else if (posting.cost?.label) {
				postingLine += ` {${quote(posting.cost.label)}}`;
			}

			if (posting.price?.amount && posting.price?.currency) {
				postingLine += ` ${posting.price.isTotal ? '@@' : '@'} ${posting.price.amount} ${posting.price.currency}`;
			}
		}

		if (posting.comment) postingLine += `  ; ${posting.comment}`;
		lines.push(postingLine);

		for (const [key, value] of Object.entries(posting.metadata || {})) {
			lines.push(`    ${key}: ${quote(String(value))}`);
		}
	}

	return lines.join(newline);
}

export async function createTransaction(
	plugin: BeancountPlugin,
	transactionData: TransactionData
): Promise<{ success: boolean; error?: string }> {
	try {
		const transactionDate = transactionData.date || new Date().toISOString().split('T')[0];
		const folderName = plugin.settings.structuredFolderName || 'Finances';
		await ensureTransactionFile(plugin, folderName, transactionDate);

		const beancountFilePath = getTargetFile(plugin, 'transaction', transactionDate);
		if (!beancountFilePath) return { success: false, error: 'Beancount file path not configured' };

		const normalizedPath = convertWslPathToWindows(beancountFilePath);
		Logger.log(`[createTransaction] ${beancountFilePath} → ${normalizedPath}`);

		await createBackupFile(plugin, normalizedPath, plugin.settings.createBackups ?? true, 'createTransaction');
		const currentContent = await readFileContent(plugin, normalizedPath);
		const newline = getNewlineCharacter(currentContent);
		await atomicFileWrite(plugin, normalizedPath, currentContent + newline + generateTransactionText(transactionData, newline) + newline);

		Logger.log(`[createTransaction] Created transaction in ${normalizedPath}`);
		return { success: true };
	} catch (error) {
		Logger.error('[createTransaction] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

function findTransactionBlock(lines: string[], lineIndex: number): { startIndex: number; endIndex: number } {
	let startIndex = lineIndex;
	for (let i = lineIndex - 1; i >= 0; i--) {
		const line = lines[i];
		if (line.trim() === '') break;
		if (!line.startsWith(' ') && !line.startsWith('\t')) { startIndex = i; break; }
	}

	let endIndex = lineIndex;
	for (let i = lineIndex + 1; i < lines.length; i++) {
		const line = lines[i];
		if (line.trim() === '') {
			let foundNonEmpty = false;
			for (let j = i + 1; j < lines.length; j++) {
				if (lines[j].trim() !== '') {
					if (lines[j].startsWith(' ') || lines[j].startsWith('\t')) { endIndex = j; }
					else { foundNonEmpty = true; }
					break;
				}
			}
			if (foundNonEmpty) { endIndex = i - 1; break; }
			endIndex = i;
		} else if (line.startsWith(' ') || line.startsWith('\t')) {
			endIndex = i;
		} else {
			endIndex = i - 1; break;
		}
	}

	if (endIndex === lineIndex) {
		for (let i = lineIndex + 1; i < lines.length; i++) {
			const line = lines[i];
			if (line.trim() === '' || (!line.startsWith(' ') && !line.startsWith('\t'))) { endIndex = i - 1; break; }
			endIndex = i;
		}
	}

	return { startIndex, endIndex };
}

/**
 * The exact source text of the transaction starting at `lineno` (1-based) in
 * `filename` (as reported by bean-query). Unlike the Journal's BQL view, this
 * keeps everything written in the ledger: posting flags, comments, metadata,
 * cost labels, `{{}}`/`@@`, and which posting was left blank to auto-balance.
 */
export async function readTransactionText(
	plugin: BeancountPlugin,
	filename: string,
	lineno: number
): Promise<{ success: true; text: string } | { success: false; error: string }> {
	try {
		const content = await readFileContent(plugin, convertWslPathToWindows(filename));
		const lines = content.split(/\r?\n/);
		if (!Number.isInteger(lineno) || lineno < 1 || lineno > lines.length)
			return { success: false, error: `Invalid line number ${lineno}` };
		const { startIndex, endIndex } = findTransactionBlock(lines, lineno - 1);
		return { success: true, text: lines.slice(startIndex, endIndex + 1).join('\n') };
	} catch (error) {
		Logger.error('[readTransactionText] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function updateTransaction(
	plugin: BeancountPlugin,
	transactionId: string,
	transactionData: TransactionData
): Promise<{ success: boolean; error?: string }> {
	try {
		if (!plugin.settings.structuredFolderName)
			return { success: false, error: 'Beancount folder not configured' };

		const csv = await runQuery(plugin, `SELECT filename, lineno FROM postings WHERE id = "${transactionId}" LIMIT 1`);
		const records = parseCsv(csv, { columns: true, skip_empty_lines: true, trim: true }) as unknown as FileLineRow[];

		if (records.length === 0) return { success: false, error: `Transaction ${transactionId} not found` };

		const actualFilePath = records[0].filename;
		const lineno = parseInt(records[0].lineno);
		if (!actualFilePath) return { success: false, error: 'Filename not returned from query' };

		const normalizedPath = convertWslPathToWindows(actualFilePath);
		Logger.log(`[updateTransaction] ${actualFilePath} → ${normalizedPath}, line ${lineno}`);

		await createBackupFile(plugin, normalizedPath, plugin.settings.createBackups ?? true, 'updateTransaction');
		const currentContent = await readFileContent(plugin, normalizedPath);
		const newline = getNewlineCharacter(currentContent);
		const lines = currentContent.split(/\r?\n/);

		if (isNaN(lineno) || lineno < 1 || lineno > lines.length)
			return { success: false, error: `Invalid line number ${lineno}` };

		const { startIndex, endIndex } = findTransactionBlock(lines, lineno - 1);
		Logger.log(`[updateTransaction] Block: lines ${startIndex + 1}–${endIndex + 1}`);

		const newLines = [...lines.slice(0, startIndex), generateTransactionText(transactionData, newline), ...lines.slice(endIndex + 1)];
		await atomicFileWrite(plugin, normalizedPath, newLines.join(newline));
		Logger.log(`[updateTransaction] Updated ${transactionId}`);
		return { success: true };
	} catch (error) {
		Logger.error('[updateTransaction] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function deleteTransaction(
	plugin: BeancountPlugin,
	transactionId: string
): Promise<{ success: boolean; error?: string }> {
	try {
		if (!plugin.settings.structuredFolderName)
			return { success: false, error: 'Beancount folder not configured' };

		const csv = await runQuery(plugin, `SELECT filename, lineno FROM postings WHERE id = "${transactionId}" LIMIT 1`);
		const records = parseCsv(csv, { columns: true, skip_empty_lines: true, trim: true }) as unknown as FileLineRow[];

		if (records.length === 0) return { success: false, error: `Transaction ${transactionId} not found` };

		const actualFilePath = records[0].filename;
		const lineno = parseInt(records[0].lineno);
		if (!actualFilePath) return { success: false, error: 'Filename not returned from query' };

		const normalizedPath = convertWslPathToWindows(actualFilePath);
		Logger.log(`[deleteTransaction] ${actualFilePath} → ${normalizedPath}, line ${lineno}`);

		await createBackupFile(plugin, normalizedPath, plugin.settings.createBackups ?? true, 'deleteTransaction');
		const currentContent = await readFileContent(plugin, normalizedPath);
		const newline = getNewlineCharacter(currentContent);
		const lines = currentContent.split(/\r?\n/);

		if (isNaN(lineno) || lineno < 1 || lineno > lines.length)
			return { success: false, error: `Invalid line number ${lineno}` };

		const block = findTransactionBlock(lines, lineno - 1);
		const startIndex = block.startIndex;
		let endIndex = block.endIndex;
		if (endIndex + 1 < lines.length && lines[endIndex + 1].trim() === '') endIndex++;

		Logger.log(`[deleteTransaction] Block: lines ${startIndex + 1}–${endIndex + 1}`);
		const newLines = [...lines.slice(0, startIndex), ...lines.slice(endIndex + 1)];
		await atomicFileWrite(plugin, normalizedPath, newLines.join(newline));
		Logger.log(`[deleteTransaction] Deleted ${transactionId}`);
		return { success: true };
	} catch (error) {
		Logger.error('[deleteTransaction] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export async function createSnippet(
	plugin: BeancountPlugin,
	snippetName: string,
	transactionData: TransactionData
): Promise<{ success: boolean; error?: string }> {
	try {
		const folderName = plugin.settings.structuredFolderName || 'Finances';
		const snippetsFilePath = `${folderName}/snippets.beancount`;
		const adapter = plugin.app.vault.adapter;

		const exists = await adapter.exists(snippetsFilePath);
		if (!exists) {
			await plugin.loadSnippets();
		}

		const metadata = { ...(transactionData.metadata || {}), Snippet: snippetName };
		const dataForSnippet = { ...transactionData, metadata };

		const currentContent = await adapter.read(snippetsFilePath);
		const newline = getNewlineCharacter(currentContent);

		const snippetText = generateTransactionText(dataForSnippet, newline);
		const newContent = currentContent.endsWith(newline)
			? `${currentContent}${snippetText}${newline}`
			: `${currentContent}${newline}${snippetText}${newline}`;

		await adapter.write(snippetsFilePath, newContent);

		await plugin.loadSnippets();

		Logger.log(`[createSnippet] Created snippet "${snippetName}" in snippets.beancount`);
		return { success: true };
	} catch (error) {
		Logger.error('[createSnippet] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}
