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

	// The "source of truth" for our UI state
	private state = {
		isLoading: true,
		assets: "0 USD",
		liabilities: "0 USD",
		netWorth: "0.00 USD",
		kpiError: null as string | null,
		reportError: null as string | null,
		reportHtml: "Loading..."
	};

	constructor(leaf: WorkspaceLeaf, plugin: BeancountPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() { return BEANCOUNT_VIEW_TYPE; }
	getDisplayText() { return "Beancount"; }

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		
		this.component = new BeancountViewComponent({
			target: container,
			props: this.state // Pass the initial state
		});

		// Listen for events dispatched from the Svelte component
		this.component.$on('refresh', () => this.updateView());
		this.component.$on('renderReport', (e) => this.renderReport(e.detail));

		// Use setTimeout to run the initial load on the next tick
		setTimeout(() => this.updateView(), 0);
	}

	async onClose() {
		if (this.component) {
			this.component.$destroy();
		}
	}

	// Our custom function (renamed to avoid conflicts)
	private updateProps(newState: Partial<typeof this.state>) {
		this.state = { ...this.state, ...newState };
		if (this.component) {
			this.component.$set(this.state);
		}
	}

	// --- All Data Logic Lives Here ---

	async updateView() {
		this.updateProps({ isLoading: true, kpiError: null, reportError: null, reportHtml: "Loading..." });
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

			await this.renderReport('balance');

		} catch (error) {
			console.error("Error updating view:", error);
			this.updateProps({ kpiError: error.message, reportHtml: "" });
		} finally {
			this.updateProps({ isLoading: false });
		}
	}

	async renderReport(reportType: 'balance' | 'income' | 'expenses') {
		this.updateProps({ isLoading: true, reportError: null, reportHtml: `Loading ${reportType} report...` });
		let query = '';
		
		switch (reportType) {
			case 'balance': query = `SELECT account, sum(position) GROUP BY account`; break;
			case 'income': query = `SELECT account, sum(position) WHERE account ~ '^Income' GROUP BY account`; break;
			case 'expenses': query = `SELECT account, sum(position) WHERE account ~ '^Expenses' GROUP BY account`; break;
		}

		try {
			const result = await this.runQuery(query);
			const cleanStdout = result.replace(/\r/g, "").trim();
			const records: string[][] = parse(cleanStdout, { columns: false, skip_empty_lines: true });

			if (records.length === 0) {
				this.updateProps({ reportHtml: "No data returned." });
				return;
			}
			
			const firstRowIsHeader = records[0][1].includes('sum(position)'); 
			let table = "";
			let dataRows: string[][] = [];

			if (firstRowIsHeader) {
				table += `| ${records[0][0]} | ${records[0][1]} |\n| --- | --- |\n`;
				dataRows = records.slice(1);
			} else {
				table += `| account | balance |\n| --- | --- |\n`;
				dataRows = records;
			}
			table += dataRows.map(row => `| ${row[0]} | ${row[1]} |`).join('\n');

			const tempDiv = document.createElement('div');
			MarkdownRenderer.render(this.app, table, tempDiv, '', this.plugin);
			this.updateProps({ reportHtml: tempDiv.innerHTML, reportError: null });
			
		} catch (error) {
			console.error(`Error rendering ${reportType} report:`, error);
			this.updateProps({ reportError: error.message, reportHtml: "" });
		} finally {
			this.updateProps({ isLoading: false });
		}
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