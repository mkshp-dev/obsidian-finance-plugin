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
	getDisplayText() { return "Beancount"; }
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
		// --- ADDED: Listen for openJournal event ---
		this.component.$on('openJournal', () => this.openJournalView());
		// ------------------------------------------

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
		this.updateProps({ isLoading: true, kpiError: null, reportError: null, fileStatus: "checking", fileStatusMessage: null, reportHeaders: [], reportRows: [] });
		new Notice('Refreshing financial data...');

		try {
			const assetsQuery = `SELECT sum(position) WHERE account ~ '^Assets'`;
			const liabilitiesQuery = `SELECT sum(position) WHERE account ~ '^Liabilities'`;

			const [
				kpiResults,
				_reportResult, // RenderReport updates props itself now
				checkResult
			] = await Promise.all([
				Promise.all([this.plugin.runQuery(assetsQuery), this.plugin.runQuery(liabilitiesQuery)]),
				this.renderReport('assets'), // Render default report
				this.runBeanCheck()
			]);

			const [assetsResult, liabilitiesResult] = kpiResults;
			const assets = this.parseSingleValue(assetsResult) || "0 USD";
			const liabilities = this.parseSingleValue(liabilitiesResult) || "0 USD";
			const netWorthNum = parseFloat(assets.split(" ")[0]) - parseFloat(liabilities.split(" ")[0]);
			const currency = assets.split(" ")[1] || "USD";

			this.updateProps({
				assets, liabilities, netWorth: `${netWorthNum.toFixed(2)} ${currency}`,
				kpiError: null, fileStatus: checkResult.status, fileStatusMessage: checkResult.message
			});

		} catch (error) {
			console.error("Error updating view:", error);
			this.updateProps({ kpiError: error.message, reportHeaders: [], reportRows: [], fileStatus: "error", fileStatusMessage: "Failed during refresh." });
		} finally {
			// isLoading is managed within renderReport and runBeanCheck calls implicitly
			// but we ensure it's false if the top-level try/catch fails
			if(this.state.isLoading) this.updateProps({ isLoading: false });
		}
	}

