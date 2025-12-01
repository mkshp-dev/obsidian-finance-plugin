// src/main.ts

import { Plugin } from 'obsidian';
import { BeancountSettingTab, type BeancountPluginSettings, DEFAULT_SETTINGS } from './settings';
import { BeancountView, BEANCOUNT_VIEW_TYPE } from './ui/views/sidebar/sidebar-view';
import { UnifiedTransactionModal } from './ui/modals/UnifiedTransactionModal';
import { runQuery, parseSingleValue, convertWslPathToWindows } from './utils/index';
import { UnifiedDashboardView, UNIFIED_DASHBOARD_VIEW_TYPE } from './ui/views/dashboard/unified-dashboard-view';
import { BQLCodeBlockProcessor } from './ui/markdown/BQLCodeBlockProcessor';
import { InlineBQLProcessor } from './ui/markdown/InlineBQLProcessor';
import { OnboardingModal } from './ui/modals/OnboardingModal';

import { BackendProcess } from './core/backend-process';
import { ApiClient } from './api/client';
import { JournalService } from './services/journal.service';
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
	private inlineBqlProcessor: InlineBQLProcessor;

    // Services
    public backendProcess: BackendProcess;
    public apiClient: ApiClient;
    public journalService: JournalService;
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
        this.backendProcess = new BackendProcess(this);
        this.apiClient = new ApiClient(this.backendProcess);
        this.journalService = new JournalService(this.apiClient);
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


		this.addSettingTab(new BeancountSettingTab(this.app, this));
	}

	/**
	 * Activates a specific view type in the workspace.
	 *
	 * @param {string} viewType - The type of view to activate.
	 * @param {'tab' | 'right' | 'left'} [location='tab'] - Where to open the view.
	 */
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
	 * Public wrapper for running BQL queries (used by views).
	 * @param {string} query - The BQL query.
	 * @returns {Promise<string>} The CSV output.
	 */
	public runQuery = (query: string): Promise<string> => {
		// Call the imported utility function, passing 'this' (the plugin instance)
		return runQuery(this, query);
	}

	/**
	 * Public wrapper for parsing single values from CSV (used by views).
	 * @param {string} csv - The CSV string.
	 * @returns {string} The parsed value.
	 */
	public parseSingleValue = (csv: string): string => {
		return parseSingleValue(csv);
	}

	/**
	 * Public wrapper for converting WSL paths (used by views).
	 * @param {string} wslPath - The WSL path.
	 * @returns {string} The Windows path.
	 */
	public convertWslPathToWindows = (wslPath: string): string => {
		return convertWslPathToWindows(wslPath);
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
	 * Stops backend processes.
	 */
	onunload() {
        Logger.log('Plugin unloading...');
        this.backendProcess?.stop();
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
