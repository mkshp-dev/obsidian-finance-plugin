<script lang="ts">
	import { createEventDispatcher, afterUpdate, onMount, onDestroy } from 'svelte';

	export let tabs: { value: string; label: string; count?: number; tone?: 'error' | 'warning' }[] = [];
	export let value: string = '';
	export let ariaLabel: string = 'Tabs';
	// true (default): tabs stretch to fill the container, equal width (e.g. a full-width sidebar strip).
	// false: the bar hugs its own content and each tab sizes to its label — pass this
	// when the tab bar should sit off to one side instead of spanning its container.
	export let fullWidth: boolean = true;

	const dispatch = createEventDispatcher<{ change: string }>();

	let containerEl: HTMLDivElement;
	let buttonEls: (HTMLButtonElement | null)[] = [];
	let indicatorLeft = 0;
	let indicatorWidth = 0;
	let resizeObserver: ResizeObserver | null = null;

	$: activeIndex = Math.max(0, tabs.findIndex((t) => t.value === value));

	// Measures the active button's actual box rather than assuming equal widths,
	// so this works whether tabs are stretched (fullWidth) or sized to their label.
	function measure() {
		const btn = buttonEls[activeIndex];
		if (!btn) return;
		const left = btn.offsetLeft;
		const width = btn.offsetWidth;
		// Guard against no-op writes — Svelte reassigns unconditionally, and afterUpdate
		// re-runs measure() on every update, so an unguarded write here loops forever.
		if (left !== indicatorLeft) indicatorLeft = left;
		if (width !== indicatorWidth) indicatorWidth = width;
	}

	afterUpdate(measure);

	onMount(() => {
		measure();
		resizeObserver = new ResizeObserver(() => measure());
		if (containerEl) resizeObserver.observe(containerEl);
	});

	onDestroy(() => {
		resizeObserver?.disconnect();
	});

	function select(tabValue: string) {
		if (tabValue === value) return;
		value = tabValue;
		dispatch('change', tabValue);
	}

	function handleKeydown(event: KeyboardEvent, index: number) {
		if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft' && event.key !== 'Home' && event.key !== 'End') return;
		event.preventDefault();
		let nextIndex = index;
		if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
		else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
		else if (event.key === 'Home') nextIndex = 0;
		else if (event.key === 'End') nextIndex = tabs.length - 1;
		select(tabs[nextIndex].value);
		buttonEls[nextIndex]?.focus();
	}
</script>

<div
	class="tab-bar"
	class:compact={!fullWidth}
	role="tablist"
	aria-label={ariaLabel}
	bind:this={containerEl}
>
	<div class="tab-bar-indicator" style="left: {indicatorLeft}px; width: {indicatorWidth}px;"></div>
	{#each tabs as tab, index (tab.value)}
		<button
			type="button"
			class="tab-bar-item"
			class:active={tab.value === value}
			role="tab"
			aria-selected={tab.value === value}
			tabindex={tab.value === value ? 0 : -1}
			bind:this={buttonEls[index]}
			on:click={() => select(tab.value)}
			on:keydown={(e) => handleKeydown(e, index)}
		>
			<span class="tab-bar-label">{tab.label}</span>
			{#if tab.count !== undefined}
				<span
					class="tab-bar-count"
					class:active={tab.value === value}
					class:tone-error={tab.tone === 'error'}
					class:tone-warning={tab.tone === 'warning'}
				>{tab.count}</span>
			{/if}
		</button>
	{/each}
</div>

<style>
	.tab-bar {
		position: relative;
		display: flex;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m, 8px);
		padding: 3px;
		gap: 2px;
	}

	.tab-bar.compact {
		display: inline-flex;
		align-self: flex-end;
	}

	.tab-bar-indicator {
		position: absolute;
		top: 3px;
		bottom: 3px;
		border-radius: calc(var(--radius-m, 8px) - 3px);
		background: var(--interactive-accent);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
		transition: left 0.22s cubic-bezier(0.4, 0, 0.2, 1), width 0.22s cubic-bezier(0.4, 0, 0.2, 1);
		z-index: 0;
	}

	.tab-bar-item {
		position: relative;
		z-index: 1;
		flex: 1 1 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 6px 12px;
		border: none;
		background: transparent;
		border-radius: calc(var(--radius-m, 8px) - 3px);
		color: var(--text-muted);
		font-size: var(--font-ui-small, 13px);
		font-weight: 500;
		cursor: pointer;
		white-space: nowrap;
		transition: color 0.15s ease;
	}

	.tab-bar.compact .tab-bar-item {
		flex: 0 0 auto;
	}

	.tab-bar-item:hover:not(.active) {
		color: var(--text-normal);
	}

	.tab-bar-item:focus-visible {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
	}

	.tab-bar-item.active {
		color: var(--text-on-accent);
		font-weight: 600;
	}

	.tab-bar-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 16px;
		height: 16px;
		padding: 0 5px;
		border-radius: 8px;
		font-size: 10px;
		font-weight: 600;
		background: var(--background-modifier-border);
		color: var(--text-muted);
		transition: background-color 0.15s ease, color 0.15s ease;
	}

	.tab-bar-count.active {
		background: rgba(255, 255, 255, 0.22);
		color: var(--text-on-accent);
	}

	.tab-bar-count.tone-error {
		background: var(--color-red, #e05252);
		color: white;
	}

	.tab-bar-count.tone-warning {
		background: var(--color-orange, #e8a027);
		color: white;
	}

	@media (prefers-reduced-motion: reduce) {
		.tab-bar-indicator {
			transition: none;
		}
	}
</style>
