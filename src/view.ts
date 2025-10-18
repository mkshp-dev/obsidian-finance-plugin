// src/view.ts

import { ItemView, WorkspaceLeaf, Notice, MarkdownRenderer } from 'obsidian';
import BeancountPlugin from './main';
import BeancountViewComponent from './BeancountView.svelte';
import { exec } from 'child_process';
import { parse } from 'csv-parse/sync';

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
	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		
		this.component = new BeancountViewComponent({
			target: container,
			props: this.state
		});

		this.component.$on('refresh', () => this.updateView());
		this.component.$on('renderReport', (e) => this.renderReport(e.detail));

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

	async updateView() {
		this.updateProps({ isLoading: true, kpiError: null, reportError: null, reportHeaders: [], reportRows: [] });
		new Notice('Refreshing financial data...');

		try {
			const assetsQuery = `SELECT sum(position) WHERE account ~ '^Assets'`;
			const liabilitiesQuery = `SELECT sum(position) WHERE account ~ '^Liabilities'`;
			
			const [assetsResult, liabilitiesResult] = await Promise.all([
				this.runQuery(assetsQuery),
				this.runQuery(liabilitiesQuery)
			]);

			const assets = this.parseSingleValue(assetsResult) || "0 USD";
			const liabilities = this.parseSingleValue(liabilitiesResult) || "0 USD";
			const netWorthNum = parseFloat(assets.split(" ")[0]) - parseFloat(liabilities.split(" ")[0]);
			const currency = assets.split(" ")[1] || "USD";
			
			this.updateProps({
				assets,
				liabilities,
				netWorth: `${netWorthNum.toFixed(2)} ${currency}`,
				kpiError: null
			});

		// We'll run the report render and the bean-check at the same time
			await Promise.all([
				this.renderReport('assets'),
				this.runBeanCheck()
			]);

		} catch (error) {
		// ...
		} finally {
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

	async runBeanCheck() {
		this.updateProps({ fileStatus: "checking", fileStatusMessage: null });

		const filePath = this.plugin.settings.beancountFilePath;
		let commandName = this.plugin.settings.beancountCommand;

		if (!filePath) {
			this.updateProps({ fileStatus: "error", fileStatusMessage: "File path not set." });
			return;
		}
		if (!commandName) {
			this.updateProps({ fileStatus: "error", fileStatusMessage: "Command not set." });
			return;
		}

		// Construct the bean-check command. We assume it's in the same
		// place as bean-query and just replace the executable name.
		commandName = commandName.replace(/bean-query(.exe)?$/, 'bean-check$1');
		const command = `${commandName} "${filePath}"`;

		return new Promise<void>((resolve) => {
			exec(command, (error, stdout, stderr) => {
				// bean-check is weird. It prints errors to STDOUT, not STDERR.
				// And a successful check prints nothing.
				if (error || stdout) {
					// If 'error' exists (e.g., command not found) or stdout has data (an error message)
					const errorMessage = error ? error.message : stdout;
					this.updateProps({ fileStatus: "error", fileStatusMessage: errorMessage });
				} else {
					// No error, no stdout means a clean check
					this.updateProps({ fileStatus: "ok", fileStatusMessage: "File OK" });
				}
				resolve(); // Always resolve so we don't block the UI
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