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
}

export const DEFAULT_SETTINGS: BeancountPluginSettings = {
    beancountFilePath: '',
    beancountCommand: '',
    defaultCurrency: 'USD',
    reportingCurrency: 'INR',
    maxTransactionResults: 2000,
    maxJournalResults: 1000
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
    }
}