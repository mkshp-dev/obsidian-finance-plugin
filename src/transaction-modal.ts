// src/transaction-modal.ts

import { App, Modal, Notice } from 'obsidian';
import * as fs from 'fs';
import type BeancountPlugin from './main'; // <-- Use type-only import
import { parse } from 'csv-parse/sync';
import TransactionFormComponent from './TransactionForm.svelte'; // <-- Import the Svelte component

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
        contentEl.createEl('h2', { text: 'Add New Transaction' });

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

// src/transaction-modal.ts

    async onSubmit(data: any) {
        // Validation
        if (!data.date || !data.payee || !data.amount || !data.fromAccount || !data.toAccount) {
            new Notice('Required fields are missing.');
            return;
        }

        const filePath = this.plugin.settings.beancountFilePath;
        if (!filePath) {
            new Notice('Beancount file path is not set in settings.');
            return;
        }

        // --- NEW: Transaction Formatting Logic ---
        
        // 1. Build the transaction header line
        const payeeStr = `"${data.payee}"`;
        // Narration is optional, add quotes if it exists
        const narrationStr = data.narration ? `"${data.narration}"` : '""';
        
        // Clean up the tag, remove # if user added it, and add it back
        let tagStr = '';
        if (data.tag) {
        	tagStr = `#${data.tag.replace('#', '').trim()}`;
        }
        
        // Combine them, filtering out the blank tag
        const header = [`\n${data.date} * ${payeeStr} ${narrationStr}`, tagStr].filter(Boolean).join(' ');

        // 2. Build the full transaction
        const transactionString = `${header}
  ${data.toAccount}          ${parseFloat(data.amount).toFixed(2)} ${data.currency}
  ${data.fromAccount}
`;
		// ------------------------------------------
        
        try {
            // Write to the file
            const commandName = this.plugin.settings.beancountCommand;
            let finalPath = filePath;
            if (commandName.startsWith('wsl')) {
                finalPath = this.plugin.convertWslPathToWindows(filePath);
            }
            fs.appendFileSync(finalPath, transactionString);
            
            new Notice('Transaction successfully added!');
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