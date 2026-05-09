<!-- src/ui/partials/dashboard/EquivalentsRow.svelte -->
<script lang="ts">
	export let equivalents: Record<string, number> = {};
	/**
	 * Visual variant. `kpi` matches the Overview KPI card type scale (slightly
	 * larger), `compact` is used inside dense rows like income/expense totals
	 * and commodity cards.
	 */
	export let variant: 'kpi' | 'compact' = 'compact';
	/** Optional alignment override; defaults to inheriting block alignment. */
	export let align: 'start' | 'end' | 'inherit' = 'inherit';

	$: entries = Object.entries(equivalents ?? {})
		.filter(([, value]) => typeof value === 'number' && isFinite(value));

	// Pick decimal precision by magnitude so a 1,000 USD figure shows as
	// "≈ 1,000" but a 0.012 BTC figure keeps enough significant digits.
	function format(value: number): string {
		const abs = Math.abs(value);
		let max: number;
		if (abs >= 1000) max = 0;
		else if (abs >= 1) max = 2;
		else if (abs >= 0.01) max = 4;
		else if (abs >= 0.0001) max = 6;
		else max = 8;
		return value.toLocaleString(undefined, {
			minimumFractionDigits: 0,
			maximumFractionDigits: max,
		});
	}
</script>

{#if entries.length > 0}
	<div
		class="equivalents-row"
		class:variant-kpi={variant === 'kpi'}
		class:variant-compact={variant === 'compact'}
		class:align-end={align === 'end'}
		class:align-start={align === 'start'}
	>
		{#each entries as [currency, value], i}
			<span class="equivalent">≈ {format(value)} {currency}</span>
			{#if i < entries.length - 1}
				<span class="separator" aria-hidden="true">·</span>
			{/if}
		{/each}
	</div>
{/if}

<style>
	.equivalents-row {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: baseline;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.02em;
	}
	.equivalents-row.align-end { justify-content: flex-end; }
	.equivalents-row.align-start { justify-content: flex-start; }

	.variant-kpi { font-size: var(--font-ui-small); margin-top: 2px; }
	.variant-compact { font-size: 11px; margin-top: 2px; }

	.equivalent { white-space: nowrap; }

	.separator {
		color: var(--text-faint);
		opacity: 0.7;
	}
</style>
