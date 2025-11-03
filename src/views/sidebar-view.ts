// src/views/sidebar-view.ts
import { ItemView, WorkspaceLeaf, Notice, MarkdownRenderer, TFile } from 'obsidian';
import { exec } from 'child_process';
import type BeancountPlugin from '../main';
import BeancountViewComponent from './SidebarView.svelte'; // Assuming this is the correct Svelte component for the sidebar
import { runQuery, parseSingleValue, convertWslPathToWindows, extractConvertedAmount } from '../utils/index';
import * as queries from '../queries/index';
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
		fileStatusMessage: "" as string | null
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
		const reportingCurrency = this.plugin.settings.reportingCurrency;
        if (!reportingCurrency) {
            this.updateProps({ kpiError: "Reporting Currency is not set in settings.", isLoading: false });
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
			const netWorthNum = assetsNum - liabilitiesNum;

			this.updateProps({
				assets, 
				liabilities, 
				netWorth: `${netWorthNum.toFixed(2)} ${reportingCurrency}`,
				hasUnconvertedCommodities,
				kpiError: null, 
				fileStatus: checkResult.status, 
				fileStatusMessage: checkResult.message
			});

		} catch (error) {
			console.error("Error updating snapshot view:", error);
			this.updateProps({ 
				kpiError: error.message, 
				hasUnconvertedCommodities: false,
				fileStatus: "error", 
				fileStatusMessage: "Failed during refresh." 
			});
		} finally {
			if(this.state.isLoading) this.updateProps({ isLoading: false });
		}
	}

	// --- Runs bean-check ---
	async runBeanCheck(): Promise<{ status: "ok" | "error"; message: string | null }> {
		const filePath = this.plugin.settings.beancountFilePath;
		let commandBase = this.plugin.settings.beancountCommand;
		if (!filePath) return { status: "error", message: "File path not set." };
		if (!commandBase) return { status: "error", message: "Command not set." };

		// --- Use imported query function ---
		const command = queries.getBeanCheckCommand(filePath, commandBase);

		// console.log("Running bean-check:", command);
		return new Promise((resolve) => {
			// --- Need exec import from child_process ---
			exec(command, (error, stdout, stderr) => {
				if (error || stdout || stderr) {
					const errorMessage = stdout || stderr || (error ? error.message : "Unknown check error.");
					// console.error("bean-check failed:", errorMessage); 
					resolve({ status: "error", message: errorMessage });
				} else {
					// console.log("bean-check successful"); 
					resolve({ status: "ok", message: "File OK" });
				}
			});
			// ------------------------------------------
		});
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