// src/view.ts -> Replace this function

	async renderReport(reportType: 'assets' | 'liabilities' | 'equity' | 'income' | 'expenses') {
		this.updateProps({ isLoading: true, reportError: null, reportHeaders: [], reportRows: [] });
		let query = '';
		const headers = ['Account', 'Amount']; // Use clean headers

		switch (reportType) {
			case 'assets': query = `SELECT account, sum(position) WHERE account ~ '^Assets' GROUP BY account`; break;
			case 'liabilities': query = `SELECT account, sum(position) WHERE account ~ '^Liabilities' GROUP BY account`; break;
			case 'equity': query = `SELECT account, sum(position) WHERE account ~ '^Equity' GROUP BY account`; break;
			case 'income': query = `SELECT account, sum(position) WHERE account ~ '^Income' GROUP BY account`; break;
			case 'expenses': query = `SELECT account, sum(position) WHERE account ~ '^Expenses' GROUP BY account`; break;
		}

		try {
			const result = await this.plugin.runQuery(query);
			const cleanStdout = result.replace(/\r/g, "").trim();
			const records: string[][] = parse(cleanStdout, { columns: false, skip_empty_lines: true });

			if (records.length === 0) {
				this.updateProps({ reportHeaders: [], reportRows: [] }); return;
			}

			const firstRowIsHeader = records[0][1]?.includes('sum(position)');
			let rows: string[][] = firstRowIsHeader ? records.slice(1) : records;

			let total = 0;
			let currency = ''; // Assume single currency for simplicity for now

			const formattedRows = rows.map(row => {
				if (row.length === 0) return row;
				const accountName = row[0];
				const amountStr = row[1] || ''; // Second column is amount

				// --- Calculate Total ---
				const amountMatch = amountStr.match(/(-?[\d,]+\.?\d*)\s*(\S+)/); // Extract number and currency
				if (amountMatch) {
					total += parseFloat(amountMatch[1].replace(/,/g, '')); // Sum the numbers
					if (!currency) currency = amountMatch[2]; // Grab the currency symbol
				}
				// ---------------------

				const lastColonIndex = accountName.lastIndexOf(':');
				const trimmedName = lastColonIndex > -1 ? accountName.substring(lastColonIndex + 1) : accountName;
				return [trimmedName, amountStr]; // Pass original amount string
			});

			// --- Add the Total Row ---
			if (formattedRows.length > 0) {
				const totalRow = ['Total', `${total.toFixed(2)} ${currency}`];
				formattedRows.push(totalRow);
			}
			// -------------------------

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
	// ----------------------------------------------

	// --- NEW: Method to open the Journal View ---
// src/view.ts -> Replace this method
// src/view.ts -> Replace this method
// src/view.ts -> Replace this method

	async openJournalView() {
		new Notice('Generating grouped journal...');
		this.updateProps({ isLoading: true });

		// --- ADD THE WARNING COMMENT HERE ---
		let markdownString = `\n\n# Beancount Journal (Grouped)\n\n`;
		// ------------------------------------

		try {
			const query = `SELECT date, payee, narration, tags, links, id, account, position ORDER BY date DESC, id`;
			const result = await this.plugin.runQuery(query);
			const cleanStdout = result.replace(/\r/g, "").trim();
			const records: string[][] = parse(cleanStdout, { columns: false, skip_empty_lines: true, relax_column_count: true });

			if (records.length === 0) {
				markdownString += "No journal entries found.";
			} else {
				const defaultHeaders = ['date', 'payee', 'narration', 'tags', 'links', 'id', 'account', 'position'];
				const firstRowIsHeader = records[0][0]?.toLowerCase().includes('date') && records[0][5]?.toLowerCase().includes('id') && records[0][6]?.toLowerCase().includes('account');
				let rows = firstRowIsHeader ? records.slice(1) : records;
				let currentTxnId = "";

				for (let i = 0; i < rows.length; i++) {
					const row = rows[i];
					while(row.length < defaultHeaders.length) row.push('');
					const [date, payee, narration, tagsStr, linksStr, txnId, account, position] = row;
					const txnKey = txnId; // Group by ID

					if (txnKey !== currentTxnId) {
						currentTxnId = txnKey;
						if (i > 0) markdownString += '\n---\n\n';
						const payeeStr = payee ? `"${payee}"` : '""';
						const narrationStr = narration ? `"${narration}"` : '""';
						const tags = tagsStr ? tagsStr.split(',').map(t => `#${t.trim()}`).join(' ') : '';
						const links = linksStr ? linksStr.split(',').map(l => `^${l.trim()}`).join(' ') : '';
						const extras = [tags, links].filter(Boolean).join(' ');
						markdownString += `### ${date} * ${payeeStr} ${narrationStr} ${extras}\n\n`;
						markdownString += `| Account | Amount |\n|---|---|\n`;
					}
					const lastColonIndex = account.lastIndexOf(':');
					const trimmedAccount = lastColonIndex > -1 ? account.substring(lastColonIndex + 1) : account;
					markdownString += `| ${trimmedAccount} | ${position} |\n`;
				}
			}

			const tempFileName = `beancount-grouped-journal-${Date.now()}.md`;
			const tempFile = await this.app.vault.create(tempFileName, markdownString);

			if (tempFile instanceof TFile) {
				const leaf = this.app.workspace.getLeaf(true);
				await leaf.openFile(tempFile);
			} else {
				throw new Error("Failed to create temporary journal file.");
			}

		} catch (error) {
			console.error("Error generating grouped journal:", error);
			new Notice(`Failed to generate journal: ${error.message}`, 0);
		} finally {
			this.updateProps({ isLoading: false });
		}
	}
// ---------------------------------------

	async runBeanCheck(): Promise<{ status: "ok" | "error"; message: string | null }> {
		const filePath = this.plugin.settings.beancountFilePath;
		let commandName = this.plugin.settings.beancountCommand;
		if (!filePath) return { status: "error", message: "File path not set." };
		if (!commandName) return { status: "error", message: "Command not set." };
		commandName = commandName.replace(/bean-query(.exe)?$/, 'bean-check$1');
		const command = `${commandName} "${filePath}"`;
		return new Promise((resolve) => {
			exec(command, (error, stdout, stderr) => {
				if (error || stdout) { const errorMessage = error ? error.message : stdout; resolve({ status: "error", message: errorMessage }); }
				else { resolve({ status: "ok", message: "File OK" }); }
			});
		});
	}

	async openLedgerFile() {
		const absoluteFilePath = this.plugin.settings.beancountFilePath;
		if (!absoluteFilePath) { new Notice("File path not set."); return; }
		const commandName = this.plugin.settings.beancountCommand;
		let osSpecificPath = absoluteFilePath;
		if (commandName.startsWith('wsl')) { osSpecificPath = this.plugin.convertWslPathToWindows(absoluteFilePath); }
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

	parseSingleValue(csv: string): string | null {
		try {
			const records = parse(csv, { columns: false, skip_empty_lines: true });
			if (records.length > 1 && records[1].length > 0) return records[1][0].trim();
			return null;
		} catch (e) { return null; }
	}
}