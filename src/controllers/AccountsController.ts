// src/controllers/AccountsController.ts

import { writable, type Writable, get } from 'svelte/store';
import type BeancountPlugin from '../main';
import * as queries from '../queries/index';
import { buildAccountTree, parseAmount } from '../utils/index';
import { parse as parseCsv } from 'csv-parse/sync';
import type { AccountNode, AccountDetail } from '../models/account';

/**
 * Interface representing the state of the Accounts view.
 */
export interface AccountsState {
	/** Whether data is currently loading. */
	isLoading: boolean;
	/** Error message if loading failed. */
	error: string | null;
	/** Hierarchical tree structure of accounts. */
	accountTree: AccountNode[];
	/** Map of account full names to detailed account information. */
	accountDetails: Map<string, AccountDetail>;
	/** Set of account full names that are currently expanded in the tree view. */
	expandedAccounts: Set<string>;
	/** Current search filter string. */
	searchFilter: string;
	/** Currently selected account for detailed view. */
	selectedAccount: AccountDetail | null;
	/** Whether to show the account details pane. */
	showAccountDetails: boolean;
}

/**
 * AccountsController
 *
 * Manages the state and logic for the Accounts tab in the dashboard.
 * Handles fetching account data, building the account tree, maintaining expansion state,
 * and filtering the account list.
 */
export class AccountsController {
	private plugin: BeancountPlugin;
	
	// Svelte store for all state
	public state: Writable<AccountsState>;

	/**
	 * Creates an instance of AccountsController.
	 * @param {BeancountPlugin} plugin - The main plugin instance.
	 */
	constructor(plugin: BeancountPlugin) {
		this.plugin = plugin;
		this.state = writable({
			isLoading: true,
			error: null,
			accountTree: [],
			accountDetails: new Map(),
			expandedAccounts: new Set(),
			searchFilter: '',
			selectedAccount: null,
			showAccountDetails: false,
		});
	}

	/**
	 * Loads account data from the backend.
	 * Fetches the list of accounts and their balances, then builds the tree structure.
	 */
	async loadData() {
		this.state.update(s => ({ ...s, isLoading: true, error: null }));

		const reportingCurrency = this.plugin.settings.operatingCurrency;
		if (!reportingCurrency) {
			this.state.update(s => ({
				...s,
				isLoading: false,
				error: "Operating currency is not set in plugin settings.",
			}));
			return;
		}

		try {
			// Get account list and balances for ALL account types
			const [accountResult, balanceResult] = await Promise.all([
				this.plugin.runQuery(queries.getAllAccountsQuery()),
				this.plugin.runQuery(queries.getAllAccountBalancesQuery(reportingCurrency))
			]);

			// Process accounts
			const cleanAccountStdout = accountResult.replace(/\r/g, "").trim();
			const accountRecords: string[][] = parseCsv(cleanAccountStdout, { columns: false, skip_empty_lines: true });
			const firstAccountRowIsHeader = accountRecords[0]?.[0]?.toLowerCase() === 'account';
			const accountDataRows = firstAccountRowIsHeader ? accountRecords.slice(1) : accountRecords;
			const allAccounts = [...new Set(accountDataRows.map(row => row?.[0]).filter(Boolean))];

			// Process balances
			const cleanBalanceStdout = balanceResult.replace(/\r/g, "").trim();
			const balanceRecords: string[][] = parseCsv(cleanBalanceStdout, { columns: false, skip_empty_lines: true });
			const firstBalanceRowIsHeader = balanceRecords[0]?.[0]?.toLowerCase() === 'account';
			const balanceDataRows = firstBalanceRowIsHeader ? balanceRecords.slice(1) : balanceRecords;

			// Create account details map
			const accountDetails = new Map<string, AccountDetail>();
			const balanceMap = new Map<string, string>();

			// Build balance map
			for (const row of balanceDataRows) {
				if (row.length >= 2) {
					balanceMap.set(row[0], row[1] || '0.00 ' + reportingCurrency);
				}
			}

			// Create detailed account info
			for (const accountName of allAccounts) {
				const balance = balanceMap.get(accountName) || '0.00 ' + reportingCurrency;
				const parsedAmount = parseAmount(balance);
				
				// For Income and some Expense accounts, Beancount might use negative values
				// Let's handle the display logic more comprehensively
				let displayBalance = balance;
				if (accountName.startsWith('Income')) {
					// Income accounts typically have negative balances in Beancount
					if (parsedAmount.amount < 0) {
						const positiveAmount = Math.abs(parsedAmount.amount);
						displayBalance = `${positiveAmount.toFixed(2)} ${parsedAmount.currency}`;
					} else if (parsedAmount.amount > 0) {
						// Some income might already be positive, keep as is
						displayBalance = balance;
					}
				} else if (accountName.startsWith('Expenses')) {
					// Expenses are typically positive in Beancount, but let's handle both cases
					if (parsedAmount.amount < 0) {
						const positiveAmount = Math.abs(parsedAmount.amount);
						displayBalance = `${positiveAmount.toFixed(2)} ${parsedAmount.currency}`;
					} else {
						// Positive expenses, keep as is
						displayBalance = balance;
					}
				}
				
				const detail: AccountDetail = {
					name: this.getAccountDisplayName(accountName),
					fullName: accountName,
					balance: displayBalance,
					currency: parsedAmount.currency,
					recentTransactionCount: 0, // Will be populated later if needed
					accountType: this.getAccountType(accountName),
					isActive: Math.abs(parsedAmount.amount) > 0.01, // Consider active if has significant balance
				};
				
				accountDetails.set(accountName, detail);
			}

			// Build account tree
			const accountTree = buildAccountTree(allAccounts);

			this.state.update(s => ({
				...s,
				isLoading: false,
				error: null,
				accountTree,
				accountDetails,
			}));

		} catch (e) {
			console.error("Error loading accounts data:", e);
			this.state.update(s => ({
				...s,
				isLoading: false,
				error: `Failed to load accounts: ${e.message}`,
			}));
		}
	}

