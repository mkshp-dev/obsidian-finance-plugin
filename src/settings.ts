// src/settings.ts

import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type BeancountPlugin from './main';
import { getTestConnectionQuery } from './queries/index';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { resolve } from 'path';

const execAsync = promisify(exec);

// Status types for LED display
interface SystemStatus {
    status: 'ok' | 'warning' | 'error' | 'unknown';
    message: string;
    details?: string;
}

interface SystemCheckResult {
    python: SystemStatus;
    beancount: SystemStatus;
    beanQuery: SystemStatus;
    beanPrice: SystemStatus;
    flask: SystemStatus;
    flaskCors: SystemStatus;
    beancountFile: SystemStatus;
    beancountSyntax: SystemStatus;
}

export interface BeancountPluginSettings {
    beancountFilePath: string;
    beancountCommand: string;
    defaultCurrency: string;
    reportingCurrency: string;
    maxTransactionResults: number;
    maxJournalResults: number;
    // BQL Code Block Settings
    bqlShowTools: boolean;
    bqlShowQuery: boolean;
    // BQL Shorthand Template File
    bqlShorthandsTemplatePath: string;
}

export const DEFAULT_SETTINGS: BeancountPluginSettings = {
    beancountFilePath: '',
    beancountCommand: '',
    defaultCurrency: 'USD',
    reportingCurrency: 'INR',
    maxTransactionResults: 2000,
    maxJournalResults: 1000,
    // BQL Code Block Settings
    bqlShowTools: true,
    bqlShowQuery: false,
    // BQL Shorthand Template File
    bqlShorthandsTemplatePath: ''
}

export class BeancountSettingTab extends PluginSettingTab {
    plugin: BeancountPlugin;
    private statusContainer: HTMLElement | null = null;

