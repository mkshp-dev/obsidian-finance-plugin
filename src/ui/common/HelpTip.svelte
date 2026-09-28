<!--
	Small "i" help icon for a plugin surface. Hover (or keyboard focus) previews
	the help popover; click pins it open until Esc, an outside click, or a second
	click. Content comes from src/ui/help/helpContent.ts, keyed by `topic`.

	The popover is portaled to the anchor's document body with fixed positioning
	so it isn't clipped by the narrow sidebar or scrolling dashboard containers.
-->
<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import { HELP_TOPICS, type HelpTopicKey, type HelpTopic } from '../help/helpContent';

	export let topic: HelpTopicKey;

	$: help = HELP_TOPICS[topic] as HelpTopic;

	const OPEN_DELAY_MS = 250;
	const CLOSE_DELAY_MS = 150;
	const VIEWPORT_MARGIN = 8;
	const GAP = 6;

	let buttonEl: HTMLButtonElement;
	let popoverEl: HTMLDivElement | null = null;
	let open = false;
	let pinned = false;
	let top = 0;
	let left = 0;
	let openTimer: number | null = null;
	let closeTimer: number | null = null;
	const popoverId = `bc-help-${Math.random().toString(36).slice(2, 10)}`;

	function clearTimers() {
		if (openTimer !== null) window.clearTimeout(openTimer);
		if (closeTimer !== null) window.clearTimeout(closeTimer);
		openTimer = closeTimer = null;
	}

	async function show() {
		clearTimers();
		if (open) return;
		open = true;
		await tick();
		position();
		addGlobalListeners();
	}

	function hide() {
		clearTimers();
		if (!open) return;
		open = false;
		pinned = false;
		removeGlobalListeners();
	}

	function scheduleShow() {
		if (closeTimer !== null) { window.clearTimeout(closeTimer); closeTimer = null; }
		if (open || openTimer !== null) return;
		openTimer = window.setTimeout(() => { openTimer = null; void show(); }, OPEN_DELAY_MS);
	}

	function scheduleHide() {
		if (openTimer !== null) { window.clearTimeout(openTimer); openTimer = null; }
		if (pinned || !open) return;
		closeTimer = window.setTimeout(() => {
			closeTimer = null;
			// e.g. button blurred by a click inside the popover while the mouse is still over it
			if (popoverEl?.matches(':hover')) return;
			hide();
		}, CLOSE_DELAY_MS);
	}

	function handleClick(event: MouseEvent) {
		event.stopPropagation();
		if (pinned) {
			hide();
		} else {
			pinned = true;
			void show();
		}
	}

	function position() {
		if (!buttonEl || !popoverEl) return;
		const win = buttonEl.ownerDocument.defaultView ?? window;
		const anchor = buttonEl.getBoundingClientRect();
		const pop = popoverEl.getBoundingClientRect();
		const vw = win.innerWidth;
		const vh = win.innerHeight;

		// Prefer below the icon; flip above if it doesn't fit and there's more room there.
		let y = anchor.bottom + GAP;
		if (y + pop.height > vh - VIEWPORT_MARGIN && anchor.top - GAP - pop.height >= VIEWPORT_MARGIN) {
			y = anchor.top - GAP - pop.height;
		}
		// Prefer left-aligned with the icon; clamp inside the viewport.
		let x = anchor.left;
		if (x + pop.width > vw - VIEWPORT_MARGIN) x = anchor.right - pop.width;
		x = Math.max(VIEWPORT_MARGIN, Math.min(x, vw - VIEWPORT_MARGIN - pop.width));
		y = Math.max(VIEWPORT_MARGIN, y);

		top = y;
		left = x;
	}

	function isInside(target: EventTarget | null): boolean {
		const node = target as Node | null;
		return !!node && (buttonEl?.contains(node) || !!popoverEl?.contains(node));
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.stopPropagation();
			hide();
			buttonEl?.focus();
		}
	}

	function onPointerDown(event: PointerEvent) {
		if (!isInside(event.target)) hide();
	}

	function onScroll(event: Event) {
		// Scrolling the popover's own content is fine; scrolling the page under it isn't.
		if (!isInside(event.target)) hide();
	}

	let listenerDoc: Document | null = null;
	let listenerWin: Window | null = null;

	function addGlobalListeners() {
		listenerDoc = buttonEl.ownerDocument;
		listenerWin = listenerDoc.defaultView ?? window;
		listenerDoc.addEventListener('keydown', onKeydown, true);
		listenerDoc.addEventListener('pointerdown', onPointerDown, true);
		listenerDoc.addEventListener('scroll', onScroll, true);
		listenerWin.addEventListener('resize', hide);
	}

	function removeGlobalListeners() {
		listenerDoc?.removeEventListener('keydown', onKeydown, true);
		listenerDoc?.removeEventListener('pointerdown', onPointerDown, true);
		listenerDoc?.removeEventListener('scroll', onScroll, true);
		listenerWin?.removeEventListener('resize', hide);
		listenerDoc = null;
		listenerWin = null;
	}

	/** Move the node to the anchor's document body (works in popout windows too). */
	function portal(node: HTMLElement) {
		(buttonEl?.ownerDocument ?? document).body.appendChild(node);
	}

	onDestroy(() => {
		clearTimers();
		removeGlobalListeners();
	});
