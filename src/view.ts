// view.ts

import { ItemView, WorkspaceLeaf, Notice, MarkdownRenderer } from 'obsidian';
import { exec } from 'child_process';
import { parse } from 'csv-parse/sync';
import BeancountPlugin from './main';

export const BEANCOUNT_VIEW_TYPE = "beancount-view";

export class BeancountView extends ItemView {
    plugin: BeancountPlugin;
    private kpiContainer: HTMLDivElement;
    private reportContainer: HTMLDivElement;

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
        const refreshButton = headerEl.createEl("button", { text: "Refresh" });
        refreshButton.onClickEvent(() => this.updateView());

        container.createEl("h4", { text: "Key Metrics" });
        this.kpiContainer = container.createEl("div", { cls: "beancount-kpi-container" });

        const navContainer = container.createEl("div", { cls: "beancount-nav" });
        const balanceBtn = navContainer.createEl("button", { text: "Balance" });
        const incomeBtn = navContainer.createEl("button", { text: "Income" });
        const expensesBtn = navContainer.createEl("button", { text: "Expenses" });

        balanceBtn.onClickEvent(() => this.renderReport('balance'));
        incomeBtn.onClickEvent(() => this.renderReport('income'));
        expensesBtn.onClickEvent(() => this.renderReport('expenses'));

        this.reportContainer = container.createEl("div", { cls: "beancount-report-container" });
        this.updateView();
    }

    async updateView() {
        new Notice('Refreshing financial data...');
        this.kpiContainer.setText("Loading...");
        this.reportContainer.setText("Loading...");

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

            this.kpiContainer.empty();
            this.kpiContainer.createEl('p', { text: `Assets: ${assets}` });
            this.kpiContainer.createEl('p', { text: `Liabilities: ${liabilities}` });
            this.kpiContainer.createEl('strong', { text: `Net Worth: ${netWorth.toFixed(2)} ${currency}` });

            this.renderReport('balance');

        } catch (error) {
            console.error("Error updating view:", error);
            new Notice("Failed to refresh data. Check console.");
            this.kpiContainer.setText("Error loading data.");
            this.reportContainer.setText("");
        }
    }

    async renderReport(reportType: 'balance' | 'income' | 'expenses') {
        this.reportContainer.setText(`Loading ${reportType} report...`);
        let query = '';
        switch (reportType) {
            case 'balance':
                query = `SELECT account, sum(position) GROUP BY account`;
                break;
            case 'income':
                query = `SELECT account, sum(position) WHERE account ~ '^Income' GROUP BY account`;
                break;
            case 'expenses':
                query = `SELECT account, sum(position) WHERE account ~ '^Expenses' GROUP BY account`;
                break;
        }

        try {
            const result = await this.runQuery(query);
            const records = parse(result, { columns: true, skip_empty_lines: true });
            const markdown = this.plugin.formatDataAsMarkdown(records);

            this.reportContainer.empty();
            MarkdownRenderer.render(this.app, markdown, this.reportContainer, '', this.plugin);
        } catch (error) {
            console.error(`Error rendering ${reportType} report:`, error);
            this.reportContainer.setText(`Failed to load ${reportType} report.`);
        }
    }

    runQuery(query: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const filePath = this.plugin.settings.beancountFilePath;
            if (!filePath) {
                return reject(new Error('Beancount file path is not set.'));
            }
            const command = `wsl bean-query -f csv "${filePath}" "${query}"`;
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    return reject(error);
                }
                if (stderr) {
                    console.warn("Beancount stderr:", stderr);
                }
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