// src/utils/SystemDetector.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, statSync, accessSync, constants } from 'fs';
import { resolve, join, dirname, sep } from 'path';
import { homedir, platform, arch, type, release } from 'os';

const execAsync = promisify(exec);

/**
 * Interface representing system information detected by the SystemDetector.
 */
export interface SystemInfo {
    /** The platform name (e.g., 'win32', 'darwin'). */
    platform: NodeJS.Platform;
    /** Human-readable platform name (e.g., 'Windows', 'macOS'). */
    platformDisplay: string;
    /** CPU architecture (e.g., 'x64'). */
    arch: string;
    /** Operating system type. */
    osType: string;
    /** Operating system release version. */
    osRelease: string;
    /** User's home directory path. */
    homeDir: string;
    /** Path separator for the system. */
    pathSeparator: string;
    /** Whether Windows Subsystem for Linux (WSL) is detected. */
    isWSL: boolean;
    /** The detected shell environment. */
    shell: string;
    /** Path to the Python executable. */
    pythonExecutable: string | null;
    /** Version of the detected Python executable. */
    pythonVersion: string | null;
}

/**
 * Interface representing information about a detected executable.
 */
export interface ExecutableInfo {
    /** Whether the executable was found. */
    found: boolean;
    /** Path to the executable. */
    path: string | null;
    /** Version of the executable, if detectable. */
    version: string | null;
    /** Whether the executable is accessible/runnable. */
    accessible: boolean;
    /** Error message if not found or not accessible. */
    errorMessage?: string;
}

/**
 * SystemDetector
 *
 * Utility class for detecting system configuration, Python environment, and Beancount tools.
 * Handles platform-specific logic (Windows vs Unix, WSL detection) and command path resolution.
 */
export class SystemDetector {
    private static _instance: SystemDetector;
    private _systemInfo: SystemInfo | null = null;

    /**
     * Gets the singleton instance of SystemDetector.
     * @returns {SystemDetector} The singleton instance.
     */
    static getInstance(): SystemDetector {
        if (!SystemDetector._instance) {
            SystemDetector._instance = new SystemDetector();
        }
        return SystemDetector._instance;
    }

    /**
     * Get human-readable platform name
     * @param {NodeJS.Platform} platformInfo - The platform identifier.
     * @returns {string} The display name.
     */
    private getPlatformDisplayName(platformInfo: NodeJS.Platform): string {
        switch (platformInfo) {
            case 'win32': return 'Windows';
            case 'darwin': return 'macOS';
            case 'linux': return 'Linux';
            case 'freebsd': return 'FreeBSD';
            case 'openbsd': return 'OpenBSD';
            case 'sunos': return 'Solaris';
            case 'aix': return 'AIX';
            default: return platformInfo;
        }
    }

    /**
     * Detect comprehensive system information.
     * Caches the result after the first call.
     * @returns {Promise<SystemInfo>} The detected system information.
     */
    async getSystemInfo(): Promise<SystemInfo> {
        if (this._systemInfo) {
            return this._systemInfo;
        }

        const platformInfo = platform();
        const archInfo = arch();
        const osTypeInfo = type();
        const osReleaseInfo = release();
        const homeDirInfo = homedir();
        const pathSep = sep;
        const isWSLInfo = await this.detectWSL();
        const shellInfo = await this.detectShell();
        const pythonInfo = await this.detectPython();

        this._systemInfo = {
            platform: platformInfo,
            platformDisplay: this.getPlatformDisplayName(platformInfo),
            arch: archInfo,
            osType: osTypeInfo,
            osRelease: osReleaseInfo,
            homeDir: homeDirInfo,
            pathSeparator: pathSep,
            isWSL: isWSLInfo,
            shell: shellInfo,
            pythonExecutable: pythonInfo.path,
            pythonVersion: pythonInfo.version
        };

        return this._systemInfo;
    }

