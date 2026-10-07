// src/models/import.ts
// Shared types for importing bank statements (CSV) into the ledger.

import type { TransactionData } from '../utils/directives/types';

/** Order of day, month and year in a date column. Separators and a trailing time are ignored. */
export type DateOrder = 'DMY' | 'MDY' | 'YMD';

/**
 * How a number column's sign is read. Positive means money into the
 * statement's account.
 */
export type NumberSign =
	| { mode: 'asis' }
	/** Positive means money out, e.g. credit card statements or a "Withdrawal" column. */
	| { mode: 'negate' }
	/** An always-positive number plus a column saying which way it went, e.g. Kotak's `DR`/`CR`. */
	| { mode: 'indicator'; column: number; debitValue: string; creditValue: string };

/** What a column holds. Date columns carry their day/month/year order; times are ignored. */
export type ColumnType =
	| { kind: 'date' | 'datetime'; order: DateOrder }
	| { kind: 'number'; sign?: NumberSign }
	| { kind: 'text' | 'ignore' };

/** Where the header row is and which rows hold transactions, as indexes into the parsed CSV rows. */
export interface TableBounds {
	headerRow: number;
	/** First transaction row (inclusive). */
	firstRow: number;
	/** Last transaction row (inclusive). */
	lastRow: number;
}

/**
 * A field of the transaction template. Text is used as written for every
 * row; `={{Column}}` takes that column's value.
 */
export type FieldValue = string;

export interface PostingTemplate {
	account: FieldValue;
	/** Empty to let beancount balance the transaction. */
	amount: FieldValue;
	currency: FieldValue;
}

/** Built-in value for `={{File name}}`: the statement file's name, e.g. for links. */
export const FILE_NAME_FIELD = 'File name';

/**
 * How one bank's CSV rows become transactions: a transaction template like
 * the Add Transaction form, plus how its columns are read.
 */
export interface ImportMapping {
	/** Mappings from before the transaction template have no version and aren't reused. */
	version: 2;
	decimalMark: '.' | ',';
	/** One per column, as confirmed in the Table step. */
	columnTypes: ColumnType[];
	date: FieldValue;
	flag: '*' | '!';
	payee: FieldValue;
	narration: FieldValue;
	tags: FieldValue[];
	links: FieldValue[];
	/** Transaction metadata. Always has `import-ref`; left blank, it's generated from the row. */
	metadata: Record<string, FieldValue>;
	/** The first posting is the statement's own account. */
	postings: PostingTemplate[];
	/**
	 * Where an account taken from a column goes when it's neither an open
	 * account nor an alias. Those transactions get the `!` flag.
	 */
	unmatchedAccount: string;
	/** Use the matched alias as the payee. */
	payeeFromAlias: boolean;
	/** Running balance column, to check the amounts and suggest a closing balance assertion. */
	balanceColumn: number | null;
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
	/** The alias that chose an account, if any. */
	matchedAlias?: string;
	/** The posting whose account came from a column, and that column's text. */
	match?: { posting: number; text: string };
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
