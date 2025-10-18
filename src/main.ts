// src/main.ts

import { Plugin } from 'obsidian';
// Import 'exec' here, as runQuery needs it
import { exec } from 'child_process'; 
import { BeancountSettingTab, type BeancountPluginSettings, DEFAULT_SETTINGS } from './settings';
import { BeancountView, BEANCOUNT_VIEW_TYPE } from './view';
import { TransactionModal } from './transaction-modal';

export default class BeancountPlugin extends Plugin {
	settings: BeancountPluginSettings;

	async onload() {
		await this.loadSettings();

		this.registerView(
			BEANCOUNT_VIEW_TYPE,
			(leaf) => new BeancountView(leaf, this)
		);

		this.addRibbonIcon('dollar-sign', 'Open Beancount View', () => {
			this.activateView();
		});

		this.addCommand({
			id: 'add-beancount-transaction',
			name: 'Add Beancount Transaction',
			callback: () => {
				new TransactionModal(this.app, this).open();
			}
		});

		this.addSettingTab(new BeancountSettingTab(this.app, this));
	}

	async activateView() {
		this.app.workspace.detachLeavesOfType(BEANCOUNT_VIEW_TYPE);
		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf) {
			await leaf.setViewState({ type: BEANCOUNT_VIEW_TYPE, active: true });
			this.app.workspace.revealLeaf(leaf);
		}
	}
	
	// --- THIS IS THE FUNCTION THAT WAS MOVED ---
	// It must be PUBLIC and INSIDE the BeancountPlugin class
	public runQuery(query: string): Promise<string> {
		return new Promise((resolve, reject) => {
			const filePath = this.settings.beancountFilePath;
			const commandName = this.settings.beancountCommand;

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

	public convertWslPathToWindows(wslPath: string): string {
		const match = wslPath.match(/^\/mnt\/([a-zA-Z])\//);
		if (match) {
			const driveLetter = match[1].toUpperCase();
			return wslPath.replace(/^\/mnt\/[a-zA-Z]\//, `${driveLetter}:\\`).replace(/\//g, '\\');
		}
		return wslPath;
	}

	onunload() {}
	async loadSettings() { this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()); }
	async saveSettings() { await this.saveData(this.settings); }
}