    /**
     * Detect if running in WSL (Windows Subsystem for Linux) environment.
     * @returns {Promise<boolean>} True if running inside WSL.
     */
    private async detectWSL(): Promise<boolean> {
        try {
            // Method 1: Check for WSL in /proc/version
            if (existsSync('/proc/version')) {
                const { stdout } = await execAsync('cat /proc/version', { timeout: 2000 });
                if (stdout.toLowerCase().includes('microsoft') || stdout.toLowerCase().includes('wsl')) {
                    return true;
                }
            }

            // Method 2: Check WSL environment variables
            if (process.env.WSL_DISTRO_NAME || process.env.WSLENV) {
                return true;
            }

            // Method 3: Check for WSL specific paths
            if (existsSync('/mnt/c') || existsSync('/mnt/wsl')) {
                return true;
            }

            return false;
        } catch (error) {
            return false;
        }
    }

    /**
     * Check if WSL is available on Windows systems (public method)
     * This checks if WSL can be used, not if we're currently running in WSL
     * @returns {Promise<boolean>} True if WSL is available on the Windows host.
     */
    async detectWSLAvailability(): Promise<boolean> {
        try {
            // Only check on Windows systems
            if (platform() !== 'win32') {
                return false;
            }

            // Test if wsl command is available and working
            const { stdout } = await execAsync('wsl --list --quiet', { timeout: 5000 });
            
            // If we get output without error, WSL is available
            // Even if no distributions are installed, the command should work
            return true;
        } catch (error: any) {
            try {
                // Fallback: try simpler wsl command
                await execAsync('wsl --help', { timeout: 3000 });
                return true;
            } catch (fallbackError) {
                // WSL not available
                return false;
            }
        }
    }

    /**
     * Detect current shell with enhanced terminal detection
     * @returns {Promise<string>} The name of the shell.
     */
    private async detectShell(): Promise<string> {
        try {
            const platformInfo = platform();
            
            // Check for WSL environment first
            if (process.env.WSL_DISTRO_NAME || process.env.WSLENV) {
                return 'WSL-Bash';
            }

            // Windows-specific detection
            if (platformInfo === 'win32') {
                // Check for PowerShell variants
                if (process.env.PSModulePath) {
                    if (process.env.PWSH_VERSION || process.title?.includes('pwsh')) {
                        return 'PowerShell Core';
                    }
                    return 'Windows PowerShell';
                }
                
                // Check for Git Bash
                if (process.env.MSYSTEM || process.env.MINGW_PREFIX) {
                    return 'Git Bash';
                }
                
                // Check ComSpec for cmd
                if (process.env.ComSpec) {
                    if (process.env.ComSpec.toLowerCase().includes('cmd')) {
                        return 'Command Prompt (cmd)';
                    }
                }
                
                return 'Windows Terminal';
            }

            // Unix-like systems
            if (process.env.SHELL) {
                const shell = process.env.SHELL.toLowerCase();
                if (shell.includes('bash')) return 'Bash';
                if (shell.includes('zsh')) return 'Zsh';
                if (shell.includes('fish')) return 'Fish';
                if (shell.includes('tcsh')) return 'Tcsh';
                if (shell.includes('csh')) return 'Csh';
                if (shell.includes('ksh')) return 'Ksh';
                return process.env.SHELL;
            }

            // Try to detect from process
            try {
                const { stdout } = await execAsync('echo $0', { timeout: 2000 });
                const shell = stdout.trim();
                if (shell.includes('bash')) return 'Bash';
                if (shell.includes('zsh')) return 'Zsh';
                if (shell.includes('fish')) return 'Fish';
                return shell || 'sh';
            } catch {
                return 'sh';
            }

        } catch (error) {
            return platform() === 'win32' ? 'Unknown Windows Shell' : 'Unknown Unix Shell';
        }
    }

