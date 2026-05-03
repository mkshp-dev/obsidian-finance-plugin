<!-- src/ui/partials/dashboard/EquivalentsRow.svelte -->
<script lang="ts">
	import { formatCurrency } from '../../../utils/currency-precision';

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

	// Delegated to the currency-precision helper so each equivalent
	// gets the natural decimal places for its currency (USD enforces
	// 2 trailing zeros, UYU/JPY drop them, BTC adapts up to 8).
	function format(value: number, currency: string): string {
		return formatCurrency(value, currency);
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
			<span class="equivalent">≈ {format(value, currency)} {currency}</span>
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
