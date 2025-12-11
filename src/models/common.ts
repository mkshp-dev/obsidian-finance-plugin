/**
 * Represents a simple monetary amount.
 */
export interface AmountData {
	/** The numeric amount. */
	amount: number;
	/** The currency code (e.g. "USD"). */
	currency: string;
}

/**
 * Represents the state of an asynchronous operation.
 */
export interface LoadingState {
	/** Whether the operation is in progress. */
	isLoading: boolean;
	/** Error message if the operation failed, null otherwise. */
	error: string | null;
}

/**
 * Represents Key Performance Indicators for the dashboard.
 */
export interface KPIData {
	/** Total net worth string. */
	netWorth: string;
	/** Monthly income string. */
	monthlyIncome: string;
	/** Monthly expenses string. */
	monthlyExpenses: string;
	/** Savings rate percentage string. */
	savingsRate: string;
}

/**
 * Represents a date range filter.
 */
export interface DateRange {
	/** Start date (YYYY-MM-DD). */
	start: string;
	/** End date (YYYY-MM-DD). */
	end: string;
}
