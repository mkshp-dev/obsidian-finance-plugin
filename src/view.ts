// src/view.ts

import { ItemView, WorkspaceLeaf, Notice, MarkdownRenderer, TFile } from 'obsidian';
import BeancountPlugin from './main';
import BeancountViewComponent from './BeancountView.svelte';
import { exec } from 'child_process';
import { parse } from 'csv-parse/sync';
import * as path from 'path';

export const BEANCOUNT_VIEW_TYPE = "beancount-view";

export class BeancountView extends ItemView {
	plugin: BeancountPlugin;
	private component: BeancountViewComponent;

	// --- STATE HAS BEEN UPDATED ---
	private state = {
		isLoading: true,
		assets: "0 USD",
		liabilities: "0 USD",
		netWorth: "0.00 USD",
		kpiError: null as string | null,
		reportError: null as string | null,
		reportHeaders: [] as string[],
		reportRows: [] as string[][],
		fileStatus: "checking" as "checking" | "ok" | "error", // <-- ADD THIS
		fileStatusMessage: "" as string | null                  // <-- ADD THIS
	};
	// ------------------------------

	constructor(leaf: WorkspaceLeaf, plugin: BeancountPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() { return BEANCOUNT_VIEW_TYPE; }
	getDisplayText() { return "Beancount"; }
	getIcon() { return "landmark"; }

// src/view.ts -> onOpen()

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

		// --- NEW: Listen for the editFile event ---
		this.component.$on('editFile', () => this.openLedgerFile());
		// ----------------------------------------

		setTimeout(() => this.updateView(), 0);
	}

// src/view.ts -> Replace this method

// src/view.ts -> Replace this method

