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
	/** More explanation in plain prose, shown under the summary without a heading. */
	paragraphs?: string[];
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
			{ label: '🔁', text: 'Makes a transaction recurring: opens a new schedule copied from it, starting one cycle after its date.' },
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

	// --- CSV statement import ---
	importFile: {
		title: 'Choosing a file',
		summary: 'Pick the statement you downloaded from your bank or card provider. It needs to be a CSV file saved somewhere in this vault; the newest ones are at the top.',
		paragraphs: [
			'If you\'ve imported from the same place before, choose its mapping profile too. It brings back everything you set up last time, so you don\'t have to do it again. For a new source, leave it on None and a profile is saved for you at the end.',
		],
	},
	importTable: {
		title: 'Where are the transactions?',
		summary: 'Statements often have account details above the transactions and notes or totals below them. The header row is shaded, the transactions are highlighted, and everything else is greyed out.',
		paragraphs: [
			'If that doesn\'t look right, click a row and mark it as the header or as the last transaction.',
		],
	},
	importColumns: {
		title: 'What\'s in each column?',
		summary: 'Tell the plugin what kind of value each column holds, so it reads them correctly: dates, numbers, text, or something to ignore. Nothing is changed here; you decide what to do with the values on the next page.',
		paragraphs: [
			'For dates, pick the order of day, month and year. If you see a warning, the dates could be read more than one way, so double-check it.',
			'Also tell it how numbers are written: 1,234.56 or 1.234,56.',
		],
		tip: 'A ✓ means every value in the column could be read. A ✗ shows how many couldn\'t, with an example.',
	},
	importStatement: {
		title: 'This statement',
		summary: 'Which account in your ledger this statement is for, like your savings account or credit card. It fills in the first posting on the next page, and you can change it in either place.',
		paragraphs: [
			'Some files cover several accounts, like exports from budgeting apps. Leave the account empty for those, and pick each row\'s account with a formula on the next page instead.',
			'Once an account is set, you can add your balance before and after the statement. They\'re filled in when the file has them; otherwise type them in, or leave them empty. Each becomes a balance assertion, so Beancount can tell you if your books and your bank ever disagree.',
		],
		tip: 'With both balances filled in, you\'ll be warned on the last page if the transactions don\'t add up from one to the other. That usually means a missing row or a wrong sign.',
	},
	importTemplate: {
		title: 'How each row becomes a transaction',
		summary: 'Fill this in like the Add Transaction form. Anything you type is used for every row. To take a value from the file instead, start the field with = and click a column above, for example ={{Description}}.',
		paragraphs: [
			'Formulas can do more than copy a column. Work out a sign with =IF {{Dr / Cr}} == "DR" THEN -{{Amount}} ELSE {{Amount}}, combine columns with ={{Deposit}} - {{Withdrawal}}, or pick the account from your aliases with =ACCOUNT WHERE {{Description}} CONTAINS ALIAS ELSE "Expenses:Shopping" (the ELSE is where rows go when no alias matches). The buttons above insert these for you; hover one to see what it does.',
			`A date column comes through exactly as it's written in the file. The transaction date has to be written the Beancount way (2026-09-22), so if your file writes dates differently, use =FORMAT_DATE({{Date column}}, "YYYY-MM-DD"). The Date buttons have more, like YEAR, MONTH and ADD_DAYS.`,
			'Tags and Links take several values separated by spaces, like imported bank. A formula gives one, so ={{File name}} links every transaction to the statement it came from.',
			'The number next to each field, like 19/20, tells you how many rows got a value from it.',
		],
		tip: 'The first posting is the statement\'s own account, the one chosen on the previous page. You can leave one posting\'s amount empty and Beancount will balance it for you.',
	},
	importMetadata: {
		title: 'Transaction metadata',
		summary: 'Extra details saved with every imported transaction.',
		paragraphs: [
			'import-ref is always there: it\'s how the plugin spots rows you\'ve already imported, so nothing gets added twice. Point it at your bank\'s reference column if there is one. Leave it empty and one is made up from the row.',
		],
	},
	importReview: {
		title: 'Before you import',
		summary: 'This is everything that will be added to your ledger: the transactions, and a balance assertion for each statement balance you gave.',
		paragraphs: [
			'Untick anything you don\'t want added. Rows that are already in your ledger start unticked. "Needs attention" collects rows that couldn\'t be read, look like duplicates, or still need an account.',
			'Click a row to see the original line next to its transaction and change anything.',
		],
	},
	importRemember: {
		title: 'Remembering an alias',
		summary: 'The plugin will remember this text for the account, so it\'s recognised automatically next time. Any other rows here with the same text are updated straight away.',
	},
} satisfies Record<string, HelpTopic>;

export type HelpTopicKey = keyof typeof HELP_TOPICS;
