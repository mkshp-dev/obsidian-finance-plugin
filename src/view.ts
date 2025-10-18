// view.ts

import { ItemView, WorkspaceLeaf, Notice, MarkdownRenderer } from 'obsidian';
import { exec } from 'child_process';
import { parse } from 'csv-parse/sync';
import BeancountPlugin from './main';

export const BEANCOUNT_VIEW_TYPE = "beancount-view";

// src/view.ts -> Replace the BeancountView class

export class BeancountView extends ItemView {
	plugin: BeancountPlugin;
	private kpiContainer: HTMLDivElement;
    private reportContainer: HTMLDivElement;
    // Add references to our buttons to disable/enable them
    private refreshButton: HTMLButtonElement;
    private navContainer: HTMLDivElement;

	constructor(leaf: WorkspaceLeaf, plugin: BeancountPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() { return BEANCOUNT_VIEW_TYPE; }
	getDisplayText() { return "Beancount"; }

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();

		const headerEl = container.createEl("div", { cls: "beancount-header" });
		headerEl.createEl("h2", { text: "Snapshot" });
		this.refreshButton = headerEl.createEl("button", { text: "Refresh" });
		
        container.createEl("h4", { text: "Key Metrics" });
        this.kpiContainer = container.createEl("div", { cls: "beancount-kpi-container" });
        
        this.navContainer = container.createEl("div", { cls: "beancount-nav" });
        const balanceBtn = this.navContainer.createEl("button", { text: "Balance" });
        const incomeBtn = this.navContainer.createEl("button", { text: "Income" });
        const expensesBtn = this.navContainer.createEl("button", { text: "Expenses" });

        // Add event listeners
        this.refreshButton.onClickEvent(() => this.updateView());
		balanceBtn.onClickEvent(() => this.renderReport('balance'));
		incomeBtn.onClickEvent(() => this.renderReport('income'));
		expensesBtn.onClickEvent(() => this.renderReport('expenses'));
		
        this.reportContainer = container.createEl("div", { cls: "beancount-report-container" });
		this.updateView();
	}

    // --- NEW: Helper to toggle button states ---
    private setLoading(isLoading: boolean) {
        this.refreshButton.disabled = isLoading;
        this.navContainer.querySelectorAll('button').forEach(button => button.disabled = isLoading);
        if (isLoading) {
            this.refreshButton.setText("Refreshing...");
        } else {
            this.refreshButton.setText("Refresh");
        }
    }
    
    // --- NEW: Helper to display errors ---
    private renderError(container: HTMLElement, error: Error) {
        container.empty();
        container.createEl('div', { 
            text: `Error: ${error.message}`, 
            cls: 'beancount-error-message' 
        });
    }

	async updateView() {
        this.setLoading(true); // Disable buttons
		this.kpiContainer.setText("Loading...");
		this.reportContainer.setText("Loading...");
// src/view.ts -> Replace the 'try' block in updateView

		try {
			const assetsQuery = `SELECT sum(position) WHERE account ~ '^Assets'`;
			const liabilitiesQuery = `SELECT sum(position) WHERE account ~ '^Liabilities'`;
			
			const [assetsResult, liabilitiesResult] = await Promise.all([
				this.runQuery(assetsQuery),
				this.runQuery(liabilitiesQuery)
			]);

			const assets = this.parseSingleValue(assetsResult) || "0 USD";
			const liabilities = this.parseSingleValue(liabilitiesResult) || "0 USD";
			const netWorth = parseFloat(assets.split(" ")[0]) - parseFloat(liabilities.split(" ")[0]);
			const currency = assets.split(" ")[1] || "USD";

			// --- THIS IS THE NEW HTML STRUCTURE ---
			this.kpiContainer.empty();

			// Net Worth (The "Hero" Metric)
			const netWorthEl = this.kpiContainer.createEl('div', { cls: 'kpi-metric' });
			netWorthEl.createEl('span', { text: 'Net Worth', cls: 'kpi-label' });
			netWorthEl.createEl('span', { text: `${netWorth.toFixed(2)} ${currency}`, cls: 'kpi-value net-worth' });

			// Assets
			const assetsEl = this.kpiContainer.createEl('div', { cls: 'kpi-metric' });
			assetsEl.createEl('span', { text: 'Assets', cls: 'kpi-label' });
			assetsEl.createEl('span', { text: assets, cls: 'kpi-value' });

			// Liabilities
			const liabilitiesEl = this.kpiContainer.createEl('div', { cls: 'kpi-metric' });
			liabilitiesEl.createEl('span', { text: 'Liabilities', cls: 'kpi-label' });
			liabilitiesEl.createEl('span', { text: liabilities, cls: 'kpi-value' });
			// ----------------------------------------

			await this.renderReport('balance');

		} catch (error) {
			console.error("Error updating view:", error);
			this.renderError(this.kpiContainer, error);
            this.reportContainer.empty();
		} finally {
            this.setLoading(false);
        }
	}

// src/view.ts -> Replace this function
// src/view.ts -> Replace this function

