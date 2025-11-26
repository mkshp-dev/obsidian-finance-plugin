// src/backend/BackendManager.ts
import { exec, spawn, ChildProcess } from 'child_process';
import type { ExecException } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';
import type BeancountPlugin from '../main';

export class BackendManager {
    private plugin: BeancountPlugin;
    private backendProcess: ChildProcess | null = null;
    private apiBaseUrl: string = 'http://localhost:5013';
    private isStarting: boolean = false;
    private maxRetries: number = 3;
    private retryCount: number = 0;

    constructor(plugin: BeancountPlugin) {
        this.plugin = plugin;
    }

    /**
     * Start the Python backend API server as a child process
     */
    public async startBackend(): Promise<boolean> {
        if (this.isStarting || this.backendProcess) {
            return true; // Already starting or running
        }

        this.isStarting = true;

        try {
            // Get the backend script path
            let pluginDir = (this.plugin as any).manifest.dir || '';
            
            // For development mode, check if we have the source files
            const backendDir = join(pluginDir, 'src', 'backend');
            const scriptPath = join(backendDir, 'journal_api.py');
            
            // Check if the script exists at the expected location
            if (!existsSync(scriptPath)) {
                // If not found, try the development directory
                const devPath = 'C:\\Users\\Asus\\Documents\\Vaults\\plugin_maker\\.obsidian\\plugins\\obsidian-finance-plugin';
                const devScriptPath = join(devPath, 'src', 'backend', 'journal_api.py');
                
                if (existsSync(devScriptPath)) {
                    pluginDir = devPath;
                    console.log('Script not found in manifest dir, using development directory:', pluginDir);
                } else {
                    throw new Error(`Backend script not found at ${scriptPath} or ${devScriptPath}`);
                }
            }
            
            const finalBackendDir = join(pluginDir, 'src', 'backend');
            const finalScriptPath = join(finalBackendDir, 'journal_api.py');
            
            console.log('Backend setup:', {
                manifestDir: (this.plugin as any).manifest.dir,
                pluginDir,
                backendDir: finalBackendDir,
                scriptPath: finalScriptPath,
                scriptExists: existsSync(finalScriptPath)
            });
            
            // Get Beancount file path from settings
            const beancountFile = this.plugin.settings.beancountFilePath;
            if (!beancountFile) {
                throw new Error('Beancount file path not configured in settings. Please go to Settings → Finance Plugin → Path to beancount file');
            }

            // Try to detect Python command
            const pythonCmd = await this.detectPythonCommand();
            if (!pythonCmd) {
                throw new Error('Python not found. Please ensure Python 3.8+ is installed and available in PATH');
            }
            
            console.log('Using Python command:', pythonCmd);

            // Determine if we're using WSL based on beancount command
            const beancountCmd = this.plugin.settings.beancountCommand;
            const useWSL = beancountCmd && beancountCmd.includes('wsl');

            // Convert file paths for WSL if needed
            const actualBeancountFile = useWSL ? this.convertToWSLPath(beancountFile) : beancountFile;
            const actualScriptPath = useWSL ? this.convertToWSLPath(finalScriptPath) : finalScriptPath;
            
            console.log('File paths:', {
                original: { beancount: beancountFile, script: finalScriptPath },
                actual: { beancount: actualBeancountFile, script: actualScriptPath }
            });

            // Check and install dependencies if needed
            await this.ensureDependencies(pythonCmd);

            console.log(`Starting backend with: ${pythonCmd} ${actualScriptPath} ${actualBeancountFile}`);

            // Prepare command and arguments for spawn
            let command: string;
            let args: string[];
            
            if (useWSL) {
                // For WSL, use 'wsl' as command and build the full command as arguments
                command = 'wsl';
                args = [
                    pythonCmd, // Use the detected python command (python3 or python)
                    actualScriptPath,
                    actualBeancountFile,
                    '--port', '5013',
                    '--host', 'localhost'
                ];
            } else {
                // For regular Python, use python command directly
                command = pythonCmd;
                args = [
                    actualScriptPath,
                    actualBeancountFile,
                    '--port', '5013',
                    '--host', 'localhost'
                ];
            }

            console.log('Spawn command:', command);
            console.log('Spawn args:', args);

            // Start the Python process
            this.backendProcess = spawn(command, args, {
                cwd: useWSL ? undefined : backendDir, // Let WSL handle working directory
                stdio: ['pipe', 'pipe', 'pipe'],
                detached: false
            });

            // Handle process events
            this.backendProcess.on('error', (error) => {
                console.error('Backend process error:', error);
                if (error.message.includes('ENOENT')) {
                    if (useWSL) {
                        console.error('WSL not found or not properly configured. Make sure WSL is installed and working.');
                        console.error('Try running "wsl --version" in PowerShell to check WSL installation.');
                    } else {
                        console.error('Python executable not found. Make sure Python is installed and in PATH.');
                    }
                    console.error('Tried command:', command, 'with args:', args);
                }
                this.backendProcess = null;
                this.isStarting = false;
            });

            this.backendProcess.on('exit', (code, signal) => {
                console.log(`Backend process exited with code ${code}, signal ${signal}`);
                this.backendProcess = null;
                this.isStarting = false;
            });

            // Forward backend stdout and stderr to Obsidian developer console
            if (this.backendProcess.stdout) {
                this.backendProcess.stdout.on('data', (data) => {
                    // Forward to Obsidian console
                    // Use chunk splitting for multi-line output
                    data.toString().split(/\r?\n/).forEach((line: string) => {
                        if (line.trim().length > 0) console.log('[Backend]', line);
                    });
                });
            }

            if (this.backendProcess.stderr) {
                this.backendProcess.stderr.on('data', (data) => {
                    data.toString().split(/\r?\n/).forEach((line: string) => {
                        if (line.trim().length > 0) console.error('[Backend]', line);
                    });
                });
            }

            // Wait for the server to start
            await this.waitForBackendReady();
            this.isStarting = false;
            this.retryCount = 0;
            return true;

        } catch (error) {
            console.error('Failed to start backend:', error);
            this.isStarting = false;
            this.retryCount++;
            
            if (this.retryCount < this.maxRetries) {
                console.log(`Retrying backend start (${this.retryCount}/${this.maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                return this.startBackend();
            }
            
            return false;
        }
    }

    /**
     * Stop the backend process
     */
    public stopBackend(): void {
        if (this.backendProcess) {
            console.log('Stopping backend process...');
            this.backendProcess.kill('SIGTERM');
            this.backendProcess = null;
        }
    }

    /**
     * Check if backend is running and responsive
     */
    public async isBackendHealthy(): Promise<boolean> {
        try {
            const response = await fetch(`${this.apiBaseUrl}/health`, {
                method: 'GET',
                timeout: 5000
            } as RequestInit);
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    /**
     * Ensure backend is running, start if needed
     */
    public async ensureBackendRunning(): Promise<boolean> {
        // Check if already running
        const healthy = await this.isBackendHealthy();
        console.debug('[BackendManager] isBackendHealthy ->', healthy);
        if (healthy) {
            return true;
        }

        // Start if not running
        return this.startBackend();
    }

    /**
     * Make API request to backend
     */
    public async apiRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
        // Ensure backend is running
        await this.ensureBackendRunning();

        const url = `${this.apiBaseUrl}${endpoint}`;
        console.debug('[BackendManager] apiRequest:', { url, options });
        const resp = await fetch(url, {
            ...options,
            timeout: 10000
        } as RequestInit);
        console.debug('[BackendManager] apiRequest response:', { url, status: resp.status, ok: resp.ok });
        return resp;
    }

    /**
     * Reload backend data (tell backend to reload Beancount file)
     */
    public async reloadBackendData(): Promise<void> {
        const response = await this.apiRequest('/reload', { method: 'POST' });
        if (!response.ok) {
            throw new Error(`Backend reload failed: ${response.status}`);
        }
    }

    /**
     * Ensure required Python dependencies are installed
     */
    private async ensureDependencies(pythonCmd: string): Promise<void> {
        const requiredPackages = ['beancount', 'flask', 'flask-cors'];
        
        // Determine if we're using WSL
        const beancountCmd = this.plugin.settings.beancountCommand;
        const useWSL = beancountCmd && beancountCmd.includes('wsl');
        
        for (const pkg of requiredPackages) {
            try {
                // Check if package is installed
                const actualCmd = useWSL ? `wsl ${pythonCmd}` : pythonCmd;
                const importCmd = `${actualCmd} -c "import ${pkg.replace('-', '_')}"`;
                await this.runCommand(importCmd);
                console.log(`✓ ${pkg} is already installed`);
            } catch (error) {
                console.log(`Installing ${pkg}...`);
                try {
                    const actualCmd = useWSL ? `wsl ${pythonCmd}` : pythonCmd;
                    const installCmd = `${actualCmd} -m pip install ${pkg}`;
                    await this.runCommand(installCmd);
                    console.log(`✓ ${pkg} installed successfully`);
                } catch (installError) {
                    throw new Error(`Failed to install ${pkg}. Please install manually: ${useWSL ? 'wsl ' : ''}pip install ${pkg}`);
                }
            }
        }
    }

    /**
     * Detect the available Python command
     */
    private async detectPythonCommand(): Promise<string | null> {
        // Check if we should use WSL based on the beancount command setting
        const beancountCmd = this.plugin.settings.beancountCommand;
        const useWSL = beancountCmd && beancountCmd.includes('wsl');
        
        let candidates: string[];
        if (useWSL) {
            // For WSL, return just the python executable name, not the full wsl command
            candidates = ['python3', 'python'];
            console.log('WSL detected, trying WSL Python commands');
        } else {
            candidates = ['python', 'python3', 'py'];
        }
        
        for (const cmd of candidates) {
            try {
                const testCmd = useWSL ? `wsl ${cmd}` : cmd;
                console.log(`Trying Python command: ${testCmd}`);
                const result = await this.runCommand(`${testCmd} --version`);
                console.log(`${testCmd} version:`, result);
                if (result.includes('Python 3.')) {
                    console.log(`✓ Found Python: ${cmd} (WSL: ${useWSL})`);
                    // Return just the python command, not the wsl prefix
                    return cmd;
                }
            } catch (error) {
                const testCmd = useWSL ? `wsl ${cmd}` : cmd;
                console.log(`✗ ${testCmd} not available:`, error.message);
                continue;
            }
        }
        
        console.error('No suitable Python 3.x installation found');
        return null;
    }

    /**
     * Wait for backend to be ready by polling health endpoint
     */
    private async waitForBackendReady(maxWaitMs: number = 30000): Promise<void> {
        const startTime = Date.now();
        const pollInterval = 500;

        while (Date.now() - startTime < maxWaitMs) {
            if (await this.isBackendHealthy()) {
                console.log('Backend is ready!');
                return;
            }
            
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        throw new Error('Backend failed to start within timeout period');
    }

    /**
     * Run a shell command and return output
     */
    private runCommand(command: string): Promise<string> {
        return new Promise((resolve, reject) => {
            exec(command, (error: ExecException | null, stdout: string, stderr: string) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(stdout.trim());
                }
            });
        });
    }

    /**
     * Get backend process status
     */
    public getStatus(): {
        isRunning: boolean;
        isStarting: boolean;
        processId: number | null;
        retryCount: number;
    } {
        return {
            isRunning: this.backendProcess !== null && !this.backendProcess.killed,
            isStarting: this.isStarting,
            processId: this.backendProcess?.pid || null,
            retryCount: this.retryCount
        };
    }

    /**
     * Convert Windows path to WSL path format
     */
    private convertToWSLPath(windowsPath: string): string {
        // If already a WSL path, return as-is
        if (windowsPath.startsWith('/mnt/') || windowsPath.startsWith('/')) {
            return windowsPath;
        }
        
        // Convert C:\Users\... to /mnt/c/Users/...
        const match = windowsPath.match(/^([A-Za-z]):(.*)/);
        if (match) {
            const drive = match[1].toLowerCase();
            const path = match[2].replace(/\\/g, '/');
            return `/mnt/${drive}${path}`;
        }
        
        // If no drive letter, assume it's relative and return as-is
        return windowsPath.replace(/\\/g, '/');
    }
}