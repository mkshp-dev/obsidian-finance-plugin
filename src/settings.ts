// src/settings.ts

import { App, PluginSettingTab, Setting, Notice } from 'obsidian'; // Added Notice for potential errors
import type BeancountPlugin from './main';
import { getTestConnectionQuery } from './queries/index';
// ------------------------------------

export interface BeancountPluginSettings {
    beancountFilePath: string;
    beancountCommand: string;
    defaultCurrency: string;
}

export const DEFAULT_SETTINGS: BeancountPluginSettings = {
    beancountFilePath: '',
    beancountCommand: '',
    defaultCurrency: 'USD'
}

export class BeancountSettingTab extends PluginSettingTab {
    plugin: BeancountPlugin;

    constructor(app: App, plugin: BeancountPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;
        containerEl.empty();
        containerEl.createEl('h2', {text: 'Beancount Settings'});

        // --- Connection Settings ---
        containerEl.createEl('h3', { text: 'Connection' });

        new Setting(containerEl)
            .setName('Beancount command')
            .setDesc('How to run bean-query. (e.g., "bean-query", "wsl bean-query", or a full path)')
            .addText(text => text
                .setPlaceholder('bean-query')
                .setValue(this.plugin.settings.beancountCommand)
                .onChange(async (value) => {
                    this.plugin.settings.beancountCommand = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Path to beancount file')
            .setDesc('Enter the absolute path to your main .beancount file.')
            .addText(text => text
                .setPlaceholder('C:/Users/User/finances.beancount or /mnt/c/...')
                .setValue(this.plugin.settings.beancountFilePath)
                .onChange(async (value) => {
                    this.plugin.settings.beancountFilePath = value;
                    await this.plugin.saveSettings();
                }));

        // --- Test Connection Button ---
        const testResultEl = containerEl.createEl('div', { cls: 'beancount-test-results' });

        new Setting(containerEl)
            .setName('Test connection')
            .setDesc('Run a test query to verify the command and file path.')
            .addButton(button => button
                .setButtonText('Test')
                .onClick(async () => {
                    // 1. Clear previous results
                    testResultEl.empty();
                    testResultEl.setText('Testing...');
                    testResultEl.removeClass('beancount-test-success');
                    testResultEl.removeClass('beancount-test-error');

                    // 2. Check if settings are configured
                    if (!this.plugin.settings.beancountCommand || !this.plugin.settings.beancountFilePath) {
                        testResultEl.setText(`❌ Failed: Please configure both Beancount command and file path.`);
                        testResultEl.addClass('beancount-test-error');
                        return;
                    }

                    // 3. Run the test using imported query function
                    try {
                        // --- Use imported query function ---
                        const query = getTestConnectionQuery();
                        await this.plugin.runQuery(query); // Calls runQuery from main.ts
                        // -----------------------------------

                        // 4. Handle Success
                        testResultEl.setText('✅ Success! Your command and file path are correct.');
                        testResultEl.addClass('beancount-test-success');

                    } catch (error) {
                        // 5. Handle Failure
                        testResultEl.setText(`❌ Failed: ${error.message}`);
                        testResultEl.addClass('beancount-test-error');
                        // Optional: Log full error for debugging
                        console.error("Beancount connection test failed:", error);
                    }
                }));

        // --- Transaction Form Settings ---
        containerEl.createEl('h3', { text: 'Transaction Form' });

        new Setting(containerEl)
            .setName('Default currency')
            .setDesc('The default currency to use in the transaction form.')
            .addText(text => text
                .setPlaceholder('USD')
                .setValue(this.plugin.settings.defaultCurrency)
                .onChange(async (value) => {
                    this.plugin.settings.defaultCurrency = value;
                    await this.plugin.saveSettings();
                }));
    }
}