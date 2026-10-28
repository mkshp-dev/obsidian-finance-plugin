<script lang="ts">
	/** An optional statement balance: found in the file when it's there, else typed in. */
	export let id: string;
	export let label: string;
	export let value = '';
	/** The row it was found on in the file, or null if it was typed in or not found. */
	export let foundRow: number | null = null;
	/** The value isn't a number. */
	export let unreadable = false;
	export let onEdit: () => void = () => {};
</script>

<div class="import-field balance-field">
	<label for={id}>{label} <span class="import-hint">(optional)</span></label>
	<input {id} type="text" placeholder="e.g. 9,656.51" bind:value on:input={() => { foundRow = null; onEdit(); }} />
	<span class="import-hint" class:is-bad={unreadable}>
		{#if unreadable}
			✗ "{value}" isn't a number.
		{:else if foundRow !== null}
			Found in the file on row {foundRow + 1}.
		{:else if !value.trim()}
			Not found in the file.
		{/if}
	</span>
</div>

<style>
	.balance-field {
		flex: 1;
		min-width: 220px;
	}

	.balance-field input {
		max-width: 16em;
	}

	.is-bad {
		color: var(--text-error);
	}
</style>
