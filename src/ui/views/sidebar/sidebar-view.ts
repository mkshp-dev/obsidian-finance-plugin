// src/views/sidebar-view.ts
import { ItemView, WorkspaceLeaf, Notice, MarkdownRenderer, TFile } from 'obsidian';
import { exec } from 'child_process';
import type { ExecException } from 'child_process';
import type BeancountPlugin from '../../../main';
import BeancountViewComponent from './SidebarView.svelte'; // Assuming this is the correct Svelte component for the sidebar
import { runQuery, parseSingleValue, convertWslPathToWindows, extractConvertedAmount } from '../../../utils/index';
import * as queries from '../../../queries/index';
import { parse as parseCsv } from 'csv-parse/sync';
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
		this.component.$on('editFile', () => this.openLedgerFile());

		setTimeout(() => this.updateView(), 0);
	}

	async onClose() {
		if (this.component) {
			this.component.$destroy();
		}
	}

	private updateProps(newState: Partial<typeof this.state>) {
		this.state = { ...this.state, ...newState };
		if (this.component) {
			this.component.$set(this.state);
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

	// --- Runs bean-check ---
	async runBeanCheck(): Promise<{ status: "ok" | "error"; message: string | null; errorCount: number; errorList: string[] }> {
		const filePath = this.plugin.settings.beancountFilePath;
		let commandBase = this.plugin.settings.beancountCommand;
		if (!filePath) return { status: "error", message: "File path not set.", errorCount: 0, errorList: [] };
		if (!commandBase) return { status: "error", message: "Command not set.", errorCount: 0, errorList: [] };

		// --- Use imported query function ---
		const command = queries.getBeanCheckCommand(filePath, commandBase);

		return new Promise((resolve) => {
			// --- Need exec import from child_process ---
			exec(command, (error: ExecException | null, stdout: string, stderr: string) => {
				if (error || stdout || stderr) {
					const errorMessage = stdout || stderr || (error ? error.message : "Unknown check error.");
					
					// Parse error lines to extract individual errors
					const errorLines = this.parseErrorLines(errorMessage);
					const errorCount = errorLines.length;
					
					resolve({ 
						status: "error", 
						message: errorMessage,
						errorCount,
						errorList: errorLines
					});
				} else {
					resolve({ 
						status: "ok", 
						message: "File OK",
						errorCount: 0,
						errorList: []
					});
				}
			});
			// ------------------------------------------
		});
	}

	// --- Parse bean-check output to extract individual error lines ---
	private parseErrorLines(output: string): string[] {
		if (!output) return [];
		
		// Split by lines and filter for error patterns
		const lines = output.split('\n');
		const errorLines: string[] = [];
		
		for (const line of lines) {
			const trimmed = line.trim();
			// Match error lines that follow the pattern: filename:line: Error message
			if (trimmed && trimmed.match(/^[^:]+:\d+:\s/)) {
				errorLines.push(trimmed);
			}
		}
		
		return errorLines;
	}

	// --- Opens the ledger file ---
	async openLedgerFile() {
		const absoluteFilePath = this.plugin.settings.beancountFilePath;
		if (!absoluteFilePath) { new Notice("File path not set."); return; }
		const commandName = this.plugin.settings.beancountCommand;
		let osSpecificPath = absoluteFilePath;
		if (commandName.startsWith('wsl')) {
			// --- Use imported path converter ---
			osSpecificPath = convertWslPathToWindows(absoluteFilePath);
		}
		const normalizedOsPath = osSpecificPath.replace(/\\/g, '/');
		// @ts-ignore
		const vaultPath = this.app.vault.adapter.getBasePath().replace(/\\/g, '/');
		if (normalizedOsPath.startsWith(vaultPath)) {
			const relativePath = normalizedOsPath.substring(vaultPath.length).replace(/^\//, '');
			const file = this.app.vault.getAbstractFileByPath(relativePath);
			if (file && file instanceof TFile) {
				const leaf = this.app.workspace.getLeaf(true); await leaf.openFile(file);
			} else {
				console.warn("File in vault path not found by API:", relativePath);
				const vaultName = this.app.vault.getName();
				const fileUri = `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(relativePath)}`;
				this.app.workspace.openLinkText(fileUri, '/', false);
			}
		} else {
			console.warn("Ledger file outside vault:", osSpecificPath);
			await navigator.clipboard.writeText(osSpecificPath);
			new Notice(`Ledger file outside vault. Path copied:\n${osSpecificPath}`);
		}
	}
}


// -------------------------