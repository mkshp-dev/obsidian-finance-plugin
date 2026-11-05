<!-- src/ui/modals/OnboardingModal.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { App, Notice, TFile, Platform } from 'obsidian';
	import type BeancountPlugin from '../../main';
	import { getDemoLedgerContent } from '../../services/demo-ledger';
	import { Logger } from '../../utils/logger';
	import { migrateToStructuredLayout } from '../../utils/structuredLayout';
	import { SystemDetector } from '../../utils/SystemDetector';
	import { checkBeancountVersion } from '../../utils/beancountVersion';
	import { UNIFIED_DASHBOARD_VIEW_TYPE } from '../views/dashboard/unified-dashboard-view';

	import StepConnect from './onboarding/StepConnect.svelte';
	import StepOrganize from './onboarding/StepOrganize.svelte';
	import StepReady from './onboarding/StepReady.svelte';

	// Props passed from Modal wrapper
	export let app: App;
	export let plugin: BeancountPlugin;
	export let modal: any;

	// ── Step state ──
	let currentStep: 'connect' | 'organize' | 'ready' = 'connect';

	// ── Step 1: Connect state ──
	let isDetecting = true;
	let beanQueryValid = false;
	let beanQueryCommand: string | null = null;
	let beanQueryVersion: string | null = null;
	/** True when the detected bean-query comes from Beancount 2 (Issue #289). */
	let beanQueryIsV2 = false;
	let beanPriceValid = false;
	let beanPriceCommand: string | null = null;
	let beanPriceVersion: string | null = null;

	// Manual command entry
	let manualCommand = '';
	let isVerifying = false;
	let verifyResult: 'idle' | 'success' | 'error' = 'idle';
	let verifyMessage = '';
	let isEditing = false;

	// Platform
	let platformDisplay = 'Unknown';
	let activeInstallTab: 'windows' | 'macos' | 'linux-native' | 'linux-sandbox' = 'windows';

	// ── Step 2: Organize state ──
	let dataChoice: 'demo' | 'existing' | null = 'demo';
	let existingFilePath = '';
	let structuredFolderName = 'Finances';
	let fileOrganization: 'yearly' | 'monthly' = 'yearly';
	let operatingCurrency = plugin.settings.operatingCurrency || 'USD';
	let beancountFiles: string[] = [];
	let isSubmitting = false;

	// ── Folder name validation ──
	const INVALID_FOLDER_CHARS = /[/\\:*?"<>|]/;
	$: folderNameError = !structuredFolderName.trim()
		? 'Folder name cannot be empty'
		: INVALID_FOLDER_CHARS.test(structuredFolderName)
			? 'Folder name contains invalid characters ( / \\ : * ? " < > | )'
			: '';
	$: isFolderNameValid = !folderNameError;

	onMount(async () => {
		// Detect platform for install tab defaults
		const detector = SystemDetector.getInstance();
		try {
			const systemInfo = await detector.getSystemInfo();
			platformDisplay = systemInfo.platformDisplay || 'Unknown';
			if (systemInfo.platform === 'win32') activeInstallTab = 'windows';
			else if (systemInfo.platform === 'darwin') activeInstallTab = 'macos';
			else activeInstallTab = 'linux-native';
		} catch {
			platformDisplay = process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux';
		}

		// List .beancount files for Step 2
		const allFiles = app.vault.getFiles();
		beancountFiles = allFiles
			.filter(file => file.extension === 'beancount')
			.map(file => file.path);
		if (beancountFiles.length > 0) {
			existingFilePath = beancountFiles[0];
		}

		// Auto-detect bean-query
		await detectBeanQuery();
	});

	// ── Detection ──
	async function detectBeanQuery() {
		if (!Platform.isDesktop) {
			Logger.warn('[Onboarding] CLI detection skipped: Not running on desktop platform.');
			isDetecting = false;
			return;
		}
		isDetecting = true;
		try {
			const detector = SystemDetector.getInstance();

			Logger.log('[Onboarding] Detecting bean-query...');
			let bqResult = await detector.detectBeanQueryCommand(false);

			if (!bqResult.isValid && plugin.settings.beancountCommand) {
				Logger.log(`[Onboarding] Trying saved command: ${plugin.settings.beancountCommand}`);
				const testResult = await detector.testCommand(plugin.settings.beancountCommand, ['--version']);
				if (testResult.success) {
					const versionMatch = (testResult.output || '').match(/(\d+\.\d+\.\d+)/);
					bqResult = {
						command: plugin.settings.beancountCommand,
						version: versionMatch ? versionMatch[1] : 'unknown',
						isValid: true,
						isBeancountV2: checkBeancountVersion(
							plugin.settings.beancountCommand,
							`${testResult.output ?? ''}\n${testResult.error ?? ''}`
						).isBeancountV2,
						errors: []
					};
				}
			}

			beanQueryValid = bqResult.isValid;
			beanQueryCommand = bqResult.command;
			beanQueryVersion = bqResult.version;
			beanQueryIsV2 = bqResult.isValid && bqResult.isBeancountV2;

			if (beanQueryValid && beanQueryCommand) {
				plugin.settings.beancountCommand = beanQueryCommand;
				manualCommand = beanQueryCommand;
			}

			Logger.log('[Onboarding] Detecting bean-price...');
			const bpResult = await detector.detectBeanPriceCommand(false);
			beanPriceValid = bpResult.isValid;
			beanPriceCommand = bpResult.command;
			beanPriceVersion = bpResult.version;

			if (beanPriceValid && beanPriceCommand) {
				plugin.settings.beanPriceCommand = beanPriceCommand;
			}

			await plugin.saveSettings();
			Logger.log('[Onboarding] Detection complete', { beanQueryValid, beanPriceValid });
		} catch (error) {
			Logger.error('[Onboarding] Detection failed', error);
		} finally {
			isDetecting = false;
		}
	}

	async function verifyManualCommand() {
		const cmd = manualCommand.trim();
		if (!cmd) {
			verifyResult = 'error';
			verifyMessage = 'Please enter a command.';
			return;
		}

		isVerifying = true;
		verifyResult = 'idle';
		verifyMessage = '';

		try {
			const detector = SystemDetector.getInstance();

			let result = await detector.testCommand(cmd, ['--version'], 5000);
			if (!result.success) {
				result = await detector.testCommand(cmd, ['--help'], 5000);
			}

			if (result.success) {
				const versionMatch = (result.output || '').match(/(\d+\.\d+\.\d+)/);
				beanQueryValid = true;
				beanQueryCommand = cmd;
				beanQueryVersion = versionMatch ? versionMatch[1] : 'unknown';
				beanQueryIsV2 = checkBeancountVersion(cmd, `${result.output ?? ''}\n${result.error ?? ''}`).isBeancountV2;
				verifyResult = 'success';
				verifyMessage = `Verified! ${beanQueryVersion !== 'unknown' ? `v${beanQueryVersion}` : ''}`;

				plugin.settings.beancountCommand = cmd;
				await plugin.saveSettings();

				isEditing = false;
			} else {
				verifyResult = 'error';
				verifyMessage = `Command failed: ${result.error || 'Not found or not executable'}`;
			}
		} catch (error: any) {
			verifyResult = 'error';
			verifyMessage = `Error: ${error?.message || 'Unknown error'}`;
		} finally {
			isVerifying = false;
		}
	}

	function startEditing() {
		isEditing = true;
		manualCommand = beanQueryCommand || plugin.settings.beancountCommand || '';
		verifyResult = 'idle';
		verifyMessage = '';
	}

	function cancelEditing() {
		isEditing = false;
		verifyResult = 'idle';
		verifyMessage = '';
	}

	function selectDataChoice(choice: 'demo' | 'existing') {
		if (choice === 'existing' && !beanQueryValid) return;
		dataChoice = choice;
		if (choice === 'demo') {
			operatingCurrency = 'USD';
		}
	}

	// ── Step 2: File setup ──
	async function handleFinish() {
		if (isSubmitting) return;

		if (!dataChoice) {
			new Notice('Please select an option');
			return;
		}

		if (dataChoice === 'existing' && !existingFilePath.trim()) {
			new Notice('Please select or enter an existing Beancount file path');
			return;
		}

		isSubmitting = true;

		try {
			if (dataChoice === 'demo') {
				await handleDemoStructured();
			} else {
				await handleExistingStructured();
			}

			plugin.settings.operatingCurrency = operatingCurrency;
			plugin.settings.fileOrganization = fileOrganization;
			plugin.settings.onboardingCompleted = true;
			await plugin.saveSettings();

			plugin.isConnectionReady = beanQueryValid;

			currentStep = 'ready';
			new Notice('🎉 Setup completed successfully!');
		} catch (error: any) {
			Logger.error('[Onboarding] Setup failed', error);
			const msg = error?.message || 'Setup failed. See console for details.';
			new Notice(`Setup failed: ${msg}`, 8000);
		} finally {
			isSubmitting = false;
		}
	}

	async function handleDemoStructured() {
		Logger.log('Onboarding: Demo + Structured Setup');
		const tempFilePath = '_demo_temp.beancount';
		const adapter = app.vault.adapter;

		if (await adapter.exists(tempFilePath)) {
			try {
				await adapter.remove(tempFilePath);
				await new Promise(r => setTimeout(r, 200));
			} catch (e: any) {
				throw new Error(`Could not delete existing temp file: ${e.message}`);
			}
		}

		await adapter.write(tempFilePath, getDemoLedgerContent());
		await new Promise(r => setTimeout(r, 300));

		const tempFile = app.vault.getAbstractFileByPath(tempFilePath) as TFile;
		if (!tempFile) {
			throw new Error('Failed to register temporary demo file in vault');
		}

		// @ts-ignore
		const tempAbsolutePath = adapter.getFullPath(tempFile.path);

		const result = await migrateToStructuredLayout(plugin, structuredFolderName, tempAbsolutePath);
		if (!result.success) {
			throw new Error(`Migration failed: ${result.error}`);
		}

		try {
			await app.vault.delete(tempFile);
		} catch (cleanupErr) {
			Logger.warn('Onboarding: Failed to clean up temp file', cleanupErr);
		}
	}

	async function handleExistingStructured() {
		Logger.log('Onboarding: Existing + Structured Setup');
		let sourcePath = existingFilePath;

		if (!sourcePath.match(/^[a-zA-Z]:[\\\/]/) && !sourcePath.startsWith('/')) {
			const file = app.vault.getAbstractFileByPath(sourcePath);
			if (file && file instanceof TFile) {
				// @ts-ignore
				sourcePath = app.vault.adapter.getFullPath(file.path);
			} else {
				throw new Error(`Could not find file in vault: ${sourcePath}`);
			}
		}

		const result = await migrateToStructuredLayout(plugin, structuredFolderName, sourcePath);
		if (!result.success) {
			throw new Error(`Migration failed: ${result.error}`);
		}
	}

	function skipOnboarding() {
		new Notice('You can set up bean-query anytime in Settings → Connection.');
		modal.close();
	}

	async function finishAndOpenDashboard() {
		// @ts-ignore
		await plugin.activateView(UNIFIED_DASHBOARD_VIEW_TYPE, 'tab');
		modal.close();
	}
</script>

<div class="onboarding-container">
	<!-- Header -->
	<div class="onboarding-header">
		<h2>Welcome to Obsidian Finance</h2>
		<!-- Step progress bar -->
		<div class="step-bar">
			<button
				class="step-node"
				class:is-active={currentStep === 'connect'}
				class:is-done={currentStep === 'organize' || currentStep === 'ready'}
				on:click={() => { if (currentStep !== 'connect') currentStep = 'connect'; }}
			>
				<span class="step-circle">1</span>
				<span class="step-label">Connect</span>
			</button>
			<div class="step-line" class:is-done={currentStep === 'organize' || currentStep === 'ready'}></div>
			<button
				class="step-node"
				class:is-active={currentStep === 'organize'}
				class:is-done={currentStep === 'ready'}
				on:click={() => { if (currentStep !== 'organize') currentStep = 'organize'; }}
			>
				<span class="step-circle">2</span>
				<span class="step-label">Organize</span>
			</button>
			<div class="step-line" class:is-done={currentStep === 'ready'}></div>
			<button
				class="step-node"
				class:is-active={currentStep === 'ready'}
				disabled
			>
				<span class="step-circle">3</span>
				<span class="step-label">Ready</span>
			</button>
		</div>
	</div>

	<!-- Step Content -->
	<div class="onboarding-body">
		{#if currentStep === 'connect'}
			<StepConnect
				{isDetecting}
				{beanQueryValid}
				{beanQueryCommand}
				{beanQueryVersion}
				{beanQueryIsV2}
				{beanPriceValid}
				{beanPriceCommand}
				{beanPriceVersion}
				bind:manualCommand
				{isVerifying}
				{verifyResult}
				{verifyMessage}
				{isEditing}
				bind:activeInstallTab
				onDetect={detectBeanQuery}
				onVerifyManualCommand={verifyManualCommand}
				onStartEditing={startEditing}
				onCancelEditing={cancelEditing}
				onSkip={skipOnboarding}
				onNext={() => currentStep = 'organize'}
			/>
		{:else if currentStep === 'organize'}
			<StepOrganize
				{beanQueryValid}
				{dataChoice}
				{beancountFiles}
				bind:existingFilePath
				bind:structuredFolderName
				bind:fileOrganization
				bind:operatingCurrency
				{folderNameError}
				{isFolderNameValid}
				{isSubmitting}
				onSelectDataChoice={selectDataChoice}
				onBack={() => currentStep = 'connect'}
				onCancel={() => modal.close()}
				onSubmit={handleFinish}
			/>
		{:else if currentStep === 'ready'}
			<StepReady
				{beanQueryCommand}
				{beanQueryVersion}
				{beanPriceValid}
				{beanPriceCommand}
				{structuredFolderName}
				{dataChoice}
				{operatingCurrency}
				{fileOrganization}
				onClose={() => modal.close()}
				onFinishAndOpenDashboard={finishAndOpenDashboard}
			/>
		{/if}
	</div>
</div>

<style>
	.onboarding-container {
		padding: var(--size-4-4);
		max-width: 680px;
		margin: 0 auto;
	}

	.onboarding-header h2 {
		margin: 0 0 var(--size-4-3) 0;
		color: var(--text-normal);
		font-size: var(--font-ui-large);
		text-align: center;
	}

	.step-bar {
		display: flex;
		align-items: flex-start;
		justify-content: center;
		gap: 0;
		margin-bottom: var(--size-4-4);
	}

	.step-node {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		background: transparent !important;
		border: none !important;
		box-shadow: none !important;
		padding: 0 !important;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.2s;
		min-width: 70px;
	}

	.step-node:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.step-circle {
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		border: 1px solid var(--background-modifier-border);
		background: var(--background-secondary-alt);
		font-weight: 600;
		font-size: 13px;
		transition: all 0.2s;
	}

	.step-node.is-active .step-circle {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		border-color: var(--interactive-accent);
		box-shadow: 0 0 0 3px rgba(var(--color-accent-rgb, 0, 122, 255), 0.2);
	}

	.step-node.is-active .step-label {
		color: var(--text-normal);
		font-weight: 600;
	}

	.step-node.is-done .step-circle {
		background: var(--background-modifier-success);
		color: var(--text-on-accent);
		border-color: var(--text-success);
	}

	.step-label {
		font-size: 11px;
		color: inherit;
	}

	.step-line {
		width: 50px;
		height: 2px;
		background: var(--background-modifier-border);
		margin-top: 13px;
		transition: background 0.3s;
	}

	.step-line.is-done {
		background: var(--text-success);
	}

	.onboarding-body {
		min-height: 300px;
	}
</style>