    constructor(app: App, plugin: BeancountPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    /**
     * Check if Python is available
     */
    private async checkPython(): Promise<SystemStatus> {
        try {
            const { stdout } = await execAsync('python --version', { timeout: 5000 });
            const version = stdout.trim();
            if (version.includes('Python 3.')) {
                const versionMatch = version.match(/Python (\d+\.\d+)/);
                const versionNum = versionMatch ? parseFloat(versionMatch[1]) : 0;
                if (versionNum >= 3.8) {
                    return { status: 'ok', message: 'Python Available', details: version };
                } else {
                    return { status: 'warning', message: 'Python < 3.8', details: `${version} (3.8+ recommended)` };
                }
            }
            return { status: 'error', message: 'Python 2 Detected', details: `${version} (Python 3.8+ required)` };
        } catch (error) {
            try {
                const { stdout } = await execAsync('python3 --version', { timeout: 5000 });
                const version = stdout.trim();
                return { status: 'ok', message: 'Python3 Available', details: version };
            } catch (error2) {
                return { status: 'error', message: 'Python Not Found', details: 'Install Python 3.8+' };
            }
        }
    }

    /**
     * Check if Beancount is available
     */
    private async checkBeancount(): Promise<SystemStatus> {
        try {
            const { stdout } = await execAsync('python -c "import beancount; print(beancount.__version__)"', { timeout: 5000 });
            const version = stdout.trim();
            return { status: 'ok', message: 'Beancount Available', details: `v${version}` };
        } catch (error) {
            try {
                const { stdout } = await execAsync('python3 -c "import beancount; print(beancount.__version__)"', { timeout: 5000 });
                const version = stdout.trim();
                return { status: 'ok', message: 'Beancount Available', details: `v${version}` };
            } catch (error2) {
                return { status: 'error', message: 'Beancount Not Found', details: 'Run: pip install beancount' };
            }
        }
    }

    /**
     * Check if bean-query command is available
     */
    private async checkBeanQuery(): Promise<SystemStatus> {
        const command = this.plugin.settings.beancountCommand || 'bean-query';
        try {
            const testCommand = command.includes('wsl') ? 
                `${command} --help` : 
                `"${command}" --help`;
            
            await execAsync(testCommand, { timeout: 5000 });
            return { status: 'ok', message: 'Bean-Query Available', details: command };
        } catch (error) {
            if (error.code === 'ENOENT' || error.message.includes('not found')) {
                return { status: 'error', message: 'Bean-Query Not Found', details: 'Check command path' };
            }
            // Command exists but returns error (which is normal for --help in some versions)
            return { status: 'ok', message: 'Bean-Query Available', details: command };
        }
    }

    /**
     * Check if bean-price command is available
     */
    private async checkBeanPrice(): Promise<SystemStatus> {
        try {
            await execAsync('bean-price --help', { timeout: 5000 });
            return { status: 'ok', message: 'Bean-Price Available', details: 'For automated pricing' };
        } catch (error) {
            if (error.code === 'ENOENT' || error.message.includes('not found')) {
                return { status: 'warning', message: 'Bean-Price Not Found', details: 'Optional for price fetching' };
            }
            return { status: 'ok', message: 'Bean-Price Available', details: 'For automated pricing' };
        }
    }

    /**
     * Check if Flask is available
     */
    private async checkFlask(): Promise<SystemStatus> {
        try {
            const { stdout } = await execAsync('python -c "import flask; print(flask.__version__)"', { timeout: 5000 });
            const version = stdout.trim();
            return { status: 'ok', message: 'Flask Available', details: `v${version}` };
        } catch (error) {
            try {
                const { stdout } = await execAsync('python3 -c "import flask; print(flask.__version__)"', { timeout: 5000 });
                const version = stdout.trim();
                return { status: 'ok', message: 'Flask Available', details: `v${version}` };
            } catch (error2) {
                return { status: 'warning', message: 'Flask Not Found', details: 'Auto-install on first use' };
            }
        }
    }

    /**
     * Check if Flask-CORS is available
     */
    private async checkFlaskCors(): Promise<SystemStatus> {
        try {
            const { stdout } = await execAsync('python -c "import flask_cors; print(flask_cors.__version__)"', { timeout: 5000 });
            const version = stdout.trim();
            return { status: 'ok', message: 'Flask-CORS Available', details: `v${version}` };
        } catch (error) {
            try {
                const { stdout } = await execAsync('python3 -c "import flask_cors; print(flask_cors.__version__)"', { timeout: 5000 });
                const version = stdout.trim();
                return { status: 'ok', message: 'Flask-CORS Available', details: `v${version}` };
            } catch (error2) {
                return { status: 'warning', message: 'Flask-CORS Not Found', details: 'Auto-install on first use' };
            }
        }
    }

    /**
     * Check if Beancount file exists and is readable
     */
    private async checkBeancountFile(): Promise<SystemStatus> {
        const filePath = this.plugin.settings.beancountFilePath;
        if (!filePath) {
            return { status: 'warning', message: 'No File Configured', details: 'Set beancount file path' };
        }

        try {
            const resolvedPath = resolve(filePath);
            if (!existsSync(resolvedPath)) {
                return { status: 'error', message: 'File Not Found', details: filePath };
            }

            if (!filePath.toLowerCase().endsWith('.beancount') && !filePath.toLowerCase().endsWith('.bean')) {
                return { status: 'warning', message: 'Unexpected Extension', details: 'Should be .beancount or .bean' };
            }

            return { status: 'ok', message: 'File Found', details: filePath };
        } catch (error) {
            return { status: 'error', message: 'File Access Error', details: error.message };
        }
    }

    /**
     * Check if Beancount file has valid syntax by running a simple query
     */
    private async checkBeancountSyntax(): Promise<SystemStatus> {
        if (!this.plugin.settings.beancountCommand || !this.plugin.settings.beancountFilePath) {
            return { status: 'warning', message: 'Cannot Test Syntax', details: 'Configure command and file first' };
        }

        try {
            const query = getTestConnectionQuery();
            const result = await this.plugin.runQuery(query);
            
            if (result && result.trim().length > 0) {
                return { status: 'ok', message: 'Valid Beancount File', details: 'Syntax check passed' };
            } else {
                return { status: 'warning', message: 'Empty Result', details: 'File parsed but no data' };
            }
        } catch (error) {
            const errorMsg = error.message.toLowerCase();
            if (errorMsg.includes('syntax') || errorMsg.includes('parse') || errorMsg.includes('lexer')) {
                return { status: 'error', message: 'Syntax Error', details: 'Check beancount file syntax' };
            } else if (errorMsg.includes('not found') || errorMsg.includes('no such file')) {
                return { status: 'error', message: 'File Not Found', details: 'Check file path' };
            } else {
                return { status: 'error', message: 'Query Failed', details: error.message };
            }
        }
    }

    /**
     * Run all system checks
     */
    private async runSystemChecks(): Promise<SystemCheckResult> {
        const checks = await Promise.allSettled([
            this.checkPython(),
            this.checkBeancount(),
            this.checkBeanQuery(),
            this.checkBeanPrice(),
            this.checkFlask(),
            this.checkFlaskCors(),
            this.checkBeancountFile(),
            this.checkBeancountSyntax()
        ]);

        const getResult = (result: PromiseSettledResult<SystemStatus>): SystemStatus => {
            if (result.status === 'fulfilled') {
                return result.value;
            } else {
                return { status: 'error', message: 'Check Failed', details: result.reason?.message || 'Unknown error' };
            }
        };

        return {
            python: getResult(checks[0]),
            beancount: getResult(checks[1]),
            beanQuery: getResult(checks[2]),
            beanPrice: getResult(checks[3]),
            flask: getResult(checks[4]),
            flaskCors: getResult(checks[5]),
            beancountFile: getResult(checks[6]),
            beancountSyntax: getResult(checks[7])
        };
    }

    /**
     * Create LED-style status indicator
     */
    private createStatusLED(status: 'ok' | 'warning' | 'error' | 'unknown'): HTMLElement {
        const led = document.createElement('span');
        led.style.cssText = `
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 8px;
            border: 1px solid rgba(0,0,0,0.2);
            box-shadow: inset 0 1px 2px rgba(0,0,0,0.2);
        `;

        switch (status) {
            case 'ok':
                led.style.background = 'radial-gradient(circle at 30% 30%, #4CAF50, #2E7D32)';
                led.style.boxShadow += ', 0 0 4px #4CAF50';
                break;
            case 'warning':
                led.style.background = 'radial-gradient(circle at 30% 30%, #FF9800, #F57C00)';
                led.style.boxShadow += ', 0 0 4px #FF9800';
                break;
            case 'error':
                led.style.background = 'radial-gradient(circle at 30% 30%, #F44336, #C62828)';
                led.style.boxShadow += ', 0 0 4px #F44336';
                break;
            default:
                led.style.background = 'radial-gradient(circle at 30% 30%, #9E9E9E, #616161)';
                break;
        }

        return led;
    }

    /**
     * Create status display panel
     */
    private createStatusPanel(container: HTMLElement): HTMLElement {
        const panel = container.createEl('div', {
            cls: 'beancount-status-panel'
        });

        panel.style.cssText = `
            background: var(--background-secondary);
            border: 1px solid var(--background-modifier-border);
            border-radius: 8px;
            padding: 16px;
            margin: 16px 0;
            font-family: var(--font-monospace);
            font-size: 0.9em;
        `;

        const header = panel.createEl('div', {
            text: '🖥️ System Status',
            attr: {
                style: 'font-weight: 600; margin-bottom: 12px; font-size: 1.1em; font-family: var(--font-ui);'
            }
        });

        const statusGrid = panel.createEl('div', {
            attr: {
                style: 'display: grid; grid-template-columns: 1fr 1fr; gap: 8px;'
            }
        });

        return statusGrid;
    }

    /**
     * Update status display
     */
    private async updateStatusDisplay(): Promise<void> {
        if (!this.statusContainer) return;

        // Show loading state
        this.statusContainer.empty();
        const loadingEl = this.statusContainer.createEl('div', {
            text: '🔄 Checking system status...',
            attr: { style: 'text-align: center; padding: 20px; color: var(--text-muted);' }
        });

        try {
            const results = await this.runSystemChecks();
            
            // Clear loading and show results
            this.statusContainer.empty();
            
            const statusItems = [
                { label: 'Python', status: results.python },
                { label: 'Beancount', status: results.beancount },
                { label: 'Bean-Query', status: results.beanQuery },
                { label: 'Bean-Price', status: results.beanPrice },
                { label: 'Flask', status: results.flask },
                { label: 'Flask-CORS', status: results.flaskCors },
                { label: 'Beancount File', status: results.beancountFile },
                { label: 'File Syntax', status: results.beancountSyntax }
            ];

            statusItems.forEach(item => {
                const statusRow = this.statusContainer!.createEl('div', {
                    attr: {
                        style: 'display: flex; align-items: center; padding: 6px 0; cursor: help;'
                    }
                });

                const led = this.createStatusLED(item.status.status);
                statusRow.appendChild(led);

                const labelEl = statusRow.createEl('span', {
                    text: item.label,
                    attr: { style: 'flex: 1; font-weight: 500;' }
                });

                const messageEl = statusRow.createEl('span', {
                    text: item.status.message,
                    attr: { style: 'font-size: 0.8em; opacity: 0.8;' }
                });

                // Add tooltip with details
                if (item.status.details) {
                    statusRow.title = `${item.label}: ${item.status.details}`;
                }
            });

        } catch (error) {
            this.statusContainer.empty();
            this.statusContainer.createEl('div', {
                text: `❌ Status check failed: ${error.message}`,
                attr: { style: 'color: var(--text-error); text-align: center; padding: 20px;' }
            });
        }
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

        // --- System Status Panel ---
        containerEl.createEl('h3', { text: 'System Status' });
        this.statusContainer = this.createStatusPanel(containerEl);
        
        // Add refresh button
        new Setting(containerEl)
            .setName('System diagnostics')
            .setDesc('Check if all required dependencies are properly installed and configured.')
            .addButton(button => button
                .setButtonText('🔄 Refresh Status')
                .onClick(async () => {
                    await this.updateStatusDisplay();
                }));

        // Initial status check
        this.updateStatusDisplay();

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
                        
                        // Auto-refresh status when command changes
                        setTimeout(() => this.updateStatusDisplay(), 500);
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
                        
                        // Auto-refresh status when file path changes
                        setTimeout(() => this.updateStatusDisplay(), 500);
                    });

