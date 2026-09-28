// src/main.ts

import { Plugin, Notice, TFile } from 'obsidian';
import { BeancountSettingTab, type BeancountPluginSettings, DEFAULT_SETTINGS } from './settings';
import type { Completion } from '@codemirror/autocomplete';
import { parseSnippetsFile } from './lang/beancount-snippets';
import { BeancountView, BEANCOUNT_VIEW_TYPE } from './ui/views/sidebar/sidebar-view';
import { BeancountFileView, BEANCOUNT_FILE_VIEW_TYPE } from './ui/views/beancount-file-view';
import { UnifiedTransactionModal } from './ui/modals/UnifiedTransactionModal';
import { runQuery, type BQLFormat } from './utils/index';
import { createPluginApi, type BeancountPluginApi } from './api';
import { UnifiedDashboardView, UNIFIED_DASHBOARD_VIEW_TYPE } from './ui/views/dashboard/unified-dashboard-view';
import { BQLCodeBlockProcessor } from './ui/markdown/BQLCodeBlockProcessor';
import { InlineBQLProcessor } from './ui/markdown/InlineBQLProcessor';
import { OnboardingModal } from './ui/modals/OnboardingModal';
import { ConfirmModal } from './ui/modals/ConfirmModal';
import { formatBeancountCommand } from './lang/beancount-format';
import type { EditorView } from '@codemirror/view';

import { JournalService } from './services/journal.service';
import { PriceService } from './services/price.service';
import { CurrencyPrecisionService } from './services/currency-precision.service';
import { createJournalStore } from './stores/journal.store';
import { Logger } from './utils/logger';
import { SystemDetector } from './utils/SystemDetector';

// --------------------------------------------------

/**
 * Main plugin class for Obsidian Finance (Beancount).
 * Handles plugin lifecycle, settings, service initialization, and UI registration.
 */
export default class BeancountPlugin extends Plugin {
	settings: BeancountPluginSettings;
	private bqlProcessor: BQLCodeBlockProcessor;
	public inlineBqlProcessor: InlineBQLProcessor;

	/** Cached user-defined transaction snippets. */
	public snippetCompletions: Completion[] = [];

	/** Public API surface for inter-plugin access. */
	public api: BeancountPluginApi;

	// Services
	public journalService: JournalService;
	public priceService: PriceService;
	public currencyPrecisionService: CurrencyPrecisionService;
	public journalStore: ReturnType<typeof createJournalStore>;

	/** Whether bean-query is currently reachable (runtime state, NOT persisted). */
	public isConnectionReady = false;

