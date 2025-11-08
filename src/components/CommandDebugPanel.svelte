<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import type { CommandInfo } from '../utils/CommandAuditor';
    import { CommandAuditor } from '../utils/CommandAuditor';
    import type BeancountPlugin from '../main';

    export let plugin: BeancountPlugin;

    const dispatch = createEventDispatcher();
    
    let auditor: CommandAuditor;
    let commands: CommandInfo[] = [];
    let systemConfig: any = {};
    let commandSummary: {[category: string]: number} = {};
    let isLoading = false;
    let testResults = new Map<string, {success: boolean, output?: string, error?: string}>();
    let selectedCategory: string = 'all';
    let searchTerm = '';
    let isExpanded = false;
    let showOnlyFailed = false;
    let autoRefreshEnabled = false;
    let refreshInterval: number;
    
    const categories = ['all', 'system_detection', 'beancount_tools', 'python_execution', 'backend_management'] as const;
    const categoryLabels = {
        all: 'All Commands',
        system_detection: 'System Detection',
        beancount_tools: 'Beancount Tools',
        python_execution: 'Python Execution',
        backend_management: 'Backend Management'
    };

    onMount(() => {
        initializeAuditor();
        if (autoRefreshEnabled) {
            startAutoRefresh();
        }
    });

    function initializeAuditor() {
        auditor = new CommandAuditor(plugin);
        refreshCommands();
    }

    function refreshCommands() {
        if (!auditor) return;
        
        auditor.refresh();
        const report = auditor.generateDebugReport();
        commands = report.commands;
        systemConfig = report.systemConfig;
        commandSummary = report.commandSummary;
    }

    function startAutoRefresh() {
        if (refreshInterval) clearInterval(refreshInterval);
        refreshInterval = setInterval(() => {
            refreshCommands();
        }, 30000); // Refresh every 30 seconds
    }

    function stopAutoRefresh() {
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = undefined;
        }
    }

    function toggleAutoRefresh() {
        autoRefreshEnabled = !autoRefreshEnabled;
        if (autoRefreshEnabled) {
            startAutoRefresh();
        } else {
            stopAutoRefresh();
        }
    }

    async function testCommand(commandId: string) {
        if (!auditor || isLoading) return;
        
        isLoading = true;
        try {
            const result = await auditor.testCommand(commandId);
            testResults.set(commandId, result);
            testResults = new Map(testResults); // Trigger reactivity
            refreshCommands(); // Update command status
        } catch (error) {
            console.error('Command test error:', error);
        } finally {
            isLoading = false;
        }
    }

    async function testAllCommands() {
        if (!auditor || isLoading) return;
        
        isLoading = true;
        try {
            const results = await auditor.testAllCommands();
            testResults = new Map(results);
            refreshCommands(); // Update command status
        } catch (error) {
            console.error('Test all commands error:', error);
        } finally {
            isLoading = false;
        }
    }

    function copyCommand(actualCommand: string) {
        navigator.clipboard.writeText(actualCommand).then(() => {
            // Could show a temporary notification here
        });
    }

    function exportDebugReport() {
        const report = auditor.generateDebugReport();
        const dataStr = JSON.stringify(report, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        
        const exportFileDefaultName = `beancount-plugin-debug-report-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    }

    $: filteredCommands = commands.filter(cmd => {
        // Category filter
        if (selectedCategory !== 'all' && cmd.category !== selectedCategory) {
            return false;
        }
        
        // Search filter
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            return cmd.name.toLowerCase().includes(searchLower) ||
                   cmd.description.toLowerCase().includes(searchLower) ||
                   cmd.actualCommand.toLowerCase().includes(searchLower) ||
                   cmd.purpose.toLowerCase().includes(searchLower);
        }

        // Failed filter
        if (showOnlyFailed) {
            return cmd.last_result === 'error';
        }
        
        return true;
    });

    $: totalCommands = commands.length;
    $: testedCommands = commands.filter(c => c.last_tested).length;
    $: successfulCommands = commands.filter(c => c.last_result === 'success').length;
    $: failedCommands = commands.filter(c => c.last_result === 'error').length;
</script>

<div class="command-debug-panel">
    <div class="panel-header">
        <h3>Command Debug Panel</h3>
        <div class="header-controls">
            <button on:click={refreshCommands} class="refresh-btn" disabled={isLoading}>
                {isLoading ? 'Loading...' : 'Refresh'}
            </button>
            <button on:click={exportDebugReport} class="export-btn">
                Export Report
            </button>
            <button on:click={() => isExpanded = !isExpanded} class="toggle-btn">
                {isExpanded ? 'Collapse' : 'Expand'}
            </button>
        </div>
    </div>

    <!-- System Configuration Summary -->
    <div class="system-summary">
        <h4>System Configuration</h4>
        <div class="config-grid">
            <div class="config-item">
                <span class="label">Platform:</span>
                <span class="value">{systemConfig.platform || 'Unknown'}</span>
            </div>
            <div class="config-item">
                <span class="label">WSL Mode:</span>
                <span class="value">{systemConfig.isWSL ? 'Yes' : 'No'}</span>
            </div>
            <div class="config-item">
                <span class="label">Beancount Command:</span>
                <span class="value code">{systemConfig.beancountCommand || 'Not configured'}</span>
            </div>
            <div class="config-item">
                <span class="label">Beancount File:</span>
                <span class="value path">{systemConfig.beancountFilePath || 'Not configured'}</span>
            </div>
            <div class="config-item">
                <span class="label">Total Commands:</span>
                <span class="value">{totalCommands}</span>
            </div>
            <div class="config-item">
                <span class="label">Tested:</span>
                <span class="value">{testedCommands}/{totalCommands}</span>
            </div>
        </div>
    </div>

    <!-- Command Summary -->
    <div class="command-summary">
        <h4>Command Statistics</h4>
        <div class="stats-grid">
            {#each Object.entries(commandSummary) as [category, count]}
                <div class="stat-item">
                    <span class="category">{categoryLabels[category] || category}:</span>
                    <span class="count">{count}</span>
                </div>
            {/each}
        </div>
        <div class="test-summary">
            <span class="success">✓ {successfulCommands} passed</span>
            <span class="failed">✗ {failedCommands} failed</span>
            <span class="untested">○ {totalCommands - testedCommands} untested</span>
        </div>
    </div>

    <!-- Controls -->
    <div class="controls">
        <div class="filter-controls">
            <select bind:value={selectedCategory}>
                {#each categories as category}
                    <option value={category}>{categoryLabels[category]}</option>
                {/each}
            </select>
            
            <input
                type="text"
                bind:value={searchTerm}
                placeholder="Search commands..."
                class="search-input"
            />
            
            <label class="checkbox-label">
                <input type="checkbox" bind:checked={showOnlyFailed} />
                Show only failed
            </label>
        </div>

        <div class="action-controls">
            <button on:click={testAllCommands} disabled={isLoading} class="test-all-btn">
                {isLoading ? 'Testing...' : `Test All (${filteredCommands.length})`}
            </button>
            
            <label class="checkbox-label">
                <input type="checkbox" bind:checked={autoRefreshEnabled} on:change={toggleAutoRefresh} />
                Auto-refresh (30s)
            </label>
        </div>
    </div>

    <!-- Commands List -->
    <div class="commands-list" class:expanded={isExpanded}>
        {#each filteredCommands as command (command.id)}
            <div class="command-card" class:tested={command.last_tested} class:success={command.last_result === 'success'} class:error={command.last_result === 'error'}>
                <div class="command-header">
                    <div class="command-info">
                        <h5>{command.name}</h5>
                        <span class="category-badge">{categoryLabels[command.category]}</span>
                        <span class="status-indicator">
                            {#if command.last_result === 'success'}
                                <span class="success-icon">✓</span>
                            {:else if command.last_result === 'error'}
                                <span class="error-icon">✗</span>
                            {:else}
                                <span class="untested-icon">○</span>
                            {/if}
                        </span>
                    </div>
                    <div class="command-actions">
                        <button on:click={() => testCommand(command.id)} disabled={isLoading} class="test-btn">
                            Test
                        </button>
                        <button on:click={() => copyCommand(command.actualCommand)} class="copy-btn" title="Copy command">
                            📋
                        </button>
                    </div>
                </div>

                <div class="command-details">
                    <p class="description">{command.description}</p>
                    <div class="command-info-grid">
                        <div class="info-item">
                            <span class="info-label">Executed from:</span>
                            <span class="info-value">{command.executedFrom}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Purpose:</span>
                            <span class="info-value">{command.purpose}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Requirements:</span>
                            <span class="info-value">{command.requirements.join(', ')}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">WSL Compatible:</span>
                            <span class="info-value">{command.wsla_compatible ? 'Yes' : 'No'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Timeout:</span>
                            <span class="info-value">{command.timeout}ms</span>
                        </div>
                    </div>

                    <div class="command-code">
                        <div class="code-header">
                            <span class="code-label">Actual Command:</span>
                            <button on:click={() => copyCommand(command.actualCommand)} class="copy-code-btn">Copy</button>
                        </div>
                        <code class="command-text">{command.actualCommand}</code>
                    </div>

                    {#if command.last_tested}
                        <div class="test-info">
                            <span class="test-date">Last tested: {command.last_tested.toLocaleString()}</span>
                        </div>
                    {/if}

                    {#if testResults.has(command.id)}
                        {@const result = testResults.get(command.id)}
                        <div class="test-result" class:success={result?.success} class:error={!result?.success}>
                            {#if result?.success}
                                <div class="success-result">
                                    <strong>✓ Success</strong>
                                    {#if result.output}
                                        <pre class="result-output">{result.output}</pre>
                                    {/if}
                                </div>
                            {:else}
                                <div class="error-result">
                                    <strong>✗ Failed</strong>
                                    {#if result?.error}
                                        <pre class="result-error">{result.error}</pre>
                                    {/if}
                                </div>
                            {/if}
                        </div>
                    {/if}

                    {#if command.last_error}
                        <div class="last-error">
                            <strong>Last Error:</strong>
                            <pre class="error-text">{command.last_error}</pre>
                        </div>
                    {/if}
                </div>
            </div>
        {/each}
    </div>

    {#if filteredCommands.length === 0}
        <div class="empty-state">
            <p>No commands match the current filters.</p>
        </div>
    {/if}
</div>

<style>
    .command-debug-panel {
        padding: 16px;
        background: var(--background-primary);
        border-radius: 8px;
        border: 1px solid var(--background-modifier-border);
    }

    .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--background-modifier-border);
    }

    .panel-header h3 {
        margin: 0;
        color: var(--text-normal);
    }

    .header-controls {
        display: flex;
        gap: 8px;
    }

    .header-controls button {
        padding: 6px 12px;
        border: 1px solid var(--background-modifier-border);
        background: var(--background-secondary);
        color: var(--text-normal);
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
    }

    .header-controls button:hover:not(:disabled) {
        background: var(--background-modifier-hover);
    }

    .header-controls button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .system-summary, .command-summary {
        margin-bottom: 16px;
        padding: 12px;
        background: var(--background-secondary);
        border-radius: 6px;
    }

    .system-summary h4, .command-summary h4 {
        margin: 0 0 8px 0;
        font-size: 14px;
        color: var(--text-normal);
    }

    .config-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 8px;
    }

    .config-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 4px 0;
    }

    .config-item .label {
        font-weight: 500;
        color: var(--text-muted);
        font-size: 12px;
    }

    .config-item .value {
        font-family: var(--font-monospace);
        font-size: 11px;
        color: var(--text-normal);
    }

    .config-item .value.code {
        background: var(--background-primary);
        padding: 2px 4px;
        border-radius: 3px;
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .config-item .value.path {
        max-width: 250px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 8px;
        margin-bottom: 8px;
    }

    .stat-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 4px 0;
    }

    .stat-item .category {
        font-size: 12px;
        color: var(--text-muted);
    }

    .stat-item .count {
        font-weight: 600;
        color: var(--text-normal);
    }

    .test-summary {
        display: flex;
        gap: 16px;
        font-size: 12px;
    }

    .test-summary .success {
        color: var(--text-success);
    }

    .test-summary .failed {
        color: var(--text-error);
    }

    .test-summary .untested {
        color: var(--text-muted);
    }

    .controls {
        margin-bottom: 16px;
        padding: 12px;
        background: var(--background-secondary);
        border-radius: 6px;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .filter-controls, .action-controls {
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
    }

    .filter-controls select, .search-input {
        padding: 6px 8px;
        border: 1px solid var(--background-modifier-border);
        background: var(--background-primary);
        color: var(--text-normal);
        border-radius: 4px;
        font-size: 12px;
    }

    .search-input {
        flex: 1;
        min-width: 200px;
    }

    .checkbox-label {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: var(--text-normal);
        cursor: pointer;
    }

    .test-all-btn {
        padding: 8px 16px;
        background: var(--interactive-accent);
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
    }

    .test-all-btn:hover:not(:disabled) {
        background: var(--interactive-accent-hover);
    }

    .test-all-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .commands-list {
        max-height: 400px;
        overflow-y: auto;
    }

    .commands-list.expanded {
        max-height: none;
    }

    .command-card {
        margin-bottom: 12px;
        padding: 12px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        background: var(--background-primary);
    }

    .command-card.success {
        border-color: var(--text-success);
        background: var(--background-primary-alt);
    }

    .command-card.error {
        border-color: var(--text-error);
        background: var(--background-primary-alt);
    }

    .command-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 8px;
    }

    .command-info h5 {
        margin: 0 0 4px 0;
        font-size: 14px;
        color: var(--text-normal);
    }

    .category-badge {
        font-size: 10px;
        padding: 2px 6px;
        background: var(--background-modifier-border);
        color: var(--text-muted);
        border-radius: 10px;
        margin-right: 8px;
    }

    .status-indicator .success-icon {
        color: var(--text-success);
    }

    .status-indicator .error-icon {
        color: var(--text-error);
    }

    .status-indicator .untested-icon {
        color: var(--text-muted);
    }

    .command-actions {
        display: flex;
        gap: 6px;
    }

    .test-btn, .copy-btn {
        padding: 4px 8px;
        font-size: 11px;
        border: 1px solid var(--background-modifier-border);
        background: var(--background-secondary);
        color: var(--text-normal);
        border-radius: 3px;
        cursor: pointer;
    }

    .test-btn:hover:not(:disabled), .copy-btn:hover {
        background: var(--background-modifier-hover);
    }

    .test-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .command-details {
        font-size: 12px;
    }

    .description {
        color: var(--text-muted);
        margin: 0 0 8px 0;
        font-style: italic;
    }

    .command-info-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 4px;
        margin-bottom: 8px;
    }

    .info-item {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
    }

    .info-label {
        font-weight: 500;
        color: var(--text-muted);
        margin-right: 8px;
        min-width: 80px;
    }

    .info-value {
        color: var(--text-normal);
        flex: 1;
        text-align: right;
    }

    .command-code {
        margin: 8px 0;
        padding: 8px;
        background: var(--background-secondary);
        border-radius: 4px;
        border: 1px solid var(--background-modifier-border);
    }

    .code-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
    }

    .code-label {
        font-weight: 500;
        color: var(--text-muted);
        font-size: 11px;
    }

    .copy-code-btn {
        padding: 2px 6px;
        font-size: 10px;
        border: 1px solid var(--background-modifier-border);
        background: var(--background-primary);
        color: var(--text-muted);
        border-radius: 2px;
        cursor: pointer;
    }

    .command-text {
        font-family: var(--font-monospace);
        font-size: 11px;
        color: var(--text-normal);
        background: var(--background-primary);
        padding: 4px 6px;
        border-radius: 3px;
        display: block;
        width: 100%;
        overflow-x: auto;
        white-space: nowrap;
    }

    .test-info {
        margin: 8px 0;
        font-size: 11px;
        color: var(--text-muted);
    }

    .test-result {
        margin: 8px 0;
        padding: 8px;
        border-radius: 4px;
        border: 1px solid var(--background-modifier-border);
    }

    .test-result.success {
        background: rgba(46, 160, 67, 0.1);
        border-color: var(--text-success);
    }

    .test-result.error {
        background: rgba(229, 83, 83, 0.1);
        border-color: var(--text-error);
    }

    .result-output, .result-error {
        margin: 4px 0 0 0;
        font-family: var(--font-monospace);
        font-size: 11px;
        white-space: pre-wrap;
        max-height: 100px;
        overflow-y: auto;
    }

    .result-output {
        color: var(--text-normal);
    }

    .result-error {
        color: var(--text-error);
    }

    .last-error {
        margin: 8px 0;
        padding: 8px;
        background: rgba(229, 83, 83, 0.1);
        border: 1px solid var(--text-error);
        border-radius: 4px;
    }

    .error-text {
        margin: 4px 0 0 0;
        font-family: var(--font-monospace);
        font-size: 11px;
        color: var(--text-error);
        white-space: pre-wrap;
    }

    .empty-state {
        text-align: center;
        padding: 32px;
        color: var(--text-muted);
        font-style: italic;
    }

    @media (max-width: 768px) {
        .config-grid, .stats-grid {
            grid-template-columns: 1fr;
        }
        
        .filter-controls, .action-controls {
            flex-direction: column;
            align-items: stretch;
        }
        
        .command-header {
            flex-direction: column;
            gap: 8px;
        }
        
        .command-info-grid {
            grid-template-columns: 1fr;
        }
        
        .info-item {
            flex-direction: column;
            align-items: flex-start;
        }
        
        .info-value {
            text-align: left;
            margin-left: 16px;
        }
    }
</style>