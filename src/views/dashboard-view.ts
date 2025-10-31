// src/views/dashboard-view.ts

// import { ItemView, WorkspaceLeaf, Notice } from 'obsidian';
// import type BeancountPlugin from '../main';
// import DashboardComponent from '../components/tabs/TransactionsTab.svelte';
// import * as queries from '../queries/index';
// import { parse as parseCsv } from 'csv-parse/sync';

// export const DASHBOARD_VIEW_TYPE = "beancount-dashboard-view";




// export class DashboardView extends ItemView {
// 	plugin: BeancountPlugin;
// 	component: DashboardComponent;

// 	// --- State now lives in the parent ---
// 	private currentFilters: queries.TransactionFilters = {};
// 	private currentTransactions: string[][] = [];
// 	private isLoading = false;
// 	private error: string | null = null;
// 	// ------------------------------------

// 	constructor(leaf: WorkspaceLeaf, plugin: BeancountPlugin) {
// 		super(leaf);
// 		this.plugin = plugin;
// 	}

// 	getViewType(): string { return DASHBOARD_VIEW_TYPE; }
// 	getDisplayText(): string { return "Beancount Dashboard"; }
// 	getIcon(): string { return "layout-dashboard"; }

// 	async onOpen() {
// 		const container = this.containerEl.children[1];
// 		container.empty();

// 		// Mount the Svelte component, passing initial state and runQuery
// 		this.component = new DashboardComponent({
// 			target: container,
// 			props: {
// 				plugin: this.plugin,
// 				runQuery: this.plugin.runQuery.bind(this.plugin),
// 				incomingTransactions: this.currentTransactions,
// 				isLoading: this.isLoading,
// 				error: this.error
// 				// Pass other necessary initial state if needed
// 			}
// 		});

// 		// Listen for filter changes from the Svelte component
// 		this.component.$on('filtersChange', (e) => this.handleFilterChange(e.detail));
// 	}

// 	async onClose() {
// 		if (this.component) { this.component.$destroy(); }
// 	}

// 	// --- NEW: Handle filter changes and fetch data ---
// 	async handleFilterChange(filters: queries.TransactionFilters) {
// 		console.log("Parent received filters:", filters); // Debug log
// 		this.currentFilters = filters;
// 		this.isLoading = true;
// 		this.error = null;
// 		this.updateSvelteProps(); // Update Svelte's loading state immediately

// 		try {
// 			const query = queries.getTransactionsQuery(this.currentFilters);
// 			console.log("Generated Query:", query); // Debug log
// 			const result = await this.plugin.runQuery(query); // Use plugin's runQuery
// 			const cleanStdout = result.replace(/\r/g, "").trim();
// 			const records: string[][] = parseCsv(cleanStdout, { columns: false, skip_empty_lines: true, relax_column_count: true });

// 			const defaultHeaders = ['date', 'payee', 'narration', 'position']; // Match query
// 			const firstRowIsHeader = records[0]?.[0]?.toLowerCase().includes('date');
// 			const dataRows = firstRowIsHeader ? records.slice(1) : records;

// 			// Store raw rows
// 			this.currentTransactions = dataRows.map(row => {
// 				const completeRow = [...row];
// 				while(completeRow.length < defaultHeaders.length) completeRow.push('');
// 				return completeRow;
// 			});

// 		} catch (e) {
// 			console.error("Error fetching transactions in parent:", e);
// 			this.error = `Failed to load transactions: ${e.message}`;
// 			this.currentTransactions = []; // Clear data on error
// 		} finally {
// 			this.isLoading = false;
// 			this.updateSvelteProps(); // Send final state (data or error) to Svelte
// 		}
// 	}
// 	// ------------------------------------------------

// 	// --- Helper to update Svelte props ---
// 	private updateSvelteProps() {
// 		if (this.component) {
// 			this.component.$set({
// 				incomingTransactions: this.currentTransactions,
// 				isLoading: this.isLoading, // Pass loading state for table
// 				error: this.error
// 			});
// 		}
// 	}
// 	// -----------------------------------
// }