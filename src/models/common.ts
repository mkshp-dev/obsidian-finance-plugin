export interface AmountData {
	amount: number;
	currency: string;
}

export interface LoadingState {
	isLoading: boolean;
	error: string | null;
}

export interface KPIData {
	netWorth: string;
	monthlyIncome: string;
	monthlyExpenses: string;
	savingsRate: string;
}

export interface DateRange {
	start: string;
	end: string;
}
