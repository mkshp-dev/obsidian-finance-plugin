// settings.ts

import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';

// We need to import the main plugin class to type it correctly.
// We'll create a circular dependency, which is fine in this case.
import BeancountPlugin from './main';

export interface BeancountPluginSettings {
    beancountFilePath: string;
    beancountCommand: string;
}

export const DEFAULT_SETTINGS: BeancountPluginSettings = {
    beancountFilePath: '',
    beancountCommand: ''
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
        new Setting(containerEl)
            .setName('Path to beancount file')
            .setDesc('Enter the absolute path to your main .beancount file.')
            .addText(text => text
                .setPlaceholder('C:/Users/Asus/Documents/sample.beancount')
                .setValue(this.plugin.settings.beancountFilePath)
                .onChange(async (value) => {
                    this.plugin.settings.beancountFilePath = value;
                    await this.plugin.saveSettings();
                }));
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
    }
}