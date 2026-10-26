// src/models/import.ts
// Shared types for importing bank statements (CSV) into the ledger.

import type { TransactionData } from '../utils/directives/types';

/** Order of day, month and year in a date column. Separators and a trailing time are ignored. */
export type DateOrder = 'DMY' | 'MDY' | 'YMD';

/**
 * What a column holds. Date columns carry their day/month/year order; times
 * are ignored. Numbers are read as written; signs are decided in formulas.
 */
export type ColumnType =
	| { kind: 'date' | 'datetime'; order: DateOrder }
	| { kind: 'number' | 'text' | 'ignore' };

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
 * row; `={{Column}}` takes that column's value; and an alias lookup like
 * `=ACCOUNT WHERE {{Description}} CONTAINS ALIAS ELSE "Expenses:Uncategorized"`
 * finds the account (or the alias) matching that column.
 */
export type FieldValue = string;

export interface PostingTemplate {
	account: FieldValue;
	/** Empty to let beancount balance the transaction. */
	amount: FieldValue;
	currency: FieldValue;
}

/** The format of saved mappings. Profiles saved in another format aren't reused. */
export const MAPPING_VERSION = 5;

/** Built-in value for `={{File name}}`: the statement file's name, e.g. for links. */
export const FILE_NAME_FIELD = 'File name';

/**
 * How one bank's CSV rows become transactions: a transaction template like
 * the Add Transaction form, plus how its columns are read.
 */
export interface ImportMapping {
	/** See MAPPING_VERSION. */
	version: typeof MAPPING_VERSION;
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
	/** The transaction as far as the mapping could fill it in; see unresolvedReasons() for what's missing. */
	txn: TransactionData;
	importRef: string;
	/** The posting whose account came from an `=ACCOUNT WHERE …` lookup. */
	match?: AccountLookupResult;
	/** For each field holding an alias lookup (named as in error messages), whether an alias matched. */
	lookups?: Record<string, boolean>;
	/** For each field (named as in error messages), whether it gave a value for this row. */
	filled?: Record<string, boolean>;
	/** Values the mapping couldn't read from this row, each starting with its field's name, e.g. "Posting 1 amount: …". */
	errors: string[];
}

export interface AccountLookupResult {
	posting: number;
	/** The column text the alias was looked for in. */
	text: string;
	mode: 'contains' | 'exact';
	/** False when no alias matched and the `ELSE` value (if any) was used. */
	matched: boolean;
}

/** Account suggested for a row's other posting, e.g. from aliases. */
export type AccountMatcher = (text: string) => { account: string; alias: string } | null;
