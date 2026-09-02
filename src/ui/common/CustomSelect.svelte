<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';

	export let options: { value: string; label: string; icon?: string }[] = [];
	export let value: string = '';
	export let variant: 'primary' | 'secondary' = 'secondary';
	export let position: 'left' | 'middle' | 'right' | 'single' = 'single';
	export let disabled: boolean = false;
	export let ariaLabel: string = 'Select option';

	const dispatch = createEventDispatcher<{ change: string }>();

	let isOpen = false;
	let containerRef: HTMLDivElement;

	$: selectedOption = options.find((o) => o.value === value) || options[0] || { value: '', label: '' };

	function toggleOpen(event?: Event) {
		if (disabled) return;
		if (event) {
			event.stopPropagation();
			event.preventDefault();
		}
		isOpen = !isOpen;
	}

	function selectOption(optionValue: string, event?: Event) {
		if (event) {
			event.stopPropagation();
			event.preventDefault();
		}
		value = optionValue;
		isOpen = false;
		dispatch('change', optionValue);
	}

	function handleClickOutside(event: MouseEvent) {
		if (!isOpen) return;
		const target = event.target as Node;
		if (!target || !target.isConnected) return;
		if (containerRef && containerRef.contains(target)) return;
		isOpen = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (disabled) return;
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			toggleOpen(event);
		} else if (event.key === 'Escape') {
			isOpen = false;
		} else if (event.key === 'ArrowDown' && isOpen) {
			event.preventDefault();
			const currentIndex = options.findIndex((o) => o.value === value);
			const nextIndex = (currentIndex + 1) % options.length;
			selectOption(options[nextIndex].value, event);
		} else if (event.key === 'ArrowUp' && isOpen) {
			event.preventDefault();
			const currentIndex = options.findIndex((o) => o.value === value);
			const prevIndex = (currentIndex - 1 + options.length) % options.length;
			selectOption(options[prevIndex].value, event);
		}
	}

	onMount(() => {
		document.addEventListener('click', handleClickOutside);
	});

	onDestroy(() => {
		if (typeof document !== 'undefined') {
			document.removeEventListener('click', handleClickOutside);
		}
	});
</script>

<div
	class="custom-select-wrapper position-{position}"
	class:is-open={isOpen}
	bind:this={containerRef}
