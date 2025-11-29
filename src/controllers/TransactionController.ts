// src/controllers/TransactionController.ts

import { writable, type Writable, get } from 'svelte/store';
import type BeancountPlugin from '../main';
import * as queries from '../queries/index';
import { parse as parseCsv } from 'csv-parse/sync';
import { buildAccountTree } from '../utils/index';
import type { AccountNode } from '../models/account';

/**
 * Interface representing the state of the Transaction view.
 */
export interface TransactionState {
	/** Whether the main transaction list is loading. */
	isLoading: boolean;
	/** Whether the filters (accounts, tags) are loading. */
	isLoadingFilters: boolean;
	/** Error message if loading failed. */
	error: string | null;
	/** Current active filters. */
	currentFilters: queries.TransactionFilters;
	/** List of raw transaction rows (CSV parsed). */
	currentTransactions: string[][];
	/** Tree structure of accounts for the filter dropdown. */
	accountTree: AccountNode[];
	/** Flat list of all available accounts. */
	allAccounts: string[];
	/** List of all available tags. */
	allTags: string[];
}

/**
 * TransactionController
 *
 * Manages the state and logic for the Transaction tab.
 * Handles loading transaction data based on filters, and fetching available filter options (accounts, tags).
 */
export class TransactionController {
	private plugin: BeancountPlugin;
	
	// Svelte store for all state
	public state: Writable<TransactionState>;

	/**
	 * Creates an instance of TransactionController.
	 * @param {BeancountPlugin} plugin - The main plugin instance.
	 */
	constructor(plugin: BeancountPlugin) {
		this.plugin = plugin;
		this.state = writable({
			isLoading: true,
			isLoadingFilters: true,
			error: null,
			currentFilters: {},
			currentTransactions: [],
			accountTree: [],
			allAccounts: [],
			allTags: [],
		});
	}

	/**
	 * Fetches metadata needed for filters (all accounts and tags).
	 * Typically called on mount.
	 */
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

	/**
	 * Updates the transaction list based on new filters.
	 * @param {queries.TransactionFilters} filters - The filters to apply.
	 */
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
