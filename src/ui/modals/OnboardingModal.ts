// src/ui/modals/OnboardingModal.ts
import { App, Modal, Setting, Notice } from 'obsidian';
import type BeancountPlugin from '../../main';
import { DEMO_LEDGER_CONTENT } from '../../services/demo-ledger';
import { Logger } from '../../utils/logger';

export class OnboardingModal extends Modal {
    plugin: BeancountPlugin;

    constructor(app: App, plugin: BeancountPlugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: 'Welcome to Obsidian Finance' });
        contentEl.createEl('p', { text: 'To get started, we need to know where your Beancount ledger file is located.' });

        // Option 1: Existing File
        const existingSection = contentEl.createDiv({ cls: 'onboarding-section' });
        existingSection.style.marginBottom = '20px';
        existingSection.createEl('h3', { text: 'Option 1: I have an existing file' });

        new Setting(existingSection)
            .setName('Beancount File Path')
            .setDesc('Absolute path to your .beancount file')
            .addText(text => text
                .setPlaceholder('/path/to/ledger.beancount')
                .onChange(async (value) => {
                    // We just store it in the plugin settings temporarily or validation?
                    // Ideally we have a "Save" button.
                    this.plugin.settings.beancountFilePath = value;
                }));

        const saveBtn = existingSection.createEl('button', { text: 'Save & Continue' });
        saveBtn.onclick = async () => {
            if (this.plugin.settings.beancountFilePath) {
                await this.plugin.saveSettings();
                Logger.log('Onboarding: User selected existing file', this.plugin.settings.beancountFilePath);
                new Notice('Configuration saved!');
                this.close();
            } else {
                new Notice('Please enter a file path.');
            }
        };

        // Option 2: Demo Ledger
        const demoSection = contentEl.createDiv({ cls: 'onboarding-section' });
        demoSection.style.borderTop = '1px solid var(--background-modifier-border)';
        demoSection.style.paddingTop = '20px';
        demoSection.createEl('h3', { text: 'Option 2: Create a Demo Ledger' });
        demoSection.createEl('p', { text: 'New to Beancount? We can create a sample ledger file for you to explore the features.' });

        const createBtn = demoSection.createEl('button', { text: 'Create Demo Ledger', cls: 'mod-cta' });
        createBtn.onclick = async () => {
            await this.createDemoLedger();
        };
    }

    async createDemoLedger() {
        try {
            const fileName = 'example.beancount';
            const adapter = this.app.vault.adapter;
            // @ts-ignore
            const vaultRoot = adapter.getBasePath(); // This gives absolute path on Desktop

            // 1. Create file in Obsidian Vault
            // Check if exists first
            const existing = this.app.vault.getAbstractFileByPath(fileName);
            if (existing) {
                new Notice(`File ${fileName} already exists!`);
                // Use it?
                // Construct absolute path
                 // @ts-ignore
                const fullPath = adapter.getFullPath(fileName);
                this.plugin.settings.beancountFilePath = fullPath;
                await this.plugin.saveSettings();
                this.close();
                return;
            }

            // Create new
            await this.app.vault.create(fileName, DEMO_LEDGER_CONTENT);
            new Notice(`Created ${fileName}`);
            Logger.log('Onboarding: Created demo ledger');

            // 2. Set absolute path in settings
            // We need absolute path for the backend
            // @ts-ignore
            if (adapter.getFullPath) {
                 // @ts-ignore
                const fullPath = adapter.getFullPath(fileName);
                this.plugin.settings.beancountFilePath = fullPath;
                await this.plugin.saveSettings();

                Logger.log('Onboarding: Set settings path to', fullPath);
                new Notice('Demo ledger configured successfully!');
                this.close();
            } else {
                new Notice('Could not determine absolute path. Please configure settings manually.');
                Logger.error('Onboarding: adapter.getFullPath missing');
            }

        } catch (error) {
            Logger.error('Onboarding: Failed to create demo ledger', error);
            new Notice('Failed to create demo ledger.');
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
