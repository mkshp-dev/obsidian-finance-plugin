import { App, Modal, Setting, Notice } from 'obsidian';
import type BeancountPlugin from '../../main';
import { migrateToStructuredLayout, migrateToSingleFile } from '../../utils/structuredLayout';
import { Logger } from '../../utils/logger';

type MigrationDirection = 'to-structured' | 'to-single';

/**
 * Modal for confirming and configuring migration between single-file and structured layout modes.
 * Handles both migration directions with appropriate UI and validation.
 */
export class MigrationConfirmModal extends Modal {
    private plugin: BeancountPlugin;
    private direction: MigrationDirection;
    private folderName: string = 'Finances';
    private folderInput: HTMLInputElement | null = null;
    private migrating: boolean = false;

    constructor(app: App, plugin: BeancountPlugin, direction: MigrationDirection) {
        super(app);
        this.plugin = plugin;
        this.direction = direction;
        
        // Initialize folder name from settings if available
        if (plugin.settings.structuredFolderName) {
            this.folderName = plugin.settings.structuredFolderName;
        }
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        if (this.direction === 'to-structured') {
            this.renderToStructuredUI(contentEl);
        } else {
            this.renderToSingleUI(contentEl);
        }
    }

    private renderToStructuredUI(contentEl: HTMLElement) {
        contentEl.createEl('h2', { text: 'Migrate to Structured Layout' });
        
        contentEl.createEl('p', { 
            text: 'This will organize your ledger into separate files:' 
        });

        const listEl = contentEl.createEl('ul');
        const files = [
            'accounts.beancount - Account definitions',
            'commodities.beancount - Commodity definitions',
            'prices.beancount - Price directives',
            'transactions/ - Year-based transaction files',
            'balances.beancount - Balance assertions',
            'notes.beancount - Notes',
            'events.beancount - Events',
            'pads.beancount - Pad directives',
            'ledger.beancount - Main file with includes'
        ];
        files.forEach(file => listEl.createEl('li', { text: file }));

        // Folder name input
        new Setting(contentEl)
            .setName('Folder name')
            .setDesc('Name of the folder to create for your structured files')
            .addText(text => {
                this.folderInput = text.inputEl;
                text.setValue(this.folderName)
                    .setPlaceholder('Finances')
                    .onChange(value => {
                        this.folderName = value || 'Finances';
                    });
            });

        contentEl.createEl('p', { 
            cls: 'mod-warning',
            text: '⚠️ Your original file will NOT be modified. It will remain as-is.' 
        });

        // Buttons
        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => {
                    // Revert the toggle
                    this.plugin.settings.useStructuredLayout = false;
                    this.plugin.saveSettings().then(() => {
                        Logger.log('[Migration] User cancelled - reverted toggle');
                    });
                    this.close();
                }))
            .addButton(btn => btn
                .setButtonText('Migrate Now')
                .setCta()
                .onClick(async () => {
                    await this.performStructuredMigration(btn.buttonEl);
                }));
    }

    private renderToSingleUI(contentEl: HTMLElement) {
        contentEl.createEl('h2', { text: 'Migrate to Single File' });
        
        contentEl.createEl('p', { 
            text: 'This will consolidate all your structured files into a single ledger.beancount file at the vault root.' 
        });

        contentEl.createEl('p', { 
            text: 'The PRINT command will automatically follow all include statements and merge:' 
        });

        const listEl = contentEl.createEl('ul');
        const files = [
            'All account definitions',
            'All commodities and prices',
            'All transactions from all years',
            'All balances, notes, events, and pads'
        ];
        files.forEach(file => listEl.createEl('li', { text: file }));

        contentEl.createEl('p', { 
            cls: 'mod-warning',
            text: '⚠️ Your structured folder will NOT be modified. Files will remain in place.' 
        });

        contentEl.createEl('p', { 
            cls: 'mod-error',
            text: '❌ If ledger.beancount already exists at vault root, migration will fail. Please rename it first.' 
        });

        // Buttons
        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => {
                    // Revert the toggle
                    this.plugin.settings.useStructuredLayout = true;
                    this.plugin.saveSettings().then(() => {
                        Logger.log('[Migration] User cancelled - reverted toggle');
                    });
                    this.close();
                }))
            .addButton(btn => btn
                .setButtonText('Migrate Now')
                .setCta()
                .onClick(async () => {
                    await this.performSingleMigration(btn.buttonEl);
                }));
    }

    private async performStructuredMigration(buttonEl: HTMLButtonElement) {
        if (this.migrating) return;
        
        this.migrating = true;
        const originalText = buttonEl.textContent;
        buttonEl.textContent = 'Migrating...';
        buttonEl.disabled = true;

        try {
            Logger.log(`[Migration] Starting structured migration to folder: ${this.folderName}`);
            
            const result = await migrateToStructuredLayout(this.plugin, this.folderName);
            
            if (result.success) {
                new Notice('✓ Migration successful!');
                Logger.log('[Migration] Structured migration completed');
                this.close();
                
                // Refresh settings display if it's open
                // The settings tab will auto-refresh on next display() call
            } else {
                new Notice(`Migration failed: ${result.error || 'Unknown error'}`);
                Logger.error('[Migration] Structured migration failed:', result.error);
                
                // Revert toggle on failure
                this.plugin.settings.useStructuredLayout = false;
                await this.plugin.saveSettings();
                
                buttonEl.textContent = originalText;
                buttonEl.disabled = false;
                this.migrating = false;
            }
        } catch (error) {
            Logger.error('[Migration] Structured migration error:', error);
            new Notice('Migration failed due to an error');
            
            // Revert toggle on error
            this.plugin.settings.useStructuredLayout = false;
            await this.plugin.saveSettings();
            
            buttonEl.textContent = originalText;
            buttonEl.disabled = false;
            this.migrating = false;
        }
    }

    private async performSingleMigration(buttonEl: HTMLButtonElement) {
        if (this.migrating) return;
        
        this.migrating = true;
        const originalText = buttonEl.textContent;
        buttonEl.textContent = 'Migrating...';
        buttonEl.disabled = true;

        try {
            Logger.log('[Migration] Starting single file migration');
            
            const result = await migrateToSingleFile(this.plugin);
            
            if (result.success) {
                new Notice('✓ Migration successful!');
                Logger.log('[Migration] Single file migration completed');
                this.close();
            } else {
                new Notice(`Migration failed: ${result.error || 'Unknown error'}`);
                Logger.error('[Migration] Single file migration failed:', result.error);
                
                // Revert toggle on failure
                this.plugin.settings.useStructuredLayout = true;
                await this.plugin.saveSettings();
                
                buttonEl.textContent = originalText;
                buttonEl.disabled = false;
                this.migrating = false;
            }
        } catch (error) {
            Logger.error('[Migration] Single file migration error:', error);
            new Notice('Migration failed due to an error');
            
            // Revert toggle on error
            this.plugin.settings.useStructuredLayout = true;
            await this.plugin.saveSettings();
            
            buttonEl.textContent = originalText;
            buttonEl.disabled = false;
            this.migrating = false;
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
