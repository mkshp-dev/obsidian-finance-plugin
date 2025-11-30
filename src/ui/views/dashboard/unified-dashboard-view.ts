// src/ui/views/dashboard/unified-dashboard-view.ts

import { ItemView, WorkspaceLeaf } from 'obsidian';
import type BeancountPlugin from '../../../main';
import UnifiedDashboardComponent from './UnifiedDashboardView.svelte';
import { CommodityDetailModal } from '../../modals/CommodityDetailModal';

// --- Import ALL controllers ---
import { OverviewController } from '../../../controllers/OverviewController';
import { TransactionController } from '../../../controllers/TransactionController';
import { BalanceSheetController } from '../../../controllers/BalanceSheetController';
import { AccountsController } from '../../../controllers/AccountsController';
import { CommoditiesController } from '../../../controllers/CommoditiesController';
// JournalController is replaced by plugin.journalStore
// -----------------------------

export const UNIFIED_DASHBOARD_VIEW_TYPE = "beancount-unified-dashboard";

export class UnifiedDashboardView extends ItemView {
	plugin: BeancountPlugin;
	component: UnifiedDashboardComponent;
	
	// --- View holds instances of controllers ---
	overviewController: OverviewController;
	transactionController: TransactionController;
	balanceSheetController: BalanceSheetController;
	accountsController: AccountsController;
	commoditiesController: CommoditiesController;

	constructor(leaf: WorkspaceLeaf, plugin: BeancountPlugin) {
		super(leaf);
		this.plugin = plugin;
		// --- Create controller instances ---
		this.overviewController = new OverviewController(this.plugin);
		this.transactionController = new TransactionController(this.plugin);
		this.balanceSheetController = new BalanceSheetController(this.plugin);
		this.accountsController = new AccountsController(this.plugin);
		this.commoditiesController = new CommoditiesController(this.plugin);
	}

	getViewType(): string { return UNIFIED_DASHBOARD_VIEW_TYPE; }
	getDisplayText(): string { return "Beancount Dashboard"; }
	getIcon(): string { return "layout-dashboard"; }

	// Method to refresh all tabs when transactions are added
	async refreshAllTabs() {
		try {
			await Promise.all([
				this.overviewController.loadData(),
				this.transactionController.loadFilterData(),
				this.balanceSheetController.loadData(),
				this.accountsController.loadData(),
				this.commoditiesController.loadData(),
				this.plugin.journalStore.refresh() // Use new store
			]);
		} catch (error) {
			console.error('Error refreshing dashboard data:', error);
		}
	}

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();

		this.component = new UnifiedDashboardComponent({
			target: container,
			props: {
				// --- Pass controllers to Svelte ---
				overviewController: this.overviewController,
				transactionController: this.transactionController,
				balanceSheetController: this.balanceSheetController,
				accountsController: this.accountsController,
				commoditiesController: this.commoditiesController,
				journalStore: this.plugin.journalStore, // Pass store instead of controller
				plugin: this.plugin // Pass plugin instance
			}
		});

		// --- Listen for events dispatched from Svelte ---
		this.component.$on('filtersChange', (e) => this.transactionController.handleFilterChange(e.detail));
		// When CommoditiesTab requests a detail modal, open it using plugin/app context
		this.component.$on('openCommodity', (e: any) => {
			const symbol = e.detail?.symbol || e.detail;
			new CommodityDetailModal(this.app, this.plugin, this.commoditiesController, symbol).open();
		});
		
		// --- Load initial data via controllers ---
		this.overviewController.loadData();
		this.transactionController.loadFilterData(); // Load filter dropdown data
		this.transactionController.handleFilterChange({}); // Load initial transactions
		this.balanceSheetController.loadData();
		// Note: AccountsController loads data independently when its tab is accessed
	}

	async onClose() {
		if (this.component) {
			this.component.$destroy();
		}
	}
}
