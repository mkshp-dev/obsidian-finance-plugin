<!-- src/ui/modals/AccountQueryRow.svelte -->
<!-- One account input row, used repeatedly by AddBudgetModal/AddTargetModal to build a
     multi-account query (e.g. Expenses:(Rent|Utility)) from individually picked accounts. -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	export let value: string = '';
	export let accounts: string[] = [];
	export let showRemove: boolean = false;
	export let placeholder: string = 'e.g. Expenses:Food';
	export let hasError: boolean = false;

	$: filteredAccounts = value
		? accounts.filter((a) => a.toLowerCase().includes(value.toLowerCase()))
		: accounts;
	$: summary = value
		? `${filteredAccounts.length} matching account${filteredAccounts.length === 1 ? '' : 's'}`
		: `${accounts.length} account${accounts.length === 1 ? '' : 's'} available. Type to filter.`;
	let showDropdown = false;

	function selectAccount(acc: string) {
		value = acc;
		showDropdown = false;
	}

	function remove() {
		dispatch('remove');
	}
</script>

<div class="account-query-row">
	<div class="autocomplete-wrapper">
		<input
			type="text"
			bind:value
			{placeholder}
			class:error={hasError}
			on:focus={() => (showDropdown = true)}
			on:blur={() => setTimeout(() => (showDropdown = false), 150)}
		/>
		{#if showDropdown}
			<ul class="autocomplete-dropdown">
				<li class="autocomplete-summary">{summary}</li>
				{#if filteredAccounts.length > 0}
					{#each filteredAccounts as acc}
						<!-- svelte-ignore a11y-click-events-have-key-events -->
						<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
						<li on:mousedown|preventDefault={() => selectAccount(acc)}>{acc}</li>
					{/each}
				{:else}
					<li class="autocomplete-empty">No accounts match your filter.</li>
				{/if}
			</ul>
		{/if}
	</div>
	{#if showRemove}
		<button type="button" class="remove-row-btn" aria-label="Remove account" on:click={remove}>&times;</button>
	{/if}
</div>

<style>
	.account-query-row {
		display: flex;
		align-items: center;
		gap: var(--size-4-2);
	}

	.autocomplete-wrapper {
		position: relative;
		flex: 1;
	}

	input[type='text'] {
		padding: var(--size-4-1) var(--size-4-2);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		background: var(--background-primary);
		color: var(--text-normal);
		font-size: var(--font-ui-small);
		width: 100%;
	}

	input.error {
		border-color: var(--text-error);
	}

	.autocomplete-dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		z-index: 100;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		max-height: 240px;
		overflow-y: auto;
		list-style: none;
		margin: 2px 0 0;
		padding: 0;
	}

	.autocomplete-dropdown li {
		padding: var(--size-4-1) var(--size-4-2);
		font-size: var(--font-ui-small);
	}

	.autocomplete-dropdown li:not(.autocomplete-summary, .autocomplete-empty) {
		cursor: pointer;
	}

	.autocomplete-dropdown li:not(.autocomplete-summary, .autocomplete-empty):hover {
		background: var(--background-modifier-hover);
	}

	.autocomplete-summary,
	.autocomplete-empty {
		color: var(--text-muted);
		cursor: default;
		font-size: var(--font-ui-smaller);
	}

	.remove-row-btn {
		flex-shrink: 0;
		width: 28px;
		height: 28px;
		padding: 0;
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		background: var(--interactive-normal);
		color: var(--text-muted);
		cursor: pointer;
		font-size: var(--font-ui-medium);
		line-height: 1;
	}

	.remove-row-btn:hover {
		background: var(--background-modifier-error);
		color: var(--text-error);
	}
</style>