	/**
	 * Toggles the expansion state of a specific account in the tree.
	 * @param {string} accountFullName - The full name of the account to toggle.
	 */
	toggleAccountExpansion(accountFullName: string) {
		this.state.update(s => {
			const newExpanded = new Set(s.expandedAccounts);
			if (newExpanded.has(accountFullName)) {
				newExpanded.delete(accountFullName);
			} else {
				newExpanded.add(accountFullName);
			}
			return { ...s, expandedAccounts: newExpanded };
		});
	}

	/**
	 * Opens the details view for a specific account.
	 * @param {string} accountFullName - The full name of the account to show.
	 */
	showAccountDetail(accountFullName: string) {
		const currentState = get(this.state);
		const accountDetail = currentState.accountDetails.get(accountFullName);
		
		if (accountDetail) {
			this.state.update(s => ({
				...s,
				selectedAccount: accountDetail,
				showAccountDetails: true,
			}));
		}
	}

	/**
	 * Closes the account details view.
	 */
	closeAccountDetail() {
		this.state.update(s => ({
			...s,
			selectedAccount: null,
			showAccountDetails: false,
		}));
	}

	/**
	 * Updates the search filter and triggers re-filtering of the tree.
	 * @param {string} filter - The new search filter string.
	 */
	updateSearchFilter(filter: string) {
		this.state.update(s => ({ ...s, searchFilter: filter }));
	}

	/**
	 * Extracts the display name (leaf name) from a full account path.
	 * @param {string} fullAccountName - e.g., "Assets:Bank:Checking".
	 * @returns {string} e.g., "Checking".
	 */
	private getAccountDisplayName(fullAccountName: string): string {
		const parts = fullAccountName.split(':');
		return parts[parts.length - 1];
	}

	/**
	 * Determines the top-level account type.
	 * @param {string} accountName - The full account name.
	 * @returns {AccountDetail['accountType']} The account type.
	 */
	private getAccountType(accountName: string): AccountDetail['accountType'] {
		if (accountName.startsWith('Assets')) return 'Assets';
		if (accountName.startsWith('Liabilities')) return 'Liabilities';
		if (accountName.startsWith('Income')) return 'Income';
		if (accountName.startsWith('Expenses')) return 'Expenses';
		if (accountName.startsWith('Equity')) return 'Equity';
		return 'Other';
	}

	/**
	 * Returns the account tree filtered by the current search term.
	 * @returns {AccountNode[]} The filtered list of root nodes.
	 */
	getFilteredAccountTree(): AccountNode[] {
		const currentState = get(this.state);
		if (!currentState.searchFilter.trim()) {
			return currentState.accountTree;
		}

		const filter = currentState.searchFilter.toLowerCase();
		return this.filterAccountTreeRecursive(currentState.accountTree, filter);
	}

	/**
	 * Recursively filters account nodes.
	 * @param {AccountNode[]} nodes - The nodes to filter.
	 * @param {string} filter - The lowercase filter string.
	 * @returns {AccountNode[]} The filtered nodes.
	 */
	private filterAccountTreeRecursive(nodes: AccountNode[], filter: string): AccountNode[] {
		const filtered: AccountNode[] = [];

		for (const node of nodes) {
			const nameMatches = node.name.toLowerCase().includes(filter) || 
							   (node.fullName && node.fullName.toLowerCase().includes(filter));
			
			const filteredChildren = this.filterAccountTreeRecursive(node.children, filter);
			
			if (nameMatches || filteredChildren.length > 0) {
				filtered.push({
					...node,
					children: filteredChildren,
				});
			}
		}

		return filtered;
	}
}
