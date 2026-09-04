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
	import { nativeDatePicker } from "../actions/nativeDatePicker";
	import TabBar from "../common/TabBar.svelte";

	export let transaction: JournalTransaction | null = null; // Now optional for Add mode
	export let entry: JournalEntry | null = null; // Support for any entry type
	export let accounts: string[] = [];
	export let payees: string[] = [];
	export let tags: string[] = [];
	export let currencies: string[] = []; // Add currencies prop
	export let mode: "add" | "edit" = transaction || entry ? "edit" : "add"; // Auto-detect mode
	export let operatingCurrency: string = "INR";
	export let plugin: any = null;
	// Preselect a tab/account in add mode (e.g. the Reconciliation panel's "Balance" quick-action).
	// Ignored whenever an existing entry/transaction is being edited.
	export let initialTab: "transaction" | "balance" | "note" | "query" | null = null;
	export let initialAccount: string | null = null;

	import { SnippetSuggestModal } from "./SnippetSuggestModal";
	import { Notice } from "obsidian";

	import PostingRow from "./transaction-edit/PostingRow.svelte";
	import TagLinkInput from "./transaction-edit/TagLinkInput.svelte";
	import BalanceTabForm from "./transaction-edit/BalanceTabForm.svelte";
	import NoteTabForm from "./transaction-edit/NoteTabForm.svelte";
	import QueryTabForm from "./transaction-edit/QueryTabForm.svelte";

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
	} else if (initialTab) {
		activeTab = initialTab;
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
		entry?.type === "balance" ? (entry as JournalBalance).account : (initialAccount ?? "");
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

	// Parse Beancount transaction text into fields
	function parseBeancountTransaction(text: string) {
		const lines = text.split(/\r?\n/);
		let payee = '';
		let narration = '';
		let flag = '*';
		const tags: string[] = [];
		const links: string[] = [];
		const metadata: Record<string, string> = {};
		const postings: any[] = [];

		if (lines.length === 0) return { payee, narration, flag, tags, links, metadata, postings };

		// Header parse
		const header = lines[0].trim();
		const dateMatch = header.match(/^\d{4}-\d{2}-\d{2}\s+([*!])/);
		if (dateMatch) {
			flag = dateMatch[1];
		}

		// Extract tags from header
		const tagMatches = header.matchAll(/#([A-Za-z0-9_-]+)/g);
		for (const match of tagMatches) {
			tags.push(match[1]);
		}

		// Extract links from header
		const linkMatches = header.matchAll(/\^([A-Za-z0-9_-]+)/g);
		for (const match of linkMatches) {
			links.push(match[1]);
		}

		// Extract payee and narration quotes
		const quotes: string[] = [];
		let inQuote = false;
		let currentQuote = '';
		for (let i = 0; i < header.length; i++) {
			const char = header[i];
			if (char === '"' && (i === 0 || header[i - 1] !== '\\')) {
				if (inQuote) {
					quotes.push(currentQuote);
					currentQuote = '';
					inQuote = false;
				} else {
					inQuote = true;
				}
			} else if (inQuote) {
				currentQuote += char;
			}
		}

		if (quotes.length >= 2) {
			payee = quotes[0];
			narration = quotes[1];
		} else if (quotes.length === 1) {
			narration = quotes[0];
		}

		let hasSeenPostings = false;
		let currentPosting: any = null;

		for (let i = 1; i < lines.length; i++) {
			const line = lines[i];
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith(';')) continue;

			// Check if metadata line
			const metadataMatch = line.match(/^\s+([A-Za-z0-9_-]+):\s+(.+)/);
			if (metadataMatch) {
				const key = metadataMatch[1];
				const value = metadataMatch[2].replace(/^["']|["']$/g, '');
				if (key.toLowerCase() === 'snippet') continue;

				if (!hasSeenPostings) {
					metadata[key] = value;
				} else if (currentPosting) {
					if (!currentPosting.metadata) currentPosting.metadata = {};
					currentPosting.metadata[key] = value;
				}
				continue;
			}

			// Clean inline comment from posting line
			const commentIdx = trimmed.indexOf(';');
			let mainLine = commentIdx >= 0 ? trimmed.substring(0, commentIdx).trim() : trimmed;
			let comment = commentIdx >= 0 ? trimmed.substring(commentIdx + 1).trim() : '';

			// Extract posting flag if present
			let postingFlag: string | null = null;
			if (mainLine.startsWith('* ') || mainLine.startsWith('! ')) {
				postingFlag = mainLine[0];
				mainLine = mainLine.substring(2).trim();
			}

			const accountMatch = mainLine.match(/^([A-Z0-9][A-Za-z0-9:-]+)/);
			if (accountMatch) {
				hasSeenPostings = true;
				const account = accountMatch[1];
				let rest = mainLine.substring(account.length).trim();

				let amount = '';
				let currency = '';
				let cost: any = null;
				let price: any = null;

				if (rest) {
					// Price (starts with @ or @@)
					const priceIdx = rest.search(/@@?/);
					let priceStr = '';
					if (priceIdx >= 0) {
						priceStr = rest.substring(priceIdx).trim();
						rest = rest.substring(0, priceIdx).trim();
					}

					// Cost (starts with { or {{, ends with } or }})
					const costStartIdx = rest.indexOf('{');
					let costStr = '';
					if (costStartIdx >= 0) {
						const costEndIdx = rest.lastIndexOf('}');
						if (costEndIdx > costStartIdx) {
							costStr = rest.substring(costStartIdx, costEndIdx + 1);
							rest = rest.substring(0, costStartIdx).trim();
						}
					}

					// Amount Currency
					if (rest) {
						const parts = rest.split(/\s+/);
						if (parts.length >= 1) amount = parts[0];
						if (parts.length >= 2) currency = parts[1];
					}

					// Cost parse
					if (costStr) {
						const isTotal = costStr.startsWith('{{');
						const costInner = costStr.replace(/^\{+/, '').replace(/\}+$/, '').trim();
						const costParts = costInner.split(',').map(s => s.trim());
						let costNum = '';
						let costCurr = currency || '';
						let costDate = '';
						let costLabel = '';

						if (costParts.length >= 1) {
							const firstPart = costParts[0].split(/\s+/);
							costNum = firstPart[0];
							if (firstPart.length >= 2) costCurr = firstPart[1];
						}
						if (costParts.length >= 2) {
							if (/^\d{4}-\d{2}-\d{2}/.test(costParts[1])) {
								costDate = costParts[1];
							} else if (costParts[1].startsWith('"')) {
								costLabel = costParts[1].replace(/^"/, '').replace(/"$/, '');
							}
						}
						if (costParts.length >= 3) {
							if (costParts[2].startsWith('"')) {
								costLabel = costParts[2].replace(/^"/, '').replace(/"$/, '');
							}
						}

						cost = {
							number: costNum,
							currency: costCurr,
							date: costDate,
							label: costLabel,
							isTotal
						};
					}

					// Price parse
					if (priceStr) {
						const isTotal = priceStr.startsWith('@@');
						const priceInner = priceStr.replace(/^@@?/, '').trim();
						const priceParts = priceInner.split(/\s+/);
						let priceAmt = '';
						let priceCurr = '';

						if (priceParts.length >= 1) priceAmt = priceParts[0];
						if (priceParts.length >= 2) priceCurr = priceParts[1];

						price = {
							amount: priceAmt,
							currency: priceCurr,
							isTotal
						};
					}
				}

				currentPosting = {
					account,
					amount,
					currency,
					flag: postingFlag,
					comment,
					metadata: {},
					cost: cost || {
						number: '',
						currency: currency || 'USD',
						date: '',
						label: '',
						isTotal: false
					},
					price: price || {
						amount: '',
						currency: currency || 'USD',
						isTotal: false
					}
				};
				postings.push(currentPosting);
			}
		}

		return { payee, narration, flag, tags, links, metadata, postings };
	}

	// Open load snippet suggest modal
	function openLoadSnippetModal() {
		if (!plugin) {
			console.error("Plugin instance not found");
			return;
		}

		const snippets = plugin.snippetCompletions || [];
		if (snippets.length === 0) {
			new Notice("No snippets found. Please enable snippets and define them in snippets.beancount first.");
			return;
		}

		new SnippetSuggestModal(plugin.app, snippets, (item) => {
			const infoStr = item.info as string;
			const doubleNewlineIdx = infoStr.indexOf('\n\n');
			if (doubleNewlineIdx >= 0) {
				const templateText = infoStr.substring(doubleNewlineIdx + 2);
				const parsed = parseBeancountTransaction(templateText);

				payee = parsed.payee;
				narration = parsed.narration;
				flag = parsed.flag;
				postings = parsed.postings;
				selectedTags = parsed.tags;
				selectedLinks = parsed.links;
				transactionMetadata = parsed.metadata;
				showTransactionMetadata = Object.keys(transactionMetadata).length > 0;

				// Refresh Svelte reactive expandable lists
				showCost = postings.map(p => p.cost && (p.cost.number || p.cost.date || p.cost.label));
				showPrice = postings.map(p => p.price && p.price.amount);
				showPostingFlag = postings.map(p => !!p.flag);
				showPostingComment = postings.map(p => !!p.comment);
				showPostingMetadata = postings.map(p => p.metadata && Object.keys(p.metadata).length > 0);

				new Notice(`Loaded snippet: ${item.label}`);
			}
		}).open();
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
				<TabBar
					tabs={[
						{ value: 'transaction', label: '💰 Transaction' },
						{ value: 'balance', label: '⚖️ Balance' },
						{ value: 'note', label: '📝 Note' },
						{ value: 'query', label: '🔍 Query' },
					]}
					bind:value={activeTab}
					fullWidth={false}
					ariaLabel="Entry type"
				/>
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
					<input type="date" id="date" bind:value={date} required use:nativeDatePicker />
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
									&times;
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
					<PostingRow
						{posting}
						{index}
						totalPostings={postings.length}
						{date}
						{operatingCurrency}
						showCost={showCost[index]}
						showPrice={showPrice[index]}
						showPostingFlag={showPostingFlag[index]}
						showPostingComment={showPostingComment[index]}
						showPostingMetadata={showPostingMetadata[index]}
						onToggleCost={toggleCost}
						onTogglePrice={togglePrice}
						onToggleFlag={togglePostingFlag}
						onToggleComment={togglePostingComment}
						onToggleMetadata={togglePostingMetadata}
						onRemovePosting={removePosting}
						onAddMetadata={addPostingMetadata}
						onRemoveMetadata={removePostingMetadata}
						onUpdateMetadataKey={updatePostingMetadataKey}
					/>
				{/each}

				<button type="button" class="add-posting" on:click={addPosting}>
					+ Add Posting
				</button>
			</div>

			<!-- Tags & Links -->
			<TagLinkInput
				bind:selectedTags
				bind:selectedLinks
				{tags}
			/>
		{/if}

		<!-- Balance Form -->
		{#if activeTab === "balance"}
			<BalanceTabForm
				bind:date
				bind:balanceAccount
				bind:balanceAmount
				bind:balanceCurrency
			/>
		{/if}

		<!-- Note Form -->
		{#if activeTab === "note"}
			<NoteTabForm
				bind:date
				bind:noteAccount
				bind:noteComment
			/>
		{/if}

		<!-- Query Form -->
		{#if activeTab === "query"}
			<QueryTabForm
				bind:date
				bind:queryName
				bind:querySql
				{queryTesting}
				{queryTestRows}
				{queryTestError}
				{savedQueries}
				{savedQueriesLoading}
				onTestQuerySQL={testQuerySQL}
				onLoadSavedQueries={loadSavedQueries}
				onLoadQueryIntoForm={loadQueryIntoForm}
			/>
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
			{#if mode === "add" && activeTab === "transaction" && plugin?.settings?.enableUserSnippets}
				<button
					type="button"
					class="btn-secondary"
					on:click={openLoadSnippetModal}
				>
					📋 Load Snippet
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
		gap: var(--size-4-2);
		margin-bottom: var(--size-4-3);
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
		gap: var(--size-4-3);
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
		gap: var(--size-4-2);
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
		background: var(--background-modifier-form-field);
		color: var(--text-error);
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		width: 2rem;
		height: 2rem;
		cursor: pointer;
		font-size: 1.2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
	}

	.remove-posting:hover:not(:disabled) {
		background: var(--background-modifier-error);
		border-color: var(--text-error);
		color: var(--text-error);
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
		padding: var(--size-4-2) var(--size-4-3);
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
		margin-bottom: 0.75rem;
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
		padding: 0.3rem 0.5rem;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		background: var(--background-primary);
		color: var(--text-normal);
		font-size: 0.875rem;
		height: 2rem;
		line-height: 1.2;
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

	/* Consolidated with definition above */

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
		background: var(--background-modifier-form-field);
		color: var(--text-error);
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		padding: 0.5rem;
		cursor: pointer;
		font-size: 0.9rem;
		transition: all 0.2s;
	}

	.remove-metadata:hover {
		background: var(--background-modifier-error);
		border-color: var(--text-error);
		color: var(--text-error);
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

	.query-hint {
		color: var(--text-muted);
	}

	.query-sql-textarea {
		font-family: var(--font-monospace);
		font-size: 0.9em;
	}

	.query-preview-label {
		color: var(--text-muted);
		display: block;
		margin-bottom: 0.4rem;
	}
</style>
