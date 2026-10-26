<script lang="ts">
	import { onMount } from 'svelte';
	import { Notice } from 'obsidian';
	import type BeancountPlugin from '../../main';
	import { loadAccountAliasEntries, type AccountAliasEntry } from '../../services/import.service';
	import { parseAliases } from '../../utils/import/aliases';
	import { updateAccountAliases } from '../../utils/directives/accountDirectives';
	import { Logger } from '../../utils/logger';

	export let plugin: BeancountPlugin;

	/** Accounts and their aliases as saved in the ledger. */
	let entries: AccountAliasEntry[] = [];
	/** The aliases as edited here, by account; written only on Save. */
	let edited: Record<string, string[]> = {};
	let loading = true;
	let loadError = '';
	let saving = false;

	let search = '';
	let onlyWithAliases = false;
	/** The alias being typed for each account, by account name. */
	let drafts: Record<string, string> = {};

	onMount(reload);

	async function reload() {
		try {
			entries = await loadAccountAliasEntries(plugin);
			edited = Object.fromEntries(entries.map((e) => [e.account, [...e.aliases]]));
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

	function aliasesOf(account: string): string[] {
		return edited[account] ?? [];
	}

	// Reads `edited` directly so Svelte re-runs this on every edit.
	$: changed = entries.filter((e) => (edited[e.account] ?? []).join('|') !== e.aliases.join('|'));
	$: query = normalize(search);
	$: visible = entries.filter((e) => {
		const aliases = edited[e.account] ?? [];
		return (!onlyWithAliases || aliases.length > 0)
			&& (!query || normalize(e.account).includes(query) || aliases.some((a) => normalize(a).includes(query)));
	});
	$: withAliases = entries.filter((e) => (edited[e.account] ?? []).length > 0).length;

	function add(entry: AccountAliasEntry) {
		// `|` separates aliases, so it can't be part of one.
		const alias = parseAliases((drafts[entry.account] ?? '').replace(/\|/g, ' '))[0];
		if (!alias) return;
		const owner = entries.find((e) => aliasesOf(e.account).some((a) => normalize(a) === normalize(alias)));
		if (owner) {
			new Notice(owner === entry ? `"${alias}" is already an alias of ${owner.account}.` : `"${alias}" is already an alias of ${owner.account}. Remove it there first.`);
			return;
		}
		edited[entry.account] = [...aliasesOf(entry.account), alias];
		drafts[entry.account] = '';
	}

	function remove(entry: AccountAliasEntry, alias: string) {
		edited[entry.account] = aliasesOf(entry.account).filter((a) => a !== alias);
	}

	/** Writes every changed account to the ledger, then reads it again. */
	async function save() {
		if (saving || changed.length === 0) return;
		saving = true;
		try {
			const result = await updateAccountAliases(plugin, changed.map((e) => ({
				account: e.account, filename: e.filename, lineno: e.lineno, aliases: aliasesOf(e.account),
			})));
			if (result.saved > 0) new Notice(`Saved aliases for ${result.saved} account${result.saved === 1 ? '' : 's'}.`);
			if (result.errors.length > 0) new Notice(`Some aliases weren't saved:\n${result.errors.join('\n')}`, 0);
			await reload();
		} finally {
			saving = false;
		}
	}

	/** For the modal: whether closing would lose changes. */
	export function hasUnsavedChanges(): boolean {
		return changed.length > 0;
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
		Aliases are words from your bank statements that point to an account, like "Uber" for Expenses:Transport.
		Importing a statement uses them in <code>ACCOUNT WHERE</code> and <code>ALIAS WHERE</code> formulas.
		They're saved as <code>aliases</code> metadata on each account's open directive.
	</p>

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
				<div class="alias-row" class:is-changed={changed.includes(entry)}>
					<div class="alias-account">{entry.account}</div>
					<div class="alias-chips">
						{#each edited[entry.account] ?? [] as alias (alias)}
							<span class="alias-chip" class:is-new={!entry.aliases.includes(alias)}>{alias}
								<button type="button" aria-label="Remove {alias}" disabled={saving} on:click={() => remove(entry, alias)}>&times;</button>
							</span>
						{/each}
						<input type="text" class="alias-input" placeholder="+ alias" bind:value={drafts[entry.account]}
							aria-label="New alias for {entry.account}" disabled={saving}
							on:keydown={(e) => onEnter(e, () => add(entry))} />
					</div>
				</div>
			{:else}
				<p class="aliases-hint">{entries.length === 0 ? 'No open accounts in the ledger.' : 'No accounts match.'}</p>
			{/each}
		</div>
	{/if}

	<div class="aliases-footer">
		{#if changed.length > 0}
			<span class="aliases-hint">Unsaved changes to {changed.length} account{changed.length === 1 ? '' : 's'}</span>
		{/if}
		<button type="button" class="mod-cta" disabled={saving || changed.length === 0} on:click={save}>{saving ? 'Saving…' : 'Save'}</button>
	</div>
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

	.alias-row.is-changed {
		box-shadow: inset 3px 0 0 var(--interactive-accent);
	}

	.alias-chip.is-new {
		outline: 1px dashed var(--interactive-accent);
	}

	.aliases-footer {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: var(--size-4-3);
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
		.alias-row {
			grid-template-columns: 1fr;
		}
	}
</style>