	/**
	 * Called when the plugin is loaded by Obsidian.
	 * Initializes services, processors, views, commands, and settings.
	 */
	async onload() {
		await this.loadSettings();

		// Initialize Logger
		Logger.setDebugMode(this.settings.debugMode);
		Logger.log('Plugin loading...');
		this.applyHelpTipVisibility();
		this.registerEvent(this.app.workspace.on('window-open', (_win, popout) => {
			popout.document.body.toggleClass('beancount-hide-help', !this.settings.showHelpTips);
		}));

		// Load snippets if enabled
		if (this.settings.enableUserSnippets) {
			await this.loadSnippets();
		}

		// Expose public API for other plugins
		this.api = createPluginApi(this);

		// Initialize Core Services
		this.journalService = new JournalService(this);
		this.priceService = new PriceService(this);
		this.currencyPrecisionService = new CurrencyPrecisionService(this);
		this.journalStore = createJournalStore(this.journalService);

		// Non-blocking: infer per-currency display precision from the ledger.
		if (this.settings.beancountCommand) {
			void this.currencyPrecisionService.ensureLoaded();
		}

		// Check for onboarding — use dedicated flag instead of structuredFolderName
		if (!this.settings.onboardingCompleted) {
			Logger.log('Onboarding not completed. Triggering onboarding wizard.');
			this.app.workspace.onLayoutReady(() => {
				new OnboardingModal(this.app, this).open();
			});
		}

		// Non-blocking runtime probe to check if bean-query is reachable
		if (this.settings.beancountCommand) {
			void this.probeConnection();
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
		this.registerView(
			BEANCOUNT_FILE_VIEW_TYPE,
			(leaf) => new BeancountFileView(leaf, this)
		);

		// Register .beancount and .bean files with a plain-text view to avoid Markdown rendering
		this.registerExtensions(['beancount', 'bean'], BEANCOUNT_FILE_VIEW_TYPE);

		// Add Ribbon Icons
		this.addRibbonIcon('plus-circle', 'Add transaction', () => {
			new UnifiedTransactionModal(this.app, this, null, this.getDashboardRefreshCallback()).open();
		});
		this.addRibbonIcon('layout-dashboard', 'Open Beancount dashboard', () => {
			void this.activateView(UNIFIED_DASHBOARD_VIEW_TYPE, 'tab'); // Open the NEW view
		});

		// Add Commands
		this.addCommand({
			id: 'add-beancount-transaction',
			name: 'Add Beancount transaction',
			callback: () => { new UnifiedTransactionModal(this.app, this, null, this.getDashboardRefreshCallback()).open(); }
		});
		// 'Insert BQL Query Block' command removed — use manual insertion or BQL templates instead
		this.addCommand({
			id: 'open-beancount-unified-dashboard', // This ID now opens the new unified view
			name: 'Open Beancount unified dashboard',
			callback: () => { void this.activateView(UNIFIED_DASHBOARD_VIEW_TYPE, 'tab'); }
		});
		this.addCommand({
			id: 'open-beancount-snapshot',
			name: 'Open Beancount snapshot',
			callback: () => { void this.activateView(BEANCOUNT_VIEW_TYPE, 'right'); }
		});
		this.addCommand({
			id: 'run-beancount-onboarding',
			name: 'Run setup/onboarding',
			callback: () => {
				if (this.settings.onboardingCompleted) {
					new ConfirmModal(
						this.app,
						"Run Setup / Onboarding",
						"You have already completed setup. Running the onboarding wizard again will allow you to recreate the structured folder layout or migrate another ledger. Do you want to proceed?",
						() => {
							new OnboardingModal(this.app, this).open();
						}
					).open();
				} else {
					new OnboardingModal(this.app, this).open();
				}
			}
		});
		this.addCommand({
			id: 'format-beancount-document',
			name: 'Format Beancount document',
			callback: () => {
				const active = this.app.workspace.getActiveViewOfType(BeancountFileView);
				if (active) {
					formatBeancountCommand((active as unknown as { editorView: EditorView }).editorView);
				} else {
					new Notice('Open a .beancount file first.');
				}
			}
		});

		// Add Fetch Commodity Prices command
		this.addCommand({
			id: 'fetch-commodity-prices',
			name: 'Fetch commodity prices',
			callback: async () => {
				// Find the unified dashboard view and call fetchPrices on commodities controller
				const leaves = this.app.workspace.getLeavesOfType(UNIFIED_DASHBOARD_VIEW_TYPE);
				for (const leaf of leaves) {
					if (leaf.view instanceof UnifiedDashboardView) {
						await leaf.view.commoditiesController?.fetchPrices();
						return;
					}
				}
				// If dashboard not open, just run the service directly
				Logger.log('[Main] Fetching prices via command (dashboard not open)');
				const result = await this.priceService.fetchAndSavePrices();
				if (result.savedCount > 0) {
					new Notice(`✓ Fetched and saved ${result.savedCount} price(s)`);
				} else {
					new Notice('No prices fetched. Check commodity price sources.');
				}
			}
		});

		// Setup automatic price fetching if enabled
		if (this.settings.autoPriceFetch) {
			this.setupAutomaticPriceFetching();
		}


		// Register vault listeners for real-time snippets reloading
		this.registerEvent(
			this.app.vault.on('modify', (file) => {
				if (!this.settings.enableUserSnippets) return;
				const folderName = this.settings.structuredFolderName || 'Finances';
				if (file instanceof TFile && file.path === `${folderName}/snippets.beancount`) {
					void this.loadSnippets();
				}
			})
		);
		this.registerEvent(
			this.app.vault.on('create', (file) => {
				if (!this.settings.enableUserSnippets) return;
				const folderName = this.settings.structuredFolderName || 'Finances';
				if (file instanceof TFile && file.path === `${folderName}/snippets.beancount`) {
					void this.loadSnippets();
				}
			})
		);
		this.registerEvent(
			this.app.vault.on('delete', (file) => {
				if (!this.settings.enableUserSnippets) return;
				const folderName = this.settings.structuredFolderName || 'Finances';
				if (file instanceof TFile && file.path === `${folderName}/snippets.beancount`) {
					this.snippetCompletions = [];
				}
			})
		);
		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => {
				if (!this.settings.enableUserSnippets) return;
				const folderName = this.settings.structuredFolderName || 'Finances';
				const snippetsPath = `${folderName}/snippets.beancount`;
				if (file instanceof TFile) {
					if (file.path === snippetsPath) {
						void this.loadSnippets();
					} else if (oldPath === snippetsPath) {
						this.snippetCompletions = [];
					}
				}
			})
		);

