// src/transaction-modal.ts

import { App, Modal, Setting, Notice } from 'obsidian';
// 1. Import the Node.js filesystem module
import * as fs from 'fs';
import BeancountPlugin from './main';

export class TransactionModal extends Modal {
    plugin: BeancountPlugin;
    
    date: string = new Date().toISOString().slice(0, 10);
    payee: string = '';
    amount: string = '';
    fromAccount: string = 'Assets:Checking';
    toAccount: string = 'Expenses:';

    constructor(app: App, plugin: BeancountPlugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        // ... onOpen is unchanged
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: 'Add New Transaction' });

        new Setting(contentEl).setName('Date').addText(text => text.setValue(this.date).onChange(value => this.date = value));
        new Setting(contentEl).setName('Payee').addText(text => text.setPlaceholder('e.g., Coffee Shop').onChange(value => this.payee = value));
        new Setting(contentEl).setName('Amount').addText(text => text.setPlaceholder('e.g., 4.50').onChange(value => this.amount = value));
        new Setting(contentEl).setName('From Account').addText(text => text.setValue(this.fromAccount).onChange(value => this.fromAccount = value));
        new Setting(contentEl).setName('To Account').addText(text => text.setValue(this.toAccount).onChange(value => this.toAccount = value));

        new Setting(contentEl)
            .addButton(button => button
                .setButtonText('Add Transaction')
                .setCta()
                .onClick(() => this.onSubmit()));
    }

    async onSubmit() {
        // ... validation is unchanged
        if (!this.date || !this.payee || !this.amount || !this.fromAccount || !this.toAccount) {
            new Notice('All fields are required.');
            return;
        }

        const filePath = this.plugin.settings.beancountFilePath;
        if (!filePath) {
            new Notice('Beancount file path is not set in settings.');
            return;
        }

        const transactionString = `\n${this.date} * "${this.payee}"
  ${this.toAccount}          ${parseFloat(this.amount).toFixed(2)} USD
  ${this.fromAccount}
`;

        try {
            // 2. THE KEY CHANGE:
            // First, translate the path from WSL to Windows, as before.
            const windowsPath = this.plugin.convertWslPathToWindows(filePath);
            
            // Second, use the 'fs' module to append to the absolute path.
            fs.appendFileSync(windowsPath, transactionString);
            
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
    }
}