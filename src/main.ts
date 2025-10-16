// main.ts (Final Refactored Version)

import { Plugin } from 'obsidian';

import { BeancountSettingTab, BeancountPluginSettings, DEFAULT_SETTINGS } from './settings';
import { BeancountView, BEANCOUNT_VIEW_TYPE } from './view';

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

    // This helper function is used by the view, so it stays in the main plugin class
    formatDataAsMarkdown(records: any[]): string {
        if (records.length === 0) { return "No data returned from Beancount."; }
        const headers = Object.keys(records[0]);
        const headerRow = `| ${headers.join(' | ')} |`;
        const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;
        const dataRows = records.map(record => `| ${headers.map(header => record[header]).join(' | ')} |`).join('\n');
        return `${headerRow}\n${separatorRow}\n${dataRows}`;
    }

    onunload() {}
    async loadSettings() { this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()); }
    async saveSettings() { await this.saveData(this.settings); }
}