// src/types/index.ts
// Re-exporting models for backward compatibility
export * from '../models/account';
export * from '../models/journal';
export * from '../models/common';

// Legacy types that might still be needed if not fully covered by models
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

export interface BeancountPluginSettings {
	beancountFilePath: string;
	beancountCommand: string;
	operatingCurrency: string;
}

export type { ChartConfiguration, ChartData, ChartOptions } from 'chart.js/auto';
