<script lang="ts">
	/** How many transaction rows a field gave a value for, shown next to its label. */
	export let count: { filled: number; total: number; looked: number; matched: number } | null = null;
</script>

{#if count}
	<span
		class="field-count"
		class:is-full={count.filled === count.total}
		class:is-none={count.filled === 0}
		title={`This field gave a value for ${count.filled} of the ${count.total} transaction rows`
			+ (count.looked > 0 ? `. ${count.matched} of ${count.looked} matched an alias` : '')}
	>{count.filled}/{count.total}</span>
{/if}

<style>
	.field-count {
		margin-left: var(--size-4-1);
		padding: 0 6px;
		border-radius: var(--radius-s);
		font-size: var(--font-ui-smaller);
		font-weight: normal;
		font-variant-numeric: tabular-nums;
		background: var(--background-modifier-hover);
		color: var(--text-muted);
	}

	.field-count.is-full {
		color: var(--text-success);
	}

	.field-count.is-none {
		color: var(--color-orange);
	}
</style>
