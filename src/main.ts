// src/main.ts

import { Plugin } from 'obsidian';
import { BeancountSettingTab, type BeancountPluginSettings, DEFAULT_SETTINGS } from './settings';
import { BeancountView, BEANCOUNT_VIEW_TYPE } from './ui/views/sidebar/sidebar-view';
import { UnifiedTransactionModal } from './ui/modals/UnifiedTransactionModal';
import { runQuery } from './utils/index';
import { UnifiedDashboardView, UNIFIED_DASHBOARD_VIEW_TYPE } from './ui/views/dashboard/unified-dashboard-view';
import { BQLCodeBlockProcessor } from './ui/markdown/BQLCodeBlockProcessor';
import { InlineBQLProcessor } from './ui/markdown/InlineBQLProcessor';
import { OnboardingModal } from './ui/modals/OnboardingModal';

import { JournalService } from './services/journal.service';
import { PriceService } from './services/price.service';
import { createJournalStore } from './stores/journal.store';
import { Logger } from './utils/logger';

// --------------------------------------------------

/**
 * Main plugin class for Obsidian Finance (Beancount).
 * Handles plugin lifecycle, settings, service initialization, and UI registration.
 */
export default class BeancountPlugin extends Plugin {
	settings: BeancountPluginSettings;
	private bqlProcessor: BQLCodeBlockProcessor;
	public inlineBqlProcessor: InlineBQLProcessor;

	// Services
	public journalService: JournalService;
	public priceService: PriceService;
	public journalStore: ReturnType<typeof createJournalStore>;

	/**
	 * Called when the plugin is loaded by Obsidian.
	 * Initializes services, processors, views, commands, and settings.
	 */
	async onload() {
		await this.loadSettings();

		// Initialize Logger
		Logger.setDebugMode(this.settings.debugMode);
		Logger.log('Plugin loading...');

		// Initialize Core Services
		this.journalService = new JournalService(this);
		this.priceService = new PriceService(this);
		this.journalStore = createJournalStore(this.journalService);

		// Check for onboarding
		if (!this.settings.beancountFilePath) {
			Logger.log('No Beancount file configured. Triggering onboarding.');
			this.app.workspace.onLayoutReady(() => {
				new OnboardingModal(this.app, this).open();
			});
		}

		// Initialize and register BQL code block processor
		this.registerBQLProcessor();

		// Initialize and register inline BQL processor
		this.registerInlineBQLProcessor();

		// Register Views
		this.registerView(
			BEANCOUNT_VIEW_TYPE, // Sidebar Snapshot
			(leaf) => new BeancountView(leaf, this)
		);
		this.registerView(
			UNIFIED_DASHBOARD_VIEW_TYPE,
			(leaf) => new UnifiedDashboardView(leaf, this)
		);

		// Register file extensions so Obsidian shows .beancount and .bean files in file explorer
		// Note: Uses 'markdown' view type, so Beancount syntax will have some Markdown rendering
		this.registerExtensions(['beancount', 'bean'], 'markdown');

		// Add Ribbon Icons
		this.addRibbonIcon('plus-circle', 'Add Transaction', () => {
			new UnifiedTransactionModal(this.app, this, null, this.getDashboardRefreshCallback()).open();
		});
		this.addRibbonIcon('layout-dashboard', 'Open Beancount Dashboard', () => {
			this.activateView(UNIFIED_DASHBOARD_VIEW_TYPE, 'tab'); // Open the NEW view
		});

		// Add Commands
		this.addCommand({
			id: 'add-beancount-transaction',
			name: 'Add Beancount Transaction',
			callback: () => { new UnifiedTransactionModal(this.app, this, null, this.getDashboardRefreshCallback()).open(); }
		});
		// 'Insert BQL Query Block' command removed — use manual insertion or BQL templates instead
		this.addCommand({
			id: 'open-beancount-unified-dashboard', // This ID now opens the new unified view
			name: 'Open Beancount Unified Dashboard',
			callback: () => { this.activateView(UNIFIED_DASHBOARD_VIEW_TYPE, 'tab'); }
		});
		this.addCommand({
			id: 'open-beancount-snapshot',
			name: 'Open Beancount Snapshot',
			callback: () => { this.activateView(BEANCOUNT_VIEW_TYPE, 'right'); }
		});
		this.addCommand({
			id: 'run-beancount-onboarding',
			name: 'Run Setup/Onboarding',
			callback: () => { new OnboardingModal(this.app, this).open(); }
		});

		// Add Fetch Commodity Prices command
		this.addCommand({
			id: 'fetch-commodity-prices',
			name: 'Fetch Commodity Prices',
			callback: async () => {
				// Find the unified dashboard view and call fetchPrices on commodities controller
				const leaves = this.app.workspace.getLeavesOfType(UNIFIED_DASHBOARD_VIEW_TYPE);
				for (const leaf of leaves) {
					if (leaf.view instanceof UnifiedDashboardView) {
						await (leaf.view as any).commoditiesController?.fetchPrices();
						return;
					}
				}
				// If dashboard not open, just run the service directly
				Logger.log('[Main] Fetching prices via command (dashboard not open)');
				const result = await this.priceService.fetchAndSavePrices();
				if (result.savedCount > 0) {
					// @ts-ignore - Notice exists in Obsidian
					new this.app.Notice(`✓ Fetched and saved ${result.savedCount} price(s)`);
				} else {
					// @ts-ignore
					new this.app.Notice('No prices fetched. Check commodity price sources.');
				}
			}
		});

		// Setup automatic price fetching if enabled
		if (this.settings.autoPriceFetch) {
			this.setupAutomaticPriceFetching();
		}


		this.addSettingTab(new BeancountSettingTab(this.app, this));
	}

