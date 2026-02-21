// src/views/sidebar-view.ts
import { ItemView, WorkspaceLeaf, Notice, MarkdownRenderer, TFile } from 'obsidian';
import { exec } from 'child_process';
import type { ExecException } from 'child_process';
import type BeancountPlugin from '../../../main';
import BeancountViewComponent from './SidebarView.svelte'; // Assuming this is the correct Svelte component for the sidebar
import { runQuery, parseSingleValue, convertWslPathToWindows, extractConvertedAmount } from '../../../utils/index';
import * as queries from '../../../queries/index';
import { parse as parseCsv } from 'csv-parse/sync';
import { Logger } from '../../../utils/logger';
// ----------------------------------------

export const BEANCOUNT_VIEW_TYPE = "beancount-view"; // This identifies the Sidebar/Snapshot view

export class BeancountView extends ItemView {
	plugin: BeancountPlugin;
	private component: BeancountViewComponent;

	// State managed by this view
	private state = {
		isLoading: true,
		assets: "0 USD",
		liabilities: "0 USD",
		netWorth: "0.00 USD",
		hasUnconvertedCommodities: false,
		kpiError: null as string | null,
		fileStatus: "checking" as "checking" | "ok" | "error",
		fileStatusMessage: "" as string | null,
		errorCount: 0,
		errorList: [] as string[]
	};

	constructor(leaf: WorkspaceLeaf, plugin: BeancountPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() { return BEANCOUNT_VIEW_TYPE; }
	getDisplayText() { return "Beancount Snapshot"; } // Updated display text
	getIcon() { return "landmark"; }

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();

		this.component = new BeancountViewComponent({
			target: container,
			props: this.state
		});

		// Listen for events
		this.component.$on('refresh', () => this.updateView());

		setTimeout(() => this.updateView(), 0);
	}

	async onClose() {
		if (this.component) {
			this.component.$destroy();
		}
	}

	private updateProps(newState: Partial<typeof this.state>) {
		Logger.log('[updateProps] Updating state with:', newState);
		this.state = { ...this.state, ...newState };
		Logger.log('[updateProps] New state:', this.state);
		if (this.component) {
			this.component.$set(this.state);
			Logger.log('[updateProps] Component updated with new state');
		} else {
			Logger.log('[updateProps] Warning: Component not initialized yet');
		}
	}

