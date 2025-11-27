// src/core/backend-process.ts
import { exec, spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';
import { FileSystemAdapter } from 'obsidian';
import type BeancountPlugin from '../main';
import { SystemDetector } from '../utils/SystemDetector';

interface BackendStatus {
    isRunning: boolean;
    isStarting: boolean;
    processId: number | null;
    retryCount: number;
}

export class BackendProcess {
    private plugin: BeancountPlugin;
    private backendProcess: ChildProcess | null = null;
    private isStarting: boolean = false;
    private maxRetries: number = 3;
    private retryCount: number = 0;

    constructor(plugin: BeancountPlugin) {
        this.plugin = plugin;
    }

    public async start(): Promise<boolean> {
        if (this.isStarting || this.backendProcess) {
            return true;
        }

        this.isStarting = true;

        try {
            // Get full path to beancount file
            const beancountFileRelative = this.plugin.settings.beancountFilePath;
            if (!beancountFileRelative) {
                throw new Error('Beancount file path not configured.');
            }

            let vaultPath = '';
            if (this.plugin.app.vault.adapter instanceof FileSystemAdapter) {
                vaultPath = this.plugin.app.vault.adapter.getBasePath();
            } else {
                throw new Error('Vault is not file system based');
            }

            const fullBeancountPath = join(vaultPath, beancountFileRelative);

            // Use SystemDetector to determine optimal setup
            const systemDetector = SystemDetector.getInstance();
            // Determine preference from existing settings
            const preferredWSL = this.plugin.settings.beancountCommand?.includes('wsl') || false;

            const setup = await systemDetector.detectOptimalBeancountSetup(fullBeancountPath, preferredWSL);

            if (!setup.python) {
                throw new Error('Python not found or not configured properly.');
            }

            const pythonCmd = setup.python;
            const useWSL = setup.useWSL;

            // Construct path to journal_api.py
            // We use the same logic as ConnectionSettings to be consistent
            // But we try to rely on manifest.dir if possible to be robust
            const pluginDir = (this.plugin as any).manifest.dir; // Relative to vault usually

            // Construct absolute path to script
            let scriptPath = join(vaultPath, pluginDir, 'src', 'backend', 'journal_api.py');

            // If we are in WSL, we need to convert paths
            let actualScriptPath = scriptPath;
            let actualBeancountFile = fullBeancountPath;

            if (useWSL && process.platform === 'win32') {
                actualScriptPath = systemDetector.convertWindowsToWSLPath(scriptPath);
                actualBeancountFile = systemDetector.convertWindowsToWSLPath(fullBeancountPath);
            }

            // Ensure dependencies (using the detected python command)
            await this.ensureDependencies(pythonCmd, useWSL, setup.pythonPackages);

            let command: string;
            let args: string[];

            if (useWSL) {
                command = 'wsl';
                // When using wsl command, the first arg is the command inside wsl
                // However, pythonCmd might already be "wsl python3" or similar?
                // detectOptimalBeancountSetup returns the full command string like "wsl python3"
                // But spawn expects command and args separately.

                // If pythonCmd is "wsl python3", we split it.
                // Or we can just use "wsl" as command and ["python3", ...] as args.

                // detectOptimalBeancountSetup returns "wsl python3" or "python3"
                const parts = pythonCmd.split(' ');
                if (parts[0] === 'wsl') {
                    // pythonCmd is "wsl python3"
                    // command is 'wsl'
                    // args start with 'python3'
                    args = [...parts.slice(1), actualScriptPath, actualBeancountFile, '--port', '5013', '--host', 'localhost'];
                } else {
                     // Should not happen if useWSL is true based on our logic, unless it's just 'python3' running in WSL?
                     // If setup.useWSL is true, it means we should run in WSL.
                     args = [pythonCmd, actualScriptPath, actualBeancountFile, '--port', '5013', '--host', 'localhost'];
                }
            } else {
                command = pythonCmd;
                args = [actualScriptPath, actualBeancountFile, '--port', '5013', '--host', 'localhost'];
            }

            // Fix for spawn: command must be the executable
            // If command is "python3", it's fine.
            // If command is "wsl", it's fine.

            console.log(`Starting backend: ${command} ${args.join(' ')}`);

            this.backendProcess = spawn(command, args, {
                cwd: undefined, // We are providing full paths, so cwd shouldn't matter as much, but undefined lets it inherit
                stdio: ['pipe', 'pipe', 'pipe'],
                detached: false
            });

            this.backendProcess.on('error', (error) => {
                console.error('Backend process error:', error);
                this.backendProcess = null;
                this.isStarting = false;
            });

            this.backendProcess.on('exit', (code, signal) => {
                console.log(`Backend process exited with code ${code}, signal ${signal}`);
                this.backendProcess = null;
                this.isStarting = false;
            });

            // Log stdout/stderr
            this.backendProcess.stdout?.on('data', d => console.log('[Backend]', d.toString()));
            this.backendProcess.stderr?.on('data', d => console.error('[Backend]', d.toString()));

            this.isStarting = false;
            this.retryCount = 0;
            return true;

        } catch (error) {
            console.error('Failed to start backend:', error);
            this.isStarting = false;
            this.retryCount++;

            if (this.retryCount < this.maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                return this.start();
            }
            return false;
        }
    }

    public stop(): void {
        if (this.backendProcess) {
            this.backendProcess.kill('SIGTERM');
            this.backendProcess = null;
        }
    }

    public getStatus(): BackendStatus {
        return {
            isRunning: this.backendProcess !== null && !this.backendProcess.killed,
            isStarting: this.isStarting,
            processId: this.backendProcess?.pid || null,
            retryCount: this.retryCount
        };
    }

    private async ensureDependencies(pythonCmd: string, useWSL: boolean, currentPackages: any): Promise<void> {
        const requiredPackages = ['beancount', 'flask', 'flask-cors'];

        for (const pkg of requiredPackages) {
            const pkgNameInCheck = pkg.replace('-', '_'); // e.g. flask-cors -> flask_cors

            // Check if package was already detected by SystemDetector
            if (currentPackages && currentPackages[pkgNameInCheck] && currentPackages[pkgNameInCheck] !== 'unknown') {
                continue;
            }

            try {
                // Double check if not in the report (or if we want to be sure)
                const actualCmd = pythonCmd; // pythonCmd already includes 'wsl' prefix if needed? No, see start() logic.

                // We need the raw python command to run with runCommand
                // If pythonCmd is "wsl python3", runCommand can handle it?
                // runCommand uses exec.

                await this.runCommand(`${pythonCmd} -c "import ${pkgNameInCheck}"`);
            } catch {
                console.log(`Installing ${pkg}...`);
                await this.runCommand(`${pythonCmd} -m pip install ${pkg}`);
            }
        }
    }

    private runCommand(command: string): Promise<string> {
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout) => {
                if (error) reject(error);
                else resolve(stdout.trim());
            });
        });
    }
}
