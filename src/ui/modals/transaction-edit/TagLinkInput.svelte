<!-- src/ui/modals/transaction-edit/TagLinkInput.svelte -->
<script lang="ts">
	export let selectedTags: string[] = [];
	export let selectedLinks: string[] = [];
	export let tags: string[] = [];

	let tagInputValue = "";
	let linkInputValue = "";

	// Text still in the box is committed on blur too — otherwise a tag typed
	// (or picked from the datalist) without pressing Enter is silently lost
	// when the user clicks Save.
	function commitTag() {
		const value = tagInputValue.trim().replace(/^#/, "");
		if (value && !selectedTags.includes(value)) {
			selectedTags = [...selectedTags, value];
		}
		if (!value || selectedTags.includes(value)) tagInputValue = "";
	}

	function handleTagInput(e: KeyboardEvent) {
		if (e.key === "Enter" || e.key === ",") {
			e.preventDefault();
			commitTag();
		}
	}

	function removeTag(tagToRemove: string) {
		selectedTags = selectedTags.filter((t) => t !== tagToRemove);
	}

	function commitLink() {
		const value = linkInputValue.trim().replace(/^\^/, "");
		if (value && !selectedLinks.includes(value)) {
			selectedLinks = [...selectedLinks, value];
		}
		if (!value || selectedLinks.includes(value)) linkInputValue = "";
	}

	function handleLinkInput(e: KeyboardEvent) {
		if (e.key === "Enter" || e.key === ",") {
			e.preventDefault();
			commitLink();
		}
	}

	function removeLink(linkToRemove: string) {
		selectedLinks = selectedLinks.filter((l) => l !== linkToRemove);
	}
</script>

<div class="tags-links-section">
	<div class="tags-links-row">
		<div class="form-group">
			<label for="tags">Tags</label>
			<input
				type="text"
				id="tags"
				bind:value={tagInputValue}
				on:keydown={handleTagInput}
				on:blur={commitTag}
				list="tags-list"
				placeholder="Tag + Enter"
			/>
			<datalist id="tags-list">
				{#each tags as tag}
					<option value={tag} />
				{/each}
			</datalist>
			{#if selectedTags.length > 0}
				<div class="selected-tags">
					{#each selectedTags as tag}
						<span class="tag">
							#{tag}
							<button type="button" on:click={() => removeTag(tag)}>&times;</button>
						</span>
					{/each}
				</div>
			{/if}
		</div>
		<div class="form-group">
			<label for="links">Links</label>
			<input
				type="text"
				id="links"
				bind:value={linkInputValue}
				on:keydown={handleLinkInput}
				on:blur={commitLink}
				placeholder="Link + Enter"
			/>
			{#if selectedLinks.length > 0}
				<div class="selected-links">
					{#each selectedLinks as link}
						<span class="link">
							^{link}
							<button type="button" on:click={() => removeLink(link)}>&times;</button>
						</span>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.tags-links-section {
		margin-top: var(--size-4-3);
		padding-top: var(--size-4-3);
		border-top: 1px solid var(--background-modifier-border);
	}

	.tags-links-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--size-4-3);
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-1);
	}

	.form-group label {
		font-size: var(--font-ui-smaller);
		font-weight: 500;
		color: var(--text-muted);
	}

	input[type="text"] {
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		padding: 4px 8px;
		color: var(--text-normal);
		font-size: var(--font-ui-small);
	}

	input[type="text"]:focus {
		border-color: var(--interactive-accent);
		outline: none;
	}

	.selected-tags, .selected-links {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 6px;
	}

	.tag, .link {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 11px;
		padding: 2px 8px;
		border-radius: 12px;
		background: rgba(var(--color-accent-rgb, 0, 122, 255), 0.1);
		color: var(--text-accent);
		font-weight: 500;
	}

	.tag button, .link button {
		background: transparent;
		border: none;
		box-shadow: none;
		padding: 0;
		margin: 0;
		cursor: pointer;
		font-size: 12px;
		color: inherit;
		opacity: 0.7;
	}

	.tag button:hover, .link button:hover {
		opacity: 1;
	}
</style>