	// --- Main data update function ---
	async updateView() {
		this.updateProps({ isLoading: true, kpiError: null, fileStatus: "checking", fileStatusMessage: null });
		new Notice('Refreshing snapshot...');
		const reportingCurrency = this.plugin.settings.operatingCurrency;
		if (!reportingCurrency) {
			this.updateProps({ kpiError: "Operating currency is not set in settings.", isLoading: false });
			return;
		}
		try {
			// Run KPI queries and bean check concurrently
			const [
				kpiResults,
				checkResult
			] = await Promise.all([
				Promise.all([
					// --- Use imported runQuery and query functions ---
					runQuery(this.plugin, queries.getTotalAssetsCostQuery(reportingCurrency)),
					runQuery(this.plugin, queries.getTotalLiabilitiesCostQuery(reportingCurrency))
				]),
				this.runBeanCheck()
			]);

			const [assetsResult, liabilitiesResult] = kpiResults;
			
			// Check if results contain multiple currencies (indicates missing price data)
			const hasMultiCurrencyAssets = assetsResult.includes(',');
			const hasMultiCurrencyLiabilities = liabilitiesResult.includes(',');
			const hasUnconvertedCommodities = hasMultiCurrencyAssets || hasMultiCurrencyLiabilities;
			
			// Extract reporting currency amounts from potentially multi-currency results
			const assets = extractConvertedAmount(assetsResult, reportingCurrency);
			const liabilities = extractConvertedAmount(liabilitiesResult, reportingCurrency);
			
			// Calculate net worth: assets - liabilities
			const assetsNum = parseFloat(assets.split(" ")[0]) || 0;
			const liabilitiesNum = parseFloat(liabilities.split(" ")[0]) || 0;
			// Present liabilities as a positive magnitude in the UI. Beancount
			// often represents liabilities as negative numbers; showing the
			// absolute value improves readability for users.
			const liabilitiesDisplay = `${Math.abs(liabilitiesNum).toFixed(2)} ${reportingCurrency}`;

			// For net worth calculation we want: NetWorth = Assets - Liabilities
			// Liabilities from Beancount may be negative (normal) or positive
			// (e.g. overpaid credit card). Using multiplication by -1 preserves
			// the sign semantics: liabilitiesEffective = liabilitiesNum * -1.
			// Example: liabilitiesNum = -200 -> liabilitiesEffective = 200
			//          liabilitiesNum = 50   -> liabilitiesEffective = -50
			const liabilitiesEffective = liabilitiesNum * -1;
			const netWorthNum = assetsNum - liabilitiesEffective;

			Logger.log('[refreshData] Check result from runBeanCheck:', checkResult);
			Logger.log('[refreshData] Error count:', checkResult.errorCount);
			Logger.log('[refreshData] Error list:', checkResult.errorList);

			this.updateProps({
				assets,
				liabilities: liabilitiesDisplay,
				netWorth: `${netWorthNum.toFixed(2)} ${reportingCurrency}`,
				hasUnconvertedCommodities,
				kpiError: null, 
				fileStatus: checkResult.status, 
				fileStatusMessage: checkResult.message,
				errorCount: checkResult.errorCount,
				errorList: checkResult.errorList
			});

		} catch (error) {
			console.error("Error updating snapshot view:", error);
			this.updateProps({ 
				kpiError: error.message, 
				hasUnconvertedCommodities: false,
				fileStatus: "error", 
				fileStatusMessage: "Failed during refresh.",
				errorCount: 0,
				errorList: []
			});
		} finally {
			if(this.state.isLoading) this.updateProps({ isLoading: false });
		}
	}

	// --- Runs bean-check (using ERRORS query) ---
	async runBeanCheck(): Promise<{ status: "ok" | "error"; message: string | null; errorCount: number; errorList: string[] }> {
		const filePath = this.plugin.settings.beancountFilePath;
		let commandBase = this.plugin.settings.beancountCommand;
		Logger.log('[runBeanCheck] Starting validation check');
		Logger.log('[runBeanCheck] File path:', filePath);
		Logger.log('[runBeanCheck] Command base:', commandBase);
		
		if (!filePath) return { status: "error", message: "File path not set.", errorCount: 0, errorList: [] };
		if (!commandBase) return { status: "error", message: "Command not set.", errorCount: 0, errorList: [] };

		// Convert Windows path to WSL path if using WSL
		let checkFilePath = filePath;
		if (commandBase.includes('wsl')) {
			// Convert Windows path to WSL format
			const match = filePath.match(/^([a-zA-Z]):\\/);
			if (match) {
				const driveLetter = match[1].toLowerCase();
				checkFilePath = filePath.replace(/^[a-zA-Z]:\\/, `/mnt/${driveLetter}/`).replace(/\\/g, '/');
			}
		}

		// --- Use imported query function (uses ERRORS query) ---
		const command = queries.getBeanCheckCommand(checkFilePath, commandBase);
		Logger.log('[runBeanCheck] Executing command:', command);

		return new Promise((resolve) => {
			exec(command, (error: ExecException | null, stdout: string, stderr: string) => {
				Logger.log('[runBeanCheck] Command completed');
				Logger.log('[runBeanCheck] Error object:', error ? error.message : 'null');
				Logger.log('[runBeanCheck] Stdout length:', stdout?.length || 0);
				Logger.log('[runBeanCheck] Stderr length:', stderr?.length || 0);
				Logger.log('[runBeanCheck] Stdout content:', stdout);
				Logger.log('[runBeanCheck] Stderr content:', stderr);
				
				// Check for command execution errors (not validation errors)
				if (error && stderr && !stdout) {
					// Command failed to execute
					Logger.log('[runBeanCheck] Command execution failed');
					resolve({ 
						status: "error", 
						message: `Failed to run validation: ${stderr}`,
						errorCount: 0,
						errorList: []
					});
					return;
				}

				// Parse formatted output from ERRORS query
				if (stdout && stdout.trim()) {
					Logger.log('[runBeanCheck] Parsing stdout output');
					// Parse error lines from formatted output
					const errorLines = this.parseErrorsFromFormattedOutput(stdout);
					Logger.log('[runBeanCheck] Parsed error lines count:', errorLines.length);
					Logger.log('[runBeanCheck] Parsed error lines:', errorLines);
					
					if (errorLines.length > 0) {
						const result = { 
							status: "error" as const, 
							message: `Found ${errorLines.length} validation error(s)`,
							errorCount: errorLines.length,
							errorList: errorLines
						};
						Logger.log('[runBeanCheck] Returning error result:', result);
						resolve(result);
					} else {
						// Output had no parseable errors
						Logger.log('[runBeanCheck] No parseable errors found in output');
						resolve({ 
							status: "ok", 
							message: "File OK",
							errorCount: 0,
							errorList: []
						});
					}
				} else {
					// No output means no errors
					Logger.log('[runBeanCheck] No stdout output, assuming OK');
					resolve({ 
						status: "ok", 
						message: "File OK",
						errorCount: 0,
						errorList: []
					});
				}
			});
		});
	}

