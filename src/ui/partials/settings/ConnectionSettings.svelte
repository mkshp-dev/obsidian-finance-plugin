<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import { Notice } from 'obsidian';
    import type BeancountPlugin from '../../../main';
    import { SystemDetector } from '../../../utils/SystemDetector';

    export let plugin: BeancountPlugin;
    
    const dispatch = createEventDispatcher();

    let platform: string = '';
    let systemInfo: any = null;
    let isWSLAvailable = false;
    let useWSL = false;
    let detectedBeancountCommand = '';
    let selectedFile: string = '';
    let fullFilePath = '';
    let isValidating = false;
    let validationResult = { isValid: false, message: '' };
    let availableFiles: string[] = [];
    
    // Individual command test results
    let commandTests = {
        beanCheck: { isRunning: false, isValid: null, command: '', output: '', error: '' },
        beanQuery: { isRunning: false, isValid: null, command: '', output: '', error: '' },
        beanQueryCsv: { isRunning: false, isValid: null, command: '', output: '', error: '' },
        backend: { isRunning: false, isValid: null, command: '', output: '', error: '' }
    };
    
    // Auto-detection results
    let autoDetectionResults = null;
    let isDetecting = false;
    let detectionStatus = 'Not started';
    let optimalCommands = {
        python: null,
        pythonVersion: null,
        pythonPackages: null,
        beanQuery: null,
        beanQueryVersion: null,
        beanPrice: null,
        beanPriceVersion: null,
        beanCheck: null,
        beanCheckVersion: null,
        filePath: null,
        useWSL: false
    };

    onMount(async () => {
        await detectSystemAndFiles();
        loadCurrentSettings();
        // Force an additional file load after mount
        setTimeout(() => {
            loadVaultFiles();
        }, 100);
    });



    async function detectSystemAndFiles() {
        const systemDetector = SystemDetector.getInstance();
        
        // Get comprehensive system information
        try {
            systemInfo = await systemDetector.getSystemInfo();
            platform = systemInfo.platform;
        } catch (error) {
            // Silently handle system info detection errors
            platform = process.platform;
        }
        
        // Check WSL availability on Windows
        if (platform === 'win32') {
            try {
                isWSLAvailable = await systemDetector.detectWSLAvailability();
            } catch (error) {
                // Silently handle WSL availability check errors
                isWSLAvailable = false;
            }
        }
        
        // Auto-set WSL usage if running in WSL environment
        if (systemInfo?.isWSL) {
            useWSL = true;

        }

        // Get beancount files from vault

        loadVaultFiles();
        
        // Suggest beancount command based on system
        await suggestBeancountCommand();
        

    }

    function loadCurrentSettings() {
        const settings = plugin.settings;
        
        // Detect if current command uses WSL
        if (settings.beancountCommand && settings.beancountCommand.includes('wsl')) {
            useWSL = true;
        }
        
        // Load selected file
        selectedFile = settings.beancountFilePath || '';
        updateFullPath();
    }

    function loadVaultFiles() {
        try {
            // Get all files from vault
            const allFiles = plugin.app.vault.getFiles();
            // Filter for beancount files
            const beancountFiles = allFiles.filter(file => {
                return file.extension === 'beancount' || file.extension === 'bean';
            });
            
            // Also check for files with .beancount in the name (fallback)
            const additionalFiles = allFiles.filter(file => {
                const hasBeancountInName = file.name.includes('.beancount') || file.name.includes('.bean');
                const notAlreadyIncluded = !beancountFiles.some(bf => bf.path === file.path);
                return hasBeancountInName && notAlreadyIncluded;
            });
            
            // Combine both results
            const allBeancountFiles = [...beancountFiles, ...additionalFiles];
            availableFiles = allBeancountFiles.map(file => file.path).sort();
            
        } catch (error) {
            console.error('Error loading vault files:', error);
            availableFiles = [];
        }
    }

    async function suggestBeancountCommand() {
        const systemDetector = SystemDetector.getInstance();
        
        if (useWSL && isWSLAvailable) {
            detectedBeancountCommand = 'wsl bean-query';
        } else {
            // Try to detect beancount command
            try {
                const suggestions = await systemDetector.suggestBeancountCommand();
                if (suggestions.length > 0) {
                    detectedBeancountCommand = suggestions[0];
                } else {
                    detectedBeancountCommand = platform === 'win32' ? 'bean-query.exe' : 'bean-query';
                }
            } catch (error) {
                detectedBeancountCommand = platform === 'win32' ? 'bean-query.exe' : 'bean-query';
            }
        }
    }

    function updateFullPath() {
        if (!selectedFile) {
            fullFilePath = '';
            return;
        }

        // Get vault path using correct API
        const vaultPath = plugin.app.vault.adapter.getBasePath();
        // Join paths manually since path.join isn't available
        const separator = platform === 'win32' ? '\\' : '/';
        const fullPath = vaultPath + separator + selectedFile.replace(/\//g, separator);
        
        if (useWSL && isWSLAvailable && platform === 'win32') {
            // Convert Windows path to WSL path
            fullFilePath = convertToWSLPath(fullPath);
        } else {
            fullFilePath = fullPath;
        }
    }

    function convertToWSLPath(windowsPath: string): string {
        // Convert C:\path\to\file to /mnt/c/path/to/file
        const match = windowsPath.match(/^([A-Za-z]):(.*)/);
        if (match) {
            const drive = match[1].toLowerCase();
            const path = match[2].replace(/\\/g, '/');
            return `/mnt/${drive}${path}`;
        }
        return windowsPath.replace(/\\/g, '/');
    }

    async function handleWSLToggle() {
        await suggestBeancountCommand();
        updateFullPath();
        await saveSettings();
    }

    async function handleFileSelection() {
        updateFullPath();
        await saveSettings();
        
        // Validate the file
        if (selectedFile) {
            await validateConfiguration();
        }
    }

    async function runAutoDetection() {
        if (isDetecting) return;
        
        isDetecting = true;
        detectionStatus = `Detecting system configuration... ${useWSL ? '(WSL preferred)' : '(Native preferred)'}`;
        
        try {
            const systemDetector = SystemDetector.getInstance();
            
            // Run optimal command detection with current file path and WSL preference
            const results = await systemDetector.detectOptimalBeancountSetup(fullFilePath || undefined, useWSL);
            autoDetectionResults = results;
            optimalCommands = results;
            
            // Apply detected settings
            useWSL = results.useWSL;
            
            // Update the main beancount command with the detected bean-query command
            if (results.beanQuery) {
                detectedBeancountCommand = results.beanQuery;
                
                // Save to plugin settings
                plugin.settings.beancountCommand = results.beanQuery;
                await plugin.saveSettings();
            }
            
            detectionStatus = `Detection completed - Found: ${[
                results.python && `Python (${results.useWSL ? 'WSL' : 'Native'})`,
                results.beanQuery && `bean-query (${results.useWSL ? 'WSL' : 'Native'})`, 
                results.beanPrice && 'bean-price',
                results.beanCheck && 'bean-check'
            ].filter(Boolean).join(', ')}`;
            
            // Update validation
            await validateConfiguration();
            
        } catch (error) {
            console.error('Auto-detection failed:', error);
            detectionStatus = `Detection failed: ${error.message}`;
            autoDetectionResults = null;
        } finally {
            isDetecting = false;
        }
    }

    async function saveSettings() {
        plugin.settings.beancountCommand = detectedBeancountCommand;
        plugin.settings.beancountFilePath = fullFilePath;
        await plugin.saveSettings();
        
        dispatch('settingsChanged', {
            beancountCommand: detectedBeancountCommand,
            beancountFilePath: fullFilePath
        });
    }

    // Test individual commands
    async function testBeanCheck() {
        if (!optimalCommands.beanCheck || !fullFilePath) {
            commandTests.beanCheck.error = 'Bean-check command or file path not available';
            return;
        }

        commandTests.beanCheck.isRunning = true;
        commandTests.beanCheck.isValid = null;
        commandTests.beanCheck.command = `${optimalCommands.beanCheck} "${fullFilePath}"`;
        
        try {
            const systemDetector = SystemDetector.getInstance();
            const testResult = await systemDetector.testCommand(commandTests.beanCheck.command, 15000);
            
            commandTests.beanCheck.isValid = testResult.success;
            commandTests.beanCheck.output = testResult.output || '';
            commandTests.beanCheck.error = testResult.error || '';
            
        } catch (error) {
            commandTests.beanCheck.isValid = false;
            commandTests.beanCheck.error = `Error: ${error.message}`;
        } finally {
            commandTests.beanCheck.isRunning = false;
        }
    }

    async function testBeanQuery() {
        if (!optimalCommands.beanQuery || !fullFilePath) {
            commandTests.beanQuery.error = 'Bean-query command or file path not available';
            return;
        }

        commandTests.beanQuery.isRunning = true;
        commandTests.beanQuery.isValid = null;
        commandTests.beanQuery.command = `${optimalCommands.beanQuery} "${fullFilePath}" "SELECT TRUE LIMIT 1"`;
        
        try {
            const systemDetector = SystemDetector.getInstance();
            const testResult = await systemDetector.testCommand(commandTests.beanQuery.command, 15000);
            
            commandTests.beanQuery.isValid = testResult.success;
            commandTests.beanQuery.output = testResult.output || '';
            commandTests.beanQuery.error = testResult.error || '';
            
        } catch (error) {
            commandTests.beanQuery.isValid = false;
            commandTests.beanQuery.error = `Error: ${error.message}`;
        } finally {
            commandTests.beanQuery.isRunning = false;
        }
    }

    async function testBeanQueryCsv() {
        if (!optimalCommands.beanQuery || !fullFilePath) {
            commandTests.beanQueryCsv.error = 'Bean-query command or file path not available';
            return;
        }

        commandTests.beanQueryCsv.isRunning = true;
        commandTests.beanQueryCsv.isValid = null;
        commandTests.beanQueryCsv.command = `${optimalCommands.beanQuery} -f csv "${fullFilePath}" "SELECT TRUE LIMIT 1"`;
        
        try {
            const systemDetector = SystemDetector.getInstance();
            const testResult = await systemDetector.testCommand(commandTests.beanQueryCsv.command, 15000);
            
            commandTests.beanQueryCsv.isValid = testResult.success;
            commandTests.beanQueryCsv.output = testResult.output || '';
            commandTests.beanQueryCsv.error = testResult.error || '';
            
        } catch (error) {
            commandTests.beanQueryCsv.isValid = false;
            commandTests.beanQueryCsv.error = `Error: ${error.message}`;
        } finally {
            commandTests.beanQueryCsv.isRunning = false;
        }
    }

    async function testBackend() {
        if (!optimalCommands.python || !fullFilePath) {
            commandTests.backend.error = 'Python executable or file path not available';
            return;
        }

        commandTests.backend.isRunning = true;
        commandTests.backend.isValid = null;

        // Construct backend script path
        const vaultPath = plugin.app.vault.adapter.getBasePath();
        let backendScriptPath;
        
        if (optimalCommands.useWSL && platform === 'win32') {
            // For WSL: Convert Windows vault path to WSL format, then append Unix-style plugin path
            const match = vaultPath.match(/^([A-Za-z]):(.*)/);
            if (match) {
                const driveLetter = match[1].toLowerCase();
                const restOfPath = match[2].replace(/\\/g, '/');
                const wslVaultPath = `/mnt/${driveLetter}${restOfPath}`;
                backendScriptPath = `${wslVaultPath}/.obsidian/plugins/obsidian-finance-plugin/src/backend/journal_api.py`;
            } else {
                // Fallback if path doesn't match expected Windows format
                backendScriptPath = `${vaultPath}/.obsidian/plugins/obsidian-finance-plugin/src/backend/journal_api.py`;
            }
        } else {
            // For Windows native: Use Windows-style path separators throughout
            backendScriptPath = `${vaultPath}\\.obsidian\\plugins\\obsidian-finance-plugin\\src\\backend\\journal_api.py`;
        }

        commandTests.backend.command = `${optimalCommands.python} "${backendScriptPath}" "${fullFilePath}" --port 5013 --host localhost --validate-only`;
        
        try {
            const systemDetector = SystemDetector.getInstance();
            // Use shorter timeout for backend test since it should start quickly or fail fast
            const testResult = await systemDetector.testCommand(commandTests.backend.command, 10000);
            
            commandTests.backend.isValid = testResult.success;
            commandTests.backend.output = testResult.output || '';
            commandTests.backend.error = testResult.error || '';
            
        } catch (error) {
            commandTests.backend.isValid = false;
            commandTests.backend.error = `Error: ${error.message}`;
        } finally {
            commandTests.backend.isRunning = false;
        }
    }

    async function runAllTests() {
        if (!selectedFile) {
            validationResult = { isValid: false, message: 'Please select a beancount file first' };
            return;
        }

        isValidating = true;
        
        try {
            // Run all tests in sequence
            await testBeanCheck();
            await testBeanQuery();
            await testBeanQueryCsv();
            await testBackend();

            // Update overall validation result
            const allValid = commandTests.beanCheck.isValid && 
                           commandTests.beanQuery.isValid && 
                           commandTests.beanQueryCsv.isValid &&
                           commandTests.backend.isValid;
            
            if (allValid) {
                validationResult = { 
                    isValid: true, 
                    message: '✅ All commands tested successfully!' 
                };
                new Notice('✅ All Beancount commands validated successfully');
            } else {
                validationResult = { 
                    isValid: false, 
                    message: '❌ Some command tests failed - check individual results' 
                };
                new Notice('❌ Some Beancount command tests failed');
            }
        } catch (error) {
            validationResult = { 
                isValid: false, 
                message: `❌ Error during validation: ${error.message}` 
            };
        } finally {
            isValidating = false;
        }
    }

    // Legacy function for compatibility (now calls runAllTests)
    async function validateConfiguration() {
        await runAllTests();
    }

    function refreshFiles() {
        loadVaultFiles();
        const fileCount = availableFiles.length;
        new Notice(`File list refreshed - found ${fileCount} beancount file${fileCount !== 1 ? 's' : ''}`);
    }
    $: {
        // Auto-update when WSL or platform changes
        if (platform && typeof useWSL !== 'undefined') {
            suggestBeancountCommand();
            updateFullPath();
        }
    }
</script>

<div class="connection-settings">
    <div class="system-info">
        <h4>🖥️ System Information</h4>
        <div class="system-grid">
            <div class="system-card">
                <div class="card-header">
                    <span class="card-icon">💻</span>
                    <h5>System Platform</h5>
                </div>
                <div class="card-content">
                    {#if systemInfo}
                        <div class="info-item">
                            <span class="label">OS:</span>
                            <span class="value">{systemInfo.platformDisplay}</span>
                        </div>
                        <div class="info-item">
                            <span class="label">Architecture:</span>
                            <span class="value">{systemInfo.arch}</span>
                        </div>
                        {#if platform === 'win32'}
                            <div class="info-item">
                                <span class="label">WSL Available:</span>
                                <span class="value status" class:available={isWSLAvailable}>{isWSLAvailable ? 'Yes' : 'No'}</span>
                            </div>
                        {/if}
                    {:else}
                        <div class="loading">Loading system info...</div>
                    {/if}
                </div>
            </div>
            
            <div class="system-card">
                <div class="card-header">
                    <span class="card-icon">⚡</span>
                    <h5>Terminal Specification</h5>
                </div>
                <div class="card-content">
                    {#if systemInfo}
                        <div class="info-item">
                            <span class="label">Shell:</span>
                            <span class="value">{systemInfo.shell}</span>
                        </div>
                        <div class="info-item">
                            <span class="label">Environment:</span>
                            <span class="value">
                                {#if systemInfo.isWSL}
                                    🐧 WSL Environment
                                {:else if platform === 'win32'}
                                    🪟 Windows Native
                                {:else}
                                    🖥️ System Native
                                {/if}
                            </span>
                        </div>
                        <div class="info-item">
                            <span class="label">Path Format:</span>
                            <span class="value">{systemInfo.pathSeparator === '\\' ? 'Windows (\\)' : 'Unix (/)'}</span>
                        </div>
                    {:else}
                        <div class="loading">Loading terminal info...</div>
                    {/if}
                </div>
            </div>
        </div>
    </div>

    {#if platform === 'win32'}
        <div class="wsl-section" class:active={isWSLAvailable && !systemInfo?.isWSL} class:passive={systemInfo?.isWSL || !isWSLAvailable} class:disabled={!isWSLAvailable}>
            <div class="wsl-header">
                <h4>🐧 WSL Configuration</h4>
                <div class="wsl-status">
                    {#if isWSLAvailable && systemInfo?.isWSL}
                        <span class="status-badge running">Running in WSL</span>
                    {:else if isWSLAvailable}
                        <span class="status-badge available">WSL Available</span>
                    {:else}
                        <span class="status-badge unavailable">WSL Not Available</span>
                    {/if}
                </div>
            </div>
            
            <div class="wsl-content">
                <label class="wsl-toggle" class:disabled={systemInfo?.isWSL || !isWSLAvailable}>
                    <input 
                        type="checkbox" 
                        bind:checked={useWSL} 
                        on:change={handleWSLToggle}
                        disabled={systemInfo?.isWSL || !isWSLAvailable}
                    />
                    <span class="checkmark"></span>
                    <div class="toggle-content">
                        <span class="label-text">Use Windows Subsystem for Linux (WSL)</span>
                        <span class="description">
                            {#if systemInfo?.isWSL}
                                Currently running in WSL environment - WSL usage is automatic
                            {:else if isWSLAvailable}
                                Choose this if you have installed the requirements in WSL. WSL provides better compatibility with beancount tools.
                            {:else}
                                WSL is not available on this system
                            {/if}
                        </span>
                    </div>
                </label>
                
                {#if systemInfo?.isWSL}
                    <div class="wsl-info automatic">
                        <span class="info-icon">ℹ️</span>
                        <span class="info-text">WSL usage is automatically enabled because you're running inside a WSL environment.</span>
                    </div>
                {:else if isWSLAvailable}
                    <div class="wsl-info optional">
                        <span class="info-icon">💡</span>
                        <span class="info-text">Choose this if you have installed Python and beancount requirements in WSL. WSL provides better compatibility and easier package management for beancount tools.</span>
                    </div>
                {:else}
                    <div class="wsl-info unavailable">
                        <span class="info-icon">⚠️</span>
                        <span class="info-text">WSL is not installed or not available. Commands will run natively on Windows.</span>
                    </div>
                {/if}
            </div>
        </div>
    {/if}

    <div class="file-section">
        <h4>📁 Beancount File Selection</h4>
        
        <div class="file-selector">
            <div class="selector-header">
                <span class="selector-label">Select your .beancount file from the vault:</span>
            </div>
            
            {#if availableFiles.length > 0}
                <div class="files-found">
                    <p class="files-count">Found {availableFiles.length} beancount file{availableFiles.length !== 1 ? 's' : ''}</p>
                    <div class="file-actions">
                        <button on:click={refreshFiles} class="refresh-btn" title="Refresh file list">
                            🔄 Refresh
                        </button>
                    </div>
                </div>
                
                <div class="dropdown-container">
                    <label for="file-selector" class="dropdown-label">Choose file: <span class="selected-file-inline">{selectedFile ? selectedFile : 'None selected'}</span></label>
                    <select 
                        id="file-selector"
                        bind:value={selectedFile} 
                        on:change={handleFileSelection} 
                        class="file-dropdown"
                    >
                        <option value="">Select a beancount file...</option>
                        {#each availableFiles as file}
                            <option value={file}>{file}</option>
                        {/each}
                    </select>
                </div>
            {:else}
                <div class="no-files">
                    <p>No .beancount or .bean files found in vault</p>
                    <p class="help-text">
                        Beancount files should have .beancount or .bean extension.<br>
                        Click refresh if you just added a file.
                    </p>
                    <div class="no-files-actions">
                        <button on:click={refreshFiles} class="refresh-files-btn">
                            🔄 Refresh Files
                        </button>
                        
                    </div>
                </div>
            {/if}
        </div>

        {#if selectedFile}
            <div class="file-path-display">
                <h5>📍 File Path Information</h5>
                <div class="path-grid">
                    <div class="path-card">
                        <div class="path-header">
                            <span class="path-icon">📂</span>
                            <span class="path-title">Vault Location</span>
                        </div>
                        <code class="path-code">{plugin.app.vault.adapter.getBasePath()}</code>
                    </div>
                    
                    <div class="path-card">
                        <div class="path-header">
                            <span class="path-icon">📄</span>
                            <span class="path-title">Relative Path</span>
                        </div>
                        <code class="path-code">{selectedFile}</code>
                    </div>
                    
                    <div class="path-card full-path-card">
                        <div class="path-header">
                            <span class="path-icon">🎯</span>
                            <span class="path-title">
                                Full System Path
                                {#if useWSL && isWSLAvailable && platform === 'win32'}
                                    <span class="path-badge wsl">WSL Format</span>
                                {:else if platform === 'win32'}
                                    <span class="path-badge windows">Windows Format</span>
                                {:else}
                                    <span class="path-badge unix">Unix Format</span>
                                {/if}
                            </span>
                        </div>
                        <code class="path-code full-path">{fullFilePath}</code>
                        {#if useWSL && isWSLAvailable && platform === 'win32'}
                            <div class="path-note">
                                <span class="note-icon">ℹ️</span>
                                <span class="note-text">Path converted for WSL environment</span>
                            </div>
                        {/if}
                    </div>
                </div>
                
                <div class="path-summary">
                    <span class="summary-icon">✅</span>
                    <span class="summary-text">
                        File selected: <strong>{selectedFile}</strong> 
                        {#if useWSL && isWSLAvailable && platform === 'win32'}
                            (will be accessed via WSL)
                        {:else if platform === 'win32'}
                            (will be accessed natively on Windows)
                        {:else}
                            (will be accessed natively on {systemInfo?.platformDisplay || 'Unix'})
                        {/if}
                    </span>
                </div>
            </div>
        {/if}
    </div>

    <div class="auto-detection-section">
        <div class="section-header">
            <h4>🔍 Automatic Command Detection</h4>
            <button 
                class="detect-btn" 
                class:loading={isDetecting}
                on:click={runAutoDetection}
                disabled={isDetecting}
            >
                {#if isDetecting}
                    ⏳ Detecting...
                {:else}
                    🔄 Auto-Detect Commands
                {/if}
            </button>
        </div>
        
        <div class="detection-status">
            <span class="status-text">{detectionStatus}</span>
        </div>

        {#if autoDetectionResults || selectedFile}
            <div class="detection-results">
                <h5>🎯 Detected Commands:</h5>
                <div class="commands-grid">
                    <div class="command-item python-item" class:success={optimalCommands.python}>
                        <div class="command-header">
                            <span class="command-label">Python:</span>
                            <span class="status-icon">{optimalCommands.python ? '✅' : '❌'}</span>
                        </div>
                        <code class="command-code">{optimalCommands.python || 'Not found'}</code>
                        {#if optimalCommands.pythonVersion}
                            <div class="python-details">
                                <div class="python-version">
                                    <span class="detail-label">Version:</span>
                                    <span class="detail-value">{optimalCommands.pythonVersion}</span>
                                </div>
                                {#if optimalCommands.pythonPackages}
                                    <div class="python-packages">
                                        <span class="detail-label">Packages:</span>
                                        <div class="packages-list">
                                            <div class="package-item">
                                                <span class="package-name">beancount:</span>
                                                <span class="package-version">{optimalCommands.pythonPackages.beancount}</span>
                                            </div>
                                            <div class="package-item">
                                                <span class="package-name">flask:</span>
                                                <span class="package-version">{optimalCommands.pythonPackages.flask}</span>
                                            </div>
                                            <div class="package-item">
                                                <span class="package-name">flask_cors:</span>
                                                <span class="package-version">{optimalCommands.pythonPackages.flask_cors}</span>
                                            </div>
                                        </div>
                                    </div>
                                {/if}
                            </div>
                        {/if}
                    </div>
                    
                    <div class="command-item bean-query-item" class:success={optimalCommands.beanQuery}>
                        <div class="command-header">
                            <span class="command-label">Bean Query:</span>
                            <span class="status-icon">{optimalCommands.beanQuery ? '✅' : '❌'}</span>
                        </div>
                        <code class="command-code">{optimalCommands.beanQuery || 'Not found'}</code>
                        {#if optimalCommands.beanQueryVersion}
                            <div class="bean-query-details">
                                <div class="bean-query-version">
                                    <span class="detail-label">Version:</span>
                                    <span class="detail-value">{optimalCommands.beanQueryVersion}</span>
                                </div>
                            </div>
                        {/if}
                    </div>
                    
                    <div class="command-item bean-price-item" class:success={optimalCommands.beanPrice}>
                        <div class="command-header">
                            <span class="command-label">Bean Price:</span>
                            <span class="status-icon">{optimalCommands.beanPrice ? '✅' : '❌'}</span>
                        </div>
                        <code class="command-code">{optimalCommands.beanPrice || 'Not found'}</code>
                        {#if optimalCommands.beanPriceVersion}
                            <div class="bean-price-details">
                                <div class="bean-price-version">
                                    <span class="detail-label">Version:</span>
                                    <span class="detail-value">{optimalCommands.beanPriceVersion}</span>
                                </div>
                            </div>
                        {/if}
                    </div>
                    
                    <div class="command-item bean-check-item" class:success={optimalCommands.beanCheck}>
                        <div class="command-header">
                            <span class="command-label">Bean Check:</span>
                            <span class="status-icon">{optimalCommands.beanCheck ? '✅' : '❌'}</span>
                        </div>
                        <code class="command-code">{optimalCommands.beanCheck || 'Not found'}</code>
                        {#if optimalCommands.beanCheckVersion}
                            <div class="bean-check-details">
                                <div class="bean-check-version">
                                    <span class="detail-label">Version:</span>
                                    <span class="detail-value">{optimalCommands.beanCheckVersion}</span>
                                </div>
                            </div>
                        {/if}
                    </div>
                </div>

                <div class="environment-info">
                    <div class="env-item">
                        <span class="env-label">Environment:</span>
                        <span class="env-value">
                            {#if optimalCommands.useWSL}
                                🐧 WSL (Windows Subsystem for Linux)
                            {:else if platform === 'win32'}
                                🪟 Windows Native
                            {:else}
                                🖥️ System Native
                            {/if}
                        </span>
                    </div>
                    
                    {#if fullFilePath}
                        <div class="env-item">
                            <span class="env-label">File Path Format:</span>
                            <code class="env-code">{optimalCommands.filePath || fullFilePath}</code>
                        </div>
                    {/if}
                </div>
            </div>
        {:else if !isDetecting}
            <div class="no-detection">
                <p class="help-text">
                    Click "Auto-Detect Commands" to automatically find the best beancount setup for your system.
                    This will test various command combinations and select the optimal configuration.
                </p>
            </div>
        {/if}
    </div>

    {#if selectedFile && optimalCommands.beanCheck && optimalCommands.beanQuery && optimalCommands.python}
        <div class="validation-section">
            <h4>✅ Connection Validation</h4>
            
            <div class="validation-controls">
                <button 
                    on:click={runAllTests} 
                    disabled={isValidating}
                    class="validate-btn"
                    class:validating={isValidating}
                >
                    {isValidating ? '🔄 Testing All Commands...' : '🧪 Test All Commands'}
                </button>
                
                {#if validationResult.message}
                    <div class="validation-result" class:valid={validationResult.isValid} class:invalid={!validationResult.isValid}>
                        {validationResult.message}
                    </div>
                {/if}
            </div>

            <div class="command-tests">
                <!-- Bean Check Test -->
                <div class="command-test-item">
                    <div class="test-header">
                        <h5>1. Bean Check</h5>
                        <button 
                            on:click={testBeanCheck} 
                            disabled={commandTests.beanCheck.isRunning || !optimalCommands.beanCheck}
                            class="test-individual-btn"
                            class:running={commandTests.beanCheck.isRunning}
                        >
                            {#if commandTests.beanCheck.isRunning}
                                🔄 Testing...
                            {:else}
                                🧪 Test
                            {/if}
                        </button>
                        <span class="test-status">
                            {#if commandTests.beanCheck.isRunning}
                                🔄
                            {:else if commandTests.beanCheck.isValid === true}
                                ✅
                            {:else if commandTests.beanCheck.isValid === false}
                                ❌
                            {:else}
                                ⭕
                            {/if}
                        </span>
                    </div>
                    <div class="test-command">
                        <strong>Command:</strong> 
                        <code>{commandTests.beanCheck.command || `${optimalCommands.beanCheck || 'bean-check'} "${fullFilePath}"`}</code>
                    </div>
                    {#if commandTests.beanCheck.error}
                        <div class="test-error">
                            <strong>Error:</strong> {commandTests.beanCheck.error}
                        </div>
                    {/if}
                    {#if commandTests.beanCheck.output}
                        <div class="test-output">
                            <strong>Output:</strong> <pre>{commandTests.beanCheck.output.slice(0, 200)}{commandTests.beanCheck.output.length > 200 ? '...' : ''}</pre>
                        </div>
                    {/if}
                </div>

                <!-- Bean Query Test -->
                <div class="command-test-item">
                    <div class="test-header">
                        <h5>2. Bean Query</h5>
                        <button 
                            on:click={testBeanQuery} 
                            disabled={commandTests.beanQuery.isRunning || !optimalCommands.beanQuery}
                            class="test-individual-btn"
                            class:running={commandTests.beanQuery.isRunning}
                        >
                            {#if commandTests.beanQuery.isRunning}
                                🔄 Testing...
                            {:else}
                                🧪 Test
                            {/if}
                        </button>
                        <span class="test-status">
                            {#if commandTests.beanQuery.isRunning}
                                🔄
                            {:else if commandTests.beanQuery.isValid === true}
                                ✅
                            {:else if commandTests.beanQuery.isValid === false}
                                ❌
                            {:else}
                                ⭕
                            {/if}
                        </span>
                    </div>
                    <div class="test-command">
                        <strong>Command:</strong> 
                        <code>{commandTests.beanQuery.command || `${optimalCommands.beanQuery || 'bean-query'} "${fullFilePath}" "SELECT TRUE LIMIT 1"`}</code>
                    </div>
                    {#if commandTests.beanQuery.error}
                        <div class="test-error">
                            <strong>Error:</strong> {commandTests.beanQuery.error}
                        </div>
                    {/if}
                    {#if commandTests.beanQuery.output}
                        <div class="test-output">
                            <strong>Output:</strong> <pre>{commandTests.beanQuery.output.slice(0, 200)}{commandTests.beanQuery.output.length > 200 ? '...' : ''}</pre>
                        </div>
                    {/if}
                </div>

                <!-- Bean Query CSV Test -->
                <div class="command-test-item">
                    <div class="test-header">
                        <h5>3. Bean Query (CSV Output)</h5>
                        <button 
                            on:click={testBeanQueryCsv} 
                            disabled={commandTests.beanQueryCsv.isRunning || !optimalCommands.beanQuery}
                            class="test-individual-btn"
                            class:running={commandTests.beanQueryCsv.isRunning}
                        >
                            {#if commandTests.beanQueryCsv.isRunning}
                                🔄 Testing...
                            {:else}
                                🧪 Test
                            {/if}
                        </button>
                        <span class="test-status">
                            {#if commandTests.beanQueryCsv.isRunning}
                                🔄
                            {:else if commandTests.beanQueryCsv.isValid === true}
                                ✅
                            {:else if commandTests.beanQueryCsv.isValid === false}
                                ❌
                            {:else}
                                ⭕
                            {/if}
                        </span>
                    </div>
                    <div class="test-command">
                        <strong>Command:</strong> 
                        <code>{commandTests.beanQueryCsv.command || `${optimalCommands.beanQuery || 'bean-query'} -f csv "${fullFilePath}" "SELECT TRUE LIMIT 1"`}</code>
                    </div>
                    {#if commandTests.beanQueryCsv.error}
                        <div class="test-error">
                            <strong>Error:</strong> {commandTests.beanQueryCsv.error}
                        </div>
                    {/if}
                    {#if commandTests.beanQueryCsv.output}
                        <div class="test-output">
                            <strong>Output:</strong> <pre>{commandTests.beanQueryCsv.output.slice(0, 200)}{commandTests.beanQueryCsv.output.length > 200 ? '...' : ''}</pre>
                        </div>
                    {/if}
                </div>

                <!-- Backend Test -->
                <div class="command-test-item">
                    <div class="test-header">
                        <h5>4. Backend API Server</h5>
                        <button 
                            on:click={testBackend} 
                            disabled={commandTests.backend.isRunning || !optimalCommands.python}
                            class="test-individual-btn"
                            class:running={commandTests.backend.isRunning}
                        >
                            {#if commandTests.backend.isRunning}
                                🔄 Testing...
                            {:else}
                                🧪 Test
                            {/if}
                        </button>
                        <span class="test-status">
                            {#if commandTests.backend.isRunning}
                                🔄
                            {:else if commandTests.backend.isValid === true}
                                ✅
                            {:else if commandTests.backend.isValid === false}
                                ❌
                            {:else}
                                ⭕
                            {/if}
                        </span>
                    </div>
                    <div class="test-command">
                        <strong>Command:</strong> 
                        <code>{commandTests.backend.command || `${optimalCommands.python || 'python'} "vault/.obsidian/plugins/obsidian-finance-plugin/src/backend/journal_api.py" "${fullFilePath}" --port 5013 --host localhost --validate-only`}</code>
                    </div>
                    {#if commandTests.backend.error}
                        <div class="test-error">
                            <strong>Error:</strong> {commandTests.backend.error}
                        </div>
                    {/if}
                    {#if commandTests.backend.output}
                        <div class="test-output">
                            <strong>Output:</strong> <pre>{commandTests.backend.output.slice(0, 200)}{commandTests.backend.output.length > 200 ? '...' : ''}</pre>
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    {/if}
</div>

<style>
    .connection-settings {
        padding: 16px;
        background: var(--background-primary);
        border-radius: 8px;
        border: 1px solid var(--background-modifier-border);
    }

    .system-info, .wsl-section, .auto-detection-section, .file-section, .validation-section {
        margin-bottom: 24px;
        padding: 16px;
        background: var(--background-secondary);
        border-radius: 6px;
        border: 1px solid var(--background-modifier-border-hover);
    }

    h4 {
        margin: 0 0 12px 0;
        color: var(--text-normal);
        font-size: 14px;
        font-weight: 600;
    }

    .system-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
    }

    .system-card {
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        overflow: hidden;
    }

    .card-header {
        background: var(--background-modifier-hover);
        padding: 12px 16px;
        display: flex;
        align-items: center;
        gap: 8px;
        border-bottom: 1px solid var(--background-modifier-border);
    }

    .card-icon {
        font-size: 16px;
    }

    .card-header h5 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--text-normal);
    }

    .card-content {
        padding: 12px 16px;
    }

    .info-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 0;
    }

    .loading {
        text-align: center;
        color: var(--text-muted);
        font-style: italic;
        padding: 12px 0;
    }

    .status.available {
        color: var(--text-success);
        font-weight: 500;
    }

    .label {
        font-weight: 500;
        color: var(--text-muted);
        font-size: 12px;
    }

    .value {
        font-family: var(--font-monospace);
        font-size: 11px;
        color: var(--text-normal);
        background: var(--background-primary);
        padding: 2px 6px;
        border-radius: 3px;
    }

    .wsl-toggle {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        cursor: pointer;
        padding: 8px;
        border-radius: 4px;
        transition: background-color 0.2s;
    }

    .wsl-toggle:hover {
        background: var(--background-modifier-hover);
    }

    .wsl-toggle input[type="checkbox"] {
        margin: 0;
        transform: scale(1.2);
    }

    .label-text {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .label-text .description {
        font-size: 11px;
        color: var(--text-muted);
        font-style: italic;
    }

    /* Enhanced WSL Configuration Styles */
    .wsl-section.active {
        border-color: var(--interactive-accent);
        background: var(--background-secondary);
    }

    .wsl-section.passive {
        border-color: var(--background-modifier-border-hover);
        background: var(--background-primary-alt);
        opacity: 0.8;
    }

    .wsl-section.disabled {
        border-color: var(--background-modifier-border);
        background: var(--background-primary-alt);
        opacity: 0.6;
    }

    .wsl-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
    }

    .wsl-header h4 {
        margin: 0;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .wsl-status {
        display: flex;
        align-items: center;
    }

    .status-badge {
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .status-badge.running {
        background: var(--text-success);
        color: white;
    }

    .status-badge.available {
        background: var(--interactive-accent);
        color: white;
    }

    .status-badge.unavailable {
        background: var(--text-muted);
        color: white;
    }

    .wsl-content {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .wsl-toggle.disabled {
        cursor: not-allowed;
        opacity: 0.7;
    }

    .wsl-toggle.disabled:hover {
        background: none;
    }

    .toggle-content {
        display: flex;
        flex-direction: column;
        gap: 4px;
        flex: 1;
    }

    .wsl-info {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        line-height: 1.4;
    }

    .wsl-info.automatic {
        background: rgba(46, 160, 67, 0.1);
        border: 1px solid var(--text-success);
        color: var(--text-success);
    }

    .wsl-info.optional {
        background: rgba(100, 108, 255, 0.1);
        border: 1px solid var(--interactive-accent);
        color: var(--text-normal);
    }

    .wsl-info.unavailable {
        background: rgba(229, 83, 83, 0.1);
        border: 1px solid var(--text-error);
        color: var(--text-error);
    }

    .info-icon {
        font-size: 14px;
        margin-top: 1px;
    }

    .info-text {
        flex: 1;
    }

    /* Auto-Detection Section */
    .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
    }

    .detect-btn {
        padding: 8px 16px;
        background: var(--interactive-accent);
        color: var(--text-on-accent);
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        transition: background-color 0.2s;
    }

    .detect-btn:hover:not(:disabled) {
        background: var(--interactive-accent-hover);
    }

    .detect-btn:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }

    .detect-btn.loading {
        animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
    }

    .detection-status {
        padding: 8px 12px;
        background: var(--background-primary-alt);
        border-radius: 4px;
        border-left: 3px solid var(--text-accent);
        margin-bottom: 16px;
    }

    .status-text {
        font-size: 13px;
        color: var(--text-muted);
        font-style: italic;
    }

    .detection-results {
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        padding: 16px;
        background: var(--background-primary-alt);
    }

    .detection-results h5 {
        margin: 0 0 12px 0;
        color: var(--text-normal);
        font-size: 13px;
        font-weight: 600;
    }

    .commands-grid {
        display: grid;
        gap: 8px;
        margin-bottom: 16px;
    }

    .command-item {
        display: grid;
        grid-template-columns: 100px 1fr auto;
        gap: 8px;
        align-items: center;
        padding: 8px;
        background: var(--background-primary);
        border-radius: 4px;
        border: 1px solid var(--background-modifier-border);
    }

    .command-item.success {
        border-color: var(--text-success);
        background: var(--background-modifier-success);
    }

    .command-label {
        font-size: 12px;
        font-weight: 500;
        color: var(--text-normal);
    }

    .command-code {
        font-family: var(--font-monospace);
        font-size: 11px;
        color: var(--text-accent);
        background: var(--background-secondary);
        padding: 4px 6px;
        border-radius: 3px;
        word-break: break-all;
    }

    .status-icon {
        font-size: 14px;
    }

    /* Enhanced Python Display */
    .command-item.python-item {
        grid-template-columns: 1fr;
        gap: 8px;
        padding: 12px;
    }

    .command-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
    }

    .python-details {
        margin-top: 10px;
        padding: 8px;
        background: var(--background-secondary);
        border-radius: 4px;
        border: 1px solid var(--background-modifier-border);
    }

    .python-version {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 8px;
    }

    .detail-label {
        font-size: 11px;
        font-weight: 500;
        color: var(--text-muted);
        min-width: 60px;
    }

    .detail-value {
        font-size: 12px;
        font-weight: 600;
        color: var(--text-success);
    }

    .python-packages {
        margin-top: 8px;
    }

    .packages-list {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 4px;
        margin-top: 4px;
    }

    .package-item {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 10px;
    }

    .package-name {
        color: var(--text-muted);
        font-weight: 500;
    }

    .package-version {
        color: var(--text-accent);
        font-weight: 600;
    }

    /* Enhanced Bean Query Display */
    .command-item.bean-query-item {
        grid-template-columns: 1fr;
        gap: 8px;
        padding: 12px;
    }

    .bean-query-details {
        margin-top: 8px;
        padding: 6px 8px;
        background: var(--background-secondary);
        border-radius: 4px;
        border: 1px solid var(--background-modifier-border);
    }

    .bean-query-version {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .bean-price-details {
        margin-top: 8px;
        padding: 6px 8px;
        background: var(--background-secondary);
        border-radius: 4px;
        border: 1px solid var(--background-modifier-border);
    }

    .bean-price-version {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .bean-check-details {
        margin-top: 8px;
        padding: 6px 8px;
        background: var(--background-secondary);
        border-radius: 4px;
        border: 1px solid var(--background-modifier-border);
    }

    .bean-check-version {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .environment-info {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid var(--background-modifier-border);
    }

    .env-item {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .env-label {
        font-size: 12px;
        font-weight: 500;
        color: var(--text-normal);
        min-width: 120px;
    }

    .env-value {
        font-size: 12px;
        color: var(--text-muted);
    }

    .env-code {
        font-family: var(--font-monospace);
        font-size: 11px;
        color: var(--text-accent);
        background: var(--background-secondary);
        padding: 2px 4px;
        border-radius: 2px;
        word-break: break-all;
    }

    .no-detection {
        padding: 16px;
        text-align: center;
        background: var(--background-primary-alt);
        border-radius: 4px;
        border: 1px dashed var(--background-modifier-border);
    }

    .no-detection .help-text {
        font-size: 13px;
        color: var(--text-muted);
        line-height: 1.5;
        margin: 0;
    }

    .file-selector {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .selector-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
    }

    .selector-label {
        font-weight: 500;
        color: var(--text-normal);
        font-size: 13px;
    }

    .files-found {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        background: var(--background-primary-alt);
        border-radius: 4px;
        border: 1px solid var(--text-success);
        margin-bottom: 8px;
    }

    .files-count {
        margin: 0;
        font-size: 12px;
        color: var(--text-success);
        font-weight: 500;
    }

    .file-actions {
        display: flex;
        gap: 6px;
    }

    .refresh-btn {
        padding: 4px 8px;
        font-size: 11px;
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        color: var(--text-normal);
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .refresh-btn:hover {
        background: var(--background-modifier-hover);
    }

    .dropdown-container {
        margin-top: 12px;
        padding: 12px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        background: var(--background-primary-alt);
    }

    .dropdown-label {
        display: block;
        font-weight: 500;
        color: var(--text-normal);
        margin-bottom: 6px;
        font-size: 13px;
    }

    .dropdown-label .selected-file-inline {
        margin-left: 8px;
        font-size: 12px;
        font-weight: 400;
        color: var(--text-muted);
        font-family: var(--font-monospace);
        max-width: 70%;
        display: inline-block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        vertical-align: middle;
    }

    .file-dropdown {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-primary);
        color: var(--text-normal);
        font-size: 13px;
        min-height: 32px;
    }

    .file-dropdown:focus {
        outline: none;
        border-color: var(--interactive-accent);
        box-shadow: 0 0 0 2px var(--interactive-accent-hover);
    }

    .no-files {
        text-align: center;
        padding: 20px;
        color: var(--text-muted);
    }

    .no-files p {
        margin: 0 0 12px 0;
        font-style: italic;
    }

    .no-files .help-text {
        font-size: 12px;
        line-height: 1.4;
        margin-bottom: 16px;
        color: var(--text-muted);
    }

    .no-files-actions {
        display: flex;
        gap: 8px;
        justify-content: center;
        align-items: center;
    }

    .refresh-files-btn {
        padding: 8px 16px;
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        color: var(--text-normal);
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
    }

    .refresh-files-btn:hover {
        background: var(--background-modifier-hover);
    }
    /* Enhanced File Path Display */
    .file-path-display {
        margin-top: 16px;
        padding: 16px;
        background: var(--background-primary-alt);
        border-radius: 6px;
        border: 1px solid var(--background-modifier-border);
    }

    .file-path-display h5 {
        margin: 0 0 16px 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--text-normal);
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .path-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px;
        margin-bottom: 16px;
    }

    .path-card {
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        padding: 12px;
        position: relative;
    }

    .path-card.full-path-card {
        border-color: var(--interactive-accent);
        background: rgba(100, 108, 255, 0.05);
    }

    .path-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
    }

    .path-icon {
        font-size: 14px;
    }

    .path-title {
        font-size: 12px;
        font-weight: 500;
        color: var(--text-muted);
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .path-badge {
        padding: 2px 6px;
        border-radius: 10px;
        font-size: 10px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .path-badge.wsl {
        background: var(--text-success);
        color: white;
    }

    .path-badge.windows {
        background: var(--interactive-accent);
        color: white;
    }

    .path-badge.unix {
        background: var(--text-muted);
        color: white;
    }

    .path-code {
        font-family: var(--font-monospace);
        background: var(--background-modifier-hover);
        padding: 6px 8px;
        border-radius: 3px;
        font-size: 11px;
        color: var(--text-accent);
        word-break: break-all;
        display: block;
        border: 1px solid var(--background-modifier-border);
    }

    .full-path-card .path-code {
        background: rgba(100, 108, 255, 0.1);
        border-color: var(--interactive-accent);
        font-weight: 500;
    }

    .path-note {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 8px;
        font-size: 11px;
        color: var(--text-success);
    }

    .note-icon {
        font-size: 12px;
    }

    .note-text {
        font-style: italic;
    }

    .path-summary {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        background: rgba(46, 160, 67, 0.1);
        border: 1px solid var(--text-success);
        border-radius: 4px;
        font-size: 12px;
        color: var(--text-success);
    }

    .summary-icon {
        font-size: 14px;
    }

    .summary-text strong {
        color: var(--text-normal);
    }

    .validation-controls {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .validate-btn {
        padding: 10px 20px;
        background: var(--interactive-accent);
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        transition: background-color 0.2s;
        align-self: flex-start;
    }

    .validate-btn:hover:not(:disabled) {
        background: var(--interactive-accent-hover);
    }

    .validate-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .validate-btn.validating {
        background: var(--background-modifier-border);
        color: var(--text-muted);
    }

    .validation-result {
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
    }

    .validation-result.valid {
        background: rgba(46, 160, 67, 0.1);
        color: var(--text-success);
        border: 1px solid var(--text-success);
    }

    .validation-result.invalid {
        background: rgba(229, 83, 83, 0.1);
        color: var(--text-error);
        border: 1px solid var(--text-error);
    }

    .command-tests {
        margin-top: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .command-test-item {
        background: var(--background-secondary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        padding: 12px;
    }

    .test-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
    }

    .test-header h5 {
        margin: 0;
        font-size: 13px;
        font-weight: 600;
        flex-grow: 1;
    }

    .test-individual-btn {
        background: var(--interactive-accent);
        color: var(--text-on-accent);
        border: none;
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 10px;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .test-individual-btn:hover:not(:disabled) {
        background: var(--interactive-accent-hover);
    }

    .test-individual-btn:disabled {
        background: var(--background-modifier-border);
        color: var(--text-muted);
        cursor: not-allowed;
    }

    .test-individual-btn.running {
        background: var(--color-orange);
    }

    .test-status {
        font-size: 14px;
        min-width: 20px;
        text-align: center;
    }

    .test-command {
        background: var(--background-primary);
        padding: 6px 8px;
        border-radius: 4px;
        margin: 4px 0;
        font-size: 10px;
    }

    .test-command code {
        font-family: var(--font-monospace);
        font-size: 10px;
        word-break: break-all;
    }

    .test-error {
        background: rgba(229, 83, 83, 0.1);
        color: var(--text-error);
        padding: 6px 8px;
        border-radius: 4px;
        margin: 4px 0;
        font-size: 10px;
        border: 1px solid var(--text-error);
    }

    .test-output {
        background: rgba(68, 181, 68, 0.1);
        color: var(--text-success);
        padding: 6px 8px;
        border-radius: 4px;
        margin: 4px 0;
        font-size: 10px;
        border: 1px solid var(--text-success);
    }

    .test-output pre {
        margin: 0;
        font-family: var(--font-monospace);
        font-size: 9px;
        white-space: pre-wrap;
        word-break: break-word;
    }

    .info-text {
        margin: 0;
        font-size: 11px;
        color: var(--text-muted);
        line-height: 1.4;
    }

    .test-command {
        font-family: var(--font-monospace);
        background: var(--background-primary);
        padding: 2px 4px;
        border-radius: 2px;
        font-size: 10px;
        color: var(--text-accent);
    }

    @media (max-width: 768px) {
        .connection-settings {
            padding: 12px;
        }

        .system-info, .wsl-section, .command-section, .file-section, .validation-section {
            padding: 12px;
            margin-bottom: 16px;
        }

        .info-grid {
            grid-template-columns: 1fr;
        }

        .system-grid {
            grid-template-columns: 1fr;
            gap: 12px;
        }

        .file-path-display {
            padding: 12px;
        }

        .file-path-display h5 {
            font-size: 13px;
        }

        .path-grid {
            gap: 10px;
        }

        .path-card {
            padding: 10px;
        }

        .path-code {
            font-size: 10px;
            padding: 5px 6px;
        }

        .path-summary {
            padding: 8px 10px;
            font-size: 11px;
        }

        .selector-header {
            flex-direction: column;
            align-items: stretch;
        }
        .packages-list {
            grid-template-columns: 1fr;
            gap: 3px;
        }

        .package-item {
            font-size: 9px;
        }

        .python-details {
            padding: 6px;
        }

        .bean-query-details {
            padding: 4px 6px;
        }

        .bean-price-details {
            padding: 4px 6px;
        }

        .bean-check-details {
            padding: 4px 6px;
        }
    }
</style>