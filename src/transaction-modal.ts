// src/transaction-modal.ts

import { App, Modal, Notice } from 'obsidian';
import * as fs from 'fs';
import type BeancountPlugin from './main';
import { parse } from 'csv-parse/sync';
import TransactionFormComponent from './TransactionForm.svelte';

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
		contentEl.createEl('h2', { text: 'Add New Entry' }); // Changed title

		let accountList: string[] = [];
		try {
			const result = await this.plugin.runQuery('SELECT account');
			const cleanStdout = result.replace(/\r/g, "").trim();
			const records: string[][] = parse(cleanStdout, { columns: false, skip_empty_lines: true });
			const firstRowIsHeader = records[0][0].toLowerCase() === 'account';
			const dataRows = firstRowIsHeader ? records.slice(1) : records;
			accountList = dataRows.map(row => row[0]);
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

	// --- onSubmit now handles different types ---
	async onSubmit(data: any) {
		const filePath = this.plugin.settings.beancountFilePath;
		if (!filePath) {
			new Notice('Beancount file path is not set in settings.');
			return;
		}

		let entryString = ''; // The final string to append

		// Use a switch to format based on the type
		switch (data.type) {
			case 'transaction':
				// Validation for transaction
				if (!data.date || !data.payee || !data.amount || !data.fromAccount || !data.toAccount || !data.currency) {
					new Notice('Required fields are missing for transaction.');
					return;
				}
				const payeeStr = `"${data.payee}"`;
				const narrationStr = data.narration ? `"${data.narration}"` : '""';
				let tagStr = '';
				if (data.tag) {
					tagStr = `#${data.tag.replace('#', '').trim()}`;
				}
				const header = [`\n${data.date} * ${payeeStr} ${narrationStr}`, tagStr].filter(Boolean).join(' ');
				entryString = `${header}
  ${data.toAccount}          ${parseFloat(data.amount).toFixed(2)} ${data.currency}
  ${data.fromAccount}
`;
				break;

			case 'balance':
				// Validation for balance
				if (!data.date || !data.account || !data.amount || !data.currency) {
					new Notice('Required fields are missing for balance check.');
					return;
				}
				entryString = `\n${data.date} balance ${data.account}          ${parseFloat(data.amount).toFixed(2)} ${data.currency}`;
				break;

			case 'note':
				// Validation for note
				if (!data.date || !data.account || !data.text) {
					new Notice('Required fields are missing for note.');
					return;
				}
				entryString = `\n${data.date} note ${data.account}          "${data.text}"`;
				break;

			default:
				new Notice(`Unknown entry type: ${data.type}`);
				return;
		}

		// Append the formatted string to the file
		try {
			const commandName = this.plugin.settings.beancountCommand;
			let finalPath = filePath;
			if (commandName.startsWith('wsl')) {
				finalPath = this.plugin.convertWslPathToWindows(filePath);
			}
			fs.appendFileSync(finalPath, entryString);

			new Notice(`Entry (${data.type}) successfully added!`);
			this.close(); // Close the modal on success

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