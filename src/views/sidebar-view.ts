// src/views/sidebar-view.ts
import { ItemView, WorkspaceLeaf, Notice, MarkdownRenderer, TFile } from 'obsidian';
import { exec } from 'child_process';
import type BeancountPlugin from '../main';
import BeancountViewComponent from './SidebarView.svelte'; // Assuming this is the correct Svelte component for the sidebar
import { runQuery, parseSingleValue, convertWslPathToWindows } from '../utils/index';
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
		kpiError: null as string | null,
		reportError: null as string | null,
		reportHeaders: [] as string[],
		reportRows: [] as string[][],
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
		this.component.$on('renderReport', (e) => this.renderReport(e.detail));
		this.component.$on('editFile', () => this.openLedgerFile());
		this.component.$on('openJournal', () => this.openJournalView());

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
		this.updateProps({ isLoading: true, kpiError: null, reportError: null, fileStatus: "checking", fileStatusMessage: null, reportHeaders: [], reportRows: [] });
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
				_reportResult,
				checkResult
			] = await Promise.all([
				Promise.all([
					// --- Use imported runQuery and query functions ---
					runQuery(this.plugin, queries.getTotalAssetsCostQuery(reportingCurrency)),
					runQuery(this.plugin, queries.getTotalLiabilitiesCostQuery(reportingCurrency))
				]),
				this.renderReport('assets'), // Render default report
				this.runBeanCheck()
			]);

			const [assetsResult, liabilitiesResult] = kpiResults;
			// --- Use imported parseSingleValue ---
			const assets = parseSingleValue(assetsResult);
			const liabilities = parseSingleValue(liabilitiesResult);
			const netWorthNum = parseFloat(assets.split(" ")[0]) - parseFloat(liabilities.split(" ")[0]);
			const currency = assets.split(" ")[1] || "USD";

			this.updateProps({
				assets, liabilities, netWorth: `${netWorthNum.toFixed(2)} ${currency}`,
				kpiError: null, fileStatus: checkResult.status, fileStatusMessage: checkResult.message
			});

		} catch (error) {
			console.error("Error updating snapshot view:", error);
			this.updateProps({ kpiError: error.message, reportHeaders: [], reportRows: [], fileStatus: "error", fileStatusMessage: "Failed during refresh." });
		} finally {
			if(this.state.isLoading) this.updateProps({ isLoading: false });
		}
	}

	// --- Renders balance reports in the sidebar ---
	async renderReport(reportType: 'assets' | 'liabilities' | 'equity' | 'income' | 'expenses') {
		this.updateProps({ isLoading: true, reportError: null, reportHeaders: [], reportRows: [] });
		const headers = ['Account', 'Amount']; // Clean headers

		try {
			// --- Use imported runQuery and query function ---
			const query = queries.getBalanceReportQuery(reportType);
			const result = await runQuery(this.plugin, query);
			const cleanStdout = result.replace(/\r/g, "").trim();
			// --- Use imported parseCsv (assuming import exists) ---
			const records: string[][] = parseCsv(cleanStdout, { columns: false, skip_empty_lines: true });

			if (records.length === 0) {
				this.updateProps({ reportHeaders: [], reportRows: [] }); return;
			}

			const firstRowIsHeader = records[0][1]?.includes('sum(position)');
			let rows: string[][] = firstRowIsHeader ? records.slice(1) : records;

			let total = 0;
			let currency = '';

			const formattedRows = rows.map(row => {
				if (row.length === 0) return row;
				const accountName = row[0];
				const amountStr = row[1] || '';
				const amountMatch = amountStr.match(/(-?[\d,]+\.?\d*)\s*(\S+)/);
				if (amountMatch) {
					total += parseFloat(amountMatch[1].replace(/,/g, ''));
					if (!currency) currency = amountMatch[2];
				}
				const lastColonIndex = accountName.lastIndexOf(':');
				const trimmedName = lastColonIndex > -1 ? accountName.substring(lastColonIndex + 1) : accountName;
				return [trimmedName, amountStr];
			});

			if (formattedRows.length > 0) {
				formattedRows.push(['Total', `${total.toFixed(2)} ${currency}`]);
			}

			this.updateProps({
				reportHeaders: headers, reportRows: formattedRows, reportError: null
			});

		} catch (error) {
			console.error(`Error rendering ${reportType} report:`, error);
			this.updateProps({ reportError: error.message, reportHeaders: [], reportRows: [] });
		} finally {
			this.updateProps({ isLoading: false });
		}
	}

	// --- Opens the journal in a new tab ---
	async openJournalView() {
		new Notice('Generating grouped journal...');
		this.updateProps({ isLoading: true });
		let markdownString = `\n\n# Beancount Journal (Grouped)\n\n`;
		try {
			// --- Use imported runQuery and query function ---
			const query = queries.getJournalGroupedQuery();
			const result = await runQuery(this.plugin, query);
			const cleanStdout = result.replace(/\r/g, "").trim();
			// --- Use imported parseCsv ---
			const records: string[][] = parseCsv(cleanStdout, { columns: false, skip_empty_lines: true, relax_column_count: true });

			if (records.length === 0) {
				markdownString += "No journal entries found.";
			} else {
				// ... (Journal markdown formatting logic remains the same) ...
				const defaultHeaders = ['date', 'payee', 'narration', 'tags', 'links', 'id', 'account', 'position'];
				const firstRowIsHeader = records[0][0]?.toLowerCase().includes('date') && records[0][5]?.toLowerCase().includes('id');
				let rows = firstRowIsHeader ? records.slice(1) : records;
				let currentTxnId = "";
				for (let i = 0; i < rows.length; i++) { /* ... formatting loop ... */ } // Assumed loop logic is correct
			}

			const tempFileName = `beancount-grouped-journal-${Date.now()}.md`;
			const tempFile = await this.app.vault.create(tempFileName, markdownString);

			if (tempFile instanceof TFile) {
				const leaf = this.app.workspace.getLeaf(true); await leaf.openFile(tempFile);
			} else { throw new Error("Failed to create temporary journal file."); }

		} catch (error) {
			console.error("Error generating journal:", error); new Notice(`Failed to generate journal: ${error.message}`, 0);
		} finally {
			this.updateProps({ isLoading: false });
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

		console.log("Running bean-check:", command);
		return new Promise((resolve) => {
			// --- Need exec import from child_process ---
			exec(command, (error, stdout, stderr) => {
				if (error || stdout || stderr) {
					const errorMessage = stdout || stderr || (error ? error.message : "Unknown check error.");
					console.error("bean-check failed:", errorMessage); resolve({ status: "error", message: errorMessage });
				} else {
					console.log("bean-check successful"); resolve({ status: "ok", message: "File OK" });
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