	async renderReport(reportType: 'balance' | 'income' | 'expenses') {
		this.setLoading(true);
		this.reportContainer.setText(`Loading ${reportType} report...`);
		let query = '';
        
		switch (reportType) {
			case 'balance': query = `SELECT account, sum(position) GROUP BY account`; break;
			case 'income': query = `SELECT account, sum(position) WHERE account ~ '^Income' GROUP BY account`; break;
			case 'expenses': query = `SELECT account, sum(position) WHERE account ~ '^Expenses' GROUP BY account`; break;
		}

		try {
			const result = await this.runQuery(query);
            // Clean the whole output string of \r characters, then trim
            const cleanStdout = result.replace(/\r/g, "").trim();

            // --- THIS IS THE FIX ---
			const records: string[][] = parse(cleanStdout, { 
				columns: false, // Parse into simple arrays
				skip_empty_lines: true
			});
            // -----------------------

			if (records.length === 0) {
				this.reportContainer.setText("No data returned.");
                this.setLoading(false); // Make sure to re-enable buttons
				return;
			}
            
            // Check if the first row is a header
            const firstRowIsHeader = records[0][1].includes('sum(position)'); 
            
            let table = "";
            let dataRows: string[][] = [];

            if (firstRowIsHeader) {
                // Use the headers from the file
                table += `| ${records[0][0]} | ${records[0][1]} |\n`;
                table += `| --- | --- |\n`;
                dataRows = records.slice(1); // Data is everything after
            } else {
                // No header was found, so we create our own
                table += `| account | balance |\n`;
                table += `| --- | --- |\n`;
                dataRows = records; // All records are data
            }

            // Build the rest of the table from the data rows
            table += dataRows.map(row => `| ${row[0]} | ${row[1]} |`).join('\n');

			this.reportContainer.empty();
			MarkdownRenderer.render(this.app, table, this.reportContainer, '', this.plugin);
		} catch (error) {
			console.error(`Error rendering ${reportType} report:`, error);
			this.renderError(this.reportContainer, error);
		} finally {
            this.setLoading(false);
        }
	}
// src/view.ts -> Replace ONLY this function
// src/view.ts -> runQuery()
	runQuery(query: string): Promise<string> {
		return new Promise((resolve, reject) => {
			const filePath = this.plugin.settings.beancountFilePath;
			const commandName = this.plugin.settings.beancountCommand; // <-- GET SETTING

			if (!filePath) return reject(new Error('Beancount file path is not set.'));
			if (!commandName) return reject(new Error('Beancount command is not set.'));

			// Use the setting to build the command
			const command = `${commandName} -f csv "${filePath}" "${query}"`; 
			
			exec(command, (error, stdout, stderr) => {
				// ... rest of the function is unchanged
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

    async onClose() {}
}