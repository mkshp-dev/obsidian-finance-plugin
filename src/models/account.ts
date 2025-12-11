export interface AccountNode {
	name: string;
	fullName: string | null;
	children: AccountNode[];
}

/**
 * Interface representing the detailed information of an account.
 */
export interface AccountDetail {
	/** The short name of the account (e.g. "Checking"). */
	name: string;
	/** The full hierarchical name of the account (e.g. "Assets:Bank:Checking"). */
	fullName: string;
	/** The current balance as a formatted string. */
	balance: string;
	/** The currency of the balance. */
	currency: string;
	/** Number of recent transactions associated with this account. */
	recentTransactionCount: number;
	/** Date of the most recent transaction (YYYY-MM-DD). */
	lastTransactionDate?: string;
	/** The category type of the account. */
	accountType: 'Assets' | 'Liabilities' | 'Income' | 'Expenses' | 'Equity' | 'Other';
	/** Whether the account is considered active (has recent activity/balance). */
	isActive: boolean;
}
