<script lang="ts">
	import { onMount } from 'svelte';
	import { Notice } from 'obsidian';
	import type BeancountPlugin from '../../main';
	import { loadAccountAliasEntries, type AccountAliasEntry } from '../../services/import.service';
	import { parseAliases } from '../../utils/import/aliases';
	import { updateAccountAliases } from '../../utils/directives/accountDirectives';
	import { Logger } from '../../utils/logger';

	export let plugin: BeancountPlugin;

	let entries: AccountAliasEntry[] = [];
	let loading = true;
	let loadError = '';
	/** True while a change is being written; other changes wait. */
	let saving = false;

	let search = '';
	let onlyWithAliases = false;
	/** The alias being typed for each account, by account name. */
	let drafts: Record<string, string> = {};

	// Quick add at the top.
	let quickAccount = '';
	let quickAlias = '';

	onMount(reload);

	async function reload() {
		try {
			entries = await loadAccountAliasEntries(plugin);
			loadError = '';
		} catch (e) {
			Logger.error('[Aliases] Failed to load accounts', e);
			loadError = `Couldn't read accounts from the ledger: ${e instanceof Error ? e.message : String(e)}`;
		} finally {
			loading = false;
		}
	}

	function normalize(text: string): string {
		return text.replace(/\s+/g, ' ').trim().toLowerCase();
	}

	$: query = normalize(search);
	$: visible = entries.filter((e) =>
		(!onlyWithAliases || e.aliases.length > 0)
		&& (!query || normalize(e.account).includes(query) || e.aliases.some((a) => normalize(a).includes(query))));
	$: withAliases = entries.filter((e) => e.aliases.length > 0).length;

	/** Writes an account's new alias list, then reads the ledger again (line numbers may have moved). */
	async function save(entry: AccountAliasEntry, aliases: string[]): Promise<boolean> {
		if (saving) return false;
		saving = true;
		try {
			const result = await updateAccountAliases(plugin, entry.account, entry.filename, entry.lineno, aliases);
			if (!result.success) {
				new Notice(`Couldn't update the aliases of ${entry.account}: ${result.error ?? 'unknown error'}`);
				return false;
			}
			await reload();
			return true;
		} finally {
			saving = false;
		}
	}

	async function add(account: string, text: string): Promise<boolean> {
		const entry = entries.find((e) => e.account === account.trim());
		if (!entry) {
			new Notice(`${account.trim() || 'That account'} isn't an open account.`);
			return false;
		}
		// `|` separates aliases, so it can't be part of one.
		const alias = parseAliases(text.replace(/\|/g, ' '))[0];
		if (!alias) return false;
		const owner = entries.find((e) => e.aliases.some((a) => normalize(a) === normalize(alias)));
		if (owner) {
			new Notice(owner === entry ? `"${alias}" is already an alias of ${owner.account}.` : `"${alias}" is already an alias of ${owner.account}. Remove it there first.`);
			return false;
		}
		const saved = await save(entry, [...entry.aliases, alias]);
		if (saved) new Notice(`Added "${alias}" to ${entry.account}.`);
		return saved;
	}

	async function remove(entry: AccountAliasEntry, alias: string) {
		await save(entry, entry.aliases.filter((a) => a !== alias));
	}

	async function addFromRow(entry: AccountAliasEntry) {
		if (await add(entry.account, drafts[entry.account] ?? '')) drafts[entry.account] = '';
	}

	async function quickAdd() {
		if (await add(quickAccount, quickAlias)) quickAlias = '';
	}

	function onEnter(e: KeyboardEvent, action: () => void) {
		if (e.key === 'Enter') {
			e.preventDefault();
			action();
		}
	}
</script>

