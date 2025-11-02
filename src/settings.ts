// src/settings.ts

import { App, PluginSettingTab, Setting, Notice } from 'obsidian'; // Added Notice for potential errors
import type BeancountPlugin from './main';
import { getTestConnectionQuery } from './queries/index';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { resolve } from 'path';

const execAsync = promisify(exec);
// ------------------------------------

export interface BeancountPluginSettings {
    beancountFilePath: string;
    beancountCommand: string;
    defaultCurrency: string;
    reportingCurrency: string;
}

export const DEFAULT_SETTINGS: BeancountPluginSettings = {
    beancountFilePath: '',
    beancountCommand: '',
    defaultCurrency: 'USD',
    reportingCurrency: 'INR'
}

export class BeancountSettingTab extends PluginSettingTab {
    plugin: BeancountPlugin;

    constructor(app: App, plugin: BeancountPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    /**
     * Validates if the beancount file path exists and is accessible
     */
    private validateFilePath(filePath: string): { isValid: boolean; message: string } {
        if (!filePath.trim()) {
            return { isValid: false, message: 'File path is required' };
        }

        try {
            const resolvedPath = resolve(filePath);
            if (!existsSync(resolvedPath)) {
                return { isValid: false, message: 'File does not exist' };
            }

            // Check if it's a .beancount file
            if (!filePath.toLowerCase().endsWith('.beancount') && !filePath.toLowerCase().endsWith('.bean')) {
                return { isValid: false, message: 'File should have .beancount or .bean extension' };
            }

            return { isValid: true, message: '✅ Valid file path' };
        } catch (error) {
            return { isValid: false, message: 'Invalid file path format' };
        }
    }

    /**
     * Validates if the beancount command is available
     */
    private async validateCommand(command: string): Promise<{ isValid: boolean; message: string }> {
        if (!command.trim()) {
            return { isValid: false, message: 'Command is required' };
        }

        try {
            // Test if command exists by running with --help
            const testCommand = command.includes('wsl') ? 
                `${command} --help` : 
                `"${command}" --help`;
            
            await execAsync(testCommand, { timeout: 5000 });
            return { isValid: true, message: '✅ Command is available' };
        } catch (error) {
            if (error.code === 'ENOENT' || error.message.includes('not found') || error.message.includes('not recognized')) {
                return { isValid: false, message: 'Command not found in PATH' };
            } else if (error.killed) {
                return { isValid: false, message: 'Command timeout (>5s)' };
            } else {
                // If it fails with other errors but the command exists, it might still be valid
                // (e.g., bean-query might exit with error code when called with --help)
                return { isValid: true, message: '⚠️ Command found (but returned error)' };
            }
        }
    }

    /**
     * Creates a validation display element
     */
    private createValidationElement(container: HTMLElement): HTMLElement {
        const validationEl = container.createEl('div', { 
            cls: 'beancount-validation-message',
            attr: { style: 'margin-top: 5px; font-size: 0.9em; opacity: 0.8;' }
        });
        return validationEl;
    }

    /**
     * Updates validation message display
     */
    private updateValidationDisplay(element: HTMLElement, result: { isValid: boolean; message: string }) {
        element.textContent = result.message;
        element.style.color = result.isValid ? '#4CAF50' : '#f44336';
    }

    /**
     * Validates currency code format
     */
    private validateCurrency(currency: string): { isValid: boolean; message: string } {
        if (!currency.trim()) {
            return { isValid: false, message: 'Currency is required' };
        }

        // Check if it's a valid 3-letter currency code
        const currencyRegex = /^[A-Z]{3}$/;
        if (!currencyRegex.test(currency.toUpperCase())) {
            return { isValid: false, message: 'Currency should be 3 letters (e.g., USD, EUR, INR)' };
        }

        return { isValid: true, message: '✅ Valid currency code' };
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
            .addText(text => {
                const validationEl = this.createValidationElement(containerEl);
                
                text
                    .setPlaceholder('bean-query')
                    .setValue(this.plugin.settings.beancountCommand)
                    .onChange(async (value) => {
                        this.plugin.settings.beancountCommand = value;
                        await this.plugin.saveSettings();
                        
                        // Real-time validation
                        if (value.trim()) {
                            validationEl.textContent = 'Validating command...';
                            validationEl.style.color = '#666';
                            
                            const validation = await this.validateCommand(value);
                            this.updateValidationDisplay(validationEl, validation);
                        } else {
                            validationEl.textContent = '';
                        }
                    });

                // Initial validation
                if (this.plugin.settings.beancountCommand) {
                    this.validateCommand(this.plugin.settings.beancountCommand)
                        .then(result => this.updateValidationDisplay(validationEl, result));
                }
                
                return text;
            });

        new Setting(containerEl)
            .setName('Path to beancount file')
            .setDesc('Enter the absolute path to your main .beancount file.')
            .addText(text => {
                const validationEl = this.createValidationElement(containerEl);
                
                text
                    .setPlaceholder('C:/Users/User/finances.beancount or /mnt/c/...')
                    .setValue(this.plugin.settings.beancountFilePath)
                    .onChange(async (value) => {
                        this.plugin.settings.beancountFilePath = value;
                        await this.plugin.saveSettings();
                        
                        // Real-time validation
                        if (value.trim()) {
                            const validation = this.validateFilePath(value);
                            this.updateValidationDisplay(validationEl, validation);
                        } else {
                            validationEl.textContent = '';
                        }
                    });

                // Initial validation
                if (this.plugin.settings.beancountFilePath) {
                    const validation = this.validateFilePath(this.plugin.settings.beancountFilePath);
                    this.updateValidationDisplay(validationEl, validation);
                }
                
                return text;
            });

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
                        const result = await this.plugin.runQuery(query); // Calls runQuery from main.ts
                        
                        // Check if result contains actual data
                        if (result && result.trim().length > 0) {
                            testResultEl.setText('✅ Success! Your command and file path are correct.');
                            testResultEl.addClass('beancount-test-success');
                        } else {
                            testResultEl.setText('⚠️ Warning: Connection works but no data returned. Check your beancount file.');
                            testResultEl.addClass('beancount-test-error');
                        }
                        // -----------------------------------

                    } catch (error) {
                        // 5. Handle Failure with more specific error messages
                        let errorMessage = error.message;
                        if (errorMessage.includes('command not found') || errorMessage.includes('not recognized')) {
                            errorMessage = 'Command not found. Please check your Beancount command path.';
                        } else if (errorMessage.includes('No such file') || errorMessage.includes('cannot find')) {
                            errorMessage = 'File not found. Please check your beancount file path.';
                        } else if (errorMessage.includes('Permission denied')) {
                            errorMessage = 'Permission denied. Please check file permissions.';
                        }
                        
                        testResultEl.setText(`❌ Failed: ${errorMessage}`);
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
            .addText(text => {
                const validationEl = this.createValidationElement(containerEl);
                
                text
                    .setPlaceholder('USD')
                    .setValue(this.plugin.settings.defaultCurrency)
                    .onChange(async (value) => {
                        this.plugin.settings.defaultCurrency = value.toUpperCase();
                        await this.plugin.saveSettings();
                        
                        // Real-time validation
                        if (value.trim()) {
                            const validation = this.validateCurrency(value);
                            this.updateValidationDisplay(validationEl, validation);
                        } else {
                            validationEl.textContent = '';
                        }
                        
                        // Update the input field to show uppercase
                        text.setValue(this.plugin.settings.defaultCurrency);
                    });

                // Initial validation
                if (this.plugin.settings.defaultCurrency) {
                    const validation = this.validateCurrency(this.plugin.settings.defaultCurrency);
                    this.updateValidationDisplay(validationEl, validation);
                }
                
                return text;
            });
        
        new Setting(containerEl)
            .setName('Reporting Currency')
            .setDesc('The currency to consolidate all totals into (e.g., USD, INR). You must have "price" entries for this to work.')
            .addText(text => {
                const validationEl = this.createValidationElement(containerEl);
                
                text
                    .setPlaceholder('USD')
                    .setValue(this.plugin.settings.reportingCurrency)
                    .onChange(async (value) => {
                        this.plugin.settings.reportingCurrency = value.toUpperCase();
                        await this.plugin.saveSettings();
                        
                        // Real-time validation
                        if (value.trim()) {
                            const validation = this.validateCurrency(value);
                            this.updateValidationDisplay(validationEl, validation);
                        } else {
                            validationEl.textContent = '';
                        }
                        
                        // Update the input field to show uppercase
                        text.setValue(this.plugin.settings.reportingCurrency);
                    });

                // Initial validation
                if (this.plugin.settings.reportingCurrency) {
                    const validation = this.validateCurrency(this.plugin.settings.reportingCurrency);
                    this.updateValidationDisplay(validationEl, validation);
                }
                
                return text;
            });
    }
}