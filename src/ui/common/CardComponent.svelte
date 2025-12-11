<script lang="ts">
	// Props for the card content
	export let label: string;
	export let value: string;
	export let comparison: string | null = null; // Optional comparison text (e.g., "+5% vs last month")
	export let icon: string | null = null; // Optional icon name (Lucide icon)
</script>

<div class="kpi-card">
	{#if icon}
		<div class="kpi-icon">{icon}</div>
	{/if}
	<div class="kpi-label">{label}</div>
	<div class="kpi-value">{value}</div>
	<div class="kpi-comparison">{comparison || '&nbsp;'}</div> </div>

<style>
	/* Styles copied and adapted from OverviewView.svelte */
	.kpi-card {
		padding: var(--size-4-4);
		background-color: var(--background-secondary);
		border-radius: var(--radius-m);
		border: 1px solid var(--background-modifier-border);
		box-shadow: var(--shadow-s);
		/* Could add icon positioning styles here if needed */
	}
	.kpi-label {
		font-size: var(--font-ui-small);
		color: var(--text-muted);
		margin-bottom: var(--size-4-2);
		display: block;
	}
	.kpi-value {
		font-size: 1.8em;
		font-weight: 600;
		color: var(--text-normal);
		display: block;
		margin-bottom: var(--size-4-1);
	}
	.kpi-comparison {
		font-size: var(--font-ui-small);
		color: var(--text-faint);
		min-height: 1.2em; /* Reserve space */
	}
	.kpi-icon { /* Basic icon style */
		float: right; /* Position icon to the right */
		font-size: 1.5em; /* Example size */
		color: var(--text-muted);
		opacity: 0.5;
	}
</style>