// src/ui/modals/OnboardingModal.ts
import { App, Modal, Setting, Notice, TFile } from 'obsidian';
import type BeancountPlugin from '../../main';
import { DEMO_LEDGER_CONTENT } from '../../services/demo-ledger';
import { Logger } from '../../utils/logger';
import { createStructuredFolder, getMainLedgerPath, getDemoTransactionsForYear, migrateToStructuredLayout } from '../../utils/structuredLayout';
import { runQuery } from '../../utils/index';
import { ConfirmModal } from './ConfirmModal';
import { SystemDetector } from '../../utils/SystemDetector';
import { UNIFIED_DASHBOARD_VIEW_TYPE } from '../views/dashboard/unified-dashboard-view';

type DataChoice = 'demo' | 'existing';
type OnboardingStep = 'prerequisites' | 'file-setup' | 'verification';

export class OnboardingModal extends Modal {
    plugin: BeancountPlugin;
    
    // Current step
    private currentStep: OnboardingStep = 'prerequisites';
    
    // Prerequisites check results
    private prerequisitesChecked: boolean = false;
    private pythonValid: boolean = false;
    private beanQueryValid: boolean = false;
    private pythonCommand: string | null = null;
    private beanQueryCommand: string | null = null;
    private pythonVersion: string | null = null;
    private beanQueryVersion: string | null = null;
    private prerequisiteErrors: string[] = [];
    
    // Choices
    private dataChoice: DataChoice | null = null;
    private existingFilePath: string = '';
    private structuredFolderName: string = 'Finances';
    private operatingCurrency: string = 'USD'; // Default operating currency

    constructor(app: App, plugin: BeancountPlugin) {
        super(app);
        this.plugin = plugin;
        // Initialize with existing setting if available
        this.operatingCurrency = plugin.settings.operatingCurrency || 'USD';
    }

    onOpen() {
        this.render();
    }

    private render() {
        const { contentEl } = this;
        contentEl.empty();

        // Header with step indicator
        const header = contentEl.createDiv({ cls: 'onboarding-header' });
        header.createEl('h2', { text: 'Welcome to Obsidian Finance' });
        
        // Step indicator
        const stepIndicator = header.createDiv({ cls: 'step-indicator' });
        stepIndicator.style.display = 'flex';
        stepIndicator.style.gap = '10px';
        stepIndicator.style.marginTop = '10px';
        stepIndicator.style.marginBottom = '20px';
        
        const steps = [
            { id: 'prerequisites', label: '1. Prerequisites', icon: '🔍' },
            { id: 'file-setup', label: '2. File Setup', icon: '📁' },
            { id: 'verification', label: '3. Verification', icon: '✅' }
        ];
        
        steps.forEach(step => {
            const stepEl = stepIndicator.createDiv({ cls: 'step-item' });
            stepEl.style.display = 'flex';
            stepEl.style.alignItems = 'center';
            stepEl.style.gap = '5px';
            stepEl.style.padding = '5px 10px';
            stepEl.style.borderRadius = '5px';
            stepEl.style.fontSize = '0.9em';
            
            if (step.id === this.currentStep) {
                stepEl.style.backgroundColor = 'var(--interactive-accent)';
                stepEl.style.color = 'var(--text-on-accent)';
                stepEl.style.fontWeight = 'bold';
            } else {
                stepEl.style.backgroundColor = 'var(--background-modifier-border)';
                stepEl.style.color = 'var(--text-muted)';
            }
            
            stepEl.createSpan({ text: `${step.icon} ${step.label}` });
        });
        
        // Render current step
        switch (this.currentStep) {
            case 'prerequisites':
                this.renderPrerequisitesStep(contentEl);
                break;
            case 'file-setup':
                this.renderFileSetupStep(contentEl);
                break;
            case 'verification':
                this.renderVerificationStep(contentEl);
                break;
        }
    }
    
