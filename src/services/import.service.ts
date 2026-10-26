// src/services/import.service.ts
// Ledger lookups for importing a statement (aliases, duplicates, opening
// balance), and writing the import into the ledger files.

import { parse as parseCsv } from 'csv-parse/sync';
import type BeancountPlugin from '../main';
import type { ImportDraft } from '../models/import';
import type { TransactionData } from '../utils/directives/types';
import { runQuery } from '../utils/queryRunner';
import {
	getAliasAccountsQuery,
	getBalanceBeforeQuery,
	getImportCandidatePostingsQuery,
	getImportRefsQuery,
} from '../queries/index';
import { parseAliases, type AccountAliases } from '../utils/import/aliases';
import { findDuplicates, type DuplicateStatus, type LedgerPosting } from '../utils/import/duplicates';
import { addAmounts, addDays, amountsEqual, negateAmount } from '../utils/import/values';
import { appendEntries } from '../utils/import/ledgerText';
import { generateTransactionText } from '../utils/directives/transactionDirectives';
import { formatBalanceHeader } from '../utils/directives/directiveText';
import { ensureTransactionFile, getTargetFile } from '../utils/structuredLayout';
import { atomicFileWrite, convertWslPathToWindows, createBackupFile, getNewlineCharacter, readFileContent } from '../utils/fileEditor';
import { Logger } from '../utils/logger';

/** Refs and postings are looked up this far around the statement's dates. */
const LOOKUP_MARGIN_DAYS = 7;

function readRows(csv: string): Record<string, string>[] {
	const clean = csv.replace(/\r/g, '').trim();
	if (!clean) return [];
	const rows: Record<string, string>[] = parseCsv(clean, { columns: true, skip_empty_lines: true, trim: true });
	return rows;
}

function assertDate(date: string): string {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Invalid date: ${date}`);
	return date;
}

/** Every open account's aliases. */
export async function loadAccountAliases(plugin: BeancountPlugin): Promise<AccountAliases[]> {
	const rows = readRows(await runQuery(plugin, getAliasAccountsQuery()));
	return rows
		.map((r) => ({ account: r.account, aliases: parseAliases(r.aliases ?? '') }))
		.filter((e) => e.account && e.aliases.length > 0);
}

export function parseLedgerPostings(csv: string): LedgerPosting[] {
	return readRows(csv).map((r) => ({
		date: r.date,
		amount: r.number,
		currency: r.currency,
		payee: r.payee ?? '',
		narration: r.narration ?? '',
		importRef: r.ref ?? '',
		filename: r.filename ?? '',
		lineno: Number(r.lineno) || 0,
	}));
}

/**
 * Marks each draft as new, already imported (its `import-ref` is in the
 * ledger) or a possible duplicate of a posting on `account`. Returned in
 * the same order as `drafts`.
 */
export async function lookupDuplicates(
	plugin: BeancountPlugin,
	account: string,
	drafts: ImportDraft[],
	windowDays = 3,
): Promise<DuplicateStatus[]> {
	const dates = drafts.map((d) => d.txn?.date).filter((d): d is string => !!d).sort();
	if (dates.length === 0) return drafts.map(() => ({ kind: 'new' }));

	const from = assertDate(addDays(dates[0], -LOOKUP_MARGIN_DAYS));
	const to = assertDate(addDays(dates[dates.length - 1], LOOKUP_MARGIN_DAYS));

	const [refsCsv, postingsCsv] = await Promise.all([
		runQuery(plugin, getImportRefsQuery(from, to)),
		runQuery(plugin, getImportCandidatePostingsQuery(account, from, to)),
	]);
	const refs = new Set(readRows(refsCsv).map((r) => r.ref).filter(Boolean));
	return findDuplicates(drafts, refs, parseLedgerPostings(postingsCsv), windowDays);
}

export interface OpeningBalanceCheck {
	ok: boolean;
	/** The ledger's balance before the statement's first day. */
	ledger: string;
	statement: string;
	/** statement − ledger: how much the ledger is missing. */
	difference: string;
}

/**
 * Compares the statement's opening balance with the ledger's balance
 * before its first day. A difference means transactions from before the
 * statement are missing or wrong.
 */
export async function checkOpeningBalance(
	plugin: BeancountPlugin,
	account: string,
	currency: string,
	firstDate: string,
	opening: string,
): Promise<OpeningBalanceCheck> {
	const [row] = readRows(await runQuery(plugin, getBalanceBeforeQuery(account, currency, assertDate(firstDate))));
	const ledger = row?.balance || '0';
	return {
		ok: amountsEqual(ledger, opening),
		ledger,
		statement: opening,
		difference: addAmounts(opening, negateAmount(ledger)),
	};
}

export interface ImportWrite {
	/** Oldest first. */
	transactions: TransactionData[];
	/** Balance assertions on the statement's account. */
	assertions: { date: string; account: string; amount: string; currency: string }[];
}

export interface ImportWriteResult {
	transactions: number;
	assertions: number;
	errors: string[];
}

function message(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}

/** Appends entries, written with the file's newline, to one ledger file with a single backup and write. */
async function appendToFile(plugin: BeancountPlugin, filePath: string, entries: (newline: string) => string[], blankLine: boolean): Promise<void> {
	const path = convertWslPathToWindows(filePath);
	await createBackupFile(plugin, path, plugin.settings.createBackups ?? true, 'importStatement');
	const content = await readFileContent(plugin, path);
	const newline = getNewlineCharacter(content);
	await atomicFileWrite(plugin, path, appendEntries(content, entries(newline), newline, blankLine));
}

/** Groups items by the file they're written to, keeping their order. */
function byFile<T>(items: T[], fileOf: (item: T) => string): Map<string, T[]> {
	const groups = new Map<string, T[]>();
	for (const item of items) {
		const file = fileOf(item);
		groups.set(file, [...(groups.get(file) ?? []), item]);
	}
	return groups;
}

/**
 * Writes an import into the ledger: transactions into their period's
 * transactions file and balance assertions into the balances file, each
 * file backed up and written once. A file that fails doesn't stop the others;
 * the result counts what was written and lists what wasn't.
 */
export async function writeImport(plugin: BeancountPlugin, data: ImportWrite): Promise<ImportWriteResult> {
	const result: ImportWriteResult = { transactions: 0, assertions: 0, errors: [] };
	const folderName = plugin.settings.structuredFolderName || 'Finances';

	for (const [file, txns] of byFile(data.transactions, (t) => getTargetFile(plugin, 'transaction', t.date))) {
		try {
			await ensureTransactionFile(plugin, folderName, txns[0].date);
			await appendToFile(plugin, file, (newline) => txns.map((t) => generateTransactionText(t, newline)), true);
			result.transactions += txns.length;
		} catch (e) {
			Logger.error('[Import] Failed to write transactions', file, e);
			result.errors.push(`${txns.length} transaction${txns.length === 1 ? '' : 's'} not written to ${file}: ${message(e)}`);
		}
	}

	for (const [file, balances] of byFile(data.assertions, (a) => getTargetFile(plugin, 'balance', a.date))) {
		try {
			await appendToFile(plugin, file, () => balances.map((b) => formatBalanceHeader({ ...b, tolerance: null, rest: '' })), false);
			result.assertions += balances.length;
		} catch (e) {
			Logger.error('[Import] Failed to write balance assertions', file, e);
			result.errors.push(`Balance assertions not written to ${file}: ${message(e)}`);
		}
	}

	return result;
}
