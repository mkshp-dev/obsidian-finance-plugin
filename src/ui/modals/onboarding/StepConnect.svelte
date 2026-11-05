<!-- src/ui/modals/onboarding/StepConnect.svelte -->
<script lang="ts">
	import InstallationHelp from './InstallationHelp.svelte';
	import { BEANCOUNT_UPGRADE_COMMAND, BEANCOUNT_UPGRADE_DOCS_URL } from '../../../utils/beancountVersion';

	export let isDetecting = false;
	export let beanQueryValid = false;
	export let beanQueryCommand: string | null = null;
	export let beanQueryVersion: string | null = null;
	export let beanQueryIsV2 = false;
	export let beanPriceValid = false;
	export let beanPriceCommand: string | null = null;
	export let beanPriceVersion: string | null = null;

	export let manualCommand = '';
	export let isVerifying = false;
	export let verifyResult: 'idle' | 'success' | 'error' = 'idle';
	export let verifyMessage = '';
	export let isEditing = false;
	export let activeInstallTab: 'windows' | 'macos' | 'linux-native' | 'linux-sandbox' = 'windows';

	export let onDetect: () => void;
	export let onVerifyManualCommand: () => void;
	export let onStartEditing: () => void;
	export let onCancelEditing: () => void;
	export let onSkip: () => void;
	export let onNext: () => void;
</script>

<p class="step-description">
	This plugin uses <strong>bean-query</strong>, a command-line tool from the Beancount ecosystem to query your financial data.
	Obsidian must be able to run it.
</p>

