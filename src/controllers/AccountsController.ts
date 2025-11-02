// src/controllers/AccountsController.ts

import { writable, type Writable, get } from 'svelte/store';
import type BeancountPlugin from '../main';
import * as queries from '../queries/index';
import { buildAccountTree, parseAmount } from '../utils/index';
import { parse as parseCsv } from 'csv-parse/sync';
import type { AccountNode, AccountDetail } from '../types/index';

// Define the shape of our accounts state
export interface AccountsState {
	isLoading: boolean;
	error: string | null;
	accountTree: AccountNode[];
	accountDetails: Map<string, AccountDetail>;
	expandedAccounts: Set<string>;
	searchFilter: string;
	selectedAccount: AccountDetail | null;
	showAccountDetails: boolean;
}

export class AccountsController {
	private plugin: BeancountPlugin;
	
	// Svelte store for all state
	public state: Writable<AccountsState>;

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

	// Load account data with hierarchy and details
	async loadData() {
		this.state.update(s => ({ ...s, isLoading: true, error: null }));

		const reportingCurrency = this.plugin.settings.reportingCurrency;
		if (!reportingCurrency) {
			this.state.update(s => ({
				...s,
				isLoading: false,
				error: "Reporting Currency is not set in plugin settings.",
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

	// Toggle account expansion in hierarchy
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

	// Show detailed view for an account
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

	// Close detailed view
	closeAccountDetail() {
		this.state.update(s => ({
			...s,
			selectedAccount: null,
			showAccountDetails: false,
		}));
	}

	// Update search filter
	updateSearchFilter(filter: string) {
		this.state.update(s => ({ ...s, searchFilter: filter }));
	}

	// Helper method to get display name (last part of account hierarchy)
	private getAccountDisplayName(fullAccountName: string): string {
		const parts = fullAccountName.split(':');
		return parts[parts.length - 1];
	}

	// Helper method to determine account type
	private getAccountType(accountName: string): AccountDetail['accountType'] {
		if (accountName.startsWith('Assets')) return 'Assets';
		if (accountName.startsWith('Liabilities')) return 'Liabilities';
		if (accountName.startsWith('Income')) return 'Income';
		if (accountName.startsWith('Expenses')) return 'Expenses';
		if (accountName.startsWith('Equity')) return 'Equity';
		return 'Other';
	}

	// Filter accounts based on search
	getFilteredAccountTree(): AccountNode[] {
		const currentState = get(this.state);
		if (!currentState.searchFilter.trim()) {
			return currentState.accountTree;
		}

		const filter = currentState.searchFilter.toLowerCase();
		return this.filterAccountTreeRecursive(currentState.accountTree, filter);
	}

	// Recursive filtering for account tree
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