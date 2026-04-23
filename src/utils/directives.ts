// src/utils/directives.ts
// All Beancount file write operations: create/update/delete for transactions, balances,
// notes, commodities, prices, open/close directives, and commodity metadata.

import { readFile } from 'fs/promises';
import { parse as parseCsv } from 'csv-parse/sync';
import type BeancountPlugin from '../main';
import { getTargetFile, ensureYearFile } from './structuredLayout';
import { atomicFileWrite, createBackupFile, convertWslPathToWindows } from './fileEditor';
import { runQuery } from './queryRunner';
import { Logger } from './logger';

// ─── OPEN DIRECTIVE ────────────────────────────────────────────────────────────

export async function saveOpenDirective(
    plugin: BeancountPlugin,
    date: string,
    account: string,
    currencies?: string[],
    booking?: string,
    createBackup: boolean = true
): Promise<{ success: boolean; error?: string }> {
    try {
        const filePath = getTargetFile(plugin, 'account', date);
        if (!filePath) return { success: false, error: 'Beancount file path not set' };

        const normalizedPath = convertWslPathToWindows(filePath);
        const parts = [date, 'open', account];
        if (currencies && currencies.length > 0) parts.push(currencies.join(','));
        if (booking) parts.push(`"${booking}"`);
        const directiveText = parts.join(' ');

        await createBackupFile(normalizedPath, createBackup, 'saveOpenDirective');
        const content = await readFile(normalizedPath, 'utf-8');
        const newContent = content.endsWith('\n') ? `${content}${directiveText}\n` : `${content}\n${directiveText}\n`;
        await atomicFileWrite(normalizedPath, newContent);

        Logger.log(`[saveOpenDirective] Saved open directive for ${account}`);
        return { success: true };
    } catch (error) {
        Logger.error('[saveOpenDirective] Error:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

// ─── CLOSE DIRECTIVE ───────────────────────────────────────────────────────────

export async function saveCloseDirective(
    plugin: BeancountPlugin,
    date: string,
    account: string,
    createBackup: boolean = true
): Promise<{ success: boolean; error?: string }> {
    try {
        const filePath = getTargetFile(plugin, 'account', date);
        if (!filePath) return { success: false, error: 'Beancount file path not set' };

        const normalizedPath = convertWslPathToWindows(filePath);
        const directiveText = `${date} close ${account}`;

        await createBackupFile(normalizedPath, createBackup, 'saveCloseDirective');
        const content = await readFile(normalizedPath, 'utf-8');
        const newContent = content.endsWith('\n') ? `${content}${directiveText}\n` : `${content}\n${directiveText}\n`;
        await atomicFileWrite(normalizedPath, newContent);

        Logger.log(`[saveCloseDirective] Saved close directive for ${account}`);
        return { success: true };
    } catch (error) {
        Logger.error('[saveCloseDirective] Error:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

// ─── BALANCE ASSERTION ─────────────────────────────────────────────────────────

export async function createBalanceAssertion(
    plugin: BeancountPlugin,
    date: string,
    account: string,
    amount: string,
    currency: string,
    tolerance?: string,
    createBackup: boolean = true
): Promise<{ success: boolean; error?: string }> {
    try {
        const filePath = getTargetFile(plugin, 'balance', date);
        if (!filePath) return { success: false, error: 'Beancount file path not set' };

        const normalizedPath = convertWslPathToWindows(filePath);
        let directiveText = `${date} balance ${account}  ${amount} ${currency}`;
        if (tolerance) directiveText += ` ~ ${tolerance}`;

        await createBackupFile(normalizedPath, createBackup, 'createBalanceAssertion');
        const content = await readFile(normalizedPath, 'utf-8');
        const newContent = content.endsWith('\n') ? `${content}${directiveText}\n` : `${content}\n${directiveText}\n`;
        await atomicFileWrite(normalizedPath, newContent);

        Logger.log(`[createBalanceAssertion] Saved balance for ${account}`);
        return { success: true };
    } catch (error) {
        Logger.error('[createBalanceAssertion] Error:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

export async function updateBalance(
    plugin: BeancountPlugin,
    balanceId: string,
    balanceData: any
): Promise<{ success: boolean; error?: string }> {
    try {
        if (!plugin.settings.beancountFilePath)
            return { success: false, error: 'Beancount file path not configured' };

        const parts = balanceId.split('_');
        if (parts.length < 3 || parts[0] !== 'balance')
            return { success: false, error: `Invalid balance ID format: ${balanceId}` };

        const date = parts[1];
        const account = parts.slice(2).join(':');

        const csv = await runQuery(plugin, `SELECT filename, lineno FROM #entries WHERE type='balance' AND date=${date} AND '${account}' IN accounts`);
        const records = parseCsv(csv, { columns: true, skip_empty_lines: true, trim: true }) as any[];

        if (records.length === 0)
            return { success: false, error: `Balance assertion not found for ${account} on ${date}` };

        const actualFilePath = records[0]['filename'];
        const lineno = parseInt(records[0]['lineno']);
        if (!actualFilePath) return { success: false, error: 'Filename not returned from query' };

        const normalizedPath = convertWslPathToWindows(actualFilePath);
        Logger.log(`[updateBalance] ${actualFilePath} → ${normalizedPath}, line ${lineno}`);

        await createBackupFile(normalizedPath, plugin.settings.createBackups ?? true, 'updateBalance');
        const lines = (await readFile(normalizedPath, 'utf-8')).split('\n');

        if (isNaN(lineno) || lineno < 1 || lineno > lines.length)
            return { success: false, error: `Invalid line number ${lineno}` };

        let newBalanceText = `${balanceData.date} balance ${balanceData.account}  ${balanceData.amount} ${balanceData.currency}`;
        if (balanceData.tolerance) newBalanceText += ` ~ ${balanceData.tolerance}`;

        lines[lineno - 1] = newBalanceText;
        await atomicFileWrite(normalizedPath, lines.join('\n'));
        Logger.log(`[updateBalance] Updated ${balanceId}`);
        return { success: true };
    } catch (error) {
        console.error('[updateBalance] Error:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

export async function deleteBalance(
    plugin: BeancountPlugin,
    balanceId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        if (!plugin.settings.beancountFilePath)
            return { success: false, error: 'Beancount file path not configured' };

        const parts = balanceId.split('_');
        if (parts.length < 3 || parts[0] !== 'balance')
            return { success: false, error: `Invalid balance ID format: ${balanceId}` };

        const date = parts[1];
        const account = parts.slice(2).join(':');

        const csv = await runQuery(plugin, `SELECT filename, lineno FROM #entries WHERE type='balance' AND date=${date} AND '${account}' IN accounts`);
        const records = parseCsv(csv, { columns: true, skip_empty_lines: true, trim: true }) as any[];

        if (records.length === 0)
            return { success: false, error: `Balance assertion not found for ${account} on ${date}` };

        const actualFilePath = records[0]['filename'];
        const lineno = parseInt(records[0]['lineno']);
        if (!actualFilePath) return { success: false, error: 'Filename not returned from query' };

        const normalizedPath = convertWslPathToWindows(actualFilePath);
        Logger.log(`[deleteBalance] ${actualFilePath} → ${normalizedPath}, line ${lineno}`);

        await createBackupFile(normalizedPath, plugin.settings.createBackups ?? true, 'deleteBalance');
        const lines = (await readFile(normalizedPath, 'utf-8')).split('\n');

        if (isNaN(lineno) || lineno < 1 || lineno > lines.length)
            return { success: false, error: `Invalid line number ${lineno}` };

        lines.splice(lineno - 1, 1);
        await atomicFileWrite(normalizedPath, lines.join('\n'));
        Logger.log(`[deleteBalance] Deleted ${balanceId}`);
        return { success: true };
    } catch (error) {
        console.error('[deleteBalance] Error:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

// ─── NOTE DIRECTIVE ────────────────────────────────────────────────────────────

export async function createNote(
    plugin: BeancountPlugin,
    date: string,
    account: string,
    comment: string,
    tags?: string[],
    links?: string[],
    createBackup: boolean = true
): Promise<{ success: boolean; error?: string }> {
    try {
        const filePath = getTargetFile(plugin, 'note', date);
        if (!filePath) return { success: false, error: 'Beancount file path not set' };

        const normalizedPath = convertWslPathToWindows(filePath);
        const parts = [date, 'note', account, `"${comment}"`];
        if (tags) for (const t of tags) { const c = t.replace(/^#/, ''); if (c) parts.push(`#${c}`); }
        if (links) for (const l of links) parts.push(`^${l}`);
        const directiveText = parts.join(' ');

        await createBackupFile(normalizedPath, createBackup, 'createNote');
        const content = await readFile(normalizedPath, 'utf-8');
        const newContent = content.endsWith('\n') ? `${content}${directiveText}\n` : `${content}\n${directiveText}\n`;
        await atomicFileWrite(normalizedPath, newContent);

        Logger.log(`[createNote] Saved note for ${account}`);
        return { success: true };
    } catch (error) {
        Logger.error('[createNote] Error:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

export async function updateNote(
    plugin: BeancountPlugin,
    noteId: string,
    noteData: any
): Promise<{ success: boolean; error?: string }> {
    try {
        if (!plugin.settings.beancountFilePath)
            return { success: false, error: 'Beancount file path not configured' };

        const parts = noteId.split('_');
        if (parts.length < 3 || parts[0] !== 'note')
            return { success: false, error: `Invalid note ID format: ${noteId}` };

        const date = parts[1];
        const account = parts.slice(2).join(':');

        const csv = await runQuery(plugin, `SELECT filename, lineno FROM #entries WHERE type='note' AND date=${date} AND '${account}' IN accounts`);
        const records = parseCsv(csv, { columns: true, skip_empty_lines: true, trim: true }) as any[];

        if (records.length === 0)
            return { success: false, error: `Note not found for ${account} on ${date}` };

        const actualFilePath = records[0]['filename'];
        const lineno = parseInt(records[0]['lineno']);
        if (!actualFilePath) return { success: false, error: 'Filename not returned from query' };

        const normalizedPath = convertWslPathToWindows(actualFilePath);
        Logger.log(`[updateNote] ${actualFilePath} → ${normalizedPath}, line ${lineno}`);

        await createBackupFile(normalizedPath, plugin.settings.createBackups ?? true, 'updateNote');
        const lines = (await readFile(normalizedPath, 'utf-8')).split('\n');

        if (isNaN(lineno) || lineno < 1 || lineno > lines.length)
            return { success: false, error: `Invalid line number ${lineno}` };

        const noteParts = [noteData.date, 'note', noteData.account, `"${noteData.comment}"`];
        if (noteData.tags) for (const t of noteData.tags) { const c = t.replace(/^#/, ''); if (c) noteParts.push(`#${c}`); }
        if (noteData.links) for (const l of noteData.links) noteParts.push(`^${l}`);

        lines[lineno - 1] = noteParts.join(' ');
        await atomicFileWrite(normalizedPath, lines.join('\n'));
        Logger.log(`[updateNote] Updated ${noteId}`);
        return { success: true };
    } catch (error) {
        console.error('[updateNote] Error:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

export async function deleteNote(
    plugin: BeancountPlugin,
    noteId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        if (!plugin.settings.beancountFilePath)
            return { success: false, error: 'Beancount file path not configured' };

        const parts = noteId.split('_');
        if (parts.length < 3 || parts[0] !== 'note')
            return { success: false, error: `Invalid note ID format: ${noteId}` };

        const date = parts[1];
        const account = parts.slice(2).join(':');

        const csv = await runQuery(plugin, `SELECT filename, lineno FROM #entries WHERE type='note' AND date=${date} AND '${account}' IN accounts`);
        const records = parseCsv(csv, { columns: true, skip_empty_lines: true, trim: true }) as any[];

        if (records.length === 0)
            return { success: false, error: `Note not found for ${account} on ${date}` };

        const actualFilePath = records[0]['filename'];
        const lineno = parseInt(records[0]['lineno']);
        if (!actualFilePath) return { success: false, error: 'Filename not returned from query' };

        const normalizedPath = convertWslPathToWindows(actualFilePath);
        Logger.log(`[deleteNote] ${actualFilePath} → ${normalizedPath}, line ${lineno}`);

        await createBackupFile(normalizedPath, plugin.settings.createBackups ?? true, 'deleteNote');
        const lines = (await readFile(normalizedPath, 'utf-8')).split('\n');

        if (isNaN(lineno) || lineno < 1 || lineno > lines.length)
            return { success: false, error: `Invalid line number ${lineno}` };

        lines.splice(lineno - 1, 1);
        await atomicFileWrite(normalizedPath, lines.join('\n'));
        Logger.log(`[deleteNote] Deleted ${noteId}`);
        return { success: true };
    } catch (error) {
        console.error('[deleteNote] Error:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

// ─── COMMODITY DIRECTIVE ───────────────────────────────────────────────────────

export async function createCommodity(
    plugin: BeancountPlugin,
    symbol: string,
    date: string,
    priceMetadata?: string,
    logoUrl?: string,
    createBackup: boolean = true
): Promise<{ success: boolean; error?: string }> {
    try {
        const filePath = getTargetFile(plugin, 'commodity', date);
        if (!filePath) return { success: false, error: 'Beancount file path not set' };

        if (!symbol || !/^[A-Z0-9._-]+$/i.test(symbol))
            return { success: false, error: 'Invalid commodity symbol. Use alphanumeric characters, dots, underscores, or hyphens.' };

        const normalizedPath = convertWslPathToWindows(filePath);
        let directiveText = `${date} commodity ${symbol.toUpperCase()}`;
        const metadataLines: string[] = [];
        if (priceMetadata) metadataLines.push(`  price: "${priceMetadata}"`);
        if (logoUrl) metadataLines.push(`  logo: "${logoUrl}"`);
        if (metadataLines.length > 0) directiveText += '\n' + metadataLines.join('\n');

        await createBackupFile(normalizedPath, createBackup, 'createCommodity');
        const content = await readFile(normalizedPath, 'utf-8');
        const newContent = content.endsWith('\n') ? `${content}${directiveText}\n` : `${content}\n${directiveText}\n`;
        await atomicFileWrite(normalizedPath, newContent);

        Logger.log(`[createCommodity] Created commodity ${symbol}`);
        return { success: true };
    } catch (error) {
        Logger.error('[createCommodity] Error:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

export async function saveCommodityMetadata(
    symbol: string,
    metadata: Record<string, any>,
    filename: string,
    lineno: number,
    createBackup: boolean = true
): Promise<{ success: boolean; error?: string }> {
    try {
        const normalizedPath = convertWslPathToWindows(filename);
        await createBackupFile(normalizedPath, createBackup, 'saveCommodityMetadata');

        const lines = (await readFile(normalizedPath, 'utf-8')).split('\n');

        if (isNaN(lineno) || lineno < 1 || lineno > lines.length)
            return { success: false, error: `Invalid line number ${lineno}` };

        const lineIndex = lineno - 1;
        const commodityLine = lines[lineIndex];

        if (!commodityLine.includes('commodity') || !commodityLine.includes(symbol))
            return { success: false, error: `Line ${lineno} does not appear to be a commodity directive for ${symbol}` };

        // Remove existing metadata lines (indented lines immediately after commodity line)
        let endIndex = lineIndex + 1;
        while (endIndex < lines.length && (lines[endIndex].startsWith('  ') || lines[endIndex].startsWith('\t'))) {
            endIndex++;
        }

        // Build new metadata lines
        const newMetadataLines = Object.entries(metadata)
            .filter(([key]) => key !== 'filename' && key !== 'lineno')
            .map(([key, value]) => `  ${key}: "${value}"`);

        lines.splice(lineIndex + 1, endIndex - lineIndex - 1, ...newMetadataLines);
        await atomicFileWrite(normalizedPath, lines.join('\n'));

        Logger.log(`[saveCommodityMetadata] Saved metadata for ${symbol}`);
        return { success: true };
    } catch (error) {
        Logger.error('[saveCommodityMetadata] Error:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

export async function deleteCommodityDirective(
    symbol: string,
    filename: string,
    lineno: number,
    createBackup: boolean = true
): Promise<{ success: boolean; error?: string }> {
    try {
        const normalizedPath = convertWslPathToWindows(filename);
        await createBackupFile(normalizedPath, createBackup, 'deleteCommodityDirective');

        const lines = (await readFile(normalizedPath, 'utf-8')).split('\n');

        if (isNaN(lineno) || lineno < 1 || lineno > lines.length)
            return { success: false, error: `Invalid line number ${lineno}` };

        const lineIndex = lineno - 1;
        const commodityLine = lines[lineIndex];

        if (!commodityLine.includes('commodity') || !commodityLine.includes(symbol))
            return { success: false, error: `Line ${lineno} does not appear to be a commodity directive for ${symbol}` };

        // Find the extent: commodity line + all following indented metadata lines
        let endIndex = lineIndex + 1;
        while (endIndex < lines.length && (lines[endIndex].startsWith('  ') || lines[endIndex].startsWith('\t'))) {
            endIndex++;
        }

        // Remove blank line before if present
        let startIndex = lineIndex;
        if (startIndex > 0 && lines[startIndex - 1].trim() === '') {
            startIndex--;
        }

        lines.splice(startIndex, endIndex - startIndex);
        await atomicFileWrite(normalizedPath, lines.join('\n'));

        Logger.log(`[deleteCommodityDirective] Deleted commodity directive for ${symbol}`);
        return { success: true };
    } catch (error) {
        Logger.error('[deleteCommodityDirective] Error:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

// ─── PRICE DIRECTIVE ───────────────────────────────────────────────────────────

export async function createPriceDirective(
    plugin: BeancountPlugin,
    date: string,
    commodity: string,
    amount: number,
    currency: string,
    createBackup: boolean = true
): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
        const filePath = getTargetFile(plugin, 'price', date);
        if (!filePath) return { success: false, error: 'Beancount file path not set' };

        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { success: false, error: 'Invalid date format.' };
        if (!commodity || !/^[A-Z0-9._-]+$/i.test(commodity)) return { success: false, error: 'Invalid commodity symbol.' };
        if (!amount || isNaN(amount)) return { success: false, error: 'Invalid amount.' };
        if (!currency || !/^[A-Z]{3,}$/i.test(currency)) return { success: false, error: 'Invalid currency code.' };

        const normalizedPath = convertWslPathToWindows(filePath);
        const directiveText = `${date} price ${commodity.toUpperCase()} ${amount.toFixed(2)} ${currency.toUpperCase()}`;

        await createBackupFile(normalizedPath, createBackup, 'createPriceDirective');
        const content = await readFile(normalizedPath, 'utf-8');
        const newContent = content.endsWith('\n') ? `${content}${directiveText}\n` : `${content}\n${directiveText}\n`;
        await atomicFileWrite(normalizedPath, newContent);

        Logger.log(`[createPriceDirective] Created price directive for ${commodity}`);
        return { success: true, filePath: normalizedPath };
    } catch (error) {
        Logger.error('[createPriceDirective] Error:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

// ─── TRANSACTION HELPERS ───────────────────────────────────────────────────────

/**
 * Generates properly formatted Beancount transaction text from a transaction data object.
 */
export function generateTransactionText(transactionData: any): string {
    const date = transactionData.date;
    const flag = transactionData.flag || '*';
    const payee = transactionData.payee || '';
    const narration = transactionData.narration || '';
    const tags: string[] = transactionData.tags || [];
    const links: string[] = transactionData.links || [];

    let payeeNarration = '';
    if (payee && narration) payeeNarration = `"${payee}" "${narration}"`;
    else if (payee) payeeNarration = `"${payee}" ""`;
    else if (narration) payeeNarration = `"${narration}"`;
    else payeeNarration = '""';

    const headerParts = [date, flag, payeeNarration];
    for (const tag of tags) { const c = tag.replace(/^#/, ''); if (c) headerParts.push(`#${c}`); }
    for (const link of links) headerParts.push(`^${link}`);

    const lines = [headerParts.join(' ')];

    // Transaction-level metadata
    for (const [key, value] of Object.entries(transactionData.metadata || {})) {
        if (key !== 'filename' && key !== 'lineno') lines.push(`  ${key}: "${value}"`);
    }

    // Postings
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
                if (posting.cost.label) postingLine += `, "${posting.cost.label}"`;
                postingLine += cb;
            } else if (posting.cost?.date) {
                postingLine += ` {${posting.cost.date}}`;
            } else if (posting.cost?.label) {
                postingLine += ` {"${posting.cost.label}"}`;
            }

            if (posting.price?.amount && posting.price?.currency) {
                postingLine += ` ${posting.price.isTotal ? '@@' : '@'} ${posting.price.amount} ${posting.price.currency}`;
            }
        }

        if (posting.comment) postingLine += `  ; ${posting.comment}`;
        lines.push(postingLine);

        for (const [key, value] of Object.entries(posting.metadata || {})) {
            lines.push(`    ${key}: "${value}"`);
        }
    }

    return lines.join('\n');
}

export async function createTransaction(
    plugin: BeancountPlugin,
    transactionData: any
): Promise<{ success: boolean; error?: string }> {
    try {
        const transactionDate = transactionData.date || new Date().toISOString().split('T')[0];
        const year = new Date(transactionDate).getFullYear();
        const folderName = plugin.settings.structuredFolderName || 'Finances';
        await ensureYearFile(plugin, folderName, year);

        const beancountFilePath = getTargetFile(plugin, 'transaction', transactionDate);
        if (!beancountFilePath) return { success: false, error: 'Beancount file path not configured' };

        const normalizedPath = convertWslPathToWindows(beancountFilePath);
        Logger.log(`[createTransaction] ${beancountFilePath} → ${normalizedPath}`);

        await createBackupFile(normalizedPath, plugin.settings.createBackups ?? true, 'createTransaction');
        const currentContent = await readFile(normalizedPath, 'utf-8');
        await atomicFileWrite(normalizedPath, currentContent + '\n' + generateTransactionText(transactionData) + '\n');

        Logger.log(`[createTransaction] Created transaction in ${normalizedPath}`);
        return { success: true };
    } catch (error) {
        console.error('[createTransaction] Error:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

// Helper: find transaction block boundaries given a BQL-returned posting line index
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

export async function updateTransaction(
    plugin: BeancountPlugin,
    transactionId: string,
    transactionData: any
): Promise<{ success: boolean; error?: string }> {
    try {
        if (!plugin.settings.beancountFilePath)
            return { success: false, error: 'Beancount file path not configured' };

        const csv = await runQuery(plugin, `SELECT filename, lineno FROM postings WHERE id = "${transactionId}" LIMIT 1`);
        const records = parseCsv(csv, { columns: true, skip_empty_lines: true, trim: true }) as any[];

        if (records.length === 0) return { success: false, error: `Transaction ${transactionId} not found` };

        const actualFilePath = records[0]['filename'];
        const lineno = parseInt(records[0]['lineno']);
        if (!actualFilePath) return { success: false, error: 'Filename not returned from query' };

        const normalizedPath = convertWslPathToWindows(actualFilePath);
        Logger.log(`[updateTransaction] ${actualFilePath} → ${normalizedPath}, line ${lineno}`);

        await createBackupFile(normalizedPath, plugin.settings.createBackups ?? true, 'updateTransaction');
        const currentContent = await readFile(normalizedPath, 'utf-8');
        const lines = currentContent.split('\n');

        if (isNaN(lineno) || lineno < 1 || lineno > lines.length)
            return { success: false, error: `Invalid line number ${lineno}` };

        const { startIndex, endIndex } = findTransactionBlock(lines, lineno - 1);
        Logger.log(`[updateTransaction] Block: lines ${startIndex + 1}–${endIndex + 1}`);

        const newLines = [...lines.slice(0, startIndex), generateTransactionText(transactionData), ...lines.slice(endIndex + 1)];
        await atomicFileWrite(normalizedPath, newLines.join('\n'));
        Logger.log(`[updateTransaction] Updated ${transactionId}`);
        return { success: true };
    } catch (error) {
        console.error('[updateTransaction] Error:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

export async function deleteTransaction(
    plugin: BeancountPlugin,
    transactionId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        if (!plugin.settings.beancountFilePath)
            return { success: false, error: 'Beancount file path not configured' };

        const csv = await runQuery(plugin, `SELECT filename, lineno FROM postings WHERE id = "${transactionId}" LIMIT 1`);
        const records = parseCsv(csv, { columns: true, skip_empty_lines: true, trim: true }) as any[];

        if (records.length === 0) return { success: false, error: `Transaction ${transactionId} not found` };

        const actualFilePath = records[0]['filename'];
        const lineno = parseInt(records[0]['lineno']);
        if (!actualFilePath) return { success: false, error: 'Filename not returned from query' };

        const normalizedPath = convertWslPathToWindows(actualFilePath);
        Logger.log(`[deleteTransaction] ${actualFilePath} → ${normalizedPath}, line ${lineno}`);

        await createBackupFile(normalizedPath, plugin.settings.createBackups ?? true, 'deleteTransaction');
        const currentContent = await readFile(normalizedPath, 'utf-8');
        const lines = currentContent.split('\n');

        if (isNaN(lineno) || lineno < 1 || lineno > lines.length)
            return { success: false, error: `Invalid line number ${lineno}` };

        let { startIndex, endIndex } = findTransactionBlock(lines, lineno - 1);
        // Also consume trailing blank line
        if (endIndex + 1 < lines.length && lines[endIndex + 1].trim() === '') endIndex++;

        Logger.log(`[deleteTransaction] Block: lines ${startIndex + 1}–${endIndex + 1}`);
        const newLines = [...lines.slice(0, startIndex), ...lines.slice(endIndex + 1)];
        await atomicFileWrite(normalizedPath, newLines.join('\n'));
        Logger.log(`[deleteTransaction] Deleted ${transactionId}`);
        return { success: true };
    } catch (error) {
        console.error('[deleteTransaction] Error:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

// ─── VALIDATION ────────────────────────────────────────────────────────────────

// ─── OPERATING CURRENCY ────────────────────────────────────────────────────────

/**
 * Updates the `option "operating_currency" "..."` line in the main ledger file
 * to reflect the new currency value from plugin settings.
 *
 * @param plugin        - The Beancount plugin instance
 * @param currency      - The new operating currency (e.g. "USD", "EUR")
 * @param createBackup  - Whether to back up the ledger file before modifying
 */
export async function updateOperatingCurrency(
    plugin: BeancountPlugin,
    currency: string,
    createBackup: boolean = true
): Promise<{ success: boolean; error?: string }> {
    try {
        const { getMainLedgerPath } = await import('./structuredLayout');
        const ledgerPath = getMainLedgerPath(plugin);
        if (!ledgerPath) return { success: false, error: 'Main ledger path not set' };

        const normalizedPath = convertWslPathToWindows(ledgerPath);
        await createBackupFile(normalizedPath, createBackup, 'updateOperatingCurrency');

        const content = await readFile(normalizedPath, 'utf-8');
        const pattern = /^(option\s+"operating_currency"\s+)"[^"]*"/m;

        if (!pattern.test(content)) {
            return { success: false, error: 'Could not find option "operating_currency" in ledger file' };
        }

        const updated = content.replace(pattern, `$1"${currency}"`);
        await atomicFileWrite(normalizedPath, updated);

        Logger.log(`[updateOperatingCurrency] Updated operating_currency to ${currency}`);
        return { success: true };
    } catch (error) {
        Logger.error('[updateOperatingCurrency] Error:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

export async function validateCommodityLocation(
    filename: string,
    lineno: number,
    symbol: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const normalizedPath = convertWslPathToWindows(filename);
        const lines = (await readFile(normalizedPath, 'utf-8')).split('\n');

        if (isNaN(lineno) || lineno < 1 || lineno > lines.length)
            return { success: false, error: `Invalid line number ${lineno}` };

        const line = lines[lineno - 1];
        if (!line.toLowerCase().includes('commodity') || !line.includes(symbol))
            return { success: false, error: `Line ${lineno} is not a commodity directive for ${symbol}` };

        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

// ─── QUERY DIRECTIVE ──────────────────────────────────────────────────────────

/**
 * Parse all query directives from the content of a queries.beancount file.
 * Returns a map of query name → sql string.
 * Format: `YYYY-MM-DD query "name" "sql"`
 */
export function parseQueryDirectives(content: string): Record<string, string> {
    const result: Record<string, string> = {};
    // Match: date query "name" "sql"
    const pattern = /^\d{4}-\d{2}-\d{2}\s+query\s+"([^"]+)"\s+"((?:[^"\\]|\\.)*)"/gm;
    let match;
    while ((match = pattern.exec(content)) !== null) {
        const [, name, sql] = match;
        result[name] = sql;
    }
    return result;
}

/**
 * Create a named query directive in queries.beancount.
 * Format: `YYYY-MM-DD query "name" "sql"`
 */
export async function createQueryDirective(
    plugin: BeancountPlugin,
    date: string,
    name: string,
    sql: string,
    createBackup: boolean = true
): Promise<{ success: boolean; error?: string }> {
    try {
        const filePath = getTargetFile(plugin, 'query');
        if (!filePath) return { success: false, error: 'Beancount file path not set' };

        const normalizedPath = convertWslPathToWindows(filePath);

        // Escape any double-quotes inside the sql string
        const escapedSql = sql.replace(/"/g, '\\"');
        const directiveText = `${date} query "${name}" "${escapedSql}"`;

        await createBackupFile(normalizedPath, createBackup, 'createQueryDirective');

        // Ensure file exists; if not, create it with a header
        let content: string;
        try {
            content = await readFile(normalizedPath, 'utf-8');
        } catch {
            content = `;; Named Queries\n;; Managed by Beancount for Obsidian\n\n`;
        }

        const newContent = content.endsWith('\n')
            ? `${content}${directiveText}\n`
            : `${content}\n${directiveText}\n`;

        await atomicFileWrite(normalizedPath, newContent);
        Logger.log(`[createQueryDirective] Saved query directive "${name}"`);
        return { success: true };
    } catch (error) {
        Logger.error('[createQueryDirective] Error:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

/**
 * Delete a named query directive from queries.beancount by name.
 */
export async function deleteQueryDirective(
    plugin: BeancountPlugin,
    name: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const filePath = getTargetFile(plugin, 'query');
        if (!filePath) return { success: false, error: 'Beancount file path not set' };

        const normalizedPath = convertWslPathToWindows(filePath);
        await createBackupFile(normalizedPath, plugin.settings.createBackups ?? true, 'deleteQueryDirective');

        const content = await readFile(normalizedPath, 'utf-8');
        // Remove lines that declare this query name
        const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const linePattern = new RegExp(`^\\d{4}-\\d{2}-\\d{2}\\s+query\\s+"${escapedName}"[^\n]*\n?`, 'gm');
        const newContent = content.replace(linePattern, '');

        await atomicFileWrite(normalizedPath, newContent);
        Logger.log(`[deleteQueryDirective] Deleted query directive "${name}"`);
        return { success: true };
    } catch (error) {
        Logger.error('[deleteQueryDirective] Error:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

/**
 * Read all query directives from queries.beancount.
 * Returns a map of name → sql.
 */
export async function getQueryDirectives(
    plugin: BeancountPlugin
): Promise<Record<string, string>> {
    try {
        const filePath = getTargetFile(plugin, 'query');
        if (!filePath) return {};

        const normalizedPath = convertWslPathToWindows(filePath);
        const content = await readFile(normalizedPath, 'utf-8');
        return parseQueryDirectives(content);
    } catch {
        return {};
    }
}
