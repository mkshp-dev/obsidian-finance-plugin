<script lang="ts">
	/** Numbered progress steps for multi-step modals. Steps before `current` can be clicked to go back. */
	export let steps: { value: string; label: string }[] = [];
	export let current: string = '';
	export let onSelect: (value: string) => void = () => {};

	$: currentIndex = steps.findIndex((s) => s.value === current);
</script>

<div class="step-bar">
	{#each steps as step, i (step.value)}
		{#if i > 0}
			<div class="step-line" class:is-done={i <= currentIndex}></div>
		{/if}
		<button
			type="button"
			class="step-node"
			class:is-active={i === currentIndex}
			class:is-done={i < currentIndex}
			disabled={i >= currentIndex}
			on:click={() => onSelect(step.value)}
		>
			<span class="step-circle">{i < currentIndex ? '✓' : i + 1}</span>
			<span class="step-label">{step.label}</span>
		</button>
	{/each}
</div>

<style>
	.step-bar {
		display: flex;
		align-items: flex-start;
		justify-content: center;
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
		height: auto;
		color: var(--text-muted);
		cursor: pointer;
		min-width: 70px;
	}

	.step-node:disabled {
		cursor: default;
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
	}

	.step-node.is-active .step-circle {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		border-color: var(--interactive-accent);
	}

	.step-node.is-active .step-label {
		color: var(--text-normal);
		font-weight: 600;
	}

	.step-node.is-done .step-circle {
		color: var(--text-success);
		border-color: var(--text-success);
	}

	.step-label {
		font-size: 11px;
	}

	.step-line {
		width: 50px;
		height: 2px;
		background: var(--background-modifier-border);
		margin-top: 13px;
	}

	.step-line.is-done {
		background: var(--text-success);
	}
</style>
