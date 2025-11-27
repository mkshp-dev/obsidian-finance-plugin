export interface AccountNode {
	name: string;
	fullName: string | null;
	children: AccountNode[];
}

export interface AccountDetail {
	name: string;
	fullName: string;
	balance: string;
	currency: string;
	recentTransactionCount: number;
	lastTransactionDate?: string;
	accountType: 'Assets' | 'Liabilities' | 'Income' | 'Expenses' | 'Equity' | 'Other';
	isActive: boolean;
}
