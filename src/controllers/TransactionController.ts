// src/controllers/TransactionController.ts

import { writable, type Writable, get } from 'svelte/store';
import type BeancountPlugin from '../main';
import * as queries from '../queries/index';
import { parse as parseCsv } from 'csv-parse/sync';
import { buildAccountTree, type AccountNode } from '../utils/index';

// Define the shape of our state
export interface TransactionState {
	isLoading: boolean;
	isLoadingFilters: boolean;
	error: string | null;
	currentFilters: queries.TransactionFilters;
	currentTransactions: string[][];
	accountTree: AccountNode[];
	allAccounts: string[]; // Add flat list of account names
	allTags: string[];
}

export class TransactionController {
	private plugin: BeancountPlugin;
	
	// Svelte store for all state
	public state: Writable<TransactionState>;

	constructor(plugin: BeancountPlugin) {
		this.plugin = plugin;
		this.state = writable({
			isLoading: true,
			isLoadingFilters: true,
			error: null,
			currentFilters: {},
			currentTransactions: [],
			accountTree: [],
			allAccounts: [], // Add empty array for account names
			allTags: [],
		});
	}

	// --- LOGIC MOVED FROM SVELTE onMount ---
	// Fetches the data needed for the filters (accounts, tags)
	async loadFilterData() {
		this.state.update(s => ({ ...s, isLoadingFilters: true }));
		try {
			const [accountResult, tagResult] = await Promise.all([
				this.plugin.runQuery(queries.getAllAccountsQuery()),
				this.plugin.runQuery(queries.getAllTagsQuery())
			]);
			
			// Process Accounts
			const cleanAccountStdout = accountResult.replace(/\r/g, "").trim();
			const accountRecords: string[][] = parseCsv(cleanAccountStdout, { columns: false, skip_empty_lines: true });
			const firstAccountRowIsHeader = accountRecords[0]?.[0]?.toLowerCase() === 'account';
			const accountDataRows = firstAccountRowIsHeader ? accountRecords.slice(1) : accountRecords;
			const allAccounts = [...new Set(accountDataRows.map(row => row?.[0]).filter(Boolean))];
			const builtTree = buildAccountTree(allAccounts);
			const allNode: AccountNode = { name: 'All Accounts', fullName: null, children: [] };
			
			// Process Tags
			const cleanTagStdout = tagResult.replace(/\r/g, "").trim();
			const tagRecords: string[][] = parseCsv(cleanTagStdout, { columns: false, skip_empty_lines: true, relax_column_count: true });
			const firstTagRowIsHeader = tagRecords[0]?.[0]?.toLowerCase() === 'tags';
			const tagDataRows = firstTagRowIsHeader ? tagRecords.slice(1) : tagRecords;
			const allTags = [...new Set(tagDataRows.flat().flatMap(tagStr => tagStr ? tagStr.split(',') : []).map(tag => tag.trim()).filter(tag => tag !== ''))];
			
			// Update state
			this.state.update(s => ({
				...s,
				isLoadingFilters: false,
				accountTree: [allNode, ...builtTree],
				allAccounts: allAccounts, // Store flat list of account names
				allTags: allTags
			}));
			
		} catch (e) {
			console.error("Error fetching transaction filters:", e);
			this.state.update(s => ({ ...s, isLoadingFilters: false, error: "Failed to load filters." }));
		}
	}

	// --- LOGIC MOVED FROM unified-dashboard-view.ts ---
	// Fetches the actual transactions based on filters
	async handleFilterChange(filters: queries.TransactionFilters) {
		this.state.update(s => ({ ...s, isLoading: true, error: null, currentFilters: filters }));
		
		let newTransactions: string[][] = [];
		let newError: string | null = null;

		try {
			const query = queries.getTransactionsQuery(filters, this.plugin.settings.maxTransactionResults);
			const result = await this.plugin.runQuery(query);
			const cleanStdout = result.replace(/\r/g, "").trim();
			const records: string[][] = parseCsv(cleanStdout, { columns: false, skip_empty_lines: true, relax_column_count: true });
			const defaultHeaders = ['date', 'payee', 'narration', 'position', 'balance']; // Added balance column
			const firstRowIsHeader = records[0]?.[0]?.toLowerCase().includes('date');
			const dataRows = firstRowIsHeader ? records.slice(1) : records;
			newTransactions = dataRows.map(row => {
				const completeRow = [...row]; while(completeRow.length < defaultHeaders.length) completeRow.push(''); return completeRow;
			});
		} catch (e) {
			console.error("Error fetching transactions:", e);
			newError = `Failed to load transactions: ${e.message}`;
			newTransactions = [];
		} finally {
			this.state.update(s => ({ ...s, isLoading: false, error: newError, currentTransactions: newTransactions }));
		}
	}
}