</script>

<button
	bind:this={buttonEl}
	type="button"
	class="bc-help-tip"
	class:is-open={open}
	aria-label="Help: {help.title}"
	aria-expanded={open}
	aria-controls={open ? popoverId : undefined}
	on:click={handleClick}
	on:mouseenter={scheduleShow}
	on:mouseleave={scheduleHide}
	on:focus={scheduleShow}
	on:blur={scheduleHide}
>
	<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
		<circle cx="12" cy="12" r="10"/>
		<line x1="12" y1="16" x2="12" y2="11"/>
		<line x1="12" y1="7.5" x2="12.01" y2="7.5"/>
	</svg>
</button>

{#if open}
	<div
		use:portal
		bind:this={popoverEl}
		id={popoverId}
		class="bc-help-popover"
		class:is-pinned={pinned}
		role="dialog"
		aria-label={help.title}
		style="top: {top}px; left: {left}px;"
		on:mouseenter={scheduleShow}
		on:mouseleave={scheduleHide}
	>
		<div class="bc-help-title">{help.title}</div>
		<p class="bc-help-summary">{help.summary}</p>

		{#if help.steps?.length}
			<div class="bc-help-heading">How to use it</div>
			<ol class="bc-help-steps">
				{#each help.steps as step}
					<li>{step}</li>
				{/each}
			</ol>
		{/if}

		{#if help.items?.length}
			<div class="bc-help-heading">Controls</div>
			<dl class="bc-help-items">
				{#each help.items as item}
					<dt>{item.label}</dt>
					<dd>{item.text}</dd>
				{/each}
			</dl>
		{/if}

		{#if help.tip}
			<p class="bc-help-tipline">{help.tip}</p>
		{/if}

		{#if !pinned}
			<div class="bc-help-hint">Click the ⓘ to keep this open</div>
		{/if}
	</div>
{/if}

<style>
	.bc-help-tip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		vertical-align: middle;
		width: 20px;
		height: 20px;
		padding: 0;
		margin: 0;
		border: none;
		border-radius: 50%;
		background: transparent;
		box-shadow: none;
		color: var(--text-faint);
		cursor: help;
		transition: color 0.15s ease, background-color 0.15s ease;
	}
	.bc-help-tip:hover,
	.bc-help-tip.is-open,
	.bc-help-tip:focus-visible {
		color: var(--text-accent);
		background-color: var(--background-modifier-hover);
	}

	/* Settings → "Show help icons" off */
	:global(body.beancount-hide-help) .bc-help-tip {
		display: none;
	}

	.bc-help-popover {
		position: fixed;
		z-index: var(--layer-popover, 30);
		width: max-content;
		max-width: min(340px, calc(100vw - 16px));
		max-height: min(70vh, 520px);
		overflow-y: auto;
		padding: var(--size-4-3) var(--size-4-4);
		background-color: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		box-shadow: var(--shadow-l, 0 8px 24px rgba(0, 0, 0, 0.18));
		font-size: var(--font-ui-small);
		line-height: 1.45;
		color: var(--text-normal);
		text-align: left;
		white-space: normal;
	}
	.bc-help-popover.is-pinned {
		border-color: color-mix(in srgb, var(--interactive-accent) 45%, var(--background-modifier-border));
	}

	.bc-help-title {
		font-weight: 650;
		font-size: var(--font-ui-medium);
		margin-bottom: var(--size-4-1);
	}
	.bc-help-summary {
		margin: 0 0 var(--size-4-2) 0;
		color: var(--text-muted);
	}
	.bc-help-heading {
		margin: var(--size-4-2) 0 var(--size-4-1) 0;
		font-size: var(--font-ui-smaller);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-faint);
	}
	.bc-help-steps {
		margin: 0;
		padding-left: 1.3em;
	}
	.bc-help-steps li + li {
		margin-top: 3px;
	}
	.bc-help-items {
		margin: 0;
	}
	.bc-help-items dt {
		font-weight: 600;
		margin-top: var(--size-4-1);
	}
	.bc-help-items dd {
		margin: 0 0 0 var(--size-4-2);
		color: var(--text-muted);
	}
	.bc-help-tipline {
		margin: var(--size-4-2) 0 0 0;
		padding: var(--size-4-1) var(--size-4-2);
		border-left: 2px solid var(--interactive-accent);
		background-color: var(--background-secondary);
		border-radius: var(--radius-s);
		color: var(--text-muted);
	}
	.bc-help-hint {
		margin-top: var(--size-4-2);
		font-size: var(--font-ui-smaller);
		color: var(--text-faint);
	}
</style>
