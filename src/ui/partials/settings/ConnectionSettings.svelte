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
    let isValidating = false;
    let validationResult = { isValid: false, message: '' };
    
    // Individual command test results
    let commandTests = {
        beanQuery: { isRunning: false, isValid: null, command: '', output: '', error: '' },
        beanQueryCsv: { isRunning: false, isValid: null, command: '', output: '', error: '' }
    };
    
    // Auto-detection results
    let autoDetectionResults = null;
    let isDetecting = false;
    let detectionStatus = 'Not started';
    let optimalCommands = {
        python: null,
        pythonVersion: null,
        beanQuery: null,
        beanQueryVersion: null,
        beanPrice: null,
        beanPriceVersion: null,
        filePath: null,
        useWSL: false
    };

    // Command editing state
    let isEditingCommand = false;
    let editedBeanQueryCommand = '';
    let commandVerificationStatus: 'idle' | 'success' | 'error' = 'idle';
    let commandVerificationMessage = '';
    let isVerifyingCommand = false;

    onMount(async () => {
        await detectSystemAndFiles();
        loadCurrentSettings();
        await detectCurrentCommands();
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
        
        // Suggest beancount command based on system
        await suggestBeancountCommand();
    }

    function loadCurrentSettings() {
        const settings = plugin.settings;
        
        // Detect if current command uses WSL
        if (settings.beancountCommand && settings.beancountCommand.includes('wsl')) {
            useWSL = true;
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

    async function handleWSLToggle() {
        await suggestBeancountCommand();
        await saveSettings();
    }

    async function runAutoDetection() {
        if (isDetecting) return;
        
        isDetecting = true;
        detectionStatus = `Detecting system configuration... ${useWSL ? '(WSL preferred)' : '(Native preferred)'}`;
        
        try {
            const systemDetector = SystemDetector.getInstance();
            
            // Run optimal command detection with current file path and WSL preference
            const results = await systemDetector.detectOptimalBeancountSetup(plugin.settings.beancountFilePath || undefined, useWSL);
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
                results.beanPrice && 'bean-price'
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
        await plugin.saveSettings();
        
        dispatch('settingsChanged', {
            beancountCommand: detectedBeancountCommand
        });
    }

    // Test individual commands
    async function testBeanQuery() {
        const filePath = plugin.settings.beancountFilePath;
        if (!optimalCommands.beanQuery || !filePath) {
            commandTests.beanQuery.error = 'Bean-query command or file path not available';
            return;
        }

        commandTests.beanQuery.isRunning = true;
        commandTests.beanQuery.isValid = null;
        commandTests.beanQuery.command = `${optimalCommands.beanQuery} "${filePath}" "SELECT TRUE LIMIT 1"`;
        
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
        const filePath = plugin.settings.beancountFilePath;
        if (!optimalCommands.beanQuery || !filePath) {
            commandTests.beanQueryCsv.error = 'Bean-query command or file path not available';
            return;
        }

        commandTests.beanQueryCsv.isRunning = true;
        commandTests.beanQueryCsv.isValid = null;
        commandTests.beanQueryCsv.command = `${optimalCommands.beanQuery} -f csv "${filePath}" "SELECT TRUE LIMIT 1"`;
        
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

    async function runAllTests() {
        if (!plugin.settings.beancountFilePath) {
            validationResult = { isValid: false, message: 'No beancount file configured. Please run onboarding first.' };
            return;
        }

        isValidating = true;
        
        try {
            // Run all tests in sequence
            await testBeanQuery();
            await testBeanQueryCsv();

            // Update overall validation result
            const allValid = commandTests.beanQuery.isValid && 
                           commandTests.beanQueryCsv.isValid;
            
            if (allValid) {
                validationResult = { 
                    isValid: true, 
                    message: '✅ All bean-query commands tested successfully!' 
                };
                new Notice('✅ Bean-query commands validated successfully');
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

    // Detect current commands from settings
    async function detectCurrentCommands() {
        const systemDetector = SystemDetector.getInstance();
        
        // If we have a beancount command set, get its version
        if (plugin.settings.beancountCommand) {
            try {
                const versionResult = await systemDetector.testCommand(`${plugin.settings.beancountCommand} --version`);
                if (versionResult.success && versionResult.output) {
                    const versionMatch = versionResult.output.match(/(\d+\.\d+\.\d+)/);
                    optimalCommands.beanQuery = plugin.settings.beancountCommand;
                    optimalCommands.beanQueryVersion = versionMatch ? versionMatch[1] : 'unknown';
                }
            } catch (error) {
                // Silently handle - command might not be set yet
            }
        }
    }

    // Command editing functions
    function enableCommandEdit() {
        isEditingCommand = true;
        editedBeanQueryCommand = plugin.settings.beancountCommand || '';
    }

    function cancelCommandEdit() {
        isEditingCommand = false;
        editedBeanQueryCommand = '';
    }

    async function saveCommandEdit() {
        if (!editedBeanQueryCommand.trim()) {
            new Notice('❌ Command cannot be empty');
            return;
        }

        plugin.settings.beancountCommand = editedBeanQueryCommand.trim();
        await plugin.saveSettings();
        
        isEditingCommand = false;
        commandVerificationStatus = 'idle';
        commandVerificationMessage = '';
        
        // Re-detect command info
        await detectCurrentCommands();
        
        new Notice('✅ Command saved successfully');
        
        dispatch('settingsChanged', {
            beancountCommand: editedBeanQueryCommand.trim()
        });
    }

    async function verifyCommand() {
        const commandToVerify = isEditingCommand ? editedBeanQueryCommand : plugin.settings.beancountCommand;
        
        if (!commandToVerify || !commandToVerify.trim()) {
            commandVerificationStatus = 'error';
            commandVerificationMessage = 'No command to verify';
            return;
        }

        if (!plugin.settings.beancountFilePath) {
            commandVerificationStatus = 'error';
            commandVerificationMessage = 'No beancount file configured. Please run onboarding first.';
            new Notice('❌ No beancount file configured');
            return;
        }

        isVerifyingCommand = true;
        commandVerificationStatus = 'idle';
        commandVerificationMessage = 'Verifying...';

        try {
            const systemDetector = SystemDetector.getInstance();
            const testQuery = 'SELECT TRUE LIMIT 1';
            const command = `${commandToVerify.trim()} -f csv "${plugin.settings.beancountFilePath}" "${testQuery}"`;
            
            const result = await systemDetector.testCommand(command, 15000);
            
            if (result.success) {
                commandVerificationStatus = 'success';
                commandVerificationMessage = '✅ Command verified successfully';
                new Notice('✅ Command verified successfully');
            } else {
                commandVerificationStatus = 'error';
                commandVerificationMessage = `❌ Verification failed: ${result.error || 'Unknown error'}`;
                new Notice('❌ Command verification failed');
            }
        } catch (error) {
            commandVerificationStatus = 'error';
            commandVerificationMessage = `❌ Error: ${error.message}`;
            new Notice(`❌ Verification error: ${error.message}`);
        } finally {
            isVerifyingCommand = false;
        }
    }

    $: {
        // Auto-update when WSL or platform changes
        if (platform && typeof useWSL !== 'undefined') {
            suggestBeancountCommand();
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

    <div class="commands-section">
        <h4>⚙️ Commands</h4>
        
        <div class="command-config">
            <div class="command-item-config">
                <div class="command-info-header">
                    <div class="command-title">
                        <span class="command-icon">🔹</span>
                        <span class="command-name">Bean Query Command</span>
                    </div>
                    {#if optimalCommands.beanQueryVersion}
                        <span class="command-version-badge">v{optimalCommands.beanQueryVersion}</span>
                    {/if}
                </div>
                
                <div class="command-input-group">
                    {#if isEditingCommand}
                        <input 
                            type="text" 
                            class="command-input editing"
                            bind:value={editedBeanQueryCommand}
                            placeholder="bean-query or python3 -m beancount.query"
                        />
                    {:else}
                        <input 
                            type="text" 
                            class="command-input"
                            value={plugin.settings.beancountCommand}
                            disabled
                            placeholder="bean-query or python3 -m beancount.query"
                        />
                    {/if}
                    
                    <div class="command-actions">
                        {#if !isEditingCommand}
                            <button 
                                class="action-btn edit-btn" 
                                on:click={enableCommandEdit}
                                title="Edit command"
                            >
                                ✏️ Edit
                            </button>
                            <button 
                                class="action-btn verify-btn" 
                                on:click={verifyCommand}
                                disabled={isVerifyingCommand || !plugin.settings.beancountCommand}
                                title="Verify command works"
                            >
                                {#if isVerifyingCommand}
                                    🔄 Verifying...
                                {:else}
                                    ✓ Verify
                                {/if}
                            </button>
                        {:else}
                            <button 
                                class="action-btn save-btn" 
                                on:click={saveCommandEdit}
                                disabled={!editedBeanQueryCommand.trim()}
                            >
                                💾 Save
                            </button>
                            <button 
                                class="action-btn cancel-btn" 
                                on:click={cancelCommandEdit}
                            >
                                ✖ Cancel
                            </button>
                        {/if}
                    </div>
                </div>
                
                <!-- Verification Status -->
                {#if commandVerificationMessage}
                    <div class="verification-status" class:success={commandVerificationStatus === 'success'} class:error={commandVerificationStatus === 'error'}>
                        <span class="status-icon">
                            {#if commandVerificationStatus === 'success'}
                                ✅
                            {:else if commandVerificationStatus === 'error'}
                                ❌
                            {:else}
                                ℹ️
                            {/if}
                        </span>
                        <span class="status-message">{commandVerificationMessage}</span>
                    </div>
                {/if}
                
                <div class="command-help">
                    <p class="help-text">
                        This command is used to execute BQL queries against your Beancount file. 
                        Common values: <code>bean-query</code>, <code>wsl bean-query</code>, or <code>python3 -m beancount.query</code>
                    </p>
                </div>
            </div>
        </div>
    </div>
</div>

<style>
    .connection-settings {
        padding: 16px;
        background: var(--background-primary);
        border-radius: 8px;
        border: 1px solid var(--background-modifier-border);
    }

    .system-info, .wsl-section, .commands-section {
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

    .status-icon {
        font-size: 14px;
    }

    /* Commands Section Styles */
    .commands-section h4 {
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .command-config {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .command-item-config {
        background: var(--background-primary-alt);
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        padding: 16px;
    }

    .command-info-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
    }

    .command-title {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .command-icon {
        font-size: 16px;
    }

    .command-name {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-normal);
    }

    .command-version-badge {
        background: var(--interactive-accent);
        color: white;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.5px;
    }

    .command-input-group {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
    }

    .command-input {
        flex: 1;
        padding: 8px 12px;
        font-family: var(--font-monospace);
        font-size: 12px;
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        color: var(--text-normal);
    }

    .command-input:disabled {
        background: var(--background-secondary);
        color: var(--text-muted);
        cursor: not-allowed;
    }

    .command-input.editing {
        border-color: var(--interactive-accent);
        background: var(--background-primary);
        color: var(--text-normal);
    }

    .command-actions {
        display: flex;
        gap: 6px;
    }

    .action-btn {
        padding: 8px 14px;
        border: none;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
    }

    .edit-btn {
        background: var(--interactive-accent);
        color: white;
    }

    .edit-btn:hover:not(:disabled) {
        background: var(--interactive-accent-hover);
    }

    .verify-btn {
        background: var(--background-modifier-success);
        color: var(--text-success);
        border: 1px solid var(--text-success);
    }

    .verify-btn:hover:not(:disabled) {
        background: var(--text-success);
        color: white;
    }

    .save-btn {
        background: var(--text-success);
        color: white;
    }

    .save-btn:hover:not(:disabled) {
        opacity: 0.9;
    }

    .cancel-btn {
        background: var(--background-modifier-border);
        color: var(--text-normal);
    }

    .cancel-btn:hover {
        background: var(--background-modifier-border-hover);
    }

    .action-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .verification-status {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        border-radius: 4px;
        margin-bottom: 12px;
        font-size: 12px;
    }

    .verification-status.success {
        background: var(--background-modifier-success);
        border: 1px solid var(--text-success);
        color: var(--text-success);
    }

    .verification-status.error {
        background: var(--background-modifier-error);
        border: 1px solid var(--text-error);
        color: var(--text-error);
    }

    .verification-status .status-icon {
        font-size: 16px;
    }

    .verification-status .status-message {
        flex: 1;
    }

    .command-help {
        background: var(--background-secondary);
        padding: 10px 12px;
        border-radius: 4px;
        border-left: 3px solid var(--text-accent);
    }

    .command-help .help-text {
        margin: 0;
        font-size: 11px;
        line-height: 1.5;
        color: var(--text-muted);
    }

    .command-help code {
        background: var(--background-primary);
        padding: 2px 4px;
        border-radius: 2px;
        font-size: 10px;
        color: var(--text-accent);
    }

    .info-text {
        margin: 0;
        font-size: 11px;
        color: var(--text-muted);
        line-height: 1.4;
    }

    @media (max-width: 768px) {
        .connection-settings {
            padding: 12px;
        }

        .system-info, .wsl-section {
            padding: 12px;
            margin-bottom: 16px;
        }

        .system-grid {
            grid-template-columns: 1fr;
            gap: 12px;
        }
    }
</style>