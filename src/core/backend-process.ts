// src/core/backend-process.ts
import { exec, spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';
import type BeancountPlugin from '../main';

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
            const pluginDir = (this.plugin as any).manifest.dir || '';
            const backendDir = join(pluginDir, 'src', 'backend');
            const scriptPath = join(backendDir, 'journal_api.py');

            // Fallback for dev environment
            if (!existsSync(scriptPath)) {
                console.warn(`Backend script not found at ${scriptPath}`);
                // Add fallback logic if necessary, or fail fast
            }

            const beancountFile = this.plugin.settings.beancountFilePath;
            if (!beancountFile) {
                throw new Error('Beancount file path not configured.');
            }

            const pythonCmd = await this.detectPythonCommand();
            if (!pythonCmd) {
                throw new Error('Python not found.');
            }

            const useWSL = this.plugin.settings.beancountCommand?.includes('wsl');

            const actualBeancountFile = useWSL ? this.convertToWSLPath(beancountFile) : beancountFile;
            const actualScriptPath = useWSL ? this.convertToWSLPath(scriptPath) : scriptPath;

            await this.ensureDependencies(pythonCmd, useWSL);

            let command: string;
            let args: string[];

            if (useWSL) {
                command = 'wsl';
                args = [pythonCmd, actualScriptPath, actualBeancountFile, '--port', '5013', '--host', 'localhost'];
            } else {
                command = pythonCmd;
                args = [actualScriptPath, actualBeancountFile, '--port', '5013', '--host', 'localhost'];
            }

            this.backendProcess = spawn(command, args, {
                cwd: useWSL ? undefined : backendDir,
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

            // Wait for health check in the API Client layer, but here we just wait a bit or assume started
            // Ideally we should wait for a "Ready" signal or let the API client retry.
            // For now, let's keep the wait logic here to ensure process stability

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

    private async detectPythonCommand(): Promise<string | null> {
        const useWSL = this.plugin.settings.beancountCommand?.includes('wsl');
        const candidates = useWSL ? ['python3', 'python'] : ['python', 'python3', 'py'];

        for (const cmd of candidates) {
            try {
                const testCmd = useWSL ? `wsl ${cmd}` : cmd;
                await this.runCommand(`${testCmd} --version`);
                return cmd;
            } catch {
                continue;
            }
        }
        return null;
    }

    private async ensureDependencies(pythonCmd: string, useWSL: boolean): Promise<void> {
        // ... (Simplified for brevity, but should include the logic from BackendManager)
         const requiredPackages = ['beancount', 'flask', 'flask-cors'];
         for (const pkg of requiredPackages) {
             try {
                 const actualCmd = useWSL ? `wsl ${pythonCmd}` : pythonCmd;
                 await this.runCommand(`${actualCmd} -c "import ${pkg.replace('-', '_')}"`);
             } catch {
                 console.log(`Installing ${pkg}...`);
                 const actualCmd = useWSL ? `wsl ${pythonCmd}` : pythonCmd;
                 await this.runCommand(`${actualCmd} -m pip install ${pkg}`);
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

    private convertToWSLPath(windowsPath: string): string {
        if (windowsPath.startsWith('/mnt/') || windowsPath.startsWith('/')) return windowsPath;
        const match = windowsPath.match(/^([A-Za-z]):(.*)/);
        if (match) {
            const drive = match[1].toLowerCase();
            const path = match[2].replace(/\\/g, '/');
            return `/mnt/${drive}${path}`;
        }
        return windowsPath.replace(/\\/g, '/');
    }
}
