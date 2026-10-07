// src/services/import.service.ts
// Ledger lookups for importing a statement: aliases, duplicates, opening balance.

import { parse as parseCsv } from 'csv-parse/sync';
import type BeancountPlugin from '../main';
import type { ImportDraft } from '../models/import';
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
