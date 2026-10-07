<script lang="ts">
	export let files: string[] = [];
	export let filePath = '';
	export let fileError = '';
	export let profiles: { id: string; name: string }[] = [];
	/** '' for a new mapping. */
	export let profileId = '';
	/** The chosen profile's header isn't in this file. */
	export let profileMismatch = false;
	export let transactionCount = 0;
	/** A table was found, or can be marked by hand in the next step. */
	export let canContinue = false;
	export let onSelectFile: (path: string) => void;
	export let onSelectProfile: (id: string) => void;
	export let onCancel: () => void;
	export let onNext: () => void;

	$: chosen = profiles.find((p) => p.id === profileId);
</script>

<div class="import-step">
	{#if files.length === 0}
		<div class="import-empty">
			<p>No CSV files in this vault yet.</p>
			<p class="import-hint">Download your statement as CSV from your bank's website and save it anywhere in the vault, then run this command again.</p>
		</div>
	{:else}
		<div class="import-field">
			<label for="import-file">Statement file</label>
			<select id="import-file" class="dropdown" value={filePath} on:change={(e) => onSelectFile(e.currentTarget.value)}>
				<option value="" disabled>Choose a CSV file…</option>
				{#each files as path}
					<option value={path}>{path}</option>
				{/each}
			</select>
			<span class="import-hint">CSV files in your vault, most recently changed first.</span>
		</div>

		<div class="import-field">
			<label for="import-profile-choice">Mapping profile</label>
			<select id="import-profile-choice" class="dropdown" value={profileId} on:change={(e) => onSelectProfile(e.currentTarget.value)}>
				<option value="">None (new mapping)</option>
				{#each profiles as p (p.id)}
					<option value={p.id}>{p.name}</option>
				{/each}
			</select>
			<span class="import-hint">
				{#if profiles.length === 0}
					A profile saves how a bank's columns map to transactions. One is saved when you apply a mapping.
				{:else}
					Reuse a mapping saved from an earlier import of the same bank.
				{/if}
			</span>
		</div>

		{#if fileError}
			<div class="import-banner is-warning">{fileError}</div>
		{:else if filePath && transactionCount > 0}
			<div class="import-banner is-success">Found {transactionCount} transaction{transactionCount === 1 ? '' : 's'}.</div>
		{/if}

		{#if chosen && profileMismatch && filePath}
			<div class="import-banner is-warning">
				This file's columns are different from the ones <strong>{chosen.name}</strong> was saved with, so its mapping may not fit.
			</div>
		{/if}
	{/if}

	<div class="import-footer">
		<button type="button" on:click={onCancel}>Cancel</button>
		<button type="button" class="mod-cta" disabled={!filePath || !canContinue} on:click={onNext}>Next</button>
	</div>
</div>
