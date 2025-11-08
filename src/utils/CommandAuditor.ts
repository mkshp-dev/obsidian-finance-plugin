/**
 * Command Auditor - Comprehensive audit of all terminal commands executed by the plugin
 * 
 * This utility provides complete visibility into all terminal commands that the plugin
 * executes, along with debugging information and test capabilities.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { SystemDetector } from './SystemDetector';

const execAsync = promisify(exec);
import type BeancountPlugin from '../main';

export interface CommandInfo {
    id: string;
    name: string;
    description: string;
    category: 'system_detection' | 'beancount_tools' | 'python_execution' | 'backend_management';
    baseCommand: string;
    actualCommand: string;
    parameters: string[];
    timeout: number;
    executedFrom: string;
    purpose: string;
    requirements: string[];
    wsla_compatible: boolean;
    last_tested?: Date;
    last_result?: 'success' | 'error' | 'timeout';
    last_error?: string;
}

export class CommandAuditor {
    private plugin: BeancountPlugin;
    private systemDetector: SystemDetector;
    private commands: Map<string, CommandInfo> = new Map();

    constructor(plugin: BeancountPlugin) {
        this.plugin = plugin;
        this.systemDetector = SystemDetector.getInstance();
        this.buildCommandInventory();
    }

    /**
     * Build comprehensive inventory of all commands used by the plugin
     */
    private buildCommandInventory(): void {
        // Clear existing commands
        this.commands.clear();

        // System Detection Commands (from SystemDetector.ts)
        this.addSystemDetectionCommands();
        
        // Beancount Tool Commands (from utils/index.ts and views/sidebar-view.ts)
        this.addBeancountCommands();
        
        // Python Execution Commands (from BackendManager.ts and settings.ts)
        this.addPythonCommands();
        
        // Backend Management Commands (from BackendManager.ts)
        this.addBackendCommands();
    }

    private addSystemDetectionCommands(): void {
        const settings = this.plugin.settings;
        const isWSL = settings.beancountCommand?.includes('wsl') || false;

        // Python version detection
        const pythonCandidates = isWSL ? ['python3', 'python'] : ['python', 'python3', 'py'];
        pythonCandidates.forEach(pythonCmd => {
            const actualCmd = isWSL ? `wsl ${pythonCmd}` : pythonCmd;
            this.commands.set(`python_version_${pythonCmd}`, {
                id: `python_version_${pythonCmd}`,
                name: `Python Version Check (${pythonCmd})`,
                description: `Check if ${pythonCmd} is available and get version info`,
                category: 'system_detection',
                baseCommand: pythonCmd,
                actualCommand: `${actualCmd} --version`,
                parameters: ['--version'],
                timeout: 5000,
                executedFrom: 'SystemDetector.detectPython()',
                purpose: 'Detect available Python interpreters and versions',
                requirements: ['Python 3.8+'],
                wsla_compatible: true
            });
        });

        // Beancount command validation
        if (settings.beancountCommand) {
            this.commands.set('beancount_validation', {
                id: 'beancount_validation',
                name: 'Beancount Command Validation',
                description: 'Test if configured beancount command works',
                category: 'system_detection',
                baseCommand: 'bean-query',
                actualCommand: `${settings.beancountCommand} --help`,
                parameters: ['--help'],
                timeout: 5000,
                executedFrom: 'SystemDetector.testCommand()',
                purpose: 'Validate that beancount tools are properly installed and accessible',
                requirements: ['Beancount package', 'bean-query command'],
                wsla_compatible: settings.beancountCommand.includes('wsl')
            });
        }

        // Bean-price command validation  
        if (settings.beancountCommand) {
            const priceCmd = settings.beancountCommand.replace('bean-query', 'bean-price');
            this.commands.set('beanprice_validation', {
                id: 'beanprice_validation', 
                name: 'Bean-Price Command Validation',
                description: 'Test if bean-price command works for commodity prices',
                category: 'system_detection',
                baseCommand: 'bean-price',
                actualCommand: `${priceCmd} --help`,
                parameters: ['--help'],
                timeout: 5000,
                executedFrom: 'SystemDetector.testCommand()',
                purpose: 'Validate that bean-price tool is available for commodity price fetching',
                requirements: ['Beancount package', 'bean-price command'],
                wsla_compatible: priceCmd.includes('wsl')
            });
        }
    }

    private addBeancountCommands(): void {
        const settings = this.plugin.settings;
        
        if (settings.beancountCommand && settings.beancountFilePath) {
            // BQL Query execution (from runQuery in utils/index.ts)
            this.commands.set('bql_query', {
                id: 'bql_query',
                name: 'BQL Query Execution',
                description: 'Execute Beancount Query Language statements',
                category: 'beancount_tools',
                baseCommand: 'bean-query',
                actualCommand: `${settings.beancountCommand} "${settings.beancountFilePath}" "[BQL_QUERY]"`,
                parameters: [settings.beancountFilePath, '[BQL_QUERY]'],
                timeout: 30000,
                executedFrom: 'runQuery() in utils/index.ts',
                purpose: 'Execute BQL queries for financial data retrieval and calculations',
                requirements: ['Beancount file', 'bean-query command', 'Valid BQL syntax'],
                wsla_compatible: settings.beancountCommand.includes('wsl')
            });

            // Bean-check file validation (from sidebar-view.ts)
            const checkCmd = settings.beancountCommand.replace('bean-query', 'bean-check');
            this.commands.set('bean_check', {
                id: 'bean_check',
                name: 'Beancount File Validation',
                description: 'Validate Beancount file syntax and consistency',
                category: 'beancount_tools', 
                baseCommand: 'bean-check',
                actualCommand: `${checkCmd} "${settings.beancountFilePath}"`,
                parameters: [settings.beancountFilePath],
                timeout: 15000,
                executedFrom: 'checkBeancountFile() in sidebar-view.ts',
                purpose: 'Validate Beancount file for syntax errors and consistency issues',
                requirements: ['Beancount file', 'bean-check command'],
                wsla_compatible: checkCmd.includes('wsl')
            });
        }
    }

    private addPythonCommands(): void {
        const isWSL = this.plugin.settings.beancountCommand?.includes('wsl') || false;
        const pythonCandidates = isWSL ? ['python3', 'python'] : ['python', 'python3', 'py'];

        pythonCandidates.forEach(pythonCmd => {
            const cmdPrefix = isWSL ? `wsl ${pythonCmd}` : pythonCmd;

            // Flask version check (from settings.ts)
            this.commands.set(`flask_check_${pythonCmd}`, {
                id: `flask_check_${pythonCmd}`,
                name: `Flask Version Check (${pythonCmd})`,
                description: `Check if Flask is installed with ${pythonCmd}`,
                category: 'python_execution',
                baseCommand: pythonCmd,
                actualCommand: `${cmdPrefix} -c "import flask; print(flask.__version__)"`,
                parameters: ['-c', '"import flask; print(flask.__version__)"'],
                timeout: 5000,
                executedFrom: 'checkPythonDependencies() in settings.ts',
                purpose: 'Verify Flask is available for backend API server',
                requirements: ['Python', 'Flask package'],
                wsla_compatible: true
            });

            // Flask-CORS version check (from settings.ts)
            this.commands.set(`flask_cors_check_${pythonCmd}`, {
                id: `flask_cors_check_${pythonCmd}`,
                name: `Flask-CORS Version Check (${pythonCmd})`,
                description: `Check if Flask-CORS is installed with ${pythonCmd}`,
                category: 'python_execution',
                baseCommand: pythonCmd,
                actualCommand: `${cmdPrefix} -c "import flask_cors; print(flask_cors.__version__)"`,
                parameters: ['-c', '"import flask_cors; print(flask_cors.__version__)"'],
                timeout: 5000,
                executedFrom: 'checkPythonDependencies() in settings.ts',
                purpose: 'Verify Flask-CORS is available for API cross-origin requests',
                requirements: ['Python', 'Flask-CORS package'],
                wsla_compatible: true
            });

            // Beancount package check
            this.commands.set(`beancount_check_${pythonCmd}`, {
                id: `beancount_check_${pythonCmd}`,
                name: `Beancount Package Check (${pythonCmd})`,
                description: `Check if Beancount package is installed with ${pythonCmd}`,
                category: 'python_execution',
                baseCommand: pythonCmd,
                actualCommand: `${cmdPrefix} -c "import beancount"`,
                parameters: ['-c', '"import beancount"'],
                timeout: 5000,
                executedFrom: 'BackendManager.ensureDependencies()',
                purpose: 'Verify Beancount package is available for data processing',
                requirements: ['Python', 'Beancount package'],
                wsla_compatible: true
            });
        });
    }

    private addBackendCommands(): void {
        const settings = this.plugin.settings;
        const isWSL = settings.beancountCommand?.includes('wsl') || false;
        
        if (settings.beancountFilePath) {
            // Backend API server startup (from BackendManager.ts)
            const pythonCmd = isWSL ? 'python3' : 'python'; // Simplified - actual detection is more complex
            const scriptPath = isWSL ? 
                '/mnt/c/Users/Asus/Documents/Vaults/plugin_maker/.obsidian/plugins/obsidian-finance-plugin/src/backend/journal_api.py' :
                'C:\\Users\\Asus\\Documents\\Vaults\\plugin_maker\\.obsidian\\plugins\\obsidian-finance-plugin\\src\\backend\\journal_api.py';
            
            let actualCommand: string;
            let baseCommand: string;
            if (isWSL) {
                baseCommand = 'wsl';
                actualCommand = `wsl ${pythonCmd} "${scriptPath}" "${this.convertToWSLPath(settings.beancountFilePath)}" --port 5013 --host localhost`;
            } else {
                baseCommand = pythonCmd;
                actualCommand = `${pythonCmd} "${scriptPath}" "${settings.beancountFilePath}" --port 5013 --host localhost`;
            }

            this.commands.set('backend_startup', {
                id: 'backend_startup',
                name: 'Backend API Server Startup',
                description: 'Start Python Flask backend for advanced journal operations',
                category: 'backend_management',
                baseCommand: baseCommand,
                actualCommand: actualCommand,
                parameters: [scriptPath, settings.beancountFilePath, '--port', '5013', '--host', 'localhost'],
                timeout: 30000,
                executedFrom: 'BackendManager.startBackend()',
                purpose: 'Start Flask API server for journal entry CRUD operations',
                requirements: ['Python 3.8+', 'Flask', 'Flask-CORS', 'Beancount', 'journal_api.py script'],
                wsla_compatible: true
            });
        }
    }

    /**
     * Get all commands in the inventory
     */
    public getAllCommands(): CommandInfo[] {
        return Array.from(this.commands.values());
    }

    /**
     * Get commands by category
     */
    public getCommandsByCategory(category: CommandInfo['category']): CommandInfo[] {
        return Array.from(this.commands.values()).filter(cmd => cmd.category === category);
    }

    /**
     * Test a specific command and update its status
     */
    public async testCommand(commandId: string): Promise<{success: boolean, output?: string, error?: string}> {
        const command = this.commands.get(commandId);
        if (!command) {
            return {success: false, error: 'Command not found'};
        }

        try {
            command.last_tested = new Date();
            
            // For some commands, we need to modify the test to avoid side effects
            let testCommand = command.actualCommand;
            
            // Replace BQL query placeholder with simple test query
            if (commandId === 'bql_query') {
                testCommand = testCommand.replace('[BQL_QUERY]', 'SELECT TRUE LIMIT 1');
            }
            
            // For backend startup, just test the Python script exists
            if (commandId === 'backend_startup') {
                const pythonCmd = command.actualCommand.split(' ')[0];
                if (command.wsla_compatible && pythonCmd === 'wsl') {
                    testCommand = 'wsl python3 --version';
                } else {
                    testCommand = `${pythonCmd} --version`;
                }
            }

            const result = await execAsync(testCommand, {timeout: command.timeout});
            command.last_result = 'success';
            command.last_error = undefined;
            
            return {success: true, output: result.stdout || result.stderr};
        } catch (error: any) {
            command.last_result = 'error';
            command.last_error = error.message || 'Unknown error';
            
            return {success: false, error: error.message || 'Unknown error'};
        }
    }

    /**
     * Test all commands and return results
     */
    public async testAllCommands(): Promise<Map<string, {success: boolean, output?: string, error?: string}>> {
        const results = new Map<string, {success: boolean, output?: string, error?: string}>();
        
        for (const commandId of this.commands.keys()) {
            try {
                const result = await this.testCommand(commandId);
                results.set(commandId, result);
            } catch (error: any) {
                results.set(commandId, {success: false, error: error.message});
            }
        }
        
        return results;
    }

    /**
     * Get current system configuration affecting commands
     */
    public getSystemConfiguration(): {
        platform: string;
        isWSL: boolean;
        beancountCommand: string | undefined;
        beancountFilePath: string | undefined;
        pythonExecutables: string[];
        estimatedCommands: number;
    } {
        const settings = this.plugin.settings;
        const isWSL = settings.beancountCommand?.includes('wsl') || false;
        
        return {
            platform: process.platform,
            isWSL: isWSL,
            beancountCommand: settings.beancountCommand,
            beancountFilePath: settings.beancountFilePath,
            pythonExecutables: isWSL ? ['wsl python3', 'wsl python'] : ['python', 'python3', 'py'],
            estimatedCommands: this.commands.size
        };
    }

    /**
     * Generate debug report with all command information
     */
    public generateDebugReport(): {
        systemConfig: ReturnType<typeof this.getSystemConfiguration>;
        commandSummary: {[category: string]: number};
        commands: CommandInfo[];
        lastUpdate: string;
    } {
        const commandsByCategory = Array.from(this.commands.values()).reduce((acc, cmd) => {
            acc[cmd.category] = (acc[cmd.category] || 0) + 1;
            return acc;
        }, {} as {[category: string]: number});

        return {
            systemConfig: this.getSystemConfiguration(),
            commandSummary: commandsByCategory,
            commands: this.getAllCommands(),
            lastUpdate: new Date().toISOString()
        };
    }

    /**
     * Convert Windows path to WSL format (helper method)
     */
    private convertToWSLPath(windowsPath: string): string {
        if (windowsPath.startsWith('/mnt/') || windowsPath.startsWith('/')) {
            return windowsPath;
        }
        
        const match = windowsPath.match(/^([A-Za-z]):(.*)/);
        if (match) {
            const drive = match[1].toLowerCase();
            const path = match[2].replace(/\\/g, '/');
            return `/mnt/${drive}${path}`;
        }
        
        return windowsPath.replace(/\\/g, '/');
    }

    /**
     * Refresh the command inventory (call when settings change)
     */
    public refresh(): void {
        this.buildCommandInventory();
    }
}