// src/utils/directives/types.ts

export interface FileLineRow {
	filename: string;
	lineno: string;
}

export interface BalanceData {
	date: string;
	account: string;
	amount: string | number;
	currency: string;
	tolerance?: string | number;
}

export interface NoteData {
	date: string;
	account: string;
	comment: string;
	tags?: string[];
	links?: string[];
}

export interface CostData {
	number?: string | number;
	currency?: string;
	isTotal?: boolean;
	date?: string;
	label?: string;
}

export interface PriceDataPayload {
	amount?: string | number;
	currency?: string;
	isTotal?: boolean;
}

export interface PostingData {
	flag?: string;
	account: string;
	amount?: string | number;
	currency?: string;
	cost?: CostData;
	price?: PriceDataPayload;
	comment?: string;
	metadata?: Record<string, string>;
}

export interface TransactionData {
	date: string;
	flag?: string;
	payee?: string;
	narration?: string;
	tags?: string[];
	links?: string[];
	metadata?: Record<string, string>;
	postings?: PostingData[];
}

export interface IndicatorDirectiveParams {
	type: 'Budget' | 'Target';
	name: string;
	accountQuery: string;
	cycle: 'Monthly' | 'Weekly' | 'Quarterly' | 'Yearly' | (string & {});
	target: number;
	currency: string;
	isRollover: boolean;
	startDate: string; // ISO date string YYYY-MM-DD
	tag?: string;      // optional tag name (without #)
	tagMode?: 'has' | 'not_has';
}

/**
 * A single leg of a scheduled transaction template — everything a real
 * transaction posting can carry, so any transaction can be scheduled.
 * `amount`/`currency` are omitted for an elided posting — the beancount
 * idiom of leaving (at most) one posting's amount blank so it's inferred to
 * balance the rest of the transaction. An elided posting can't carry a cost
 * or price (generateTransactionText() only writes them after an amount).
 */
export interface PostingStub {
	account: string;
	amount?: number;
	currency?: string;
	flag?: string;
	comment?: string;
	cost?: CostData;
	price?: PriceDataPayload;
	metadata?: Record<string, string>;
}

export interface ScheduleDirectiveParams {
	name: string;
	frequency: 'One-time' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly' | (string & {});
	startDate: string;   // ISO date string YYYY-MM-DD — first occurrence, never changes
	nextDate: string;    // ISO date string YYYY-MM-DD — next occurrence due
	lastGenerated?: string; // ISO date string YYYY-MM-DD of the most recent materialization
	active: boolean;
	payee?: string;
	narration?: string;
	flag?: string;
	tags?: string[];
	links?: string[];
	/** Transaction-level metadata copied onto every materialized transaction. */
	metadata?: Record<string, string>;
	postings: PostingStub[];
	/** Sum of positive-amount postings (in the currency of the first positive
	 * leg), computed and persisted at save time — a single representative
	 * "amount" for compact display (e.g. the sidebar's Upcoming tab). */
	displayAmount?: number;
	displayCurrency?: string;
}
