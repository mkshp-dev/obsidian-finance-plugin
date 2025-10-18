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
		// 'reportHtml' is gone
		reportHeaders: [] as string[], // <-- NEW
		reportRows: [] as string[][]    // <-- NEW
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

			await this.renderReport('assets');

		} catch (error) {
			console.error("Error updating view:", error);
			this.updateProps({ kpiError: error.message, reportHeaders: [], reportRows: [] });
		} finally {
			this.updateProps({ isLoading: false });
		}
	}

// src/view.ts -> Replace this function
// src/view.ts -> Replace this function

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
				// If no data, send empty arrays
				this.updateProps({ reportHeaders: [], reportRows: [] });
				return;
			}
			
			const firstRowIsHeader = records[0][1].includes('sum(position)'); 
			let headers: string[] = [];
			let rows: string[][] = [];

			if (firstRowIsHeader) {
				headers = records[0];
				rows = records.slice(1);
			} else {
				headers = ['account', 'balance']; // Use default headers
				rows = records;
			}

			// --- THIS IS THE NEW LOGIC ---
			// Map over the rows to format the account names
			const formattedRows = rows.map(row => {
				// Defensive check for safety
				if (row.length === 0) return row;

				const accountName = row[0];
				const lastColonIndex = accountName.lastIndexOf(':');
				
				// Find the last ':' and get the substring after it.
				// If no ':' is found, use the original name.
				const trimmedName = lastColonIndex > -1
					? accountName.substring(lastColonIndex + 1)
					: accountName;
				
				// Return a new row array with the trimmed name
				return [trimmedName, ...row.slice(1)];
			});
			// -------------------------------

			this.updateProps({
				reportHeaders: headers,
				reportRows: formattedRows, // <-- Pass the newly formatted rows
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