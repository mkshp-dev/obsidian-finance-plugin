<script lang="ts">
	import { onMount, createEventDispatcher } from "svelte";
	import type {
		JournalTransaction,
		JournalPosting,
		JournalEntry,
		JournalBalance,
		JournalNote,
	} from "../../models/journal";
	import { runQuery } from "../../utils/queryRunner";
	import { getQueryDirectives } from "../../utils";

	export let transaction: JournalTransaction | null = null; // Now optional for Add mode
	export let entry: JournalEntry | null = null; // Support for any entry type
	export let accounts: string[] = [];
	export let payees: string[] = [];
	export let tags: string[] = [];
	export let currencies: string[] = []; // Add currencies prop
	export let mode: "add" | "edit" = transaction || entry ? "edit" : "add"; // Auto-detect mode
	export let operatingCurrency: string = "INR";
	export let plugin: any = null;

	const dispatch = createEventDispatcher();

	// Beancount internal metadata fields that should not be shown to users
	const INTERNAL_METADATA_KEYS = [
		"filename",
		"lineno",
		"__tolerances__",
		"__residual__",
		"__automatic__",
		"__treeified__",
		"__accuracy__",
	];

	// Helper function to filter out internal metadata
	function filterInternalMetadata(
		metadata: Record<string, string> | undefined,
	): Record<string, string> {
		if (!metadata) return {};
		const filtered: Record<string, string> = {};
		for (const [key, value] of Object.entries(metadata)) {
			if (!INTERNAL_METADATA_KEYS.includes(key)) {
				filtered[key] = value;
			}
		}
		return filtered;
	}

	// Entry type tabs
	let activeTab: "transaction" | "balance" | "note" | "query" = "transaction";

	// Initialize active tab based on existing entry
	if (entry) {
		activeTab =
			entry.type === "pad"
				? "balance"
				: (entry.type as "transaction" | "balance" | "note");
	} else if (transaction) {
		activeTab = "transaction";
	}

	// Query directive fields
	let queryName = "";
	let querySql = "";

	// Saved queries browser
	let savedQueries: Record<string, string> = {};
	let savedQueriesLoading = false;
	let savedQueriesLoaded = false;

	$: if (activeTab === "query" && plugin && !savedQueriesLoaded) {
		loadSavedQueries();
	}

	async function loadSavedQueries() {
		if (!plugin || savedQueriesLoading) return;
		savedQueriesLoading = true;
		try {
			savedQueries = await getQueryDirectives(plugin);
			savedQueriesLoaded = true;
		} catch (_) {
			savedQueries = {};
		} finally {
			savedQueriesLoading = false;
		}
	}

	function loadQueryIntoForm(name: string, sql: string) {
		queryName = name;
		querySql = sql;
		// Clear previous test results
		queryTestRows = [];
		queryTestError = "";
	}

	// Query test state
	let queryTesting = false;
	let queryTestRows: string[][] = [];
	let queryTestError = "";

	async function testQuerySQL() {
		if (!querySql.trim() || !plugin) return;
		queryTesting = true;
		queryTestRows = [];
		queryTestError = "";
		try {
			const csv = await runQuery(plugin, querySql.trim());
			const lines = csv.trim().split("\n").filter((l) => l.trim());
			// Parse CSV lines (handles simple quoted fields)
			queryTestRows = lines.slice(0, 6).map((line) => {
				const cells: string[] = [];
				let current = "";
				let inQuotes = false;
				for (let i = 0; i < line.length; i++) {
					const ch = line[i];
					if (ch === '"') { inQuotes = !inQuotes; }
					else if (ch === "," && !inQuotes) { cells.push(current.trim()); current = ""; }
					else { current += ch; }
				}
				cells.push(current.trim());
				return cells;
			});
		} catch (e: any) {
			queryTestError = e.message || String(e);
		} finally {
			queryTesting = false;
		}
	}

	// Reactive title update
	$: {
		const titleMode = mode === "edit" ? "Edit" : "Add";
		const titleType =
			activeTab.charAt(0).toUpperCase() + activeTab.slice(1);
		dispatch("titleChange", `${titleMode} ${titleType}`);
	}

	// Common fields for all entry types
	let date =
		transaction?.date ||
		entry?.date ||
		new Date().toISOString().split("T")[0];

	// Transaction-specific fields
	let flag = transaction?.flag || "*";
	let payee = transaction?.payee || "";
	let narration = transaction?.narration || "";
	let postings: JournalPosting[] = transaction
		? transaction.postings.map((p) => ({
				...p,
				// Ensure cost and price have complete structures with all required fields
				cost: p.cost
					? {
							number: p.cost.number || "",
							currency: p.cost.currency || operatingCurrency,
							date: p.cost.date || "",
							label: p.cost.label || "",
							isTotal: p.cost.isTotal || false,
						}
					: {
							number: "",
							currency: operatingCurrency,
							date: "",
							label: "",
							isTotal: false,
						},
				price: p.price
					? {
							amount: p.price.amount || "",
							currency: p.price.currency || operatingCurrency,
							isTotal: p.price.isTotal || false,
						}
					: {
							amount: "",
							currency: operatingCurrency,
							isTotal: false,
						},
				flag: p.flag || null,
				comment: p.comment || null,
				metadata: filterInternalMetadata(p.metadata),
			}))
		: [
				{
					account: "",
					amount: null,
					currency: operatingCurrency,
					price: {
						amount: "",
						currency: operatingCurrency,
						isTotal: false,
					},
					cost: {
						number: "",
						currency: operatingCurrency,
						date: "",
						label: "",
						isTotal: false,
					},
					flag: null,
					comment: null,
					metadata: {},
				},
				{
					account: "",
					amount: null,
					currency: operatingCurrency,
					price: {
						amount: "",
						currency: operatingCurrency,
						isTotal: false,
					},
					cost: {
						number: "",
						currency: operatingCurrency,
						date: "",
						label: "",
						isTotal: false,
					},
					flag: null,
					comment: null,
					metadata: {},
				},
			];
	let selectedTags: string[] = transaction ? [...transaction.tags] : [];
	let selectedLinks: string[] = transaction ? [...transaction.links] : [];
	let transactionMetadata: Record<string, string> = filterInternalMetadata(
		transaction?.metadata,
	);

	// Track which posting sections are expanded (separate toggles for each feature)
	let showCost: boolean[] = postings.map((p) => {
		const hasCost =
			p.cost && (p.cost.number || p.cost.date || p.cost.label);
		return !!hasCost;
	});
	let showPrice: boolean[] = postings.map((p) => {
		const hasPrice = p.price && p.price.amount;
		return !!hasPrice;
	});
	let showPostingFlag: boolean[] = postings.map((p) => !!p.flag);
	let showPostingComment: boolean[] = postings.map((p) => !!p.comment);
	let showPostingMetadata: boolean[] = postings.map((p) => {
		return p.metadata && Object.keys(p.metadata).length > 0;
	});

	// Track transaction-level metadata toggle
	let showTransactionMetadata: boolean =
		transactionMetadata && Object.keys(transactionMetadata).length > 0;

	// Balance-specific fields
	let balanceAccount =
		entry?.type === "balance" ? (entry as JournalBalance).account : "";
	let balanceAmount =
		entry?.type === "balance" ? (entry as JournalBalance).amount : "";
	let balanceCurrency =
		entry?.type === "balance"
			? (entry as JournalBalance).currency
			: operatingCurrency;

	// Note-specific fields
	let noteAccount =
		entry?.type === "note" ? (entry as JournalNote).account : "";
	let noteComment =
		entry?.type === "note" ? (entry as JournalNote).comment : "";

	// UI state
	let saving = false;
	let deleting = false;
	let showDeleteConfirm = false;
	let errors: string[] = [];

	// Add a new posting
	function addPosting() {
		postings = [
			...postings,
			{
				account: "",
				amount: null,
				currency: operatingCurrency,
				price: {
					amount: "",
					currency: operatingCurrency,
					isTotal: false,
				},
				cost: {
					number: "",
					currency: operatingCurrency,
					date: "",
					label: "",
					isTotal: false,
				},
				flag: null,
				comment: null,
				metadata: {},
			},
		];
		showCost = [...showCost, false];
		showPrice = [...showPrice, false];
		showPostingFlag = [...showPostingFlag, false];
		showPostingComment = [...showPostingComment, false];
		showPostingMetadata = [...showPostingMetadata, false];
	}

	// Remove a posting
	function removePosting(index: number) {
		if (postings.length > 2) {
			postings = postings.filter((_, i) => i !== index);
			showCost = showCost.filter((_, i) => i !== index);
			showPrice = showPrice.filter((_, i) => i !== index);
			showPostingFlag = showPostingFlag.filter((_, i) => i !== index);
			showPostingComment = showPostingComment.filter(
				(_, i) => i !== index,
			);
			showPostingMetadata = showPostingMetadata.filter(
				(_, i) => i !== index,
			);
		}
	}

	// Toggle functions for each posting feature
	function toggleCost(index: number) {
		showCost[index] = !showCost[index];
		if (!postings[index].cost || typeof postings[index].cost !== "object") {
			postings[index].cost = {
				number: "",
				currency: operatingCurrency,
				date: "",
				label: "",
				isTotal: false,
			};
		}
	}

	function togglePrice(index: number) {
		showPrice[index] = !showPrice[index];
		if (
			!postings[index].price ||
			typeof postings[index].price !== "object"
		) {
			postings[index].price = {
				amount: "",
				currency: operatingCurrency,
				isTotal: false,
			};
		}
	}

	function togglePostingFlag(index: number) {
		showPostingFlag[index] = !showPostingFlag[index];
		if (!postings[index].flag) {
			postings[index].flag = "!";
		}
	}

	function togglePostingComment(index: number) {
		showPostingComment[index] = !showPostingComment[index];
		if (!postings[index].comment) {
			postings[index].comment = "";
		}
	}

	function togglePostingMetadata(index: number) {
		showPostingMetadata[index] = !showPostingMetadata[index];
		if (!postings[index].metadata) {
			postings[index].metadata = {};
		}
	}

	function toggleTransactionMetadata() {
		showTransactionMetadata = !showTransactionMetadata;
	}

	function addPostingMetadata(index: number) {
		if (!postings[index].metadata) {
			postings[index].metadata = {};
		}
		const key = `key${Object.keys(postings[index].metadata).length + 1}`;
		postings[index].metadata[key] = "";
		postings = [...postings]; // Trigger reactivity
	}

	function removePostingMetadata(index: number, key: string) {
		delete postings[index].metadata[key];
		postings = [...postings];
	}

	function addTransactionMetadata() {
		const key = `key${Object.keys(transactionMetadata).length + 1}`;
		transactionMetadata[key] = "";
		transactionMetadata = { ...transactionMetadata };
	}

	function removeTransactionMetadata(key: string) {
		delete transactionMetadata[key];
		transactionMetadata = { ...transactionMetadata };
	}

	function updateTransactionMetadataKey(oldKey: string, newKey: string) {
		if (oldKey === newKey) return;
		const value = transactionMetadata[oldKey];
		delete transactionMetadata[oldKey];
		transactionMetadata[newKey] = value;
		transactionMetadata = { ...transactionMetadata };
	}

	function updatePostingMetadataKey(
		index: number,
		oldKey: string,
		newKey: string,
	) {
		if (oldKey === newKey) return;
		const value = postings[index].metadata[oldKey];
		delete postings[index].metadata[oldKey];
		postings[index].metadata[newKey] = value;
		postings = [...postings];
	}

	// Validate form
	function validateForm(): boolean {
		errors = [];

		if (!date) errors.push("Date is required");

		if (activeTab === "transaction") {
			// Removed narration requirement
			if (postings.length < 2)
				errors.push("At least 2 postings are required");

			for (let i = 0; i < postings.length; i++) {
				if (!postings[i].account) {
					errors.push(`Posting ${i + 1}: Account is required`);
				}

				const posting = postings[i];

				// Validate cost if present
				if (
					posting.cost &&
					(posting.cost.number ||
						posting.cost.date ||
						posting.cost.label)
				) {
					// Cost requires amount and currency on posting
					if (!posting.amount || !posting.currency) {
						errors.push(
							`Posting ${i + 1}: Cost requires an amount and currency`,
						);
					}

					// Cost number must be positive if specified
					if (posting.cost.number) {
						const costNum = parseFloat(posting.cost.number);
						if (isNaN(costNum) || costNum <= 0) {
							errors.push(
								`Posting ${i + 1}: Cost amount must be a positive number`,
							);
						}
					}

					// Cost date must be <= transaction date if specified
					if (posting.cost.date) {
						if (posting.cost.date > date) {
							errors.push(
								`Posting ${i + 1}: Cost date cannot be after transaction date`,
							);
						}
					}

					// Cost currency is required if cost number is specified
					if (posting.cost.number && !posting.cost.currency) {
						errors.push(
							`Posting ${i + 1}: Cost currency is required`,
						);
					}
				}

				// Validate price if present
				if (posting.price && posting.price.amount) {
					// Price requires amount and currency on posting
					if (!posting.amount || !posting.currency) {
						errors.push(
							`Posting ${i + 1}: Price requires an amount and currency`,
						);
					}

					// Price amount must be positive
					const priceNum = parseFloat(posting.price.amount);
					if (isNaN(priceNum) || priceNum <= 0) {
						errors.push(
							`Posting ${i + 1}: Price amount must be a positive number`,
						);
					}

					// Price currency is required
					if (!posting.price.currency) {
						errors.push(
							`Posting ${i + 1}: Price currency is required`,
						);
					}
				}

				// Validate posting flag if present
				if (
					posting.flag &&
					posting.flag !== "*" &&
					posting.flag !== "!"
				) {
					errors.push(`Posting ${i + 1}: Flag must be either * or !`);
				}

				// Validate posting metadata keys
				if (posting.metadata) {
					for (const key of Object.keys(posting.metadata)) {
						if (!/^[a-z0-9_-]+$/.test(key)) {
							errors.push(
								`Posting ${i + 1}: Metadata key "${key}" must be lowercase with only letters, numbers, hyphens, or underscores`,
							);
						}
					}
				}
			}

			// Validate transaction metadata keys
			for (const key of Object.keys(transactionMetadata)) {
				if (!/^[a-z0-9_-]+$/.test(key)) {
					errors.push(
						`Transaction metadata key "${key}" must be lowercase with only letters, numbers, hyphens, or underscores`,
					);
				}
			}

			// Validate tags (no spaces, valid characters)
			for (const tag of selectedTags) {
				if (/\s/.test(tag)) {
					errors.push(
						`Tag "${tag}" contains spaces (not allowed in Beancount)`,
					);
				}
				if (!/^[a-zA-Z0-9_-]+$/.test(tag)) {
					errors.push(
						`Tag "${tag}" contains invalid characters (use only letters, numbers, hyphens, underscores)`,
					);
				}
			}

			// Validate links (no spaces, valid characters)
			for (const link of selectedLinks) {
				if (/\s/.test(link)) {
					errors.push(
						`Link "${link}" contains spaces (not allowed in Beancount)`,
					);
				}
				if (!/^[a-zA-Z0-9_-]+$/.test(link)) {
					errors.push(
						`Link "${link}" contains invalid characters (use only letters, numbers, hyphens, underscores)`,
					);
				}
			}

			// Validate that max one posting has an empty amount
			const emptyAmountPostings = postings.filter(
				(p) => p.amount === null || p.amount === "",
			);
			if (emptyAmountPostings.length > 1) {
				errors.push(
					"Only one posting can have an empty amount (to be auto-calculated)",
				);
			}
		} else if (activeTab === "balance") {
			if (!balanceAccount)
				errors.push("Account is required for balance assertion");
			if (
				balanceAmount === "" ||
				balanceAmount === null ||
				balanceAmount === undefined
			)
				errors.push("Amount is required for balance assertion");
			if (!balanceCurrency)
				errors.push("Currency is required for balance assertion");
		} else if (activeTab === "note") {
			if (!noteAccount) errors.push("Account is required for note");
			if (!noteComment) errors.push("Comment is required for note");
		} else if (activeTab === "query") {
			if (!queryName.trim()) errors.push("Query name is required");
			if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(queryName.trim())) errors.push("Query name must start with a letter and contain only letters, numbers, hyphens, or underscores");
			if (!querySql.trim()) errors.push("SQL is required");
		}

		return errors.length === 0;
	}

	// Save entry (transaction, balance, or note)
	async function saveEntry() {
		if (!validateForm()) return;

		saving = true;

		let entryData: any;

		if (activeTab === "transaction") {
			entryData = {
				type: "transaction",
				date,
				flag: flag || "*",
				payee: payee || null,
				narration,
				postings: postings.map((p) => {
					const posting: any = {
						account: p.account,
						amount: p.amount,
						currency: p.currency,
					};

					// Only include cost if at least one field is filled
					if (
						p.cost &&
						(p.cost.number || p.cost.date || p.cost.label)
					) {
						posting.cost = {
							number: p.cost.number || null,
							currency: p.cost.currency || null,
							date: p.cost.date || null,
							label: p.cost.label || null,
							isTotal: p.cost.isTotal || false,
						};
					}

					// Only include price if amount is filled
					if (p.price && p.price.amount) {
						posting.price = {
							amount: p.price.amount,
							currency: p.price.currency,
							isTotal: p.price.isTotal || false,
						};
					}

					// Include posting flag if set
					if (p.flag) {
						posting.flag = p.flag;
					}

					// Include comment if set
					if (p.comment) {
						posting.comment = p.comment;
					}

					// Include metadata if not empty
					if (p.metadata && Object.keys(p.metadata).length > 0) {
						posting.metadata = p.metadata;
					}

					return posting;
				}),
				tags: selectedTags,
				links: selectedLinks,
			};

			// Include transaction metadata if not empty
			if (Object.keys(transactionMetadata).length > 0) {
				entryData.metadata = transactionMetadata;
			}
		} else if (activeTab === "balance") {
			entryData = {
				type: "balance",
				date,
				account: balanceAccount,
				amount: balanceAmount,
				currency: balanceCurrency,
			};
		} else if (activeTab === "note") {
			entryData = {
				type: "note",
				date,
				account: noteAccount,
				comment: noteComment,
			};
		} else if (activeTab === "query") {
			entryData = {
				type: "query",
				date,
				name: queryName.trim(),
				sql: querySql.trim(),
			};
		}

		if (mode === "edit") {
			dispatch("save", entryData);
		} else {
			dispatch("add", entryData);
		}

		saving = false;
	}

	// Cancel editing
	function cancel() {
		dispatch("cancel");
	}

	// Handle tag input
	function handleTagInput(event: Event) {
		const target = event.target as HTMLInputElement;
		const value = target.value;
		if (
			event instanceof KeyboardEvent &&
			event.key === "Enter" &&
			value.trim()
		) {
			event.preventDefault();
			if (!selectedTags.includes(value.trim())) {
				selectedTags = [...selectedTags, value.trim()];
			}
			target.value = "";
		}
	}

	// Remove tag
	function removeTag(tag: string) {
		selectedTags = selectedTags.filter((t) => t !== tag);
	}

	// Link handling
	function handleLinkInput(event: Event) {
		const target = event.target as HTMLInputElement;
		const value = target.value;
		if (
			event instanceof KeyboardEvent &&
			event.key === "Enter" &&
			value.trim()
		) {
			event.preventDefault();
			// Strip ^ prefix if user includes it
			const linkValue = value.trim().replace(/^\^/, "");
			if (linkValue && !selectedLinks.includes(linkValue)) {
				selectedLinks = [...selectedLinks, linkValue];
			}
			target.value = "";
		}
	}

	// Remove link
	function removeLink(link: string) {
		selectedLinks = selectedLinks.filter((l) => l !== link);
	}

	// Delete transaction (only available in edit mode)
	function confirmDelete() {
		if (mode !== "edit" || !transaction) return;
		showDeleteConfirm = true;
	}

	function cancelDelete() {
		showDeleteConfirm = false;
	}

	async function deleteEntry() {
		if (mode !== "edit" || (!transaction && !entry)) return;
		deleting = true;
		const entryId = transaction?.id || entry?.id;
		dispatch("delete", entryId);
		deleting = false;
	}
