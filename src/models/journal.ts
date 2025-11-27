export interface JournalPosting {
    account: string;
    amount: string | null;
    currency: string | null;
    price?: {
        amount: string;
        currency: string;
    };
    cost?: {
        number: string | null;
        currency: string;
        date: string | null;
        label: string | null;
    };
}

export interface JournalBaseEntry {
    id: string;
    type: 'transaction' | 'balance' | 'pad' | 'note';
    date: string;
    metadata: Record<string, any>;
}

export interface JournalTransaction extends JournalBaseEntry {
    type: 'transaction';
    flag: string;
    payee: string | null;
    narration: string;
    tags: string[];
    links: string[];
    postings: JournalPosting[];
}

export interface JournalNote extends JournalBaseEntry {
    type: 'note';
    account: string;
    comment: string;
}

export interface JournalBalance extends JournalBaseEntry {
    type: 'balance';
    account: string;
    amount: string;
    currency: string;
    tolerance: string | null;
    diff_amount: string | null;
}

export interface JournalPad extends JournalBaseEntry {
    type: 'pad';
    account: string;
    source_account: string;
}

export type JournalEntry = JournalTransaction | JournalNote | JournalBalance | JournalPad;

export interface JournalFilters {
    startDate?: string;
    endDate?: string;
    account?: string;
    payee?: string;
    tag?: string;
    searchTerm?: string;
    entryTypes?: string[];
}

export interface JournalApiResponse {
    transactions?: JournalTransaction[];
    entries?: JournalEntry[];
    total_count: number;
    returned_count: number;
    offset: number;
    limit: number;
    has_more: boolean;
}
