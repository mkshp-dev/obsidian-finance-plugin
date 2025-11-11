<script lang="ts">
	import type { AccountNode } from '../types/index'; // Import the type
	import DropdownItem from './DropdownItem.svelte'; // Import the item component
	import { createEventDispatcher } from 'svelte';
    

	// Props
	export let treeData: AccountNode[] = [];
	export let selectedAccount: string | null = null; // Use two-way binding: bind:selectedAccount
	export let placeholder = "Select Account";
	export let disabled = false;
    export let isLoading = false;

	// Internal State
	let isOpen = false; // Is the dropdown open?

	const dispatch = createEventDispatcher();

	function toggleDropdown() {
		if (!disabled) {
			isOpen = !isOpen;
		}
	}

	function handleSelect(event: any) {
		selectedAccount = event.detail; // Update the bound value
		isOpen = false; // Close dropdown after selection
		// Optionally dispatch an event if not using bind:
		// dispatch('change', selectedAccount);
	}

	// Simple function to get the display name (last part)
	function getDisplayName(fullName: string | null): string {
        if (fullName === null) return "All Accounts";
		if (!fullName) return placeholder;
		return fullName.substring(fullName.lastIndexOf(':') + 1) || fullName;
	}

	// Close dropdown if clicked outside (optional but good UX)
	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		// Check if the click target is outside the component's root element
		if (hostElement && !hostElement.contains(target)) {
			isOpen = false;
		}
	}
	let hostElement: HTMLDivElement; // Reference to the root element

</script>

<svelte:window on:click={handleClickOutside}/>

<div class="hierarchical-dropdown" bind:this={hostElement}>
	<button
		class="dropdown-toggle"
		on:click={toggleDropdown}
		disabled={disabled}
		aria-haspopup="true"
		aria-expanded={isOpen}
	>
		<span>{getDisplayName(selectedAccount)}</span>
		<span class="toggle-arrow">{isOpen ? '▲' : '▼'}</span>
	</button>

    {#if isOpen}
        <div class="dropdown-menu">

            {#if isLoading}
                <div class="dropdown-empty">Loading...</div>
            {:else if treeData && treeData.length > 0}
                {#each treeData as node (node.fullName ?? node.name)}
                    <DropdownItem {node} on:select={handleSelect} />
                {/each}
            {:else}
                <div class="dropdown-empty">No accounts loaded.</div>
            {/if}
        </div>
    {/if}
</div>

<style>
	.hierarchical-dropdown {
		position: relative; /* Needed for absolute positioning of the menu */
		display: inline-block;
	}
	.dropdown-toggle {
		/* Style like a standard input/button */
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--size-4-1) var(--size-4-3);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		background-color: var(--background-secondary);
		cursor: pointer;
		min-width: 200px; /* Match old select */
		text-align: left;
		width: 100%; /* Take available width */
	}
	.dropdown-toggle:disabled {
		cursor: not-allowed;
		opacity: 0.7;
	}
	.toggle-arrow {
		color: var(--text-muted);
		margin-left: 10px;
	}
	.dropdown-menu {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		background-color: var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		padding: 5px;
		margin-top: 4px;
		z-index: 10; /* Ensure it appears above other content */
		max-height: 300px; /* Prevent excessively long dropdowns */
		overflow-y: auto;
		box-shadow: var(--shadow-m);
	}
	.dropdown-empty {
		padding: 8px;
		color: var(--text-muted);
		font-style: italic;
	}
</style>