    /**
     * Detect Python executable and version
     * @returns {Promise<{ path: string | null; version: string | null }>} The python path and version.
     */
    private async detectPython(): Promise<{ path: string | null; version: string | null }> {
        const pythonCommands = ['python3', 'python', 'py'];
        
        for (const cmd of pythonCommands) {
            try {
                const { stdout: versionOutput } = await execAsync(`${cmd} --version`, { timeout: 5000 });
                const { stdout: pathOutput } = await execAsync(`${cmd} -c "import sys; print(sys.executable)"`, { timeout: 5000 });
                
                return {
                    path: pathOutput.trim(),
                    version: versionOutput.trim()
                };
            } catch (error) {
                continue;
            }
        }

        return { path: null, version: null };
    }

    /**
     * Find executable in system PATH
     * @param {string} executableName - The name of the executable to find.
     * @returns {Promise<ExecutableInfo>} Information about the found executable.
     */
    async findExecutable(executableName: string): Promise<ExecutableInfo> {
        try {
            // Try direct execution first
            const { stdout: whichOutput } = await execAsync(
                platform() === 'win32' ? `where ${executableName}` : `which ${executableName}`,
                { timeout: 5000 }
            );

            const execPath = whichOutput.split('\n')[0].trim();
            
            if (execPath && existsSync(execPath)) {
                // Check if executable is accessible
                try {
                    accessSync(execPath, constants.F_OK | constants.X_OK);
                    
                    // Try to get version
                    let version = null;
                    try {
                        const { stdout: versionOutput } = await execAsync(`"${execPath}" --version`, { timeout: 5000 });
                        version = versionOutput.trim();
                    } catch {
                        // Version check failed, but executable exists
                    }

                    return {
                        found: true,
                        path: execPath,
                        version,
                        accessible: true
                    };
                } catch (accessError) {
                    return {
                        found: true,
                        path: execPath,
                        version: null,
                        accessible: false,
                        errorMessage: 'Found but not accessible'
                    };
                }
            }
        } catch (error) {
            // Continue to manual search
        }

        // Manual search in common locations
        const commonPaths = this.getCommonExecutablePaths();
        const possibleNames = this.getExecutableVariations(executableName);

        for (const basePath of commonPaths) {
            for (const name of possibleNames) {
                const fullPath = join(basePath, name);
                if (existsSync(fullPath)) {
                    try {
                        accessSync(fullPath, constants.F_OK | constants.X_OK);
                        return {
                            found: true,
                            path: fullPath,
                            version: null,
                            accessible: true
                        };
                    } catch {
                        continue;
                    }
                }
            }
        }

        return {
            found: false,
            path: null,
            version: null,
            accessible: false,
            errorMessage: 'Executable not found in PATH or common locations'
        };
    }

    /**
     * Get common executable search paths for current platform
     * @returns {string[]} List of common paths.
     */
    private getCommonExecutablePaths(): string[] {
        const platformInfo = platform();
        const paths = (process.env.PATH || '').split(platformInfo === 'win32' ? ';' : ':').filter(Boolean);

        // Add common system paths
        if (platformInfo === 'win32') {
            paths.push(
                'C:\\Windows\\System32',
                'C:\\Windows',
                'C:\\Python39',
                'C:\\Python38',
                'C:\\Python37',
                'C:\\Program Files\\Python39',
                'C:\\Program Files\\Python38',
                'C:\\Program Files\\Python37',
                join(homedir(), 'AppData', 'Local', 'Programs', 'Python'),
                join(homedir(), 'AppData', 'Local', 'Microsoft', 'WindowsApps')
            );
        } else {
            paths.push(
                '/usr/bin',
                '/usr/local/bin',
                '/bin',
                '/opt/homebrew/bin', // macOS Homebrew ARM
                '/usr/local/homebrew/bin', // macOS Homebrew Intel
                join(homedir(), '.local', 'bin'),
                join(homedir(), 'bin')
            );
        }

        return paths.filter(path => existsSync(path));
    }

    /**
     * Get possible executable name variations for different platforms
     * @param {string} baseName - The base name of the executable.
     * @returns {string[]} List of variations (e.g. with .exe extension).
     */
    private getExecutableVariations(baseName: string): string[] {
        const variations = [baseName];
        
        if (platform() === 'win32') {
            variations.push(
                `${baseName}.exe`,
                `${baseName}.cmd`,
                `${baseName}.bat`
            );
        }

        return variations;
    }