	/**
	 * Sets up automatic price fetching on an interval.
	 */
	public setupAutomaticPriceFetching(): void {
		const intervalMs = this.settings.priceFetchIntervalHours * 60 * 60 * 1000;
		Logger.log(`[Main] Setting up automatic price fetching every ${this.settings.priceFetchIntervalHours} hours`);

		// Register interval with Obsidian's lifecycle management
		this.registerInterval(
			window.setInterval(async () => {
				Logger.log('[Main] Running automatic price fetch');
				try {
					const result = await this.priceService.fetchAndSavePrices();

					// Update last fetch timestamp
					this.settings.lastAutoPriceFetch = Date.now();
					await this.saveSettings();

					// Only show notice on errors (don't spam on success)
					if (result.failed.length > 0) {
						const failedSymbols = result.failed.map(f => f.commodity).join(', ');
						// @ts-ignore
						new this.app.Notice(`⚠ Automatic price fetch: Failed for ${failedSymbols}`);
					}

					Logger.log(`[Main] Automatic price fetch complete: ${result.savedCount} saved, ${result.failed.length} failed`);
				} catch (error) {
					Logger.error('[Main] Automatic price fetch error:', error);
				}
			}, intervalMs)
		);
	}

	/**
	 * Activates a specific view type in the workspace.
	 *
	 * @param {string} viewType - The type of view to activate.
	 * @param {'tab' | 'right' | 'left'} [location='tab'] - Where to open the view.
	 */
	async activateView(viewType: string, location: 'tab' | 'right' | 'left' = 'tab') {
		// Detach existing leaves of this type first to avoid duplicates
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
			Logger.log(`Activating view: ${viewType} at ${location}`);
			await leaf.setViewState({
				type: viewType,
				active: true,
			});
			this.app.workspace.revealLeaf(leaf); // Focus the view
		} else {
			Logger.error(`Could not get leaf for location: ${location}`);
		}
	}

	/**
	 * Public wrapper for running BQL queries (used by views and controllers).
	 * @param {string} query - The BQL query.
	 * @returns {Promise<string>} The CSV output.
	 */
	public runQuery = (query: string): Promise<string> => {
		return runQuery(this, query);
	}

	// Helper method to get dashboard refresh callback
	private getDashboardRefreshCallback(): () => Promise<void> {
		return async () => {
			// Find the unified dashboard view and call its refresh method
			const leaves = this.app.workspace.getLeavesOfType(UNIFIED_DASHBOARD_VIEW_TYPE);
			for (const leaf of leaves) {
				if (leaf.view instanceof UnifiedDashboardView) {
					await leaf.view.refreshAllTabs();
					break;
				}
			}
		};
	}

	/**
	 * Called when the plugin is unloaded.
	 */
	onunload() {
		Logger.log('Plugin unloading...');
		// Cleanup is handled automatically by registerInterval
	}

	// Register BQL processor
	private registerBQLProcessor() {
		// Create processor instance
		this.bqlProcessor = new BQLCodeBlockProcessor(this);

		// Register the processor
		this.registerMarkdownCodeBlockProcessor('bql', this.bqlProcessor.getProcessor());
	}

	// Register inline BQL processor
	private registerInlineBQLProcessor() {
		// Create processor instance
		this.inlineBqlProcessor = new InlineBQLProcessor(this);

		// Register the processor for all markdown content with high priority
		this.registerMarkdownPostProcessor(this.inlineBqlProcessor.getProcessor(), -100);
	}

	async loadSettings() {
		const raw = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, raw);

		// Migration: consolidate legacy `reportingCurrency` / `defaultCurrency` into `operatingCurrency`
		if (!this.settings.operatingCurrency) {
			const legacyReporting = (raw as any)?.reportingCurrency;
			const legacyDefault = (raw as any)?.defaultCurrency;
			const migrated = (legacyReporting || legacyDefault || DEFAULT_SETTINGS.operatingCurrency) as string;
			this.settings.operatingCurrency = typeof migrated === 'string' ? migrated.toUpperCase() : DEFAULT_SETTINGS.operatingCurrency;
			// Persist migrated value
			await this.saveSettings();
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
		// Refresh all BQL code blocks with new settings
		if (this.bqlProcessor) {
			this.refreshBQLBlocks();
		}
	}

	// Force refresh all BQL code blocks
	private refreshBQLBlocks() {
		// Use setTimeout to ensure settings are fully saved before refreshing
		setTimeout(() => {
			this.bqlProcessor?.refreshAllBlocks();
		}, 50);
	}
}