                // Initial validation
                if (this.plugin.settings.beancountFilePath) {
                    const validation = this.validateFilePath(this.plugin.settings.beancountFilePath);
                    this.updateValidationDisplay(validationEl, validation);
                }
                // Give the input element a stable id so other parts of the settings UI can update it
                try {
                    // TextComponent exposes 'inputEl' at runtime
                    (text as any).inputEl.id = 'beancount-file-input';
                } catch (e) {
                    // Ignore if not present
                }

                return text;
            });

        // Add a helper button to choose a .beancount file from the current vault (if any)
        new Setting(containerEl)
            .setName('Choose from vault')
            .setDesc('Pick a .beancount/.bean file that exists inside this Obsidian vault.')
            .addButton(btn => btn
                .setButtonText('Choose file in vault')
                .onClick(() => {
                    this.showVaultBeancountPicker();
                })
            );

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
                    
                    // Auto-refresh status after test
                    setTimeout(() => this.updateStatusDisplay(), 1000);
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

        // --- Performance Settings ---
        containerEl.createEl('h3', { text: 'Performance' });

        new Setting(containerEl)
            .setName('Max transaction results')
            .setDesc('Maximum number of transactions to load at once (to prevent memory issues with large datasets).')
            .addText(text => text
                .setPlaceholder('2000')
                .setValue(this.plugin.settings.maxTransactionResults.toString())
                .onChange(async (value) => {
                    const numValue = parseInt(value);
                    if (!isNaN(numValue) && numValue > 0 && numValue <= 10000) {
                        this.plugin.settings.maxTransactionResults = numValue;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('Max journal results')
            .setDesc('Maximum number of journal entries to load at once.')
            .addText(text => text
                .setPlaceholder('1000')
                .setValue(this.plugin.settings.maxJournalResults.toString())
                .onChange(async (value) => {
                    const numValue = parseInt(value);
                    if (!isNaN(numValue) && numValue > 0 && numValue <= 5000) {
                        this.plugin.settings.maxJournalResults = numValue;
                        await this.plugin.saveSettings();
                    }
                }));

        // --- BQL Code Block Settings ---
        containerEl.createEl('h3', { text: 'BQL Code Blocks' });

        new Setting(containerEl)
            .setName('Show query tools')
            .setDesc('Display refresh, copy, and download buttons above BQL query results. When disabled, only a clean table is shown.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.bqlShowTools)
                .onChange(async (value) => {
                    this.plugin.settings.bqlShowTools = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Show query text')
            .setDesc('Display the BQL query text above the results in a collapsible section.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.bqlShowQuery)
                .onChange(async (value) => {
                    this.plugin.settings.bqlShowQuery = value;
                    await this.plugin.saveSettings();
                }));

        // --- BQL Shorthand Template File ---
        containerEl.createEl('h3', { text: 'BQL Shortcuts Template' });

        const templateSetting = new Setting(containerEl)
            .setName('Shortcuts template file')
            .setDesc('Path to markdown file containing BQL shortcut definitions. Leave empty to use defaults.');

        // Create a container for the file picker components
        const filePickerContainer = templateSetting.controlEl.createDiv({ cls: 'bql-template-file-picker' });
        
        // Create text input with autocomplete
        const textInput = filePickerContainer.createEl('input', {
            type: 'text',
            placeholder: 'e.g., BQL_Shortcuts.md or /full/path/to/file.md',
            value: this.plugin.settings.bqlShorthandsTemplatePath
        });
        textInput.style.width = '300px';
        textInput.style.marginRight = '8px';
        
        // Add autocomplete functionality
        this.setupFileAutocomplete(textInput);
        
        // Handle text input changes
        textInput.addEventListener('input', async (event) => {
            const value = (event.target as HTMLInputElement).value;
            this.plugin.settings.bqlShorthandsTemplatePath = value;
            await this.plugin.saveSettings();
        });
        
        // Browse button for file selection
        const browseButton = filePickerContainer.createEl('button', {
            text: '📁 Browse',
            cls: 'mod-cta'
        });
        browseButton.style.marginRight = '8px';
        browseButton.addEventListener('click', () => {
            this.showFileSuggestModal(textInput);
        });
        
        // Create Template button
        const createButton = filePickerContainer.createEl('button', {
            text: '✨ Create Template',
        });
        createButton.addEventListener('click', async () => {
            const templatePath = this.plugin.settings.bqlShorthandsTemplatePath.trim();
            if (!templatePath) {
                new Notice('Please specify a template file path first');
                return;
            }
            
            const { ShorthandParser } = await import('./utils/shorthandParser');
            try {
                ShorthandParser.createDefaultTemplateFile(templatePath);
                new Notice(`Created template file: ${templatePath}`);
            } catch (error) {
                new Notice(`Error creating template file: ${error.message}`);
            }
        });
        
        containerEl.createEl('p', { 
            text: 'Use bql-sh:SHORTCUT in your notes to insert live financial data. Edit the template file to customize shortcuts.',
            cls: 'setting-item-description' 
        });
    }

    /**
     * Set up file autocomplete for the template file input
     */
    private setupFileAutocomplete(input: HTMLInputElement) {
        let suggestionContainer: HTMLElement | null = null;
        
        const showSuggestions = (files: string[]) => {
            this.hideSuggestions();
            
            if (files.length === 0) return;
            
            suggestionContainer = document.createElement('div');
            suggestionContainer.className = 'bql-file-suggestions';
            suggestionContainer.style.cssText = `
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                background: var(--background-primary);
                border: 1px solid var(--background-modifier-border);
                border-radius: 6px;
                box-shadow: var(--shadow-s);
                max-height: 200px;
                overflow-y: auto;
                z-index: 1000;
            `;
            
            files.forEach((file, index) => {
                const item = document.createElement('div');
                item.className = 'bql-file-suggestion-item';
                item.textContent = file;
                item.style.cssText = `
                    padding: 8px 12px;
                    cursor: pointer;
                    border-bottom: 1px solid var(--background-modifier-border-hover);
                `;
                
                item.addEventListener('mouseenter', () => {
                    item.style.background = 'var(--background-modifier-hover)';
                });
                
                item.addEventListener('mouseleave', () => {
                    item.style.background = '';
                });
                
                item.addEventListener('click', () => {
                    input.value = file;
                    input.dispatchEvent(new Event('input'));
                    this.hideSuggestions();
                });
                
                if (index === files.length - 1) {
                    item.style.borderBottom = 'none';
                }
                
                suggestionContainer!.appendChild(item);
            });
            
            // Position container relative to input
            const inputRect = input.getBoundingClientRect();
            const parent = input.parentElement!;
            parent.style.position = 'relative';
            parent.appendChild(suggestionContainer);
        };
        
        this.hideSuggestions = () => {
            if (suggestionContainer) {
                suggestionContainer.remove();
                suggestionContainer = null;
            }
        };
        
        // Setup input event listener for autocomplete
        input.addEventListener('input', () => {
            const value = input.value.toLowerCase();
            if (value.length < 1) {
                this.hideSuggestions();
                return;
            }
            
            // Get markdown files from vault
            const markdownFiles = this.app.vault.getMarkdownFiles()
                .map(file => file.path)
                .filter(path => path.toLowerCase().includes(value))
                .slice(0, 10); // Limit to 10 suggestions
            
            showSuggestions(markdownFiles);
        });
        
        // Hide suggestions when clicking outside
        document.addEventListener('click', (event) => {
            if (!input.contains(event.target as Node) && !suggestionContainer?.contains(event.target as Node)) {
                this.hideSuggestions();
            }
        });
        
        // Handle keyboard navigation
        input.addEventListener('keydown', (event) => {
            if (!suggestionContainer) return;
            
            const items = Array.from(suggestionContainer.querySelectorAll('.bql-file-suggestion-item'));
            const activeIndex = items.findIndex(item => item.classList.contains('active'));
            
            switch (event.key) {
                case 'ArrowDown':
                    event.preventDefault();
                    const nextIndex = activeIndex < items.length - 1 ? activeIndex + 1 : 0;
                    this.setActiveSuggestion(items, nextIndex);
                    break;
                    
                case 'ArrowUp':
                    event.preventDefault();
                    const prevIndex = activeIndex > 0 ? activeIndex - 1 : items.length - 1;
                    this.setActiveSuggestion(items, prevIndex);
                    break;
                    
                case 'Enter':
                    event.preventDefault();
                    if (activeIndex >= 0) {
                        (items[activeIndex] as HTMLElement).click();
                    }
                    break;
                    
                case 'Escape':
                    this.hideSuggestions();
                    break;
            }
        });
    }

    private hideSuggestions: () => void = () => {};

    private setActiveSuggestion(items: Element[], index: number) {
        items.forEach((item, i) => {
            item.classList.toggle('active', i === index);
            if (i === index) {
                item.scrollIntoView({ block: 'nearest' });
            }
        });
    }

    /**
     * Show a file suggestion modal with all markdown files
     */
    private showFileSuggestModal(input: HTMLInputElement) {
        const modal = document.createElement('div');
        modal.className = 'bql-file-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        `;
        
        const modalContent = modal.createEl('div', {
            cls: 'bql-file-modal-content'
        });
        modalContent.style.cssText = `
            background: var(--background-primary);
            padding: 24px;
            border-radius: 8px;
            max-width: 600px;
            width: 90%;
            max-height: 80%;
            overflow-y: auto;
            border: 1px solid var(--background-modifier-border);
        `;
        
        modalContent.createEl('h3', { text: 'Select Template File' });
        
        const searchInput = modalContent.createEl('input', {
            type: 'text',
            placeholder: 'Search markdown files...'
        });
        searchInput.style.cssText = `
            width: 100%;
            padding: 8px;
            margin-bottom: 16px;
            border: 1px solid var(--background-modifier-border);
            border-radius: 4px;
            background: var(--background-secondary);
            color: var(--text-normal);
        `;
        
        const fileList = modalContent.createEl('div', {
            cls: 'bql-file-list'
        });
        fileList.style.cssText = `
            max-height: 300px;
            overflow-y: auto;
            border: 1px solid var(--background-modifier-border);
            border-radius: 4px;
        `;
        
        const updateFileList = (filter = '') => {
            fileList.empty();
            
            const markdownFiles = this.app.vault.getMarkdownFiles()
                .filter(file => filter === '' || file.path.toLowerCase().includes(filter.toLowerCase()))
                .slice(0, 50); // Limit to 50 files
            
            if (markdownFiles.length === 0) {
                const noFiles = fileList.createEl('div', {
                    text: 'No markdown files found',
                    cls: 'bql-no-files'
                });
                noFiles.style.cssText = `
                    padding: 16px;
                    text-align: center;
                    color: var(--text-muted);
                    font-style: italic;
                `;
                return;
            }
            
            markdownFiles.forEach(file => {
                const item = fileList.createEl('div', {
                    text: file.path,
                    cls: 'bql-file-item'
                });
                item.style.cssText = `
                    padding: 8px 12px;
                    cursor: pointer;
                    border-bottom: 1px solid var(--background-modifier-border-hover);
                `;
                
                item.addEventListener('mouseenter', () => {
                    item.style.background = 'var(--background-modifier-hover)';
                });
                
                item.addEventListener('mouseleave', () => {
                    item.style.background = '';
                });
                
                item.addEventListener('click', () => {
                    input.value = file.path;
                    input.dispatchEvent(new Event('input'));
                    modal.remove();
                });
            });
        };
        
        // Initial file list
        updateFileList();
        
        // Search functionality
        searchInput.addEventListener('input', () => {
            updateFileList(searchInput.value);
        });
        
        // Close button
        const buttonContainer = modalContent.createEl('div');
        buttonContainer.style.cssText = `
            display: flex;
            justify-content: flex-end;
            margin-top: 16px;
            gap: 8px;
        `;
        
        const closeButton = buttonContainer.createEl('button', {
            text: 'Cancel'
        });
        closeButton.style.cssText = `
            padding: 8px 16px;
            border-radius: 4px;
            border: 1px solid var(--background-modifier-border);
            background: var(--interactive-normal);
            color: var(--text-normal);
            cursor: pointer;
        `;
        closeButton.addEventListener('click', () => modal.remove());
        
        // Close on background click
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.remove();
            }
        });
        
        document.body.appendChild(modal);
        searchInput.focus();
    }

    /**
     * Show a modal to pick a .beancount or .bean file from the current vault
     */
    private showVaultBeancountPicker() {
        const modal = document.createElement('div');
        modal.className = 'beancount-vault-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        `;

        const content = modal.createEl('div', { cls: 'beancount-vault-modal-content' });
        content.style.cssText = `
            background: var(--background-primary);
            padding: 20px;
            border-radius: 8px;
            width: 90%;
            max-width: 700px;
            max-height: 80%;
            overflow-y: auto;
            border: 1px solid var(--background-modifier-border);
        `;

        content.createEl('h3', { text: 'Select Beancount File in Vault' });

        const list = content.createEl('div', { cls: 'beancount-file-list' });
        list.style.cssText = `max-height: 400px; overflow-y: auto; border: 1px solid var(--background-modifier-border); border-radius: 4px;`;

        // Gather files from vault with .beancount or .bean extensions
        const allFiles = this.app.vault.getFiles();
        const beancountFiles = allFiles.filter(f => f.path.toLowerCase().endsWith('.beancount') || f.path.toLowerCase().endsWith('.bean'));

        if (beancountFiles.length === 0) {
            list.createEl('div', { text: 'No .beancount/.bean files found in this vault', cls: 'beancount-no-files' });
        } else {
            beancountFiles.forEach(file => {
                const item = list.createEl('div', { text: file.path, cls: 'beancount-file-item' });
                item.style.cssText = `padding: 8px 12px; cursor: pointer; border-bottom: 1px solid var(--background-modifier-border-hover);`;
                item.addEventListener('mouseenter', () => item.style.background = 'var(--background-modifier-hover)');
                item.addEventListener('mouseleave', () => item.style.background = '');
                item.addEventListener('click', async () => {
                    // Compute absolute path by combining vault base path and relative path
                    // @ts-ignore
                    const vaultBase: string = (this.app.vault.adapter as any).getBasePath();
                    // Normalize separators to forward slashes and remove trailing slash from vaultBase
                    const baseNormalized = vaultBase.replace(/\\/g, '/').replace(/\/$/, '');
                    const rel = file.path.replace(/\\/g, '/');
                    const absolutePath = `${baseNormalized}/${rel}`;
                    this.plugin.settings.beancountFilePath = absolutePath;
                    await this.plugin.saveSettings();
                    // Update the visible input element in settings (if present)
                    const inputEl = document.getElementById('beancount-file-input') as HTMLInputElement | null;
                    if (inputEl) {
                        inputEl.value = absolutePath;
                        // Trigger the input event so the existing onChange handler updates validation
                        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    // Refresh status display and close modal
                    setTimeout(() => this.updateStatusDisplay(), 300);
                    modal.remove();
                });
            });
        }

        const btnRow = content.createEl('div');
        btnRow.style.cssText = 'display:flex; justify-content:flex-end; gap:8px; margin-top:12px;';
        const cancel = btnRow.createEl('button', { text: 'Cancel' });
        cancel.addEventListener('click', () => modal.remove());

        document.body.appendChild(modal);
    }
}