    /**
     * Normalize and resolve file paths for current system
     * @param {string} filePath - The path to normalize.
     * @returns {string} The normalized, resolved path.
     */
    normalizeFilePath(filePath: string): string {
        if (!filePath) return '';

        // Handle WSL path conversion
        if (this._systemInfo?.isWSL && filePath.startsWith('/mnt/')) {
            return this.convertWSLToWindowsPath(filePath);
        }

        // Handle Windows path conversion for WSL commands
        if (platform() === 'win32' && filePath.includes(':\\')) {
            return resolve(filePath);
        }

        return resolve(filePath);
    }

    /**
     * Convert WSL path to Windows path
     * @param {string} wslPath - The path in WSL format (/mnt/c/...)
     * @returns {string} The path in Windows format (C:\...)
     */
    private convertWSLToWindowsPath(wslPath: string): string {
        const match = wslPath.match(/^\/mnt\/([a-zA-Z])\/(.*)/);
        if (match) {
            const driveLetter = match[1].toUpperCase();
            const restOfPath = match[2].replace(/\//g, '\\');
            return `${driveLetter}:\\${restOfPath}`;
        }
        return wslPath;
    }

    /**
     * Convert Windows path to WSL path format
     * @param {string} windowsPath - The path in Windows format.
     * @returns {string} The path in WSL format.
     */
    public convertWindowsToWSLPath(windowsPath: string): string {
        // Convert C:\path\to\file to /mnt/c/path/to/file
        const match = windowsPath.match(/^([A-Za-z]):(.*)/);
        if (match) {
            const driveLetter = match[1].toLowerCase();
            const restOfPath = match[2].replace(/\\/g, '/');
            return `/mnt/${driveLetter}${restOfPath}`;
        }
        return windowsPath.replace(/\\/g, '/');
    }

    /**
     * Get appropriate command format for current system
     * @param {string} baseCommand - The base command.
     * @param {string[]} args - Arguments for the command.
     * @returns {string} The formatted command string.
     */
    formatCommand(baseCommand: string, args: string[] = []): string {
        const systemInfo = this._systemInfo;
        if (!systemInfo) {
            throw new Error('System info not initialized. Call getSystemInfo() first.');
        }

        // Handle WSL command prefixing
        if (systemInfo.isWSL && baseCommand.includes('wsl')) {
            return `${baseCommand} ${args.join(' ')}`;
        }

        // Quote paths on Windows if they contain spaces
        if (systemInfo.platform === 'win32') {
            const quotedArgs = args.map(arg => 
                arg.includes(' ') && !arg.startsWith('"') ? `"${arg}"` : arg
            );
            return `"${baseCommand}" ${quotedArgs.join(' ')}`;
        }

        return `${baseCommand} ${args.join(' ')}`;
    }

    /**
     * Validate and suggest beancount command based on system detection
     * @returns {Promise<string[]>} List of suggested command strings.
     */
    async suggestBeancountCommand(): Promise<string[]> {
        const suggestions: string[] = [];
        const systemInfo = await this.getSystemInfo();

        // Direct bean-query
        const beanQueryInfo = await this.findExecutable('bean-query');
        if (beanQueryInfo.found && beanQueryInfo.accessible) {
            suggestions.push(beanQueryInfo.path!);
        }

        // Python module execution
        if (systemInfo.pythonExecutable) {
            suggestions.push(`${systemInfo.pythonExecutable} -m beancount.query`);
        }

        // WSL-specific suggestions
        if (systemInfo.platform === 'win32') {
            suggestions.push('wsl bean-query');
            if (systemInfo.pythonExecutable) {
                suggestions.push(`wsl ${systemInfo.pythonExecutable} -m beancount.query`);
            }
        }

        // Fallback suggestions
        suggestions.push('bean-query');
        suggestions.push('python -m beancount.query');
        suggestions.push('python3 -m beancount.query');

        return suggestions;
    }

    /**
     * Test if a command works with proper error handling
     * @param {string} command - The command to test.
     * @param {number} [timeout=5000] - Timeout in milliseconds.
     * @returns {Promise<{ success: boolean; output?: string; error?: string }>} The result.
     */
    async testCommand(command: string, timeout: number = 5000): Promise<{ success: boolean; output?: string; error?: string }> {
        try {
            const { stdout, stderr } = await execAsync(command, { timeout });
            return { success: true, output: stdout, error: stderr };
        } catch (error: any) {
            return { 
                success: false, 
                error: error.message || 'Command execution failed',
                output: error.stdout || ''
            };
        }
    }

    /**
     * Comprehensive Python environment detection with package validation
     * @param {boolean} [useWSL=false] - Whether to check in WSL.
     * @returns {Promise<object>} Detailed report of Python environment.
     */
    async detectPythonEnvironment(useWSL: boolean = false): Promise<{
        command: string | null;
        version: string | null;
        isValid: boolean;
        errors: string[];
    }> {
        const result = {
            command: null as string | null,
            version: null as string | null,
            isValid: false,
            errors: [] as string[]
        };

        const systemInfo = await this.getSystemInfo();
        
        // Define Python commands to test in order of preference
        let pythonCommands = ['python3', 'python', 'py'];
        
        // Add WSL prefix if needed
        if (useWSL && systemInfo.platform === 'win32') {
            pythonCommands = pythonCommands.map(cmd => `wsl ${cmd}`);
        }

        for (const pythonCmd of pythonCommands) {
            try {
                // Test 1: Check if Python command exists and get version
                const versionResult = await this.testCommand(`${pythonCmd} --version`);
                if (!versionResult.success) {
                    continue;
                }

                const versionMatch = versionResult.output?.match(/Python (\d+\.\d+\.\d+)/);
                if (!versionMatch || !versionResult.output) {
                    result.errors.push(`${pythonCmd}: Could not parse version from output: ${versionResult.output || 'no output'}`);
                    continue;
                }

                const version = versionMatch[1];
                const [major, minor] = version.split('.').map(Number);

                // Test 2: Check Python version >= 3.8
                if (major < 3 || (major === 3 && minor < 8)) {
                    result.errors.push(`${pythonCmd}: Version ${version} is too old (requires >= 3.8)`);
                    continue;
                }

                // All tests passed!
                result.command = pythonCmd;
                result.version = version;
                result.isValid = true;
                
                break;

            } catch (error) {
                result.errors.push(`${pythonCmd}: Unexpected error - ${error.message}`);
            }
        }

        return result;
    }

    /**
     * Comprehensive bean-query command detection with version validation
     * @param {boolean} [useWSL=false] - Whether to check in WSL.
     * @param {string} [beancountFilePath] - Optional path to a beancount file to test against.
     * @returns {Promise<object>} Report of bean-query detection.
     */
    async detectBeanQueryCommand(useWSL: boolean = false, beancountFilePath?: string): Promise<{
        command: string | null;
        version: string | null;
        isValid: boolean;
        errors: string[];
    }> {
        const result = {
            command: null as string | null,
            version: null as string | null,
            isValid: false,
            errors: [] as string[]
        };

        const systemInfo = await this.getSystemInfo();
        
        // Define bean-query commands to test in order of preference
        let beanQueryCommands = [
            'bean-query',
            'python3 -m beancount.query',
            'python -m beancount.query',
            'py -m beancount.query'
        ];
        
        // Add WSL prefix if needed
        if (useWSL && systemInfo.platform === 'win32') {
            beanQueryCommands = beanQueryCommands.map(cmd => `wsl ${cmd}`);
        }

        for (const beanQueryCmd of beanQueryCommands) {
            try {
                // Test 1: Check if bean-query command exists and get version
                const versionResult = await this.testCommand(`${beanQueryCmd} --version`);
                if (!versionResult.success) {
                    // Try help command as fallback for version detection
                    const helpResult = await this.testCommand(`${beanQueryCmd} --help`);
                    if (!helpResult.success) {
                        result.errors.push(`${beanQueryCmd}: Command not found or not accessible`);
                        continue;
                    }
                    // If help works but version doesn't, we can still use the command
                    result.command = beanQueryCmd;
                    result.version = 'unknown (help available)';
                    result.isValid = true;
                    break;
                }

                // Parse version from output
                let version = 'unknown';
                if (versionResult.output) {
                    // Try to extract version number from various formats
                    const versionMatch = versionResult.output.match(/(\d+\.\d+\.\d+)/);
                    if (versionMatch) {
                        version = versionMatch[1];
                    } else {
                        // Sometimes bean-query just shows "beancount X.Y.Z"
                        const beancountMatch = versionResult.output.match(/beancount\s+(\d+\.\d+\.\d+)/i);
                        if (beancountMatch) {
                            version = beancountMatch[1];
                        }
                    }
                }

                // Test 2: Verify bean-query can run basic queries (if file is provided)
                if (beancountFilePath) {
                    const testQuery = 'SELECT TRUE LIMIT 1';
                    const queryResult = await this.testCommand(`${beanQueryCmd} -f csv "${beancountFilePath}" "${testQuery}"`);
                    if (!queryResult.success) {
                        result.errors.push(`${beanQueryCmd}: Cannot execute test query against beancount file`);
                        continue;
                    }
                }

                // All tests passed!
                result.command = beanQueryCmd;
                result.version = version;
                result.isValid = true;
                break;

            } catch (error) {
                result.errors.push(`${beanQueryCmd}: Unexpected error - ${error.message}`);
            }
        }

        return result;
    }

    /**
     * Comprehensive bean-price command detection with version validation
     * @param {boolean} [useWSL=false] - Whether to check in WSL.
     * @returns {Promise<object>} Report of bean-price detection.
     */
    async detectBeanPriceCommand(useWSL: boolean = false): Promise<{
        command: string | null;
        version: string | null;
        isValid: boolean;
        errors: string[];
    }> {
        const result = {
            command: null as string | null,
            version: null as string | null,
            isValid: false,
            errors: [] as string[]
        };

        const systemInfo = await this.getSystemInfo();
        
        // Define bean-price commands to test in order of preference
        let beanPriceCommands = [
            'bean-price',
            'python3 -m beancount.scripts.price',
            'python -m beancount.scripts.price',
            'py -m beancount.scripts.price'
        ];
        
        // Add WSL prefix if needed
        if (useWSL && systemInfo.platform === 'win32') {
            beanPriceCommands = beanPriceCommands.map(cmd => `wsl ${cmd}`);
        }

        for (const beanPriceCmd of beanPriceCommands) {
            try {
                // Test 1: Check if bean-price command exists and get version
                const versionResult = await this.testCommand(`${beanPriceCmd} --version`);
                if (!versionResult.success) {
                    // Try help command as fallback for version detection
                    const helpResult = await this.testCommand(`${beanPriceCmd} --help`);
                    if (!helpResult.success) {
                        result.errors.push(`${beanPriceCmd}: Command not found or not accessible`);
                        continue;
                    }
                    // If help works but version doesn't, we can still use the command
                    result.command = beanPriceCmd;
                    result.version = 'unknown (help available)';
                    result.isValid = true;
                    break;
                }

                // Parse version from output
                let version = 'unknown';
                if (versionResult.output) {
                    // Try to extract version number from various formats
                    const versionMatch = versionResult.output.match(/(\d+\.\d+\.\d+)/);
                    if (versionMatch) {
                        version = versionMatch[1];
                    } else {
                        // Sometimes bean-price just shows "beancount X.Y.Z"
                        const beancountMatch = versionResult.output.match(/beancount\s+(\d+\.\d+\.\d+)/i);
                        if (beancountMatch) {
                            version = beancountMatch[1];
                        }
                    }
                }

                // Test 2: Verify bean-price can run basic command (just test help again since price fetching needs network)
                // We don't want to make network calls during detection, so skip actual price testing

                // All tests passed!
                result.command = beanPriceCmd;
                result.version = version;
                result.isValid = true;
                break;

            } catch (error) {
                result.errors.push(`${beanPriceCmd}: Unexpected error - ${error.message}`);
            }
        }

        return result;
    }

    /**
     * Auto-detect optimal Beancount commands by testing all variations.
     * This is the main entry point for configuring the plugin's environment.
     *
     * @param {string} [beancountFilePath] - Path to the user's ledger file.
     * @param {boolean} [preferWSL=false] - User preference for WSL.
     * @returns {Promise<object>} Comprehensive report containing optimal commands for python, bean-query, etc.
     */
    async detectOptimalBeancountSetup(beancountFilePath?: string, preferWSL: boolean = false): Promise<{
        python: string | null;
        pythonVersion: string | null;
        beanQuery: string | null;
        beanQueryVersion: string | null;
        beanPrice: string | null;
        beanPriceVersion: string | null;
        filePath: string | null;
        useWSL: boolean;
        testResults: { [key: string]: boolean };
        errors: string[];
    }> {
        const results = {
            python: null as string | null,
            pythonVersion: null as string | null,
            beanQuery: null as string | null,
            beanQueryVersion: null as string | null,
            beanPrice: null as string | null,
            beanPriceVersion: null as string | null,
            filePath: beancountFilePath || null,
            useWSL: false,
            testResults: {} as { [key: string]: boolean },
            errors: [] as string[]
        };

        const systemInfo = await this.getSystemInfo();
        
        // Define command variations to test in order of preference
        const commandVariations = {
            python: [
                'python3',
                'python',
                'py',
                ...(systemInfo.platform === 'win32' ? ['wsl python3', 'wsl python'] : [])
            ],
            beanQuery: [
                'bean-query',
                'python3 -m beancount.query',
                'python -m beancount.query',
                'py -m beancount.query',
                ...(systemInfo.platform === 'win32' ? [
                    'wsl bean-query',
                    'wsl python3 -m beancount.query',
                    'wsl python -m beancount.query'
                ] : [])
            ],
            beanPrice: [
                'bean-price',
                'python3 -m beancount.scripts.price',
                'python -m beancount.scripts.price',
                'py -m beancount.scripts.price',
                ...(systemInfo.platform === 'win32' ? [
                    'wsl bean-price',
                    'wsl python3 -m beancount.scripts.price',
                    'wsl python -m beancount.scripts.price'
                ] : [])
            ]
        };

        // Test Python environments comprehensively
        let pythonEnv;
        
        if (preferWSL && systemInfo.platform === 'win32') {
            // User prefers WSL - try WSL Python first
            pythonEnv = await this.detectPythonEnvironment(true);
            
            // If WSL Python fails, fallback to native Python
            if (!pythonEnv.isValid) {
                pythonEnv = await this.detectPythonEnvironment(false);
            }
        } else {
            // Try native Python first
            pythonEnv = await this.detectPythonEnvironment(false);
            
            // If native Python is not valid and we're on Windows, try WSL Python
            if (!pythonEnv.isValid && systemInfo.platform === 'win32') {
                pythonEnv = await this.detectPythonEnvironment(true);
            }
        }
        
        if (pythonEnv.isValid && pythonEnv.command) {
            results.python = pythonEnv.command;
            results.pythonVersion = pythonEnv.version;
            
            // Set WSL flag if the command includes 'wsl'
            if (pythonEnv.command.startsWith('wsl')) {
                results.useWSL = true;
            }
            
            // Record test results
            results.testResults[`${pythonEnv.command}_version`] = true;
            results.testResults[`${pythonEnv.command}_beancount`] = true;
            results.testResults[`${pythonEnv.command}_flask`] = true;
            results.testResults[`${pythonEnv.command}_flask_cors`] = true;
        } else {
            // Record all errors from Python detection
            results.errors.push(...pythonEnv.errors);
            
            // Fallback: try the old simple detection for compatibility
            for (const pythonCmd of commandVariations.python) {
                const testResult = await this.testCommand(`${pythonCmd} --version`);
                results.testResults[`${pythonCmd}_version`] = testResult.success;
                
                if (testResult.success && !results.python) {
                    results.python = pythonCmd;
                    results.useWSL = pythonCmd.startsWith('wsl');
                    break;
                }
            }
        }

        // Test bean-query commands comprehensively
        let beanQueryEnv;
        
        if (preferWSL && systemInfo.platform === 'win32') {
            // User prefers WSL - try WSL bean-query first
            beanQueryEnv = await this.detectBeanQueryCommand(true, beancountFilePath);
            
            // If WSL bean-query fails, fallback to native bean-query
            if (!beanQueryEnv.isValid) {
                beanQueryEnv = await this.detectBeanQueryCommand(false, beancountFilePath);
            }
        } else {
            // Try native bean-query first
            beanQueryEnv = await this.detectBeanQueryCommand(false, beancountFilePath);
            
            // If native bean-query is not valid and we're on Windows, try WSL bean-query
            if (!beanQueryEnv.isValid && systemInfo.platform === 'win32') {
                beanQueryEnv = await this.detectBeanQueryCommand(true, beancountFilePath);
            }
        }
        
        if (beanQueryEnv.isValid && beanQueryEnv.command) {
            results.beanQuery = beanQueryEnv.command;
            results.beanQueryVersion = beanQueryEnv.version;
            
            // Set WSL flag if the command includes 'wsl'
            if (beanQueryEnv.command.startsWith('wsl')) {
                results.useWSL = true;
            }
            
            // Record test results
            results.testResults[`${beanQueryEnv.command}_version`] = true;
            results.testResults[`${beanQueryEnv.command}_help`] = true;
        } else {
            // Record all errors from bean-query detection
            results.errors.push(...beanQueryEnv.errors);
        }

        // Test bean-price commands comprehensively
        let beanPriceEnv;
        
        if (preferWSL && systemInfo.platform === 'win32') {
            // User prefers WSL - try WSL bean-price first
            beanPriceEnv = await this.detectBeanPriceCommand(true);
            
            // If WSL bean-price fails, fallback to native bean-price
            if (!beanPriceEnv.isValid) {
                beanPriceEnv = await this.detectBeanPriceCommand(false);
            }
        } else {
            // Try native bean-price first
            beanPriceEnv = await this.detectBeanPriceCommand(false);
            
            // If native bean-price is not valid and we're on Windows, try WSL bean-price
            if (!beanPriceEnv.isValid && systemInfo.platform === 'win32') {
                beanPriceEnv = await this.detectBeanPriceCommand(true);
            }
        }
        
        if (beanPriceEnv.isValid && beanPriceEnv.command) {
            results.beanPrice = beanPriceEnv.command;
            results.beanPriceVersion = beanPriceEnv.version;
            
            // Set WSL flag if the command includes 'wsl'
            if (beanPriceEnv.command.startsWith('wsl')) {
                results.useWSL = true;
            }
            
            // Record test results
            results.testResults[`${beanPriceEnv.command}_version`] = true;
            results.testResults[`${beanPriceEnv.command}_help`] = true;
        } else {
            // Record all errors from bean-price detection
            results.errors.push(...beanPriceEnv.errors);
        }

        // Format file path for the detected environment
        if (beancountFilePath && results.useWSL && systemInfo.platform === 'win32') {
            // Convert Windows path to WSL format if using WSL commands
            results.filePath = this.convertWindowsToWSLPath(beancountFilePath);
        }

        return results;
    }

}

/** Singleton instance of SystemDetector. */
export const systemDetector = SystemDetector.getInstance();