	async openLedgerFile() {
		const absoluteFilePath = this.plugin.settings.beancountFilePath;
		if (!absoluteFilePath) {
			new Notice("Beancount file path not set in settings.");
			return;
		}

		// --- Determine the OS-specific path ---
		const commandName = this.plugin.settings.beancountCommand;
		let osSpecificPath = absoluteFilePath; // Assume non-WSL first
		if (commandName.startsWith('wsl')) {
			osSpecificPath = this.plugin.convertWslPathToWindows(absoluteFilePath);
		}
		// Use forward slashes for comparisons and Obsidian path functions
		const normalizedOsPath = osSpecificPath.replace(/\\/g, '/');
		// ------------------------------------

		// --- Get Vault Path ---
		// @ts-ignore - Using internal adapter property
		const vaultPath = this.app.vault.adapter.getBasePath().replace(/\\/g, '/');
		// ----------------------

		// --- Check if file is INSIDE the vault path ---
		if (normalizedOsPath.startsWith(vaultPath)) {
			// Calculate the path relative to the vault root
			const relativePath = normalizedOsPath.substring(vaultPath.length).replace(/^\//, ''); // Remove leading slash if present

			const file = this.app.vault.getAbstractFileByPath(relativePath);

			if (file && file instanceof TFile) {
				// --- File found by relative path ---
				const leaf = this.app.workspace.getLeaf(true);
				await leaf.openFile(file);
			} else {
				// --- File is inside vault path, but maybe not indexed ---
				console.warn("File seems to be in vault path but wasn't found by Obsidian API. Trying direct URI:", relativePath);
				// Construct an obsidian:// URI
				const vaultName = this.app.vault.getName();
				const fileUri = `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(relativePath)}`;
				// Use openLinkText to ask Obsidian to open its own URI
				this.app.workspace.openLinkText(fileUri, '/', false);
			}
		} else {
			// --- File is OUTSIDE the vault ---
			console.warn("Ledger file is outside the vault:", osSpecificPath);
			await navigator.clipboard.writeText(osSpecificPath);
			new Notice(`Ledger file appears to be outside the vault. Path copied to clipboard:\n${osSpecificPath}`);
		}
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

// src/view.ts -> Replace this method

	async updateView() {
		// Set initial loading/checking state
		this.updateProps({ isLoading: true, kpiError: null, reportError: null, fileStatus: "checking", fileStatusMessage: null, reportHeaders: [], reportRows: [] });
		new Notice('Refreshing financial data...');

		try {
			// Define queries
			const assetsQuery = `SELECT sum(position) WHERE account ~ '^Assets'`;
			const liabilitiesQuery = `SELECT sum(position) WHERE account ~ '^Liabilities'`;

			// Run KPI queries, the default report render, AND the bean check concurrently
			const [
				kpiResults,    // Array from Promise.all for KPIs
				_reportResult, // We don't need the report result directly
				checkResult    // Result object from runBeanCheck
			] = await Promise.all([
				Promise.all([this.runQuery(assetsQuery), this.runQuery(liabilitiesQuery)]),
				this.renderReport('assets'), // This updates its own props now
				this.runBeanCheck()          // This returns the check result
			]);

			// Destructure KPI results
			const [assetsResult, liabilitiesResult] = kpiResults;

			// Process KPIs
			const assets = this.parseSingleValue(assetsResult) || "0 USD";
			const liabilities = this.parseSingleValue(liabilitiesResult) || "0 USD";
			const netWorthNum = parseFloat(assets.split(" ")[0]) - parseFloat(liabilities.split(" ")[0]);
			const currency = assets.split(" ")[1] || "USD";

			// Update props with KPI results AND the bean-check result
			this.updateProps({
				assets,
				liabilities,
				netWorth: `${netWorthNum.toFixed(2)} ${currency}`,
				kpiError: null,
				fileStatus: checkResult.status,
				fileStatusMessage: checkResult.message
			});

		} catch (error) { // Catch errors primarily from runQuery
			console.error("Error updating view:", error);
			// If anything fails, show errors and set fileStatus to error too
			this.updateProps({ kpiError: error.message, reportHeaders: [], reportRows: [], fileStatus: "error", fileStatusMessage: "Failed during refresh." });
		} finally {
			// Only update isLoading in the finally block
			this.updateProps({ isLoading: false });
		}
	}

	async renderReport(reportType: 'assets' | 'liabilities' | 'equity' | 'income' | 'expenses') {
		this.updateProps({ isLoading: true, reportError: null, reportHeaders: [], reportRows: [] });
		let query = '';
		
		switch (reportType) {
			case 'assets': query = `SELECT account, sum(position) WHERE account ~ '^Assets' GROUP BY account`; break;
			case 'liabilities': query = `SELECT account, sum(position) WHERE account ~ '^Liabilities' GROUP BY account`; break;
			case 'equity': query = `SELECT account, sum(position) WHERE account ~ '^Equity' GROUP BY account`; break;
			case 'income': query = `SELECT account, sum(position) WHERE account ~ '^Income' GROUP BY account`; break;
			case 'expenses': query = `SELECT account, sum(position) WHERE account ~ '^Expenses' GROUP BY account`; break;
		}

		try {
			const result = await this.runQuery(query);
			const cleanStdout = result.replace(/\r/g, "").trim();
			const records: string[][] = parse(cleanStdout, { columns: false, skip_empty_lines: true });

			if (records.length === 0) {
				this.updateProps({ reportHeaders: [], reportRows: [] });
				return;
			}
			
			// --- THIS IS THE CHANGED LOGIC ---
			const firstRowIsHeader = records[0][1].includes('sum(position)'); 
			
			// We set our desired headers regardless of the input.
			const headers = ['Account', 'Amount']; 
			let rows: string[][] = [];

			if (firstRowIsHeader) {
				// If the CSV has a header, we skip it.
				rows = records.slice(1);
			} else {
				// If no header, all records are data.
				rows = records;
			}
			// -------------------------------

			const formattedRows = rows.map(row => {
				if (row.length === 0) return row;
				const accountName = row[0];
				const lastColonIndex = accountName.lastIndexOf(':');
				const trimmedName = lastColonIndex > -1
					? accountName.substring(lastColonIndex + 1)
					: accountName;
				
				return [trimmedName, ...row.slice(1)];
			});

			this.updateProps({
				reportHeaders: headers, // Pass our clean headers
				reportRows: formattedRows,
				reportError: null
			});
			
		} catch (error) {
			console.error(`Error rendering ${reportType} report:`, error);
			this.updateProps({ reportError: error.message, reportHeaders: [], reportRows: [] });
		} finally {
			this.updateProps({ isLoading: false });
		}
	}
// -------------------------------
// src/view.ts -> Add this new method
// src/view.ts -> Replace this method
// src/view.ts -> Replace this method

	// Now returns the status result
	async runBeanCheck(): Promise<{ status: "ok" | "error"; message: string | null }> {
		const filePath = this.plugin.settings.beancountFilePath;
		let commandName = this.plugin.settings.beancountCommand;

		if (!filePath) return { status: "error", message: "File path not set." };
		if (!commandName) return { status: "error", message: "Command not set." };

		commandName = commandName.replace(/bean-query(.exe)?$/, 'bean-check$1');
		const command = `${commandName} "${filePath}"`;

		return new Promise((resolve) => {
			exec(command, (error, stdout, stderr) => {
				if (error || stdout) {
					const errorMessage = error ? error.message : stdout;
					resolve({ status: "error", message: errorMessage });
				} else {
					resolve({ status: "ok", message: "File OK" });
				}
			});
		});
	}
	runQuery(query: string): Promise<string> {
		return new Promise((resolve, reject) => {
			const filePath = this.plugin.settings.beancountFilePath;
			const commandName = this.plugin.settings.beancountCommand;

			if (!filePath) return reject(new Error('Beancount file path is not set.'));
			if (!commandName) return reject(new Error('Beancount command is not set.'));

			const command = `${commandName} -f csv "${filePath}" "${query}"`;
			exec(command, (error, stdout, stderr) => {
				if (error) return reject(error);
				if (stderr) return reject(new Error(stderr));
				resolve(stdout);
			});
		});
	}

	parseSingleValue(csv: string): string | null {
		try {
			const records = parse(csv, { columns: false, skip_empty_lines: true });
			if (records.length > 1 && records[1].length > 0) {
				return records[1][0].trim();
			}
			return null;
		} catch (e) {
			return null;
		}
	}
}