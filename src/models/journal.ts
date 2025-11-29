/**
 * Represents a single posting within a transaction.
 */
export interface JournalPosting {
    /** The account name for this posting. */
    account: string;
    /** The amount string (can be null for inferred amounts). */
    amount: string | null;
    /** The currency code. */
    currency: string | null;
    /** Optional price information. */
    price?: {
        amount: string;
        currency: string;
    };
    /** Optional cost basis information. */
    cost?: {
        number: string | null;
        currency: string;
        date: string | null;
        label: string | null;
    };
}

/**
 * Base interface for all journal entries.
 */
export interface JournalBaseEntry {
    /** Unique hash ID of the entry. */
    id: string;
    /** The type of the entry. */
    type: 'transaction' | 'balance' | 'pad' | 'note';
    /** Date of the entry (YYYY-MM-DD). */
    date: string;
    /** Custom metadata associated with the entry. */
    metadata: Record<string, any>;
}

/**
 * Represents a Transaction entry.
 */
export interface JournalTransaction extends JournalBaseEntry {
    type: 'transaction';
    /** Transaction flag (e.g. "*", "!"). */
    flag: string;
    /** Payee name. */
    payee: string | null;
    /** Narration/Description. */
    narration: string;
    /** List of tags. */
    tags: string[];
    /** List of links. */
    links: string[];
    /** List of postings. */
    postings: JournalPosting[];
}

/**
 * Represents a Note entry.
 */
export interface JournalNote extends JournalBaseEntry {
    type: 'note';
    /** The account the note is attached to. */
    account: string;
    /** The note content. */
    comment: string;
}

/**
 * Represents a Balance assertion entry.
 */
export interface JournalBalance extends JournalBaseEntry {
    type: 'balance';
    /** The account being asserted. */
    account: string;
    /** The asserted amount. */
    amount: string;
    /** The currency. */
    currency: string;
    /** Optional tolerance amount. */
    tolerance: string | null;
    /** The calculated difference (if any). */
    diff_amount: string | null;
}

/**
 * Represents a Pad entry (padding balance).
 */
export interface JournalPad extends JournalBaseEntry {
    type: 'pad';
    /** The account to pad. */
    account: string;
    /** The source account for padding. */
    source_account: string;
}

/**
 * Union type for all supported journal entries.
 */
export type JournalEntry = JournalTransaction | JournalNote | JournalBalance | JournalPad;

/**
 * Filters available for querying the journal.
 */
export interface JournalFilters {
    /** Filter by start date (YYYY-MM-DD). */
    startDate?: string;
    /** Filter by end date (YYYY-MM-DD). */
    endDate?: string;
    /** Filter by account name (substring match). */
    account?: string;
    /** Filter by payee name (substring match). */
    payee?: string;
    /** Filter by tag. */
    tag?: string;
    /** General search term. */
    searchTerm?: string;
    /** List of entry types to include. */
    entryTypes?: string[];
}

/**
 * Response structure from the journal API.
 */
export interface JournalApiResponse {
    /** List of transactions (legacy field). */
    transactions?: JournalTransaction[];
    /** List of journal entries. */
    entries?: JournalEntry[];
    /** Total count of entries matching filters. */
    total_count: number;
    /** Number of entries returned in this page. */
    returned_count: number;
    /** The offset used for this page. */
    offset: number;
    /** The limit used for this page. */
    limit: number;
    /** Whether more entries exist beyond this page. */
    has_more: boolean;
}