</script>

<div class="transaction-edit-modal">
	<!-- Header removed to use native Obsidian modal header -->

	<div class="modal-content">
		<!-- Entry Type Tabs -->
		{#if mode === "add"}
			<div class="entry-tabs">
				<button
					class="tab-button {activeTab === 'transaction'
						? 'active'
						: ''}"
					on:click={() => (activeTab = "transaction")}
				>
					💰 Transaction
				</button>
				<button
					class="tab-button {activeTab === 'balance' ? 'active' : ''}"
					on:click={() => (activeTab = "balance")}
				>
					⚖️ Balance
				</button>
				<button
					class="tab-button {activeTab === 'note' ? 'active' : ''}"
					on:click={() => (activeTab = "note")}
				>
					📝 Note
				</button>
				<button
					class="tab-button {activeTab === 'query' ? 'active' : ''}"
					on:click={() => (activeTab = "query")}
				>
					🔍 Query
				</button>
			</div>
		{/if}

		{#if errors.length > 0}
			<div class="errors">
				{#each errors as error}
					<div class="error">{error}</div>
				{/each}
			</div>
		{/if}

		<!-- Transaction Form -->
		{#if activeTab === "transaction"}
			<!-- Transaction Header: Date | Flag | Payee | Narration | Metadata -->
			<div class="transaction-header-row">
				<div class="form-group header-date">
					<label for="date">Date *</label>
					<input type="date" id="date" bind:value={date} required />
				</div>

				<div class="form-group header-flag">
					<label for="flag">Flag</label>
					<select id="flag" bind:value={flag}>
						<option value="*">* Complete</option>
						<option value="!">! Incomplete</option>
					</select>
				</div>

				<div class="form-group header-payee">
					<label for="payee">Payee</label>
					<input
						type="text"
						id="payee"
						bind:value={payee}
						list="payees-list"
						placeholder="Store name"
					/>
					<datalist id="payees-list">
						{#each payees as payeeOption}
							<option value={payeeOption} />
						{/each}
					</datalist>
				</div>

				<div class="form-group header-narration">
					<label for="narration">Narration</label>
					<input
						type="text"
						id="narration"
						bind:value={narration}
						placeholder="Description"
					/>
				</div>

				<div class="header-metadata-btn">
					<button
						type="button"
						class="metadata-toggle-btn"
						class:active={showTransactionMetadata}
						on:click={toggleTransactionMetadata}
						title="Transaction Metadata"
					>
						📋
					</button>
				</div>
			</div>

			<!-- Transaction Metadata Section (expandable) -->
			{#if showTransactionMetadata}
				<div class="transaction-metadata-section">
					<h5>Transaction Metadata</h5>
					<div class="metadata-list">
						{#each Object.keys(transactionMetadata) as key}
							<div class="metadata-item">
								<input
									type="text"
									value={key}
									placeholder="key"
									class="metadata-key"
									on:change={(e) =>
										updateTransactionMetadataKey(
											key,
											e.currentTarget.value,
										)}
								/>
								<input
									type="text"
									bind:value={transactionMetadata[key]}
									placeholder="value"
									class="metadata-value"
								/>
								<button
									type="button"
									class="remove-metadata"
									on:click={() =>
										removeTransactionMetadata(key)}
								>
									🗑️
								</button>
							</div>
						{/each}
						<button
							type="button"
							class="add-metadata-btn"
							on:click={addTransactionMetadata}
						>
							+ Add Metadata
						</button>
					</div>
				</div>
			{/if}

			<!-- Postings -->
			<div class="postings-section">
				{#each postings as posting, index}
					<div class="posting-container">
						<div class="posting-row">
							<div class="posting-account">
						<label for="posting-account-{index}">Account *</label>
						<input
							id="posting-account-{index}"
							type="text"
							bind:value={posting.account}
							list="accounts-list"
							placeholder="Account name"
							required
						/>
					</div>

					<div class="posting-amount">
						<label for="posting-amount-{index}">Amount</label>
						<input
							id="posting-amount-{index}"
							type="number"
							step="0.01"
							bind:value={posting.amount}
							placeholder="Optional amount"
						/>
					</div>

					<div class="posting-currency">
						<label for="posting-currency-{index}">Currency</label>
						<input
							id="posting-currency-{index}"
									bind:value={posting.currency}
									list="currencies-list"
									placeholder="INR"
									maxlength="3"
								/>
							</div>

							<div class="posting-toggle-buttons">
								<button
									type="button"
									class="posting-toggle-btn cost-btn"
									class:active={showCost[index]}
									on:click={() => toggleCost(index)}
									title="Cost"
								>
									$
								</button>
								<button
									type="button"
									class="posting-toggle-btn price-btn"
									class:active={showPrice[index]}
									on:click={() => togglePrice(index)}
									title="Price"
								>
									@
								</button>
								<button
									type="button"
									class="posting-toggle-btn flag-btn"
									class:active={showPostingFlag[index]}
									on:click={() => togglePostingFlag(index)}
									title="Flag"
								>
									!
								</button>
								<button
									type="button"
									class="posting-toggle-btn comment-btn"
									class:active={showPostingComment[index]}
									on:click={() => togglePostingComment(index)}
									title="Comment"
								>
									💬
								</button>
								<button
									type="button"
									class="posting-toggle-btn metadata-btn"
									class:active={showPostingMetadata[index]}
									on:click={() =>
										togglePostingMetadata(index)}
									title="Metadata"
								>
									📋
								</button>
								{#if postings.length > 2}
									<button
										type="button"
										class="remove-posting"
										on:click={() => removePosting(index)}
										title="Remove posting"
									>
										🗑️
									</button>
								{/if}
							</div>
						</div>

						<!-- Cost Section -->
						{#if showCost[index]}
							<div class="posting-advanced cost-section">
								<div class="advanced-grid">
									<div class="advanced-field">
									<label for="cost-amount-{index}">Amount</label>
									<input
										id="cost-amount-{index}"
										type="number"
										step="0.01"
										bind:value={posting.cost.number}
										placeholder="150.00"
									/>
								</div>

								<div class="advanced-field">
									<label for="cost-currency-{index}">Currency</label>
									<input
									id="cost-currency-{index}"
										type="text"
										bind:value={posting.cost.currency}
										list="currencies-list"
										placeholder="USD"
										maxlength="3"
									/>
								</div>

								<div class="advanced-field">
									<label for="cost-date-{index}">Date</label>
									<input
										id="cost-date-{index}"
										type="date"
										bind:value={posting.cost.date}
										max={date}
									/>
								</div>

								<div class="advanced-field">
									<label for="cost-label-{index}">Label</label>
									<input
										id="cost-label-{index}"
											bind:value={posting.cost.label}
											placeholder="lot-001"
										/>
									</div>

									<div class="advanced-field checkbox-field">
										<label>
											<input
												type="checkbox"
												bind:checked={
													posting.cost.isTotal
												}
											/>
											Total Cost {{}}
										</label>
									</div>
								</div>
							</div>
						{/if}

						<!-- Price Section -->
						{#if showPrice[index]}
							<div class="posting-advanced price-section">
								<div class="advanced-grid">
									<div class="advanced-field">
									<label for="price-amount-{index}">Amount</label>
									<input
										id="price-amount-{index}"
										type="number"
										step="0.01"
										bind:value={posting.price.amount}
										placeholder="1.09"
									/>
								</div>

								<div class="advanced-field">
									<label for="price-currency-{index}">Currency</label>
									<input
										id="price-currency-{index}"
											list="currencies-list"
											placeholder="CAD"
											maxlength="3"
										/>
									</div>

									<div class="advanced-field checkbox-field">
										<label>
											<input
												type="checkbox"
												bind:checked={
													posting.price.isTotal
												}
											/>
											Total Price @@
										</label>
									</div>
								</div>
							</div>
						{/if}

						<!-- Posting Flag Section -->
						{#if showPostingFlag[index]}
							<div class="posting-advanced flag-section">
								<div class="flag-field">
									<label>
										<input
											type="radio"
											bind:group={posting.flag}
											value="!"
										/>
										! Incomplete
									</label>
									<label>
										<input
											type="radio"
											bind:group={posting.flag}
											value="*"
										/>
										* Complete
									</label>
								</div>
							</div>
						{/if}

						<!-- Comment Section -->
						{#if showPostingComment[index]}
							<div class="posting-advanced comment-section">
							<label for="posting-comment-{index}">Comment</label>
							<input
								id="posting-comment-{index}"
									placeholder="Inline comment"
									class="comment-input"
								/>
							</div>
						{/if}

						<!-- Posting Metadata Section -->
						{#if showPostingMetadata[index]}
							<div class="posting-advanced metadata-section">
								<div class="metadata-list">
									{#each Object.keys(posting.metadata || {}) as key}
										<div class="metadata-item">
											<input
												type="text"
												value={key}
												placeholder="key"
												class="metadata-key"
												on:change={(e) =>
													updatePostingMetadataKey(
														index,
														key,
														e.currentTarget.value,
													)}
											/>
											<input
												type="text"
												bind:value={
													posting.metadata[key]
												}
												placeholder="Value"
												class="metadata-value"
											/>
											<button
												type="button"
												class="remove-metadata"
												on:click={() =>
													removePostingMetadata(
														index,
														key,
													)}
											>
												🗑️
											</button>
										</div>
									{/each}
									<button
										type="button"
										class="add-metadata-btn"
										on:click={() =>
											addPostingMetadata(index)}
									>
										+ Add Metadata
									</button>
								</div>
							</div>
						{/if}
					</div>
				{/each}

				<button type="button" class="add-posting" on:click={addPosting}>
					+ Add Posting
				</button>
			</div>

			<!-- Tags & Links (side-by-side) -->
			<div class="tags-links-section">
				<div class="tags-links-row">
					<div class="form-group">
						<label for="tags">Tags</label>
						<input
							type="text"
							id="tags"
							on:keydown={handleTagInput}
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
									<span class="tag"
										>#{tag}<button
											type="button"
											on:click={() => removeTag(tag)}
											>&times;</button
										></span
									>
								{/each}
							</div>
						{/if}
					</div>
					<div class="form-group">
						<label for="links">Links</label>
						<input
							type="text"
							id="links"
							on:keydown={handleLinkInput}
							placeholder="Link + Enter"
						/>
						{#if selectedLinks.length > 0}
							<div class="selected-links">
								{#each selectedLinks as link}
									<span class="link"
										>^{link}<button
											type="button"
											on:click={() => removeLink(link)}
											>&times;</button
										></span
									>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/if}

		<!-- Balance Form -->
		{#if activeTab === "balance"}
			<div class="form-grid">
				<div class="form-group">
					<label for="balance-date">Date *</label>
					<input
						type="date"
						id="balance-date"
						bind:value={date}
						required
					/>
				</div>

				<div class="form-group full-width">
					<label for="balance-account">Account *</label>
					<input
						type="text"
						id="balance-account"
						bind:value={balanceAccount}
						list="accounts-list"
						placeholder="Account to check balance"
						required
					/>
				</div>

				<div class="form-group">
					<label for="balance-amount">Amount *</label>
					<input
						type="number"
						step="0.01"
						id="balance-amount"
						bind:value={balanceAmount}
						placeholder="Expected balance"
						required
					/>
				</div>

				<div class="form-group">
					<label for="balance-currency">Currency *</label>
					<input
						type="text"
						id="balance-currency"
						bind:value={balanceCurrency}
						list="currencies-list"
						placeholder="INR"
						maxlength="3"
						required
					/>
				</div>
			</div>
		{/if}

		<!-- Note Form -->
		{#if activeTab === "note"}
			<div class="form-grid">
				<div class="form-group">
					<label for="note-date">Date *</label>
					<input
						type="date"
						id="note-date"
						bind:value={date}
						required
					/>
				</div>

				<div class="form-group full-width">
					<label for="note-account">Account *</label>
					<input
						type="text"
						id="note-account"
						bind:value={noteAccount}
						list="accounts-list"
						placeholder="Account for the note"
						required
					/>
				</div>

				<div class="form-group full-width">
					<label for="note-comment">Comment *</label>
					<textarea
						id="note-comment"
						bind:value={noteComment}
						placeholder="Note content"
						required
						rows="3"
					></textarea>
				</div>
			</div>
		{/if}

		<!-- Query Form -->
		{#if activeTab === "query"}
			<div class="form-grid">
				<div class="form-group">
					<label for="query-date">Date *</label>
					<input
						type="date"
						id="query-date"
						bind:value={date}
						required
					/>
				</div>

				<div class="form-group full-width">
					<label for="query-name">Query name *</label>
					<input
						type="text"
						id="query-name"
						bind:value={queryName}
						placeholder="e.g. my_expenses"
						required
					/>
					<small style="color: var(--text-muted)">Use in notes with <code>bql-q:{queryName || 'name'}</code></small>
				</div>

				<div class="form-group full-width">
					<label for="query-sql">SQL *</label>
					<textarea
						id="query-sql"
						bind:value={querySql}
						placeholder="SELECT account, sum(position) WHERE account ~ 'Expenses' GROUP BY account"
						required
						rows="4"
						style="font-family: monospace; font-size: 0.9em;"
					></textarea>
					<button
						type="button"
						class="btn-test-query"
						on:click={testQuerySQL}
						disabled={queryTesting || !querySql.trim()}
					>
						{queryTesting ? "Running..." : "▶ Test Query"}
					</button>
				</div>

				{#if queryTestError}
					<div class="form-group full-width">
						<div class="query-test-error">
							<strong>Error:</strong> {queryTestError}
						</div>
					</div>
				{/if}

				{#if queryTestRows.length > 0}
					<div class="form-group full-width">
						<div class="query-test-results">
							<small style="color: var(--text-muted); display:block; margin-bottom:0.4rem;">
								Preview {Math.min(queryTestRows.length - 1, 5)} row(s)
							</small>
							<table class="query-preview-table">
								<thead>
									<tr>{#each queryTestRows[0] as h}<th>{h}</th>{/each}</tr>
								</thead>
								<tbody>
									{#each queryTestRows.slice(1) as row}
										<tr>{#each row as cell}<td>{cell}</td>{/each}</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Saved Queries Browser -->
		{#if activeTab === "query"}
			<div class="saved-queries-section">
				<div class="saved-queries-header">
					<span>Saved Named Queries</span>
					<button
						type="button"
						class="btn-refresh-queries"
						on:click={() => { savedQueriesLoaded = false; loadSavedQueries(); }}
						disabled={savedQueriesLoading}
						title="Refresh list"
					>↻</button>
				</div>
				{#if savedQueriesLoading}
					<p class="saved-queries-empty">Loading…</p>
				{:else if Object.keys(savedQueries).length === 0}
					<p class="saved-queries-empty">No named queries saved yet.</p>
				{:else}
					<ul class="saved-queries-list">
						{#each Object.entries(savedQueries) as [name, sql]}
							<li class="saved-query-item">
								<div class="saved-query-info">
									<code class="saved-query-name">bql-q:{name}</code>
									<span class="saved-query-sql">{sql}</span>
								</div>
								<button
									type="button"
									class="btn-load-query"
									on:click={() => loadQueryIntoForm(name, sql)}
									title="Load into editor"
								>Load</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/if}
		<datalist id="accounts-list">
			{#each accounts as account}
				<option value={account} />
			{/each}
		</datalist>

		<!-- Shared currencies datalist -->
		<datalist id="currencies-list">
			{#each currencies as currency}
				<option value={currency} />
			{/each}
		</datalist>
	</div>

	<!-- Modal Footer -->
	<div class="modal-footer">
		<div class="footer-left">
			{#if mode === "edit"}
				<button
					type="button"
					class="btn-danger"
					on:click={confirmDelete}
					disabled={deleting}
				>
					{deleting ? "Deleting..." : "Delete"}
				</button>
			{/if}
		</div>

		<div class="footer-right">
			<button type="button" class="btn-secondary" on:click={cancel}>
				Cancel
			</button>
			<button
				type="button"
				class="btn-primary"
				on:click={saveEntry}
				disabled={saving}
			>
				{saving
					? "Saving..."
					: mode === "edit"
						? "Save Changes"
						: "Add " +
							activeTab.charAt(0).toUpperCase() +
							activeTab.slice(1)}
			</button>
		</div>
	</div>
</div>

<svelte:window on:keydown={(e) => e.key === 'Escape' && showDeleteConfirm && cancelDelete()} />

<!-- Delete Confirmation Dialog -->
{#if showDeleteConfirm}
	<div class="confirm-overlay">
		<button class="confirm-backdrop" type="button" on:click={cancelDelete} aria-label="Close dialog"></button>
		<div class="confirm-dialog" role="dialog" aria-modal="true" tabindex="-1">
			<h4>
				Delete {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
			</h4>
			<p>
				Are you sure you want to delete this {activeTab}? This action
				cannot be undone.
			</p>
			<div class="confirm-actions">
				<button
					type="button"
					class="btn-secondary"
					on:click={cancelDelete}
				>
					Cancel
				</button>
				<button type="button" class="btn-danger" on:click={deleteEntry}>
					Delete
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	/* ─── Compact Modal ──────────────────────────────────────────── */
	.transaction-edit-modal {
		/* container sizing handled by Obsidian */
	}

	/* Removed .modal-header and related styles */

	.modal-content {
		padding: 0.75rem 1rem;
	}

	.errors {
		background: var(--background-modifier-error);
		border: 1px solid var(--text-error);
		border-radius: 4px;
		padding: 0.5rem 0.75rem;
		margin-bottom: 0.5rem;
	}

	.error {
		color: var(--text-error);
		margin: 0.25rem 0;
		font-weight: 500;
	}

	.form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
	}

	.form-group.full-width {
		grid-column: 1 / -1;
	}

	.form-group label {
		font-size: 0.8rem;
		font-weight: 500;
		margin-bottom: 0.2rem;
		color: var(--text-muted);
	}

	.form-group input {
		padding: 0.3rem 0.5rem;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		background: var(--background-primary);
		color: var(--text-normal);
		font-size: 0.875rem;
	}

	.form-group input:focus {
		outline: none;
		border-color: var(--interactive-accent);
	}

	.postings-section {
		margin-bottom: 1.5rem;
	}

	.postings-section h4 {
		margin: 0 0 0.75rem 0;
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.posting-container {
		margin-bottom: 0.75rem;
		padding: 1rem 1.25rem;
		background: var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		border-radius: 6px;
	}

	.posting-row {
		display: grid;
		grid-template-columns: 3fr 1.2fr 1fr auto;
		gap: 1rem;
		align-items: end;
	}

	.posting-advanced-toggle {
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--background-modifier-border);
	}

	.toggle-advanced {
		background: none;
		border: none;
		color: var(--text-accent);
		cursor: pointer;
		padding: 0.5rem 0;
		font-size: 0.875rem;
		font-weight: 500;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.toggle-advanced:hover {
		color: var(--text-accent-hover);
	}

	.posting-advanced {
		margin-top: 1rem;
		padding: 1rem;
		background: var(--background-primary);
		border-radius: 4px;
		border: 1px solid var(--background-modifier-border);
	}

	.advanced-section {
		margin-bottom: 1.5rem;
	}

	.advanced-section:last-of-type {
		margin-bottom: 1rem;
	}

	.advanced-section h5 {
		margin: 0 0 0.75rem 0;
		color: var(--text-normal);
		font-size: 0.9rem;
		font-weight: 600;
	}

	.advanced-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 0.5rem;
	}

	.advanced-field {
		display: flex;
		flex-direction: column;
	}

	.advanced-field label {
		font-size: 0.8rem;
		font-weight: 500;
		margin-bottom: 0.25rem;
		color: var(--text-muted);
	}

	.advanced-field input[type="number"],
	.advanced-field input[type="text"],
	.advanced-field input[type="date"] {
		padding: 0.25rem 0.4rem;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		background: var(--background-modifier-form-field);
		color: var(--text-normal);
		font-size: 0.8rem;
	}

	.advanced-field.checkbox-field {
		flex-direction: row;
		align-items: center;
		gap: 0.5rem;
	}

	.advanced-field.checkbox-field label {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}

	.advanced-field.checkbox-field input[type="checkbox"] {
		cursor: pointer;
	}

	.field-hint {
		font-size: 0.75rem;
		color: var(--text-faint);
		margin-top: 0.25rem;
		font-style: italic;
	}

	.advanced-help {
		padding: 1rem;
		background: var(--background-secondary);
		border-radius: 4px;
		border-left: 3px solid var(--interactive-accent);
		font-size: 0.85rem;
	}

	.advanced-help strong {
		color: var(--text-normal);
		display: block;
		margin-bottom: 0.5rem;
	}

	.advanced-help ul {
		margin: 0;
		padding-left: 1.5rem;
		color: var(--text-muted);
	}

	.advanced-help li {
		margin: 0.25rem 0;
		line-height: 1.4;
	}

	.posting-account,
	.posting-amount,
	.posting-currency {
		display: flex;
		flex-direction: column;
	}

	.posting-account label,
	.posting-amount label,
	.posting-currency label {
		font-size: 0.75rem;
		font-weight: 500;
		margin-bottom: 0.15rem;
		color: var(--text-muted);
	}

	.posting-account input,
	.posting-amount input,
	.posting-currency input {
		padding: 0.3rem 0.5rem;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		background: var(--background-primary);
		color: var(--text-normal);
		font-size: 0.875rem;
	}

	.remove-posting {
		background: var(--background-modifier-error);
		color: var(--text-error);
		border: none;
		border-radius: 4px;
		width: 2rem;
		height: 2rem;
		cursor: pointer;
		font-size: 1.2rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.remove-posting:hover:not(:disabled) {
		background: var(--text-error);
		color: var(--text-on-accent);
	}

	.remove-posting:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.add-posting {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		border: none;
		border-radius: 4px;
		padding: 0.35rem 0.75rem;
		cursor: pointer;
		font-size: 0.85rem;
		font-weight: 500;
	}

	.add-posting:hover {
		background: var(--interactive-accent-hover);
	}

	.selected-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.tag {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.875rem;
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.tag button {
		background: none;
		border: none;
		color: inherit;
		cursor: pointer;
		padding: 0;
		margin-left: 0.25rem;
	}

	.modal-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 1rem;
		border-top: 1px solid var(--background-modifier-border);
		background: var(--background-secondary);
	}

	.footer-left {
		display: flex;
	}

	.footer-right {
		display: flex;
		gap: 0.5rem;
	}

	.btn-secondary,
	.btn-primary,
	.btn-danger {
		padding: 0.4rem 1rem;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 500;
		transition: background-color 0.2s;
	}

	.btn-secondary {
		background: var(--background-modifier-border);
		color: var(--text-normal);
	}

	.btn-secondary:hover {
		background: var(--background-modifier-hover);
	}

	.btn-primary {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
	}

	.btn-primary:hover:not(:disabled) {
		background: var(--interactive-accent-hover);
	}

	.btn-primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-danger {
		background: var(--text-error);
		color: var(--text-on-accent);
	}

	.btn-danger:hover:not(:disabled) {
		background: var(--text-error);
		opacity: 0.8;
	}

	.btn-danger:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	/* Confirmation Dialog */
	.confirm-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 2000;
	}

	.confirm-backdrop {
		position: absolute;
		inset: 0;
		background: transparent;
		border: none;
		cursor: default;
		padding: 0;
	}

	.confirm-dialog {
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: 8px;
		padding: 2rem;
		max-width: 400px;
		width: 90%;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
	}

	.confirm-dialog h4 {
		margin: 0 0 1rem 0;
		color: var(--text-normal);
		font-size: 1.25rem;
	}

	.confirm-dialog p {
		margin: 0 0 1.5rem 0;
		color: var(--text-muted);
		line-height: 1.5;
	}

	.confirm-actions {
		display: flex;
		justify-content: flex-end;
		gap: 1rem;
	}

	/* Entry Type Tabs */
	.entry-tabs {
		display: flex;
		gap: 0.25rem;
		margin-bottom: 0.75rem;
		border-bottom: 1px solid var(--background-modifier-border);
		padding-bottom: 0.25rem;
	}

	.tab-button {
		background: none;
		border: none;
		padding: 0.4rem 0.75rem;
		cursor: pointer;
		color: var(--text-muted);
		font-size: 0.85rem;
		border-radius: 4px 4px 0 0;
		border-bottom: 2px solid transparent;
		transition: all 0.2s ease;
		white-space: nowrap;
	}

	.tab-button:hover {
		background: var(--background-modifier-hover);
		color: var(--text-normal);
	}

	.tab-button.active {
		color: var(--text-accent);
		border-bottom-color: var(--text-accent);
		background: var(--background-modifier-form-field);
	}

	/* Form adaptations for different entry types */
	textarea {
		font-family: inherit;
		font-size: inherit;
		padding: 0.5rem;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		background: var(--background-modifier-form-field);
		color: var(--text-normal);
		resize: vertical;
		min-height: 60px;
	}

	textarea:focus {
		outline: none;
		border-color: var(--text-accent);
		box-shadow: 0 0 0 2px var(--background-modifier-border-focus);
	}

	/* Transaction Header Row */
	.transaction-header-row {
		display: grid;
		grid-template-columns: 140px 110px 1fr 2fr auto;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
		align-items: end;
	}

	.header-date,
	.header-flag,
	.header-payee,
	.header-narration {
		display: flex;
		flex-direction: column;
	}

	.header-flag select {
		padding: 0.5rem;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		background: var(--background-primary);
		color: var(--text-normal);
		font-size: 0.9rem;
	}

	.header-metadata-btn {
		display: flex;
		align-items: flex-end;
		padding-bottom: 2px;
	}

	/* Transaction Metadata Section */
	.transaction-metadata-section {
		margin-bottom: 0.5rem;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--interactive-accent);
		border-radius: 6px;
		background: var(--background-secondary);
	}

	.transaction-metadata-section h5 {
		margin: 0 0 0.75rem 0;
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
	}

	.metadata-toggle-btn {
		background: var(--background-modifier-form-field);
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		padding: 0.3rem 0.5rem;
		cursor: pointer;
		font-size: 1rem;
		transition: all 0.2s;
	}

	.metadata-toggle-btn:hover {
		background: var(--background-modifier-hover);
	}

	.metadata-toggle-btn.active {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
	}

	/* Posting Toggle Buttons */
	.posting-toggle-buttons {
		display: flex;
		gap: 0.25rem;
		align-items: center;
	}

	.posting-toggle-btn {
		background: var(--background-modifier-form-field);
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		padding: 0.25rem 0.4rem;
		cursor: pointer;
		font-size: 0.8rem;
		font-weight: bold;
		min-width: 1.8rem;
		transition: all 0.2s;
	}

	.posting-toggle-btn:hover {
		background: var(--background-modifier-hover);
	}

	.posting-toggle-btn.active {
		background: var(--interactive-accent);
		border-color: var(--interactive-accent);
		color: var(--text-on-accent);
	}

	.remove-posting {
		background: var(--background-modifier-error);
		border: 1px solid var(--text-error);
		border-radius: 4px;
		padding: 0.5rem;
		cursor: pointer;
		font-size: 0.9rem;
		transition: all 0.2s;
	}

	.remove-posting:hover {
		opacity: 0.8;
	}

	/* Posting Advanced Sections */
	.posting-advanced {
		margin-top: 0.35rem;
		padding: 0.4rem 0.6rem;
		border-radius: 4px;
		background: var(--background-secondary);
	}

	.posting-advanced.cost-section,
	.posting-advanced.price-section,
	.posting-advanced.flag-section,
	.posting-advanced.comment-section,
	.posting-advanced.metadata-section {
		border-left: 3px solid var(--interactive-accent);
	}

	.flag-field {
		display: flex;
		gap: 1rem;
	}

	.flag-field label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}

	.comment-input {
		width: 100%;
		padding: 0.5rem;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		background: var(--background-primary);
		color: var(--text-normal);
	}

	/* Metadata UI */
	.metadata-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.metadata-item {
		display: grid;
		grid-template-columns: 1fr 2fr auto;
		gap: 0.5rem;
		align-items: center;
	}

	.metadata-key,
	.metadata-value {
		padding: 0.5rem;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		background: var(--background-primary);
		color: var(--text-normal);
	}

	.remove-metadata {
		background: var(--background-modifier-error);
		border: 1px solid var(--text-error);
		border-radius: 4px;
		padding: 0.5rem;
		cursor: pointer;
		font-size: 0.9rem;
	}

	.add-metadata-btn {
		background: var(--background-modifier-form-field);
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		padding: 0.5rem 1rem;
		cursor: pointer;
		color: var(--text-normal);
		transition: all 0.2s;
		align-self: flex-start;
	}

	.add-metadata-btn:hover {
		background: var(--background-modifier-hover);
	}

	/* Tags & Links Section */
	.tags-links-section {
		margin-bottom: 0.5rem;
	}

	.tags-links-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}

	.tags-links-section h4 {
		margin: 0 0 0.75rem 0;
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.selected-links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.link {
		background: var(--background-secondary);
		border: 1px solid var(--interactive-accent);
		border-radius: 4px;
		padding: 0.25rem 0.5rem;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--interactive-accent);
		font-size: 0.9rem;
	}

	.link button {
		background: none;
		border: none;
		color: var(--interactive-accent);
		cursor: pointer;
		font-size: 1.2rem;
		line-height: 1;
		padding: 0;
	}

	.link button:hover {
		color: var(--text-error);
	}

	@media (max-width: 768px) {
		.transaction-header-row {
			grid-template-columns: 1fr;
			gap: 0.5rem;
		}

		.header-metadata-btn {
			align-items: flex-start;
			padding-bottom: 0;
		}

		.form-grid {
			grid-template-columns: 1fr;
		}

		.posting-row {
			grid-template-columns: 1fr;
			gap: 0.5rem;
		}

		.posting-actions {
			justify-self: end;
		}

		.advanced-grid {
			grid-template-columns: 1fr;
		}

		.modal-footer {
			flex-direction: column;
			gap: 1rem;
		}

		.footer-right {
			width: 100%;
			justify-content: center;
		}

		.entry-tabs {
			flex-wrap: wrap;
			gap: 0.25rem;
		}

		.tab-button {
			padding: 0.5rem 0.75rem;
			font-size: 0.8rem;
		}

		.posting-toggle-buttons {
			flex-wrap: wrap;
		}

		.metadata-item {
			grid-template-columns: 1fr;
		}
	}

	.btn-test-query {
		margin-top: 0.5rem;
		padding: 0.35rem 0.9rem;
		border: 1px solid var(--interactive-accent);
		border-radius: 4px;
		background: var(--background-modifier-form-field);
		color: var(--interactive-accent);
		cursor: pointer;
		font-size: 0.85rem;
		font-weight: 500;
		transition: all 0.2s;
	}

	.btn-test-query:hover:not(:disabled) {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
	}

	.btn-test-query:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.query-test-error {
		margin-top: 0.5rem;
		padding: 0.5rem 0.75rem;
		border-radius: 4px;
		background: var(--background-modifier-error);
		color: var(--text-error);
		font-size: 0.85rem;
		word-break: break-word;
	}

	.query-test-results {
		margin-top: 0.5rem;
		padding: 0.5rem 0.75rem;
		border-radius: 4px;
		background: var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		overflow-x: auto;
	}

	.query-preview-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8rem;
	}

	.query-preview-table th {
		text-align: left;
		padding: 0.25rem 0.5rem;
		border-bottom: 2px solid var(--background-modifier-border);
		color: var(--text-muted);
		font-weight: 600;
		white-space: nowrap;
	}

	.query-preview-table td {
		padding: 0.2rem 0.5rem;
		border-bottom: 1px solid var(--background-modifier-border);
		color: var(--text-normal);
		white-space: nowrap;
	}

	.query-preview-table tr:last-child td {
		border-bottom: none;
	}

	/* Saved Queries Browser */
	.saved-queries-section {
		margin-top: 1rem;
		border: 1px solid var(--background-modifier-border);
		border-radius: 6px;
		overflow: hidden;
	}

	.saved-queries-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.4rem 0.75rem;
		background: var(--background-secondary);
		border-bottom: 1px solid var(--background-modifier-border);
		font-size: 0.78rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted);
	}

	.btn-refresh-queries {
		background: none;
		border: none;
		cursor: pointer;
		color: var(--text-muted);
		font-size: 1rem;
		padding: 0 0.25rem;
		line-height: 1;
		transition: color 0.15s;
	}

	.btn-refresh-queries:hover:not(:disabled) {
		color: var(--text-normal);
	}

	.btn-refresh-queries:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.saved-queries-empty {
		margin: 0;
		padding: 0.6rem 0.75rem;
		font-size: 0.85rem;
		color: var(--text-muted);
	}

	.saved-queries-list {
		list-style: none;
		margin: 0;
		padding: 0;
		max-height: 200px;
		overflow-y: auto;
	}

	.saved-query-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.45rem 0.75rem;
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.saved-query-item:last-child {
		border-bottom: none;
	}

	.saved-query-item:hover {
		background: var(--background-modifier-hover);
	}

	.saved-query-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.saved-query-name {
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--text-accent);
		white-space: nowrap;
	}

	.saved-query-sql {
		font-size: 0.78rem;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.btn-load-query {
		flex-shrink: 0;
		padding: 0.2rem 0.6rem;
		border: 1px solid var(--interactive-accent);
		border-radius: 4px;
		background: transparent;
		color: var(--interactive-accent);
		cursor: pointer;
		font-size: 0.78rem;
		font-weight: 500;
		transition: all 0.15s;
	}

	.btn-load-query:hover {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
	}
</style>
