// src/types/index.ts
// Consolidated type definitions for the Beancount plugin

// Transaction and Query Types
export interface TransactionFilters {
	account?: string | null;
	startDate?: string | null;
	endDate?: string | null;
	payee?: string | null;
	tag?: string | null;
}

export interface Posting {
	account: string;
	amount: string;
	currency: string;
}

export interface TransactionData {
	type: 'transaction' | 'balance' | 'note';
	date: string;
	payee?: string;
	narration?: string;
	tag?: string;
	postings?: Posting[];
	account?: string;
	amount?: string;
	currency?: string;
	text?: string;
}

// Account and Financial Data Types
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

export interface AmountData {
	amount: number;
	currency: string;
}

// Plugin Settings
export interface BeancountPluginSettings {
	beancountFilePath: string;
	beancountCommand: string;
	operatingCurrency: string;
}

// UI State Types
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

// Chart Types (re-export from Chart.js for convenience)
export type { ChartConfiguration, ChartData, ChartOptions } from 'chart.js/auto';

// Date Range Helper
export interface DateRange {
	start: string;
	end: string;
}