		// Add Command to open snippets file
		this.addCommand({
			id: 'open-beancount-snippets',
			name: 'Open Beancount snippets file',
			callback: async () => {
				const folderName = this.settings.structuredFolderName || 'Finances';
				const snippetsFilePath = `${folderName}/snippets.beancount`;
				const file = this.app.vault.getAbstractFileByPath(snippetsFilePath);
				if (file && file instanceof TFile) {
					await this.app.workspace.getLeaf(true).openFile(file);
				} else {
					// File does not exist yet; loadSnippets() will create it
					await this.loadSnippets();
					const createdFile = this.app.vault.getAbstractFileByPath(snippetsFilePath);
					if (createdFile && createdFile instanceof TFile) {
						await this.app.workspace.getLeaf(true).openFile(createdFile);
					} else {
						new Notice('Could not find or create snippets.beancount');
					}
				}
			}
		});

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
			window.setInterval(() => {
				void (async () => {
					Logger.log('[Main] Running automatic price fetch');
					try {
						const result = await this.priceService.fetchAndSavePrices();

						// Update last fetch timestamp
						this.settings.lastAutoPriceFetch = Date.now();
						await this.saveSettings();

						// Only show notice on errors (don't spam on success)
						if (result.failed.length > 0) {
							const failedSymbols = result.failed.map(f => f.commodity).join(', ');
							new Notice(`⚠ Automatic price fetch: Failed for ${failedSymbols}`);
						}

						Logger.log(`[Main] Automatic price fetch complete: ${result.savedCount} saved, ${result.failed.length} failed`);
					} catch (error) {
						Logger.error('[Main] Automatic price fetch error:', error);
					}
				})();
			}, intervalMs)
		);
	}

	/**
	 * Non-blocking runtime probe to check if bean-query is reachable.
	 * Sets the in-memory `isConnectionReady` flag without persisting it.
	 */
	public async probeConnection(): Promise<void> {
		if (!this.settings.beancountCommand) {
			this.isConnectionReady = false;
			return;
		}
		try {
			const detector = SystemDetector.getInstance();
			let result = await detector.testCommand(
				this.settings.beancountCommand, ['--version'], 3000
			);
			if (!result.success) {
				// bean-query does not support --version, so fallback to --help
				result = await detector.testCommand(
					this.settings.beancountCommand, ['--help'], 3000
				);
			}
			this.isConnectionReady = result.success;
			Logger.log(`[Main] Connection probe: ${result.success ? 'ready' : 'not reachable'}`);
		} catch {
			this.isConnectionReady = false;
			Logger.log('[Main] Connection probe: failed (exception)');
		}
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
			await this.app.workspace.revealLeaf(leaf); // Focus the view
		} else {
			Logger.error(`Could not get leaf for location: ${location}`);
		}
	}

	/**
	 * Public wrapper for running BQL queries (used by views and controllers).
	 * @param {string} query - The BQL query.
	 * @param {BQLFormat} [format='csv'] - Output format (csv, text, html).
	 * @returns {Promise<string>} The raw output in the requested format.
	 */
	public runQuery = (query: string, format: BQLFormat = 'csv'): Promise<string> => {
		return runQuery(this, query, undefined, format);
	}

	// Helper method to get dashboard refresh callback
	public getDashboardRefreshCallback(): () => Promise<void> {
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
		for (const doc of this.getOpenDocuments()) doc.body.removeClass('beancount-hide-help');
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
		const raw = (await this.loadData()) as Record<string, unknown> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, raw);

		// Migration: consolidate legacy `reportingCurrency` / `defaultCurrency` into `operatingCurrency`
		if (!this.settings.operatingCurrency) {
			const legacyReporting = raw?.reportingCurrency;
			const legacyDefault = raw?.defaultCurrency;
			const migrated = (legacyReporting || legacyDefault || DEFAULT_SETTINGS.operatingCurrency) as string;
			this.settings.operatingCurrency = typeof migrated === 'string' ? migrated.toUpperCase() : DEFAULT_SETTINGS.operatingCurrency;
			// Persist migrated value
			await this.saveSettings();
		}

		// Migration: upgrade guard to infer onboarding completion for existing users
		if (raw && !('onboardingCompleted' in raw) && this.settings.structuredFolderName) {
			this.settings.onboardingCompleted = true;
			await this.saveSettings();
		}
	}

	/** Show/hide the "i" help icons on plugin surfaces (see HelpTip.svelte). */
	applyHelpTipVisibility() {
		for (const doc of this.getOpenDocuments()) {
			doc.body.toggleClass('beancount-hide-help', !this.settings.showHelpTips);
		}
	}

	/** Main window document plus any popout windows currently hosting a leaf. */
	private getOpenDocuments(): Set<Document> {
		const docs = new Set<Document>([this.app.workspace.containerEl.ownerDocument]);
		this.app.workspace.iterateAllLeaves((leaf) => {
			docs.add(leaf.view.containerEl.ownerDocument);
		});
		return docs;
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
		window.setTimeout(() => {
			this.bqlProcessor?.refreshAllBlocks();
		}, 50);
	}

	/**
	 * Loads and parses user-defined snippets from snippets.beancount.
	 * If the file doesn't exist, it creates it with basic templates.
	 */
	public async loadSnippets(): Promise<void> {
		if (!this.settings.enableUserSnippets) {
			this.snippetCompletions = [];
			return;
		}

		try {
			const folderName = this.settings.structuredFolderName || 'Finances';
			const snippetsFilePath = `${folderName}/snippets.beancount`;
			const adapter = this.app.vault.adapter;

			const exists = await adapter.exists(snippetsFilePath);
			if (!exists) {
				const initialContent = `;; User-Defined Transaction Snippets
;;
;; Define transactions here with the metadata "Snippet: <name>".
;; These will be suggested when you start typing at the beginning of a line.
;;
;; Example:
2026-01-01 * "Sample Payee" "Sample Narration"
  Snippet: "sampleSnippet"
  Assets:Checking      -150.00 USD
  Expenses:Rent
`;
				// Ensure folder exists before creating the file
				const folderExists = await adapter.exists(folderName);
				if (!folderExists) {
					await this.app.vault.createFolder(folderName);
				}
				await this.app.vault.create(snippetsFilePath, initialContent);
				this.snippetCompletions = [];
				Logger.log('[Main] Created snippets.beancount with initial templates.');
				return;
			}

			const content = await adapter.read(snippetsFilePath);
			this.snippetCompletions = parseSnippetsFile(content);
			Logger.log(`[Main] Loaded ${this.snippetCompletions.length} user snippet(s).`);
		} catch (error) {
			Logger.error('[Main] Failed to load snippets:', error);
			this.snippetCompletions = [];
		}
	}
}
