// Help text shown by the "i" HelpTip icon on each plugin surface.
// Kept in one place so wording stays consistent and is easy to review/update
// without touching component markup.

export interface HelpItem {
	/** Button / control name as it appears in the UI. */
	label: string;
	text: string;
}

export interface HelpTopic {
	title: string;
	/** One or two sentences: what this section is for. */
	summary: string;
	/** Typical workflow, in order. */
	steps?: string[];
	/** What each button / control does. */
	items?: HelpItem[];
	/** Optional closing hint. */
	tip?: string;
}

export const HELP_TOPICS = {
	// --- Snapshot sidebar ---
	snapshotMetrics: {
		title: 'Key Metrics',
		summary: 'A quick read of your current net worth, total assets and total liabilities, converted to your operating currency.',
		items: [
			{ label: 'Refresh', text: 'Re-runs the queries and re-checks the ledger for errors.' },
			{ label: 'Status pill', text: 'Shows whether bean-check passes. When it shows errors, click it for the full message.' },
		],
		tip: 'Commodities without a price entry cannot be converted and are left out of the totals.',
	},
	upcoming: {
		title: 'Upcoming (scheduled transactions)',
		summary: 'Recurring or one-time future transactions. They are stored in events.beancount and never post to your ledger on their own.',
		steps: [
			'Click + to define a schedule: name, frequency, start date and postings.',
			'When an item turns orange ("Due"), click Process dues.',
			'For each due occurrence choose Insert (write it to the ledger), Skip (dismiss it) or leave it on Hold (asked again next time).',
		],
		items: [
			{ label: 'Period filter', text: 'Limits the list to Today / This Week / This Month / All. Overdue items always show.' },
			{ label: 'Process dues', text: 'Collects every missed occurrence and opens the confirmation dialog.' },
			{ label: '+', text: 'Adds a new scheduled transaction.' },
			{ label: '✏️ / ❌', text: 'Edit or delete a schedule. Transactions already inserted are not touched.' },
		],
	},
	errors: {
		title: 'Errors',
		summary: 'Validation errors reported by bean-check for your ledger.',
		items: [
			{ label: 'Error row', text: 'Click to open the file at the offending line.' },
		],
		tip: 'After fixing an error, click Refresh at the top to re-check.',
	},
	reconciliation: {
		title: 'Reconciliation',
		summary: 'Keeps your ledger in agreement with your real bank and card statements by reminding you to record balance checks.',
		steps: [
			'Mark an account for reconciliation: add reconcile: 30 (days) to its open directive, or set the interval with Edit.',
			'When an account turns orange (overdue), get the real balance from your bank or statement.',
			'Click Balance and enter that amount and date. This records a balance assertion.',
			'If the assertion fails ("Failing — off by …"), click the account name to review transactions since the last balance and fix the missing or wrong entry.',
			'Only if the difference cannot be explained, use Force reconcile.',
		],
		items: [
			{ label: 'Account name', text: 'Opens the Transactions tab filtered from the last balance date. Ctrl/Cmd+click opens the Journal instead.' },
			{ label: 'Edit', text: 'Opens Account details, where you can change or clear the reconcile interval.' },
			{ label: 'Balance', text: 'Adds a balance assertion for this account.' },
			{ label: 'Force reconcile', text: 'Inserts a pad directive that plugs the gap with an automatic transaction. Enabled only when the latest assertion fails.' },
			{ label: 'Only overdue', text: 'Hides accounts that are up to date.' },
		],
		tip: 'Green = checked within its interval. Orange = past its interval, never checked, or failing.',
	},

	// --- Dashboard ---
	overview: {
		title: 'Financial Overview',
		summary: 'Headline figures for the selected period, plus your budgets and targets.',
		items: [
			{ label: 'Period', text: 'Choose a preset, or a custom month/year.' },
			{ label: 'Refresh', text: 'Reloads the figures from your ledger.' },
		],
	},
	indicators: {
		title: 'Financial Indicators',
		summary: 'Budgets cap spending on one or more accounts. Targets track progress toward a savings or balance goal.',
		steps: [
			'Pick Budgets or Targets from the dropdown.',
			'Click Add Budget / Add Target and choose the account(s), amount and period.',
			'Watch the progress bar: its colour shows whether you are on track.',
		],
		tip: 'Roll-over budgets carry unused amounts into the next period.',
	},
	transactions: {
		title: 'Transactions',
		summary: 'A sortable table of transactions filtered by account, date range, payee and tag.',
		items: [
			{ label: 'Filters', text: 'Account, From/To, Payee and Tag narrow the list. Apply them with Refresh.' },
			{ label: 'Column headers', text: 'Click to sort. Click again to reverse.' },
			{ label: 'Balance column', text: 'Shows a running balance only when a single account is selected.' },
			{ label: 'Payee', text: 'Click to filter by that payee. Ctrl/Cmd+click opens it in the Journal.' },
			{ label: 'Clear', text: 'Resets all filters.' },
		],
	},
	journal: {
		title: 'Journal',
		summary: 'Every entry (transactions, notes and balance assertions) as editable cards.',
		items: [
			{ label: 'Search & filters', text: 'Narrow by text, entry type, account, dates, payee or tag. Fields suggest values as you type.' },
			{ label: 'Accounts / tags on a card', text: 'Click to open in Transactions. Ctrl/Cmd+click filters the Journal instead.' },
			{ label: 'Edit / Delete', text: 'Change or remove the entry in your ledger file.' },
			{ label: '📋', text: 'Saves a transaction as a reusable snippet (enable User-defined snippets in settings).' },
		],
	},
	balances: {
		title: 'Accounts & Balances',
		summary: 'Your balance sheet (assets, liabilities, equity) with net worth trend and balance breakdown charts.',
		items: [
			{ label: 'Open / Close Account', text: 'Adds an open or close directive to your ledger.' },
			{ label: 'Chart dropdowns', text: 'Switch between the net worth trend and the balances chart, its interval, section and chart type.' },
			{ label: 'Category row', text: 'Click to expand or collapse. Ctrl/Cmd+click opens its transactions.' },
			{ label: 'Account row', text: 'Click to open its transactions. Ctrl/Cmd+click opens the Journal. Right-click opens Account details.' },
		],
	},
	incomeStatement: {
		title: 'Income Statement',
		summary: 'Income and expenses over time, with a trend chart and a totals breakdown.',
		items: [
			{ label: 'Chart dropdowns', text: 'Switch between Trends and Totals Breakdown, and change the interval.' },
			{ label: 'Category row', text: 'Click to expand or collapse. Ctrl/Cmd+click opens its transactions.' },
			{ label: 'Account row', text: 'Click to open its transactions. Ctrl/Cmd+click opens the Journal.' },
		],
	},
	commodities: {
		title: 'Commodities & Prices',
		summary: 'Currencies, stocks and other commodities declared in your ledger, with their latest prices.',
		items: [
			{ label: 'Update Prices', text: 'Fetches current prices with bean-price for commodities that have a price source. Requires bean-price to be set up in Settings → Connection.' },
			{ label: '+ Add Commodity', text: 'Declares a new commodity.' },
			{ label: 'Commodity card', text: 'Click to see and edit its metadata and price history.' },
		],
	},
} satisfies Record<string, HelpTopic>;

export type HelpTopicKey = keyof typeof HELP_TOPICS;