>
	<button
		type="button"
		class="custom-select-trigger variant-{variant} position-{position}"
		class:disabled={disabled}
		on:click={toggleOpen}
		on:mousedown={(e) => e.stopPropagation()}
		on:pointerdown={(e) => e.stopPropagation()}
		on:keydown={handleKeydown}
		disabled={disabled}
		aria-label={ariaLabel}
		aria-haspopup="listbox"
		aria-expanded={isOpen}
	>
		{#if selectedOption.icon}
			{#if selectedOption.icon === 'line-chart' || selectedOption.icon === 'trend'}
				<svg class="custom-select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M3 3v18h18"></path>
					<path d="m19 9-5 5-4-4-3 3"></path>
				</svg>
			{:else if selectedOption.icon === 'pie-chart' || selectedOption.icon === 'balances' || selectedOption.icon === 'total'}
				<svg class="custom-select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
					<path d="M22 12A10 10 0 0 0 12 2v10z"></path>
				</svg>
			{:else if selectedOption.icon === 'layers' || selectedOption.icon === 'all'}
				<svg class="custom-select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
					<polyline points="2 17 12 22 22 17"></polyline>
					<polyline points="2 12 12 17 22 12"></polyline>
				</svg>
			{:else if selectedOption.icon === 'wallet' || selectedOption.icon === 'has_holding'}
				<svg class="custom-select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path>
					<path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path>
					<path d="M18 12a2 2 0 0 0 0 4h4v-4z"></path>
				</svg>
			{:else if selectedOption.icon === 'tag' || selectedOption.icon === 'has_price'}
				<svg class="custom-select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M12 2H2v10l11 11 10-10L12 2z"></path>
					<circle cx="7" cy="7" r="2"></circle>
				</svg>
			{:else if selectedOption.icon === 'sparkles' || selectedOption.icon === 'has_both'}
				<svg class="custom-select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z"></path>
					<path d="M5 3v4"></path>
					<path d="M19 17v4"></path>
					<path d="M3 5h4"></path>
					<path d="M17 19h4"></path>
				</svg>
			{:else if selectedOption.icon === 'briefcase' || selectedOption.icon === 'assets'}
				<svg class="custom-select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
					<path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
				</svg>
			{:else if selectedOption.icon === 'credit-card' || selectedOption.icon === 'liabilities'}
				<svg class="custom-select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
					<line x1="1" y1="10" x2="23" y2="10"></line>
				</svg>
			{:else if selectedOption.icon === 'scale' || selectedOption.icon === 'equity'}
				<svg class="custom-select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"></path>
					<path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"></path>
					<path d="M7 21h10"></path>
					<path d="M12 3v18"></path>
					<path d="M3 7h18"></path>
				</svg>
			{:else if selectedOption.icon === 'calendar' || selectedOption.icon === 'month'}
				<svg class="custom-select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
					<line x1="16" y1="2" x2="16" y2="6"></line>
					<line x1="8" y1="2" x2="8" y2="6"></line>
					<line x1="3" y1="10" x2="21" y2="10"></line>
				</svg>
			{:else if selectedOption.icon === 'clock' || selectedOption.icon === 'week'}
				<svg class="custom-select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="10"></circle>
					<polyline points="12 6 12 12 16 14"></polyline>
				</svg>
			{:else if selectedOption.icon === 'plus-circle' || selectedOption.icon === 'income'}
				<svg class="custom-select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="10"></circle>
					<line x1="12" y1="8" x2="12" y2="16"></line>
					<line x1="8" y1="12" x2="16" y2="12"></line>
				</svg>
			{:else if selectedOption.icon === 'minus-circle' || selectedOption.icon === 'expense' || selectedOption.icon === 'expenses'}
				<svg class="custom-select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="10"></circle>
					<line x1="8" y1="12" x2="16" y2="12"></line>
				</svg>
			{:else if selectedOption.icon === 'dollar-sign' || selectedOption.icon === 'netprofit' || selectedOption.icon === 'activity'}
				<svg class="custom-select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="12" y1="1" x2="12" y2="23"></line>
					<path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
				</svg>
			{:else if selectedOption.icon === 'today'}
				<svg class="custom-select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
					<line x1="16" y1="2" x2="16" y2="6"></line>
					<line x1="8" y1="2" x2="8" y2="6"></line>
					<line x1="3" y1="10" x2="21" y2="10"></line>
					<circle cx="12" cy="16" r="2" fill="currentColor" stroke="none"></circle>
				</svg>
			{:else if selectedOption.icon === 'table'}
				<svg class="custom-select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
					<line x1="3" y1="9" x2="21" y2="9"></line>
					<line x1="3" y1="15" x2="21" y2="15"></line>
					<line x1="9" y1="3" x2="9" y2="21"></line>
					<line x1="15" y1="3" x2="15" y2="21"></line>
				</svg>
			{/if}
		{/if}

		<span class="custom-select-label">{selectedOption.label}</span>

		<svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<polyline points="6 9 12 15 18 9"></polyline>
		</svg>
	</button>

	{#if isOpen}
		<ul class="custom-select-menu" role="listbox" tabIndex={-1}>
			{#each options as opt}
				<li
					class="custom-select-item"
					class:is-selected={opt.value === value}
					role="option"
					aria-selected={opt.value === value}
					on:mousedown={(e) => selectOption(opt.value, e)}
					on:click={(e) => selectOption(opt.value, e)}
					on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && selectOption(opt.value, e)}
				>
					{#if opt.icon}
						{#if opt.icon === 'line-chart' || opt.icon === 'trend'}
							<svg class="custom-select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M3 3v18h18"></path>
								<path d="m19 9-5 5-4-4-3 3"></path>
							</svg>
						{:else if opt.icon === 'pie-chart' || opt.icon === 'balances' || opt.icon === 'total'}
							<svg class="custom-select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
								<path d="M22 12A10 10 0 0 0 12 2v10z"></path>
							</svg>
						{:else if opt.icon === 'layers' || opt.icon === 'all'}
							<svg class="custom-select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
								<polyline points="2 17 12 22 22 17"></polyline>
								<polyline points="2 12 12 17 22 12"></polyline>
							</svg>
						{:else if opt.icon === 'wallet' || opt.icon === 'has_holding'}
							<svg class="custom-select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path>
								<path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path>
								<path d="M18 12a2 2 0 0 0 0 4h4v-4z"></path>
							</svg>
						{:else if opt.icon === 'tag' || opt.icon === 'has_price'}
							<svg class="custom-select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M12 2H2v10l11 11 10-10L12 2z"></path>
								<circle cx="7" cy="7" r="2"></circle>
							</svg>
						{:else if opt.icon === 'sparkles' || opt.icon === 'has_both'}
							<svg class="custom-select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z"></path>
								<path d="M5 3v4"></path>
								<path d="M19 17v4"></path>
								<path d="M3 5h4"></path>
								<path d="M17 19h4"></path>
							</svg>
						{:else if opt.icon === 'briefcase' || opt.icon === 'assets'}
							<svg class="custom-select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
								<path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
							</svg>
						{:else if opt.icon === 'credit-card' || opt.icon === 'liabilities'}
							<svg class="custom-select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
								<line x1="1" y1="10" x2="23" y2="10"></line>
							</svg>
						{:else if opt.icon === 'scale' || opt.icon === 'equity'}
							<svg class="custom-select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"></path>
								<path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"></path>
								<path d="M7 21h10"></path>
								<path d="M12 3v18"></path>
								<path d="M3 7h18"></path>
							</svg>
						{:else if opt.icon === 'calendar' || opt.icon === 'month'}
							<svg class="custom-select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
								<line x1="16" y1="2" x2="16" y2="6"></line>
								<line x1="8" y1="2" x2="8" y2="6"></line>
								<line x1="3" y1="10" x2="21" y2="10"></line>
							</svg>
						{:else if opt.icon === 'clock' || opt.icon === 'week'}
							<svg class="custom-select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<circle cx="12" cy="12" r="10"></circle>
								<polyline points="12 6 12 12 16 14"></polyline>
							</svg>
						{:else if opt.icon === 'plus-circle' || opt.icon === 'income'}
							<svg class="custom-select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<circle cx="12" cy="12" r="10"></circle>
								<line x1="12" y1="8" x2="12" y2="16"></line>
								<line x1="8" y1="12" x2="16" y2="12"></line>
							</svg>
						{:else if opt.icon === 'minus-circle' || opt.icon === 'expense' || opt.icon === 'expenses'}
							<svg class="custom-select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<circle cx="12" cy="12" r="10"></circle>
								<line x1="8" y1="12" x2="16" y2="12"></line>
							</svg>
						{:else if opt.icon === 'dollar-sign' || opt.icon === 'netprofit' || opt.icon === 'activity'}
							<svg class="custom-select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<line x1="12" y1="1" x2="12" y2="23"></line>
								<path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
							</svg>
						{:else if opt.icon === 'today'}
							<svg class="custom-select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
								<line x1="16" y1="2" x2="16" y2="6"></line>
								<line x1="8" y1="2" x2="8" y2="6"></line>
								<line x1="3" y1="10" x2="21" y2="10"></line>
								<circle cx="12" cy="16" r="2" fill="currentColor" stroke="none"></circle>
							</svg>
						{:else if opt.icon === 'table'}
							<svg class="custom-select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
								<line x1="3" y1="9" x2="21" y2="9"></line>
								<line x1="3" y1="15" x2="21" y2="15"></line>
								<line x1="9" y1="3" x2="9" y2="21"></line>
								<line x1="15" y1="3" x2="15" y2="21"></line>
							</svg>
						{/if}
					{/if}

					<span>{opt.label}</span>

					{#if opt.value === value}
						<svg class="checkmark-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="20 6 9 17 4 12"></polyline>
						</svg>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.custom-select-wrapper {
		position: relative;
		display: inline-block;
		z-index: 15;
	}

	.custom-select-wrapper.is-open {
		z-index: 9999;
	}

	.custom-select-trigger {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 14px;
		font-size: var(--font-ui-small, 13px);
		font-weight: 500;
		cursor: pointer;
		border: 1px solid var(--background-modifier-border, #d1d5db);
		transition: all 0.15s ease-in-out;
		user-select: none;
		white-space: nowrap;
		height: 34px;
		line-height: 1;
	}

	/* Position variants for segmented pill grouping */
	.position-single {
		border-radius: var(--radius-m, 6px);
	}

	.position-left {
		border-radius: var(--radius-m, 6px) 0 0 var(--radius-m, 6px);
		border-right: none;
	}

	.position-middle {
		border-radius: 0;
		border-right: none;
	}

	.position-right {
		border-radius: 0 var(--radius-m, 6px) var(--radius-m, 6px) 0;
	}

	/* Color Variants */
	.variant-primary {
		background-color: var(--interactive-accent, #8b5cf6);
		color: #ffffff;
		border-color: var(--interactive-accent, #8b5cf6);
		box-shadow: 0 1px 3px rgba(139, 92, 246, 0.3);
	}

	.variant-primary:hover:not(.disabled) {
		background-color: var(--interactive-accent-hover, #7c3aed);
		border-color: var(--interactive-accent-hover, #7c3aed);
	}

	.variant-secondary {
		background-color: var(--background-primary, #ffffff);
		color: var(--text-normal, #111827);
	}

	.variant-secondary:hover:not(.disabled) {
		background-color: var(--background-modifier-hover, #f3f4f6);
		border-color: var(--interactive-accent, #8b5cf6);
	}

	.custom-select-trigger.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.custom-select-icon {
		width: 15px;
		height: 15px;
		flex-shrink: 0;
		pointer-events: none;
	}

	.chevron-icon {
		width: 13px;
		height: 13px;
		margin-left: 2px;
		transition: transform 0.15s ease;
		flex-shrink: 0;
		pointer-events: none;
	}

	.custom-select-wrapper.is-open .chevron-icon {
		transform: rotate(180deg);
	}

	.custom-select-label {
		pointer-events: none;
	}

	/* Dropdown Menu Popup - Completely Opaque & High Z-Index */
	.custom-select-menu {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		z-index: 99999;
		min-width: 100%;
		width: max-content;
		background-color: var(--background-secondary-alt, var(--background-primary-alt, var(--background-primary, #ffffff))) !important;
		opacity: 1 !important;
		border: 1px solid var(--background-modifier-border, rgba(128, 128, 128, 0.3));
		border-radius: var(--radius-m, 8px);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3), 0 4px 10px rgba(0, 0, 0, 0.15);
		padding: 6px;
		margin: 0;
		list-style: none;
		animation: fadeIn 0.12s ease-out;
		overflow: hidden;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.custom-select-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		font-size: var(--font-ui-small, 13px);
		color: var(--text-normal, #374151);
		border-radius: var(--radius-s, 4px);
		cursor: pointer;
		transition: background-color 0.12s ease, color 0.12s ease;
		white-space: nowrap;
		user-select: none;
	}

	.custom-select-item:hover {
		background-color: var(--interactive-hover, var(--background-modifier-hover, rgba(128, 128, 128, 0.15)));
		color: var(--text-normal, #111827);
	}

	.custom-select-item.is-selected {
		background-color: var(--background-modifier-accent, rgba(139, 92, 246, 0.15));
		color: var(--interactive-accent, #8b5cf6);
		font-weight: 600;
	}

	.checkmark-icon {
		width: 14px;
		height: 14px;
		margin-left: 12px;
		color: var(--interactive-accent, #8b5cf6);
		pointer-events: none;
	}
</style>