<div class="aliases-modal">
	<p class="aliases-intro">
		Aliases are words from your bank statements that point to an account, like "Swiggy" for Expenses:Food.
		Importing a statement uses them in <code>ACCOUNT WHERE</code> and <code>ALIAS WHERE</code> formulas.
		They're saved as <code>aliases</code> metadata on each account's open directive.
	</p>

	<div class="quick-add">
		<input type="text" class="quick-account" list="aliases-accounts" placeholder="Account" bind:value={quickAccount}
			aria-label="Account" disabled={saving} />
		<input type="text" class="quick-alias" placeholder="Alias, e.g. Swiggy" bind:value={quickAlias}
			aria-label="Alias" disabled={saving} on:keydown={(e) => onEnter(e, quickAdd)} />
		<button type="button" class="mod-cta" disabled={saving || !quickAccount.trim() || !quickAlias.trim()} on:click={quickAdd}>Add alias</button>
		<datalist id="aliases-accounts">{#each entries as e}<option value={e.account} />{/each}</datalist>
	</div>

	<div class="aliases-filter">
		<input type="search" placeholder="Search accounts and aliases" bind:value={search} aria-label="Search" />
		<label class="only-with">
			<input type="checkbox" bind:checked={onlyWithAliases} /> Only accounts with aliases ({withAliases})
		</label>
	</div>

	{#if loading}
		<p class="aliases-hint">Loading accounts…</p>
	{:else if loadError}
		<div class="aliases-error">{loadError}</div>
	{:else}
		<div class="aliases-list">
			{#each visible as entry (entry.account)}
				<div class="alias-row">
					<div class="alias-account">{entry.account}</div>
					<div class="alias-chips">
						{#each entry.aliases as alias (alias)}
							<span class="alias-chip">{alias}
								<button type="button" aria-label="Remove {alias}" disabled={saving} on:click={() => remove(entry, alias)}>&times;</button>
							</span>
						{/each}
						<input type="text" class="alias-input" placeholder="+ alias" bind:value={drafts[entry.account]}
							aria-label="New alias for {entry.account}" disabled={saving}
							on:keydown={(e) => onEnter(e, () => addFromRow(entry))} />
					</div>
				</div>
			{:else}
				<p class="aliases-hint">{entries.length === 0 ? 'No open accounts in the ledger.' : 'No accounts match.'}</p>
			{/each}
		</div>
	{/if}
</div>

<style>
	.aliases-modal {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-3);
	}

	.aliases-intro, .aliases-hint {
		margin: 0;
		color: var(--text-muted);
		font-size: var(--font-ui-small);
	}

	.quick-add {
		display: grid;
		grid-template-columns: 2fr 1.5fr auto;
		gap: var(--size-4-2);
	}

	.aliases-filter {
		display: flex;
		align-items: center;
		gap: var(--size-4-3);
	}

	.aliases-filter input[type="search"] {
		flex: 1;
	}

	.only-with {
		display: flex;
		align-items: center;
		gap: var(--size-4-1);
		font-size: var(--font-ui-small);
		color: var(--text-muted);
		white-space: nowrap;
	}

	.aliases-error {
		color: var(--text-error);
	}

	.aliases-list {
		max-height: 55vh;
		overflow-y: auto;
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
	}

	.alias-row {
		display: grid;
		grid-template-columns: minmax(180px, 1fr) 2fr;
		gap: var(--size-4-3);
		align-items: center;
		padding: var(--size-4-2) var(--size-4-3);
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.alias-row:last-child {
		border-bottom: none;
	}

	.alias-account {
		font-size: var(--font-ui-small);
		word-break: break-word;
	}

	.alias-chips {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--size-4-1);
	}

	.alias-chip {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		padding: 1px 4px 1px 8px;
		border-radius: var(--radius-l);
		background: rgba(var(--color-accent-rgb, 0, 122, 255), 0.1);
		color: var(--text-accent);
		font-size: var(--font-ui-smaller);
	}

	.alias-chip button {
		all: unset;
		cursor: pointer;
		padding: 0 4px;
		color: var(--text-muted);
	}

	.alias-chip button:hover {
		color: var(--text-error);
	}

	.alias-input {
		width: 9em;
		height: auto;
		padding: 1px 6px;
		font-size: var(--font-ui-smaller);
		border-radius: var(--radius-l);
	}

	@media (max-width: 600px) {
		.quick-add, .alias-row {
			grid-template-columns: 1fr;
		}
	}
</style>