{#if isDetecting}
	<div class="detect-loading">
		<div class="spinner"></div>
		<span>Detecting bean-query on your system…</span>
	</div>
{:else}
	<!-- ── bean-query status ── -->
	<div class="command-status-card" class:is-valid={beanQueryValid} class:is-invalid={!beanQueryValid} class:is-error={verifyResult === 'error'}>
		<div class="command-status-header">
			<div class="command-status-left">
				<span class="status-dot" class:is-active={beanQueryValid}></span>
				<strong>bean-query</strong>
				<span class="required-badge">required</span>
			</div>
			{#if beanQueryValid && beanQueryVersion}
				<span class="version-badge">v{beanQueryVersion}</span>
			{/if}
		</div>

		{#if beanQueryValid && !isEditing}
			<div class="command-status-body">
				<div class="command-display">
					<code>{beanQueryCommand}</code>
					<button class="edit-link" on:click={onStartEditing}>Edit</button>
				</div>
			</div>
		{:else}
			<div class="command-status-body">
				{#if !beanQueryValid && !isEditing}
					<p class="not-found-text">
						Not detected automatically. If it's installed, enter the full command below.
					</p>
				{/if}
				<div class="manual-entry">
					<div class="manual-input-row">
						<input
							type="text"
							bind:value={manualCommand}
							placeholder="bean-query, /usr/local/bin/bean-query, wsl bean-query…"
							on:keydown={(e) => { if (e.key === 'Enter') onVerifyManualCommand(); }}
						/>
						<button class="mod-cta verify-btn" on:click={onVerifyManualCommand} disabled={isVerifying || !manualCommand.trim()}>
							{isVerifying ? '⏳ Verifying…' : 'Verify'}
						</button>
						{#if isEditing}
							<button class="cancel-edit-btn" on:click={onCancelEditing}>Cancel</button>
						{/if}
					</div>
					{#if verifyResult !== 'idle'}
						<div class="verify-feedback" class:is-success={verifyResult === 'success'} class:is-error={verifyResult === 'error'}>
							{verifyMessage}
						</div>
					{/if}
					<p class="command-hint">
						💡 This is the exact command Obsidian will execute. Common values:
						<code>bean-query</code>, <code>wsl bean-query</code>,
						<code>/home/user/.local/bin/bean-query</code>
					</p>
				</div>
			</div>
		{/if}
	</div>

	{#if beanQueryValid && beanQueryIsV2}
		<div class="v2-warning" role="alert">
			<strong>⚠ Beancount 2 detected — Beancount 3 is required</strong>
			<p>
				This plugin needs Beancount 3 and the separate <code>beanquery</code> package.
				With Beancount 2, queries fail with confusing errors. Upgrade by running:
			</p>
			<code class="v2-upgrade-cmd">{BEANCOUNT_UPGRADE_COMMAND}</code>
			<p>
				Then click <strong>Re-detect</strong>.
				<a href={BEANCOUNT_UPGRADE_DOCS_URL} target="_blank" rel="noopener">How to upgrade</a>
			</p>
		</div>
	{/if}

	<!-- ── bean-price ── -->
	<div class="optional-dep">
		<div class="optional-dep-header">
			<span class="status-dot" class:is-active={beanPriceValid}></span>
			<strong>bean-price</strong>
			<span class="optional-badge">optional</span>
		</div>
		<div class="optional-dep-body">
			{#if beanPriceValid}
				<code>{beanPriceCommand}</code>
				{#if beanPriceVersion}<span class="version-text">v{beanPriceVersion}</span>{/if}
				— automatic commodity price fetching available.
			{:else}
				Not detected. Install with <code>pip install beanprice</code> to enable automatic price fetching. You can set this up later in Settings.
			{/if}
		</div>
	</div>

	<!-- ── Installation help ── -->
	{#if !beanQueryValid}
		<InstallationHelp bind:activeInstallTab />
	{/if}
{/if}

<!-- Action buttons -->
<div class="action-row">
	<button class="skip-link" on:click={onSkip}>Skip for now</button>
	<div class="action-buttons">
		<button
			class="re-detect-btn"
			class:mod-cta={!beanQueryValid}
			on:click={onDetect}
			disabled={isDetecting}
		>
			{isDetecting ? '⏳ Detecting…' : 'Re-detect'}
		</button>
		<button
			class="mod-cta next-btn"
			on:click={onNext}
		>
			Next: Organize →
		</button>
	</div>
</div>

<style>
	.v2-warning {
		border: 1px solid var(--text-warning);
		border-radius: var(--radius-m);
		background: rgba(var(--color-orange-rgb), 0.1);
		padding: var(--size-4-3);
		margin: 0 0 var(--size-4-4) 0;
		font-size: var(--font-ui-small);
	}

	.v2-warning strong:first-child {
		color: var(--text-warning);
	}

	.v2-warning p {
		margin: var(--size-4-2) 0;
	}

	.v2-upgrade-cmd {
		display: block;
		user-select: all;
		padding: var(--size-4-2);
	}

	.step-description {
		color: var(--text-muted);
		font-size: var(--font-ui-small);
		margin: 0 0 var(--size-4-4) 0;
		line-height: var(--line-height-normal);
	}

	.detect-loading {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--size-4-3);
		padding: var(--size-4-6) 0;
		color: var(--text-muted);
		font-size: var(--font-ui-small);
	}

	.spinner {
		width: 20px;
		height: 20px;
		border: 2px solid var(--background-modifier-border);
		border-top-color: var(--interactive-accent);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.command-status-card {
		background: var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		padding: var(--size-4-3) var(--size-4-4);
		margin-bottom: var(--size-4-4);
		transition: border-color 0.2s;
	}

	.command-status-card.is-valid {
		border-left: 4px solid var(--text-success);
	}

	.command-status-card.is-invalid {
		border-left: 4px solid var(--background-modifier-border-hover);
	}

	.command-status-card.is-error {
		border-left: 4px solid var(--text-error);
	}

	.command-status-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--size-4-2);
	}

	.command-status-left {
		display: flex;
		align-items: center;
		gap: var(--size-4-2);
	}

	.status-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--text-muted);
		display: inline-block;
	}

	.status-dot.is-active {
		background: var(--text-success);
	}

	.required-badge {
		font-size: 9px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		padding: 2px 6px;
		border-radius: 4px;
		background: var(--background-modifier-border);
		color: var(--text-muted);
	}

	.version-badge {
		font-size: var(--font-ui-smaller);
		font-weight: 600;
		color: var(--text-success);
		background: rgba(0, 180, 0, 0.1);
		padding: 2px 8px;
		border-radius: var(--radius-s);
	}

	.command-status-body {
		font-size: var(--font-ui-small);
	}

	.command-display {
		display: flex;
		align-items: center;
		gap: var(--size-4-3);
	}

	.command-display code {
		background: var(--background-primary);
		padding: 4px 10px;
		border-radius: var(--radius-s);
		font-size: 12px;
		flex: 1;
	}

	.edit-link {
		background: transparent;
		border: none;
		box-shadow: none;
		padding: 0;
		font-family: inherit;
		color: var(--text-accent);
		cursor: pointer;
		font-size: var(--font-ui-smaller);
		text-decoration: underline;
	}

	.edit-link:hover {
		color: var(--text-accent-hover);
	}

	.not-found-text {
		color: var(--text-muted);
		margin: 0 0 var(--size-4-2) 0;
		font-size: var(--font-ui-smaller);
	}

	.manual-entry {
		margin-top: var(--size-4-2);
	}

	.manual-input-row {
		display: flex;
		gap: var(--size-4-2);
		align-items: center;
	}

	.manual-input-row input {
		flex: 1;
		height: 32px;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		padding: 0 12px;
		color: var(--text-normal);
		font-size: 13px;
	}

	.manual-input-row input:focus {
		border-color: var(--interactive-accent);
		outline: none;
	}

	.verify-btn {
		height: 32px;
		white-space: nowrap;
		font-size: 13px;
		padding: 0 16px;
		border-radius: var(--radius-s);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.cancel-edit-btn {
		height: 32px;
		font-size: 13px;
		padding: 0 12px;
		border-radius: var(--radius-s);
		white-space: nowrap;
	}

	.verify-feedback {
		margin-top: var(--size-4-2);
		padding: 6px 10px;
		border-radius: var(--radius-s);
		font-size: var(--font-ui-smaller);
	}

	.verify-feedback.is-success {
		background: rgba(0, 180, 0, 0.1);
		color: var(--text-success);
	}

	.verify-feedback.is-error {
		background: rgba(220, 50, 50, 0.1);
		color: var(--text-error);
	}

	.command-hint {
		margin: var(--size-4-2) 0 0 0;
		font-size: 11px;
		color: var(--text-faint);
		line-height: 1.5;
	}

	.command-hint code {
		background: var(--background-primary);
		padding: 1px 4px;
		border-radius: 3px;
		font-size: 10px;
	}

	.optional-dep {
		background: var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		border-left: 4px solid var(--background-modifier-border-hover);
		border-radius: var(--radius-m);
		padding: var(--size-4-2) var(--size-4-3);
		margin-bottom: var(--size-4-4);
		font-size: var(--font-ui-small);
	}

	.optional-dep-header {
		display: flex;
		align-items: center;
		gap: var(--size-4-2);
		margin-bottom: 4px;
	}

	.optional-badge {
		font-size: 9px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		padding: 2px 6px;
		border-radius: 4px;
		background: var(--background-modifier-border);
		color: var(--text-muted);
	}

	.optional-dep-body {
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
		padding-left: 18px;
	}

	.optional-dep-body code {
		background: var(--background-primary);
		padding: 1px 4px;
		border-radius: 3px;
		font-size: 10px;
	}

	.version-text {
		color: var(--text-success);
		font-weight: 600;
		font-size: var(--font-ui-smaller);
	}

	.action-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: var(--size-4-4);
		padding-top: var(--size-4-3);
		border-top: 1px solid var(--background-modifier-border);
	}

	.action-buttons {
		display: flex;
		gap: var(--size-4-2);
	}

	.re-detect-btn, .next-btn {
		height: 32px;
		font-size: 13px;
		padding: 0 16px;
		border-radius: var(--radius-s);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.re-detect-btn:not(.mod-cta) {
		background: var(--interactive-normal);
		border: 1px solid var(--background-modifier-border);
		color: var(--text-normal);
	}

	.re-detect-btn:not(.mod-cta):hover:not(:disabled) {
		background: var(--interactive-hover);
	}

	.skip-link {
		background: transparent;
		border: none;
		box-shadow: none;
		padding: 0;
		font-family: inherit;
		color: var(--text-muted);
		font-size: var(--font-ui-smaller);
		cursor: pointer;
		text-decoration: underline;
		transition: color 0.15s;
	}

	.skip-link:hover {
		color: var(--text-normal);
	}
</style>
