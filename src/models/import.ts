// src/models/import.ts
// Shared types for importing bank statements (CSV) into the ledger.

import type { TransactionData } from '../utils/directives/types';

/** Order of day, month and year in a date column. Separators and a trailing time are ignored. */
export type DateOrder = 'DMY' | 'MDY' | 'YMD';

/** Where the header row is and which rows hold transactions, as indexes into the parsed CSV rows. */
export interface TableBounds {
	headerRow: number;
	/** First transaction row (inclusive). */
	firstRow: number;
	/** Last transaction row (inclusive). */
	lastRow: number;
}

/**
 * How a signed amount is read from the CSV. Positive means money into the
 * statement's account. Columns are indexes, since headers can repeat
 * (Kotak has two "Dr / Cr" columns).
 */
export type AmountSource =
	/** One column holding a signed number. `invert` for statements where positive means money out (e.g. credit cards). */
	| { mode: 'signed'; column: number; invert?: boolean }
	/** An always-positive amount plus a column saying which way it went, e.g. `DR`/`CR`. */
	| { mode: 'indicator'; column: number; indicatorColumn: number; debitValue: string; creditValue: string }
	/** Separate "withdrawal" and "deposit" columns; one of them is empty on each row. */
	| { mode: 'split'; debitColumn: number; creditColumn: number };

/** The account on the other side of each transaction. */
export type CounterAccountSource =
	/** Match `aliases` on open directives; rows with no match go to `fallback` with the `!` flag. */
	| { mode: 'aliases'; fallback: string }
	| { mode: 'fixed'; account: string };

/** Where `import-ref` comes from. A column falls back to a generated ref on rows where it's blank. */
export type ImportRefSource = { mode: 'column'; column: number } | { mode: 'generate' };

/**
 * How one bank's CSV rows become transactions. Text fields are templates
 * where `{{Column label}}` is replaced by that column's value.
 */
export interface ImportMapping {
	/** The statement's own account, e.g. `Assets:Bank:Kotak`. */
	account: string;
	currency: string;
	decimalMark: '.' | ',';
	date: { column: number; order: DateOrder };
	amount: AmountSource;
	/** Running balance after each row; used to check the parse and for the closing balance. */
	balance?: AmountSource;
	payee: string;
	narration: string;
	/** Text that aliases are matched against. */
	matchText: string;
	/** Use the matched alias as the payee instead of the payee template. */
	payeeFromAlias: boolean;
	counterAccount: CounterAccountSource;
	importRef: ImportRefSource;
	tags?: string[];
}

/** A saved mapping, recognised again by the statement's header row. */
export interface ImportProfile {
	id: string;
	name: string;
	/** See headerSignature(). */
	headerSignature: string;
	mapping: ImportMapping;
}

/** Transaction metadata key holding each imported row's reference. */
export const IMPORT_REF_KEY = 'import-ref';

/** One CSV row turned into a transaction, ready for review. */
export interface ImportDraft {
	/** Index of the row within the table rows, in file order. */
	sourceIndex: number;
	cells: string[];
	/** `null` when the row couldn't be read; see `errors`. */
	txn: TransactionData | null;
	importRef: string;
	/** The alias that chose the counter account, if any. */
	matchedAlias?: string;
	errors: string[];
}

export interface BalanceCheck {
	ok: boolean;
	/** Whether the file lists rows oldest first or newest first. */
	order: 'asc' | 'desc';
	/** When not ok: index (file order) of the first row whose balance doesn't follow. */
	breakAt?: number;
	/** Balance before the earliest row. */
	opening?: string;
	/** Balance after the latest row. */
	closing?: string;
}

/** Account suggested for a row's other posting, e.g. from aliases. */
export type AccountMatcher = (text: string) => { account: string; alias: string } | null;