    private renderPrerequisitesStep(contentEl: HTMLElement) {
        contentEl.createEl('p', { 
            text: 'First, let\'s verify that your system has the required tools installed.',
            cls: 'setting-item-description'
        });
        
        // Requirements section
        const reqSection = contentEl.createDiv({ cls: 'requirements-section' });
        reqSection.style.marginBottom = '20px';
        reqSection.style.padding = '15px';
        reqSection.style.border = '1px solid var(--background-modifier-border)';
        reqSection.style.borderRadius = '5px';
        
        reqSection.createEl('h4', { text: '📋 Required Software' });
        const reqList = reqSection.createEl('ul');
        reqList.style.marginLeft = '20px';
        reqList.createEl('li', { text: 'Python 3.8 or higher' });
        reqList.createEl('li', { text: 'Beancount v3+ (with bean-query command)' });
        
        const optionalNote = reqSection.createEl('p', { cls: 'setting-item-description' });
        optionalNote.style.marginTop = '10px';
        optionalNote.style.fontStyle = 'italic';
        optionalNote.innerHTML = '<strong>Note:</strong> bean-price is optional and only needed for automated price fetching.';
        
        // Detection status
        if (this.prerequisitesChecked) {
            const statusSection = contentEl.createDiv({ cls: 'detection-results' });
            statusSection.style.marginBottom = '20px';
            statusSection.style.padding = '15px';
            statusSection.style.border = '1px solid var(--background-modifier-border)';
            statusSection.style.borderRadius = '5px';
            
            statusSection.createEl('h4', { text: '🎯 Detection Results' });
            
            // Commands grid
            const commandsGrid = statusSection.createDiv({ cls: 'commands-grid' });
            commandsGrid.style.display = 'grid';
            commandsGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(250px, 1fr))';
            commandsGrid.style.gap = '15px';
            commandsGrid.style.marginTop = '15px';
            
            // Python card
            const pythonCard = commandsGrid.createDiv({ cls: 'command-item' });
            pythonCard.style.padding = '12px';
            pythonCard.style.border = '1px solid var(--background-modifier-border)';
            pythonCard.style.borderRadius = '5px';
            pythonCard.style.backgroundColor = this.pythonValid ? 'var(--background-modifier-success)' : 'var(--background-modifier-error)';
            
            const pythonHeader = pythonCard.createDiv({ cls: 'command-header' });
            pythonHeader.style.display = 'flex';
            pythonHeader.style.justifyContent = 'space-between';
            pythonHeader.style.alignItems = 'center';
            pythonHeader.style.marginBottom = '8px';
            pythonHeader.createEl('strong', { text: 'Python:' });
            pythonHeader.createEl('span', { text: this.pythonValid ? '✅' : '❌' });
            
            if (this.pythonValid) {
                const pythonCmd = pythonCard.createEl('code');
                pythonCmd.style.display = 'block';
                pythonCmd.style.fontSize = '0.85em';
                pythonCmd.style.marginBottom = '5px';
                pythonCmd.textContent = this.pythonCommand || '';
                
                if (this.pythonVersion) {
                    const pythonVer = pythonCard.createDiv();
                    pythonVer.style.fontSize = '0.85em';
                    pythonVer.style.color = 'var(--text-muted)';
                    pythonVer.innerHTML = `<strong>Version:</strong> ${this.pythonVersion}`;
                }
            } else {
                pythonCard.createDiv().textContent = 'Not found';
            }
            
            // Bean Query card
            const beanQueryCard = commandsGrid.createDiv({ cls: 'command-item' });
            beanQueryCard.style.padding = '12px';
            beanQueryCard.style.border = '1px solid var(--background-modifier-border)';
            beanQueryCard.style.borderRadius = '5px';
            beanQueryCard.style.backgroundColor = this.beanQueryValid ? 'var(--background-modifier-success)' : 'var(--background-modifier-error)';
            
            const beanQueryHeader = beanQueryCard.createDiv({ cls: 'command-header' });
            beanQueryHeader.style.display = 'flex';
            beanQueryHeader.style.justifyContent = 'space-between';
            beanQueryHeader.style.alignItems = 'center';
            beanQueryHeader.style.marginBottom = '8px';
            beanQueryHeader.createEl('strong', { text: 'Bean Query:' });
            beanQueryHeader.createEl('span', { text: this.beanQueryValid ? '✅' : '❌' });
            
            if (this.beanQueryValid) {
                const beanQueryCmd = beanQueryCard.createEl('code');
                beanQueryCmd.style.display = 'block';
                beanQueryCmd.style.fontSize = '0.85em';
                beanQueryCmd.style.marginBottom = '5px';
                beanQueryCmd.textContent = this.beanQueryCommand || '';
                
                if (this.beanQueryVersion) {
                    const beanQueryVer = beanQueryCard.createDiv();
                    beanQueryVer.style.fontSize = '0.85em';
                    beanQueryVer.style.color = 'var(--text-muted)';
                    beanQueryVer.innerHTML = `<strong>Version:</strong> ${this.beanQueryVersion}`;
                }
            } else {
                beanQueryCard.createDiv().textContent = 'Not found - Install Beancount';
            }
            
            // Show installation instructions if not all passed
            if (!this.pythonValid || !this.beanQueryValid) {
                this.renderInstallationInstructions(statusSection);
            }
        }
        