	// --- Parse ERRORS query formatted output ---
	private parseErrorsFromFormattedOutput(output: string): string[] {
		Logger.log('[parseErrorsFromFormattedOutput] Starting parse');
		Logger.log('[parseErrorsFromFormattedOutput] Output length:', output?.length || 0);
		Logger.log('[parseErrorsFromFormattedOutput] First 500 chars:', output?.substring(0, 500));
		
		if (!output || !output.trim()) {
			Logger.log('[parseErrorsFromFormattedOutput] Empty output, returning empty array');
			return [];
		}
		
		const lines = output.split('\n');
		Logger.log('[parseErrorsFromFormattedOutput] Total lines:', lines.length);
		const errorLines: string[] = [];
		
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const trimmed = line.trim();
			Logger.log(`[parseErrorsFromFormattedOutput] Line ${i}:`, trimmed);
			
			// Match error lines that follow the pattern: filename:line: Error message
			// Use .+ instead of [^:]+ to handle Windows paths with colons (e.g., C:\path\file.beancount:34: Error)
			const regex = /.+:\d+:\s+.+/;
			const matches = trimmed && trimmed.match(regex);
			Logger.log(`[parseErrorsFromFormattedOutput] Line ${i} matches regex:`, !!matches);
			
			if (trimmed && matches) {
				// Extract just the filename without full path for cleaner display
				// Match filepath (including Windows C:\ paths), line number, and message
				const match = trimmed.match(/(.+):(\d+):\s+(.+)/);
				Logger.log(`[parseErrorsFromFormattedOutput] Line ${i} detail match:`, match ? 'YES' : 'NO');
				
				if (match) {
					const filePath = match[1];
					const lineNum = match[2];
					const message = match[3];
					
					// Get just the filename
					const fileName = filePath.split(/[/\\]/).pop() || filePath;
					const errorMsg = `${fileName}:${lineNum}: ${message}`;
					Logger.log(`[parseErrorsFromFormattedOutput] Adding error:`, errorMsg);
					errorLines.push(errorMsg);
				} else {
					// Fallback: use the line as-is
					Logger.log(`[parseErrorsFromFormattedOutput] Using line as-is:`, trimmed);
					errorLines.push(trimmed);
				}
			}
		}
		
		Logger.log('[parseErrorsFromFormattedOutput] Total parsed errors:', errorLines.length);
		Logger.log('[parseErrorsFromFormattedOutput] Error lines:', errorLines);
		return errorLines;
	}
}


// -------------------------