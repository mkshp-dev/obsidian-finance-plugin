// src/main.ts

import { Plugin } from 'obsidian';
import { BeancountSettingTab, type BeancountPluginSettings, DEFAULT_SETTINGS } from './settings';
import { BeancountView, BEANCOUNT_VIEW_TYPE } from './views/sidebar-view'; 
import { TransactionModal } from './components/transaction-modal';
import { runQuery, parseSingleValue, convertWslPathToWindows } from './utils/index';
import { UnifiedDashboardView, UNIFIED_DASHBOARD_VIEW_TYPE } from './views/unified-dashboard-view';
// --------------------------------------------------

export default class BeancountPlugin extends Plugin {
	settings: BeancountPluginSettings;

	async onload() {
		await this.loadSettings();

		// Register Views
		// this.registerView(
		// 	OVERVIEW_VIEW_TYPE,
		// 	(leaf) => new OverviewView(leaf, this)
		// );
		this.registerView(
			BEANCOUNT_VIEW_TYPE, // Sidebar Snapshot
			(leaf) => new BeancountView(leaf, this)
		);
		// this.registerView(
		// 	DASHBOARD_VIEW_TYPE, // Main Dashboard (Transactions)
		// 	(leaf) => new DashboardView(leaf, this)
		// );
		this.registerView(
			UNIFIED_DASHBOARD_VIEW_TYPE,
			(leaf) => new UnifiedDashboardView(leaf, this)
		);
		// Add Ribbon Icons
		this.addRibbonIcon('dollar-sign', 'Open Beancount Snapshot', () => {
			this.activateView(BEANCOUNT_VIEW_TYPE, 'right'); // Specify type and location
		});
		this.addRibbonIcon('layout-dashboard', 'Open Beancount Dashboard', () => {
			this.activateView(UNIFIED_DASHBOARD_VIEW_TYPE, 'tab'); // Open the NEW view
		});
		// Consider adding one for the main Dashboard too
		// this.addRibbonIcon('layout-dashboard', 'Open Beancount Dashboard', () => {
		// 	this.activateView(DASHBOARD_VIEW_TYPE, 'tab'); // Specify type and location
		// });

		// Add Commands
		this.addCommand({
			id: 'add-beancount-transaction',
			name: 'Add Beancount Transaction',
			hotkeys: [{ modifiers: ['Mod'], key: 't' }],
			callback: () => { new TransactionModal(this.app, this).open(); }
		});
		this.addCommand({
			id: 'open-beancount-unified-dashboard', // This ID now opens the new unified view
			name: 'Open Beancount Unified Dashboard',
			hotkeys: [{ modifiers: ['Mod'], key: 'd' }],
			callback: () => { this.activateView(UNIFIED_DASHBOARD_VIEW_TYPE, 'tab'); }
		});
		this.addCommand({
			id: 'open-beancount-snapshot',
			name: 'Open Beancount Snapshot',
			hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 's' }],
			callback: () => { this.activateView(BEANCOUNT_VIEW_TYPE, 'right'); }
		});


		this.addSettingTab(new BeancountSettingTab(this.app, this));
	}

	// --- REFACTORED: Generic activateView function ---
	async activateView(viewType: string, location: 'tab' | 'right' | 'left' = 'tab') {
		// Detach existing leaves of this type first to avoid duplicates
		this.app.workspace.detachLeavesOfType(viewType);
		if (location === 'tab') {
			this.app.workspace.detachLeavesOfType(viewType);
		}
		let leaf;
		if (location === 'right') {
			leaf = this.app.workspace.getRightLeaf(false);
			// If right leaf doesn't exist, create it
			if (!leaf) {
				leaf = this.app.workspace.getLeaf('split', 'vertical');
			}
		} else if (location === 'left') {
			leaf = this.app.workspace.getLeftLeaf(false);
			// If left leaf doesn't exist, create it
			if (!leaf) {
				leaf = this.app.workspace.getLeaf('split', 'horizontal');
			}
		}
		 else { // Default to 'tab'
			leaf = this.app.workspace.getLeaf('tab');
		}

		if (leaf) {
			await leaf.setViewState({
				type: viewType,
				active: true,
			});
			this.app.workspace.revealLeaf(leaf); // Focus the view
		} else {
			console.error(`Could not get leaf for location: ${location}`);
		}
	}
	// --- REMOVED: Old activateView, activateDashboardView, activateOverviewView ---

	// --- MOVED TO UTILS: runQuery ---
	// Make runQuery available publicly for view components
	public runQuery = (query: string): Promise<string> => {
		// Call the imported utility function, passing 'this' (the plugin instance)
		return runQuery(this, query);
	}

	// --- MOVED TO UTILS: parseSingleValue ---
	// Make parseSingleValue available publicly
	public parseSingleValue = (csv: string): string => {
		return parseSingleValue(csv);
	}

	// --- MOVED TO UTILS: convertWslPathToWindows ---
	// Make convertWslPathToWindows available publicly
	public convertWslPathToWindows = (wslPath: string): string => {
		return convertWslPathToWindows(wslPath);
	}

	onunload() {}
	async loadSettings() { this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()); }
	async saveSettings() { await this.saveData(this.settings); }
}