import { OverviewView, OVERVIEW_VIEW_TYPE } from './overview-view'; // Add this
import { Plugin } from 'obsidian';
import { DashboardView, DASHBOARD_VIEW_TYPE } from './dashboard-view';
import { exec } from 'child_process'; 
import { BeancountSettingTab, type BeancountPluginSettings, DEFAULT_SETTINGS } from './settings';
import { BeancountView, BEANCOUNT_VIEW_TYPE } from './view';
import { TransactionModal } from './transaction-modal';
import { parse } from 'path/win32';
import { parse as parseCsv } from 'csv-parse/sync'; // <-- Import and alias it
import * as path from 'path';
export default class BeancountPlugin extends Plugin {
	settings: BeancountPluginSettings;
	async onload() {
		await this.loadSettings();
		this.registerView(
			OVERVIEW_VIEW_TYPE,
			(leaf) => new OverviewView(leaf, this)
		);
		this.registerView(
			BEANCOUNT_VIEW_TYPE,
			(leaf) => new BeancountView(leaf, this)
		);
		this.registerView(
			DASHBOARD_VIEW_TYPE,
			(leaf) => new DashboardView(leaf, this)
		);
		this.addRibbonIcon('dollar-sign', 'Open Beancount View', () => {
			this.activateView();
		});
		this.addRibbonIcon('pie-chart', 'Open Beancount Overview', () => {
			this.activateOverviewView();
		});
		this.addCommand({
			id: 'add-beancount-transaction',
			name: 'Add Beancount Transaction',
			callback: () => {
				new TransactionModal(this.app, this).open();
			}
		});
		this.addCommand({
			id: 'open-beancount-dashboard', // New ID
			name: 'Open Beancount Dashboard', // New Name
			callback: () => {
				this.activateDashboardView(); // Call renamed helper
			}
		});
		// ... (after other commands)
		this.addCommand({
			id: 'open-beancount-overview',
			name: 'Open Beancount Overview',
			callback: () => {
				this.activateOverviewView();
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

	// src/main.ts -> Add this method to BeancountPlugin class
	async activateOverviewView() {
		this.app.workspace.detachLeavesOfType(OVERVIEW_VIEW_TYPE); // Close existing first
		const leaf = this.app.workspace.getLeaf('tab'); // Open in main area
		await leaf.setViewState({
			type: OVERVIEW_VIEW_TYPE,
			active: true,
		});
		this.app.workspace.revealLeaf(leaf);
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

// src/main.ts -> Inside BeancountPlugin class

// src/main.ts -> Inside BeancountPlugin class

	public parseSingleValue(csv: string): string { // Changed return type to always be string
		try {
			// Use the aliased import 'parseCsv'
			const records: string[][] = parseCsv(csv, { columns: false, skip_empty_lines: true });
			// Check if the expected row and cell exist and are not empty
			if (records.length > 1 && records[1].length > 0 && records[1][0] && records[1][0].trim() !== '') {
				return records[1][0].trim(); // Return the found value
			}
			// If not found or empty, return a default zero value
			console.warn("parseSingleValue: No valid data found in CSV, returning '0 USD'. CSV:", csv);
			return '0 USD'; // Default value
		} catch (e) {
            console.error("Error parsing single value CSV:", e, "CSV:", csv); // Add error logging
            return '0 USD'; // Default value on error
        }
	}


	public convertWslPathToWindows(wslPath: string): string {
		const match = wslPath.match(/^\/mnt\/([a-zA-Z])\//);
		if (match) {
			const driveLetter = match[1].toUpperCase();
			return wslPath.replace(/^\/mnt\/[a-zA-Z]\//, `${driveLetter}:\\`).replace(/\//g, '\\');
		}
		return wslPath;
	}
	async activateDashboardView() { // Renamed from activateAccountView
		const existingLeaves = this.app.workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE);
		if (existingLeaves.length > 0) {
			this.app.workspace.revealLeaf(existingLeaves[0]);
			return;
		}
		const leaf = this.app.workspace.getLeaf('tab');
		await leaf.setViewState({
			type: DASHBOARD_VIEW_TYPE,
			active: true,
		});
		this.app.workspace.revealLeaf(leaf);
	}
	onunload() {}
	async loadSettings() { this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()); }
	async saveSettings() { await this.saveData(this.settings); }
}