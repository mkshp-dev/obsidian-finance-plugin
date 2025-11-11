<script lang="ts">
	import type { AccountNode } from '../types/index'; // Import the type
	import { createEventDispatcher } from 'svelte';

	// Props for this item
	export let node: AccountNode;
	export let level = 0; // Indentation level

	// Internal state
	let isOpen = false; // Is this item's submenu open?

	const dispatch = createEventDispatcher();

	function toggleOpen(event: MouseEvent) {
		event.stopPropagation(); // Prevent click from selecting the item
		isOpen = !isOpen;
	}

	function selectItem() {
		// Dispatch the full name when an item text is clicked
		dispatch('select', node.fullName);
	}
</script>

<div class="dropdown-item" style="--level: {level};">
    <button type="button" class="item-button" on:click={selectItem} title={node.fullName}>
        <span class="indent"></span>
        {#if node.children.length > 0}
            <button type="button" class="arrow-button" on:click={toggleOpen}>
                {#if isOpen}▼{:else}▶{/if}
            </button>
        {:else}
            <span class="spacer"></span>
        {/if}
        <span class="item-name">{node.name}</span>
    </button>

	{#if isOpen && node.children.length > 0}
		<div class="children">
			{#each node.children as childNode (childNode.fullName)}
				<svelte:self node={childNode} level={level + 1} on:select />
			{/each}
		</div>
	{/if}
</div>

<style>
	.dropdown-item {
		cursor: pointer;
	}
/* Style the new button */
    .item-button {
        display: flex;
        align-items: center;
        padding: 4px 8px;
        border-radius: 4px;
        width: 100%; /* Make button take full width */
        text-align: left; /* Align text left */
        background: none; /* Remove default button background */
        border: none; /* Remove default button border */
        color: inherit; /* Inherit text color */
        font: inherit; /* Inherit font */
        cursor: pointer; /* Keep pointer cursor */
    }
    .item-button:hover {
        background-color: var(--background-modifier-hover);
    }
	.arrow-button {
		background: none;
		border: none;
		padding: 0 5px;
		margin: 0;
		cursor: pointer;
		color: var(--text-muted);
		flex-shrink: 0;
		width: 20px; /* Ensure consistent width */
		text-align: center;
	}
	.arrow-button:hover {
		color: var(--text-normal);
	}
	.spacer { /* Placeholder for items without children */
		width: 20px;
		flex-shrink: 0;
	}
	.item-name {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.children {
		/* No extra style needed here initially */
	}
</style>