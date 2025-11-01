// src/views/unified-dashboard-view.ts

import { ItemView, WorkspaceLeaf } from 'obsidian';
import type BeancountPlugin from '../main';
import UnifiedDashboardComponent from './UnifiedDashboardView.svelte';

// --- Import BOTH controllers ---
import { OverviewController } from '../controllers/OverviewController';
import { TransactionController } from '../controllers/TransactionController';
import { BalanceSheetController } from '../controllers/BalanceSheetController';
// -----------------------------

export const UNIFIED_DASHBOARD_VIEW_TYPE = "beancount-unified-dashboard";

export class UnifiedDashboardView extends ItemView {
	plugin: BeancountPlugin;
	component: UnifiedDashboardComponent;
	
	// --- View holds instances of controllers ---
	overviewController: OverviewController;
	transactionController: TransactionController;
	balanceSheetController: BalanceSheetController;
	// --- REMOVED all state properties ---

	constructor(leaf: WorkspaceLeaf, plugin: BeancountPlugin) {
		super(leaf);
		this.plugin = plugin;
		// --- Create controller instances ---
		this.overviewController = new OverviewController(this.plugin);
		this.transactionController = new TransactionController(this.plugin);
		this.balanceSheetController = new BalanceSheetController(this.plugin);
	}

	getViewType(): string { return UNIFIED_DASHBOARD_VIEW_TYPE; }
	getDisplayText(): string { return "Beancount Dashboard"; }
	getIcon(): string { return "layout-dashboard"; }

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();

		this.component = new UnifiedDashboardComponent({
			target: container,
			props: {
				plugin: this.plugin,
				// --- Pass controllers to Svelte ---
				overviewController: this.overviewController,
				transactionController: this.transactionController,
				balanceSheetController: this.balanceSheetController
			}
		});

		// --- Listen for events dispatched from Svelte ---
		// (We'll update Svelte to dispatch an event with a 'filters' payload)
		this.component.$on('filtersChange', (e) => this.transactionController.handleFilterChange(e.detail));
		
		// --- Load initial data via controllers ---
		this.overviewController.loadData();
		this.transactionController.loadFilterData(); // Load filter dropdown data
		this.transactionController.handleFilterChange({}); // Load initial transactions
		this.balanceSheetController.loadData()
	}

	async onClose() {
		if (this.component) {
			this.component.$destroy();
		}
	}

	// --- REMOVED handleFilterChange and loadOverviewData ---
	// --- REMOVED updateSvelteProps ---
}