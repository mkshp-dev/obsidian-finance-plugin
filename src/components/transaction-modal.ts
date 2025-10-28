// src/transaction-modal.ts

import { App, Modal, Notice } from 'obsidian';
import * as fs from 'fs';
import type BeancountPlugin from '../main';
import TransactionFormComponent from './TransactionForm.svelte';
import { runQuery, convertWslPathToWindows } from '../utils/index'; 
import { getAllAccountsQuery } from '../queries/index'; 
import { parse as parseCsv } from 'csv-parse/sync';

export class TransactionModal extends Modal {
	plugin: BeancountPlugin;
	private component: TransactionFormComponent;

	constructor(app: App, plugin: BeancountPlugin) {
		super(app);
		this.plugin = plugin;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: 'Add New Entry' });

		let accountList: string[] = [];
		try {
			// --- Use imported query function ---
			const query = getAllAccountsQuery();
			// --- Use imported runQuery (via plugin instance) ---
			const result = await runQuery(this.plugin, query);
			const cleanStdout = result.replace(/\r/g, "").trim();
			// --- Use imported parseCsv ---
			const records: string[][] = parseCsv(cleanStdout, { columns: false, skip_empty_lines: true });
			const firstRowIsHeader = records[0]?.[0]?.toLowerCase() === 'account';
			const dataRows = firstRowIsHeader ? records.slice(1) : records;
			// --- Deduplicate account list ---
			accountList = [...new Set(dataRows.map(row => row?.[0]).filter(Boolean))]; // Added Set

		} catch (error) {
			console.error("Failed to fetch account list:", error);
			new Notice("Could not load account autocomplete.");
		}

		this.component = new TransactionFormComponent({
			target: contentEl,
			props: {
				accountList: accountList,
				defaultCurrency: this.plugin.settings.defaultCurrency
			}
		});

		this.component.$on('submit', (e) => this.onSubmit(e.detail));
	}

// src/components/transaction-modal.ts -> Replace onSubmit

	async onSubmit(data: any) {
		const filePath = this.plugin.settings.beancountFilePath;
		if (!filePath) {
			new Notice('Beancount file path is not set in settings.');
			return;
		}

		let entryString = ''; // The final string to append

		switch (data.type) {
			case 'transaction':
				// --- NEW: Transaction Logic ---
				// 1. Validation
				if (!data.date || !data.payee || !Array.isArray(data.postings) || data.postings.length < 2) {
					new Notice('Transaction requires date, payee, and at least two postings.');
					return;
				}
				let blankAmountIndex = -1;
				for (let i = 0; i < data.postings.length; i++) {
					const p = data.postings[i];
					if (!p.account || !p.currency) {
						new Notice(`Posting ${i + 1} is missing account or currency.`);
						return;
					}
					const isEmptyAmount = p.amount === null || p.amount === undefined || p.amount === '';
					if (isEmptyAmount) {
						if (blankAmountIndex !== -1) {
							new Notice('Only one posting amount can be left blank.');
							return; // More than one blank amount
						}
						blankAmountIndex = i;
					} else {
						const amountAsString = String(p.amount);
						if (isNaN(parseFloat(amountAsString))) {
							new Notice(`Amount in posting ${i + 1} (${amountAsString}) is not a valid number.`);
							return;
						}
					}
				}
				if (blankAmountIndex === -1 && data.postings.length > 1) {
					// Beancount *requires* one blank amount if there are multiple postings
					// unless using specific balance features not implemented here.
					// Let's enforce this for simplicity.
					// Note: Beancount-check would catch the balance error later anyway.
					// We could add a check here to sum amounts and see if they balance if needed.
					new Notice('For multiple postings, please leave one amount blank for automatic balancing.');
					return;
				}


				// 2. Format Header
				const payeeStr = `"${data.payee}"`;
				const narrationStr = data.narration ? `"${data.narration}"` : '""';
				let tagStr = ''; if (data.tag) { tagStr = `#${data.tag.replace('#', '').trim()}`; }
				const header = [`\n${data.date} * ${payeeStr} ${narrationStr}`, tagStr].filter(Boolean).join(' ');

				// 3. Format Postings
				const postingLines = data.postings.map((p: any) => {
					// --- CORRECTED Amount Check ---
					// Check if amount is null, undefined, empty string, or 0 before formatting
					const isEmptyAmount = p.amount === null || p.amount === undefined || p.amount === '' || p.amount === 0;
					const amountStr = isEmptyAmount
						? '' // Leave blank if empty or zero (though zero might be valid input sometimes)
						: `${parseFloat(String(p.amount)).toFixed(2)} ${p.currency}`; // Convert to string before parseFloat for safety
					// -----------------------------
					
					// Use standard Beancount indentation (2 spaces) and spacing
					return `  ${p.account.padEnd(30)} ${amountStr}`.trimEnd(); // Pad account for alignment, trim trailing space if amount is blank
				}).join('\n');

				entryString = `${header}\n${postingLines}\n`; // Add final newline
				break;

			case 'balance':
				// Balance logic remains unchanged
				if (!data.date || !data.account || !data.amount || !data.currency) {
					new Notice('Required fields are missing for balance check.'); return;
				}
				entryString = `\n${data.date} balance ${data.account}          ${parseFloat(data.amount).toFixed(2)} ${data.currency}`;
				break;

			case 'note':
				// Note logic remains unchanged
				if (!data.date || !data.account || !data.text) {
					new Notice('Required fields are missing for note.'); return;
				}
				entryString = `\n${data.date} note ${data.account}          "${data.text}"`;
				break;

			default:
				new Notice(`Unknown entry type: ${data.type}`); return;
		}

		// Append the formatted string to the file (unchanged logic)
		try {
			const commandName = this.plugin.settings.beancountCommand;
			let finalPath = filePath;
			if (commandName.startsWith('wsl')) {
				finalPath = this.plugin.convertWslPathToWindows(filePath);
			}
			fs.appendFileSync(finalPath, entryString);
			new Notice(`Entry (${data.type}) successfully added!`);
			this.close();

		} catch (error) {
			console.error("Error appending to beancount file:", error);
			new Notice('Failed to write to file. Check console for details.');
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
		if (this.component) {
			this.component.$destroy();
		}
	}
}