        // Action buttons
        const buttonContainer = contentEl.createDiv({ cls: 'onboarding-buttons' });
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'space-between';
        buttonContainer.style.marginTop = '20px';
        buttonContainer.style.gap = '10px';
        
        const checkBtn = buttonContainer.createEl('button', { text: '🔍 Check Prerequisites', cls: 'mod-cta' });
        checkBtn.onclick = async () => {
            await this.checkPrerequisites(checkBtn);
        };
        
        if (this.pythonValid && this.beanQueryValid) {
            const nextBtn = buttonContainer.createEl('button', { text: 'Next: File Setup →', cls: 'mod-cta' });
            nextBtn.onclick = () => {
                this.currentStep = 'file-setup';
                this.render();
            };
        }
        
        const skipBtn = buttonContainer.createEl('button', { text: 'Skip (Manual Config)', cls: 'mod-warning' });
        skipBtn.onclick = () => {
            new Notice('You can configure commands manually in Settings → Connection');
            this.close();
        };
    }
    
    private renderInstallationInstructions(parentEl: HTMLElement) {
        const installSection = parentEl.createDiv({ cls: 'installation-instructions' });
        installSection.style.marginTop = '20px';
        installSection.style.padding = '15px';
        installSection.style.backgroundColor = 'var(--background-primary-alt)';
        installSection.style.borderRadius = '5px';
        
        installSection.createEl('h5', { text: '📚 Installation Instructions' });
        
        const detector = SystemDetector.getInstance();
        const platform = detector['_systemInfo']?.platformDisplay || 'Unknown';
        
        // Platform-specific instructions
        const instructionsDiv = installSection.createDiv();
        instructionsDiv.style.marginTop = '10px';
        
        if (platform.includes('Windows')) {
            instructionsDiv.innerHTML = `
                <p><strong>Windows:</strong></p>
                <ol style="margin-left: 20px;">
                    <li>Install Python 3.8+ from <a href="https://www.python.org/downloads/">python.org</a></li>
                    <li>Open PowerShell or Command Prompt</li>
                    <li>Install Beancount: <code>pip install beancount</code></li>
                    <li>Verify installation: <code>bean-query --version</code></li>
                </ol>
                <p style="margin-top: 10px;"><strong>Alternative (WSL):</strong> Install in Windows Subsystem for Linux</p>
            `;
        } else if (platform.includes('macOS')) {
            instructionsDiv.innerHTML = `
                <p><strong>macOS:</strong></p>
                <ol style="margin-left: 20px;">
                    <li>Install Homebrew if not already installed: <code>/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"</code></li>
                    <li>Install Python: <code>brew install python@3.11</code></li>
                    <li>Install Beancount: <code>pip3 install beancount</code></li>
                    <li>Verify: <code>bean-query --version</code></li>
                </ol>
            `;
        } else {
            instructionsDiv.innerHTML = `
                <p><strong>Linux:</strong></p>
                <ol style="margin-left: 20px;">
                    <li>Install Python 3.8+: <code>sudo apt install python3 python3-pip</code> (Debian/Ubuntu)</li>
                    <li>Install Beancount: <code>pip3 install beancount</code></li>
                    <li>Verify: <code>bean-query --version</code></li>
                </ol>
            `;
        }
        
        const linkDiv = installSection.createDiv();
        linkDiv.style.marginTop = '15px';
        linkDiv.style.fontSize = '0.9em';
        linkDiv.innerHTML = '<p>📖 <a href="https://beancount.github.io/docs/installing_beancount.html" target="_blank">Official Beancount Installation Guide</a></p>';
    }
    
    private async checkPrerequisites(buttonEl: HTMLButtonElement) {
        const originalText = buttonEl.textContent;
        buttonEl.textContent = '⏳ Checking...';
        buttonEl.disabled = true;
        
        try {
            const detector = SystemDetector.getInstance();
            
            // Detect Python
            Logger.log('[Onboarding] Detecting Python environment...');
            const pythonResult = await detector.detectPythonEnvironment(false);
            
            // Detect bean-query
            Logger.log('[Onboarding] Detecting bean-query command...');
            const beanQueryResult = await detector.detectBeanQueryCommand(false, undefined);
            
            // Store results
            this.pythonValid = pythonResult.isValid;
            this.pythonCommand = pythonResult.command;
            this.pythonVersion = pythonResult.version;
            this.beanQueryValid = beanQueryResult.isValid;
            this.beanQueryCommand = beanQueryResult.command;
            this.beanQueryVersion = beanQueryResult.version;
            this.prerequisiteErrors = [...pythonResult.errors, ...beanQueryResult.errors];
            this.prerequisitesChecked = true;
            
            Logger.log('[Onboarding] Prerequisites check completed', {
                pythonValid: this.pythonValid,
                beanQueryValid: this.beanQueryValid
            });
            
            // Save detected commands to settings
            if (this.beanQueryValid && this.beanQueryCommand) {
                this.plugin.settings.beancountCommand = this.beanQueryCommand;
                await this.plugin.saveSettings();
            }
            
            this.render();
        } catch (error) {
            Logger.error('[Onboarding] Prerequisites check failed', error);
            new Notice('Prerequisites check failed. See console for details.');
            buttonEl.textContent = originalText;
            buttonEl.disabled = false;
        }
    }
    
    private renderFileSetupStep(contentEl: HTMLElement) {
        contentEl.createEl('p', { 
            text: 'Choose your starting point. A structured folder layout will be created to organize your finances.',
            cls: 'setting-item-description'
        });

        // Option A: Demo Data
        const demoSection = contentEl.createDiv({ cls: 'onboarding-section' });
        demoSection.style.marginBottom = '20px';
        demoSection.style.padding = '15px';
        demoSection.style.border = '1px solid var(--background-modifier-border)';
        demoSection.style.borderRadius = '5px';
        
        const demoHeader = demoSection.createDiv({ cls: 'onboarding-option-header' });
        demoHeader.style.display = 'flex';
        demoHeader.style.alignItems = 'center';
        demoHeader.style.marginBottom = '10px';
        
        const demoRadio = demoHeader.createEl('input', { 
            type: 'radio',
            attr: { name: 'data-choice', value: 'demo' }
        });
        demoRadio.style.marginRight = '10px';
        demoRadio.checked = this.dataChoice === 'demo';
        demoRadio.onchange = () => {
            this.dataChoice = 'demo';
            this.operatingCurrency = 'USD'; // Auto-set to USD for demo data
            this.render();
        };
        
        demoHeader.createEl('h3', { text: 'Start with Demo Data', cls: 'onboarding-option-title' });
        demoSection.createEl('p', { 
            text: 'Perfect for testing! We\'ll create sample accounts and transactions so you can explore the plugin features immediately.',
            cls: 'setting-item-description'
        });

        // Option B: Existing File
        const existingSection = contentEl.createDiv({ cls: 'onboarding-section' });
        existingSection.style.padding = '15px';
        existingSection.style.border = '1px solid var(--background-modifier-border)';
        existingSection.style.borderRadius = '5px';
        existingSection.style.marginBottom = '20px';
        
        const existingHeader = existingSection.createDiv({ cls: 'onboarding-option-header' });
        existingHeader.style.display = 'flex';
        existingHeader.style.alignItems = 'center';
        existingHeader.style.marginBottom = '10px';
        
        const existingRadio = existingHeader.createEl('input', { 
            type: 'radio',
            attr: { name: 'data-choice', value: 'existing' }
        });
        existingRadio.style.marginRight = '10px';
        existingRadio.checked = this.dataChoice === 'existing';
        existingRadio.onchange = () => {
            this.dataChoice = 'existing';
            this.render();
        };
        
        existingHeader.createEl('h3', { text: 'Use My Existing Ledger', cls: 'onboarding-option-title' });
        existingSection.createEl('p', { 
            text: 'Already have a Beancount file? Point us to it.',
            cls: 'setting-item-description'
        });

        // Show file path input if existing is selected
        if (this.dataChoice === 'existing') {
            // Get all .beancount files in the vault
            Logger.log('[Onboarding] Searching for .beancount files in vault...');
            const allFiles = this.app.vault.getFiles();
            Logger.log(`[Onboarding] Total files in vault: ${allFiles.length}`);
            
            const beancountFiles = allFiles
                .filter(file => {
                    const isBeancount = file.extension === 'beancount';
                    if (isBeancount) {
                        Logger.log(`[Onboarding] Found .beancount file: ${file.path} (extension: ${file.extension})`);
                    }
                    return isBeancount;
                })
                .map(file => file.path);
            
            Logger.log(`[Onboarding] Total .beancount files found: ${beancountFiles.length}`);
            Logger.log(`[Onboarding] Files: ${JSON.stringify(beancountFiles)}`);
            
            if (beancountFiles.length > 0) {
                // Show dropdown if there are .beancount files
                new Setting(existingSection)
                    .setName('Select Beancount file')
                    .setDesc('Choose from existing .beancount files in your vault')
                    .addDropdown(dropdown => {
                        dropdown.addOption('', '-- Select a file --');
                        beancountFiles.forEach(filePath => {
                            dropdown.addOption(filePath, filePath);
                        });
                        dropdown.setValue(this.existingFilePath);
                        dropdown.onChange(value => {
                            this.existingFilePath = value;
                        });
                    });
                
                // Also show manual input as fallback
                new Setting(existingSection)
                    .setName('Or enter path manually')
                    .setDesc('Absolute path to your .beancount file (if outside vault)')
                    .addText(text => text
                        .setPlaceholder('/path/to/your/ledger.beancount')
                        .setValue(this.existingFilePath)
                        .onChange(value => {
                            this.existingFilePath = value;
                        }));
            } else {
                // No .beancount files found, show only manual input
                existingSection.createEl('p', { 
                    text: 'No .beancount files found in vault.',
                    cls: 'setting-item-description',
                    attr: { style: 'color: var(--text-muted); font-style: italic; margin-bottom: 10px;' }
                });
                
                new Setting(existingSection)
                    .setName('Beancount file path')
                    .setDesc('Absolute path to your .beancount file')
                    .addText(text => text
                        .setPlaceholder('/path/to/your/ledger.beancount')
                        .setValue(this.existingFilePath)
                        .onChange(value => {
                            this.existingFilePath = value;
                        }));
            }
        }

        // Structured folder name setting
        const folderSection = contentEl.createDiv({ cls: 'onboarding-section' });
        folderSection.style.marginTop = '20px';
        folderSection.style.padding = '15px';
        folderSection.style.border = '1px solid var(--background-modifier-border)';
        folderSection.style.borderRadius = '5px';
        
        new Setting(folderSection)
            .setName('Structured folder name')
            .setDesc('Name of the folder where your organized finance files will be stored')
            .addText(text => text
                .setPlaceholder('Finances')
                .setValue(this.structuredFolderName)
                .onChange(value => {
                    this.structuredFolderName = value || 'Finances';
                }));
        
        // Operating currency setting
        new Setting(folderSection)
            .setName('Operating currency')
            .setDesc('The main currency for your financial records (e.g., USD, EUR, GBP)')
            .addText(text => text
                .setPlaceholder('USD')
                .setValue(this.operatingCurrency)
                .onChange(value => {
                    this.operatingCurrency = (value || 'USD').toUpperCase();
                }));
        
        // Show note about demo currency
        if (this.dataChoice === 'demo') {
            const currencyNote = folderSection.createDiv();
            currencyNote.style.marginTop = '5px';
            currencyNote.style.fontSize = '0.9em';
            currencyNote.style.color = 'var(--text-muted)';
            currencyNote.style.fontStyle = 'italic';
            currencyNote.innerHTML = '💡 <strong>Note:</strong> Demo data uses USD. You can change this setting later.';
        }

        // Setup button
        const buttonContainer = contentEl.createDiv({ cls: 'onboarding-buttons' });
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'space-between';
        buttonContainer.style.marginTop = '20px';
        buttonContainer.style.gap = '10px';

        const backBtn = buttonContainer.createEl('button', { text: '← Back to Prerequisites' });
        backBtn.onclick = () => {
            this.currentStep = 'prerequisites';
            this.render();
        };

        const setupBtn = buttonContainer.createEl('button', { text: 'Start Setup', cls: 'mod-cta' });
        setupBtn.onclick = async () => {
            if (!this.dataChoice) {
                new Notice('Please select an option');
                return;
            }
            
            if (this.dataChoice === 'existing' && !this.existingFilePath.trim()) {
                new Notice('Please enter the path to your existing file');
                return;
            }
            
            await this.handleFinish(setupBtn);
        };
    }
    
    private renderVerificationStep(contentEl: HTMLElement) {
        contentEl.createEl('p', { 
            text: 'Your Obsidian Finance plugin is now configured and ready to use!',
            cls: 'setting-item-description'
        });
        
        const successSection = contentEl.createDiv({ cls: 'success-section' });
        successSection.style.padding = '20px';
        successSection.style.marginTop = '20px';
        successSection.style.backgroundColor = 'var(--background-modifier-success)';
        successSection.style.border = '2px solid var(--color-green)';
        successSection.style.borderRadius = '5px';
        successSection.style.textAlign = 'center';
        
        successSection.createEl('h3', { text: '🎉 Setup Complete!' });
        
        const summaryDiv = successSection.createDiv();
        summaryDiv.style.marginTop = '15px';
        summaryDiv.style.textAlign = 'left';
        
        summaryDiv.createEl('h4', { text: 'Configuration Summary:' });
        const summaryList = summaryDiv.createEl('ul');
        summaryList.style.marginLeft = '20px';
        summaryList.createEl('li').innerHTML = `<strong>Python:</strong> ${this.pythonCommand} (${this.pythonVersion})`;
        summaryList.createEl('li').innerHTML = `<strong>Bean Query:</strong> ${this.beanQueryCommand}`;
        summaryList.createEl('li').innerHTML = `<strong>File Mode:</strong> Structured Layout (${this.structuredFolderName}/)`;
        summaryList.createEl('li').innerHTML = `<strong>Data Source:</strong> ${this.dataChoice === 'demo' ? 'Demo Data' : 'Existing Ledger'}`;
        summaryList.createEl('li').innerHTML = `<strong>Operating Currency:</strong> ${this.operatingCurrency}`;
        
        const nextStepsDiv = contentEl.createDiv();
        nextStepsDiv.style.marginTop = '20px';
        nextStepsDiv.style.padding = '15px';
        nextStepsDiv.style.border = '1px solid var(--background-modifier-border)';
        nextStepsDiv.style.borderRadius = '5px';
        
        nextStepsDiv.createEl('h4', { text: '🚀 Next Steps:' });
        const stepsList = nextStepsDiv.createEl('ol');
        stepsList.style.marginLeft = '20px';
        stepsList.createEl('li', { text: 'Open the Finance Dashboard (Command Palette → "Open Finance Dashboard")' });
        stepsList.createEl('li', { text: 'Explore the 5 tabs: Overview, Transactions, Journal, Balance Sheet, Commodities' });
        stepsList.createEl('li', { text: 'Try BQL queries in markdown notes with code blocks' });
        stepsList.createEl('li', { text: 'Customize settings in Settings → Obsidian Finance' });
        
        const buttonContainer = contentEl.createDiv({ cls: 'onboarding-buttons' });
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'center';
        buttonContainer.style.marginTop = '20px';
        
        const doneBtn = buttonContainer.createEl('button', { text: 'Open Dashboard & Close', cls: 'mod-cta' });
        doneBtn.onclick = async () => {
            // Use the plugin's activateView method to properly open the dashboard
            await (this.plugin as any).activateView(UNIFIED_DASHBOARD_VIEW_TYPE, 'tab');
            this.close();
        };
        
        const closeBtn = buttonContainer.createEl('button', { text: 'Close' });
        closeBtn.style.marginLeft = '10px';
        closeBtn.onclick = () => {
            this.close();
        };
    }

    private async handleFinish(buttonEl: HTMLButtonElement) {
        const originalText = buttonEl.textContent;
        buttonEl.textContent = 'Setting up...';
        buttonEl.disabled = true;

        try {
            // Always use structured layout
            if (this.dataChoice === 'demo') {
                await this.handleDemoStructured();
            } else if (this.dataChoice === 'existing') {
                await this.handleExistingStructured();
            }
            
            // Move to verification step on success
            this.currentStep = 'verification';
            this.render();
        } catch (error) {
            Logger.error('Onboarding: Setup failed', error);
            new Notice('Setup failed. Check console for details.');
            buttonEl.textContent = originalText;
            buttonEl.disabled = false;
        }
    }

    private async handleDemoStructured() {
        Logger.log('Onboarding: Demo + Structured');
        
        try {
            // Create structured folder with demo data
            await createStructuredFolder(this.plugin, this.structuredFolderName, true);
            
            // Add demo transactions to current year
            const currentYear = new Date().getFullYear();
            const yearFilePath = `${this.structuredFolderName}/transactions/${currentYear}.beancount`;
            const yearFile = this.app.vault.getAbstractFileByPath(yearFilePath);
            
            if (yearFile && yearFile instanceof TFile) {
                const demoContent = getDemoTransactionsForYear(currentYear);
                await this.app.vault.modify(yearFile, demoContent);
            }
            
            // Update settings
            const mainLedgerPath = getMainLedgerPath(this.plugin);
            this.plugin.settings.useStructuredLayout = true;
            this.plugin.settings.structuredFolderName = this.structuredFolderName;
            this.plugin.settings.structuredFolderPath = mainLedgerPath;
            this.plugin.settings.beancountFilePath = mainLedgerPath;
            this.plugin.settings.operatingCurrency = this.operatingCurrency; // Save operating currency
            await this.plugin.saveSettings();
            
            Logger.log('Onboarding: Created demo structured layout');
        } catch (error: any) {
            // If folder/files already exist, configure settings to use them
            if (error.message && error.message.includes('already exists')) {
                Logger.log('Onboarding: Structured folder already exists, configuring to use it');
                const mainLedgerPath = getMainLedgerPath(this.plugin);
                this.plugin.settings.useStructuredLayout = true;
                this.plugin.settings.structuredFolderName = this.structuredFolderName;
                this.plugin.settings.structuredFolderPath = mainLedgerPath;
                this.plugin.settings.beancountFilePath = mainLedgerPath;
                this.plugin.settings.operatingCurrency = this.operatingCurrency; // Save operating currency
                await this.plugin.saveSettings();
                
                Logger.log('Onboarding: Configured to use existing structured layout');
            } else {
                // Re-throw other errors
                throw error;
            }
        }
    }

    private async handleExistingStructured() {
        Logger.log('Onboarding: Existing + Structured - migrating');
        
        // Convert vault-relative path to absolute path if needed
        let absolutePath = this.existingFilePath;
        
        // Check if path is vault-relative (doesn't start with / or C:\ etc)
        if (!absolutePath.match(/^[a-zA-Z]:[\\\/]/) && !absolutePath.startsWith('/')) {
            // It's a vault-relative path, convert to absolute
            const file = this.app.vault.getAbstractFileByPath(absolutePath);
            if (file && file instanceof TFile) {
                // @ts-ignore
                absolutePath = this.app.vault.adapter.getFullPath(file.path);
                Logger.log(`[Onboarding] Converted vault path "${this.existingFilePath}" to absolute: "${absolutePath}"`);
            } else {
                Logger.error('[Onboarding] Could not find file in vault:', absolutePath);
                throw new Error(`Could not find file: ${absolutePath}`);
            }
        }
        
        // Temporarily set the file path for migration (MUST set useStructuredLayout=false so queries read from source)
        this.plugin.settings.beancountFilePath = absolutePath;
        this.plugin.settings.useStructuredLayout = false;
        await this.plugin.saveSettings();
        
        Logger.log(`[Onboarding] Starting migration with file: ${absolutePath}`);
        
        // Perform migration
        const result = await migrateToStructuredLayout(this.plugin, this.structuredFolderName);
        
        if (!result.success) {
            throw new Error(`Migration failed: ${result.error}`);
        }
        
        Logger.log('Onboarding: Migrated existing file to structured');
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
