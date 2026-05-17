// src/controllers/BalanceSheetController.ts

import { writable, type Writable, get } from 'svelte/store';
import type BeancountPlugin from '../main';
import * as queries from '../queries/index';
import { parse as parseCsv } from 'csv-parse/sync';
import { extractConvertedAmount, extractNonReportingCurrencies, parseAmount } from '../utils/index';
import { formatCurrencyAmount } from '../utils/currency-precision';
import { getOpenAccounts } from '../utils/accounts';
import type { ChartConfiguration } from 'chart.js/auto';
import { Logger } from '../utils/logger';

/**
 * Interface representing a node in the balance sheet hierarchy.
 */
export interface AccountItem {
	/** Full account path (e.g., "Assets:Bank"). */
	account: string;
	/** Display name (e.g., "Bank"). */
	displayName: string;
	/** Hierarchy depth level (0-based). */
	level: number;
	/** Formatted amount string. */
	amount: string;
	/** Numeric amount value. */
	amountNumber: number;
	/** String representation of other currencies held. */
	otherCurrencies: string;
	/** True if this is a parent category, false if a leaf account. */
	isCategory: boolean;
	/** Child accounts/categories. */
	children?: AccountItem[];
}

/**
 * Interface representing the state of the Balance Sheet view.
 */
export interface BalanceSheetState {
	/** Whether data is loading. */
	isLoading: boolean;
	/** Error message if loading failed. */
	error: string | null;
	/** Tree of Asset accounts (excluding Assets:Receivables which split out). */
	assets: AccountItem[];
	/** Tree of Liability accounts. */
	liabilities: AccountItem[];
	/** Tree of Equity accounts. */
	equity: AccountItem[];
	/** Tree of Assets:Receivables accounts (money owed to the user). */
	receivables: AccountItem[];
	/** Total numeric value of Assets (excluding Receivables). */
	totalAssets: number;
	/** Total numeric value of Liabilities. */
	totalLiabilities: number;
	/** Total numeric value of Equity. */
	totalEquity: number;
	/** Total numeric value of Receivables. */
	totalReceivables: number;
	/** The reporting currency used. */
	currency: string;
	/** Whether multi-currency entries were detected. */
	hasUnconvertedCommodities: boolean;
	/** Warning message for unconverted commodities. */
	unconvertedWarning: string | null;
	/** Current valuation method used. */
	valuationMethod: 'convert' | 'cost' | 'units';
	/** Chart.js configuration object for the net worth trend chart. */
	chartConfig: ChartConfiguration | null;
	/** Error specific to chart data loading. */
	chartError: string | null;
	/** Whether chart data is being reloaded (e.g. on interval toggle). */
	chartLoading: boolean;
	/** The active chart interval granularity. */
	chartInterval: 'month' | 'week';
}

/**
 * BalanceSheetController
 *
 * Manages the data fetching and state for the Balance Sheet tab.
 * Responsible for querying account balances, building the hierarchy,
 * calculating totals, and handling different valuation methods.
 */
export class BalanceSheetController {
	public plugin: BeancountPlugin;
	public state: Writable<BalanceSheetState>;

	/** Cached commodity list used by the multi-currency precision
	 * recovery (option-B fix for beancount's display truncation). One
	 * fetch per controller instance — invalidated when the user
	 * declares a new commodity by clicking refresh on the tab. */
	private currenciesCache: string[] | null = null;

	/** Refetch the list of declared commodities, used to build the
	 * per-currency `only(...)` columns in the balance-sheet query.
	 * Caches the result so subsequent loadData calls reuse it. */
	private async getKnownCurrencies(): Promise<string[]> {
		if (this.currenciesCache) return this.currenciesCache;
		try {
			const csv = await this.plugin.runQuery(queries.getAllCurrenciesQuery());
			const records: string[][] = parseCsv(csv.replace(/\r/g, '').trim(), {
				columns: false, skip_empty_lines: true,
			});
			const headerRow = records[0]?.[0]?.toLowerCase().includes('currency');
			const data = headerRow ? records.slice(1) : records;
			this.currenciesCache = data
				.map(r => (r[0] ?? '').trim())
				.filter(c => /^[A-Z][A-Z0-9'._-]*$/.test(c));
			return this.currenciesCache;
		} catch (e) {
			Logger.warn('[BalanceSheetController] currency-list query failed:', e);
			return [];
		}
	}

	/** Externally callable: force a re-fetch of the commodity list on
	 * next loadData (e.g. when the user refreshes the tab). */
	public invalidateCurrencyCache(): void {
		this.currenciesCache = null;
		this.accountCurrenciesCache = null;
	}

	/** Cache of account → first declared currency, parsed from
	 * accounts.beancount. Needed so zero-balance leaves render in
	 * their native currency (e.g. "0.00 BTC") instead of falling back
	 * to the operating currency. */
	private accountCurrenciesCache: Map<string, string> | null = null;

	private async getAccountCurrencies(): Promise<Map<string, string>> {
		if (this.accountCurrenciesCache) return this.accountCurrenciesCache;
		const out = new Map<string, string>();
		try {
			const folder = this.plugin.settings.structuredFolderName?.trim() || 'Finances';
			const path = `${folder}/accounts.beancount`;
			const adapter = this.plugin.app.vault.adapter;
			if (!(await adapter.exists(path))) {
				this.accountCurrenciesCache = out;
				return out;
			}
			const text = await adapter.read(path);
			// `<date> open <account>  <currency1>[, <currency2>]?`.
			// Account names use `[A-Z][A-Za-z0-9:_-]+`; currencies use
			// `[A-Z][A-Z0-9'._-]*`. We capture only the first currency.
			const re = /^\d{4}-\d{2}-\d{2}\s+open\s+([A-Z][A-Za-z0-9:_-]+)(?:\s+([A-Z][A-Z0-9'._-]*))?/gm;
			let m: RegExpExecArray | null;
			while ((m = re.exec(text)) !== null) {
				if (m[2]) out.set(m[1], m[2]);
			}
		} catch (e) {
			Logger.warn('[BalanceSheetController] account-currency parse failed:', e);
		}
		this.accountCurrenciesCache = out;
		return out;
	}

	/**
	 * Creates an instance of BalanceSheetController.
	 * @param {BeancountPlugin} plugin - The main plugin instance.
	 */
	constructor(plugin: BeancountPlugin) {
		this.plugin = plugin;
		this.state = writable({
			isLoading: true,
			error: null,
			assets: [],
			liabilities: [],
			equity: [],
			receivables: [],
			totalAssets: 0,
			totalLiabilities: 0,
			totalEquity: 0,
			totalReceivables: 0,
			currency: plugin.settings.operatingCurrency || 'USD',
			hasUnconvertedCommodities: false,
			unconvertedWarning: null,
			valuationMethod: 'units' as const,
			chartConfig: null,
			chartError: null,
			chartLoading: false,
			chartInterval: 'month' as const,
		});
	}

	/**
	 * Builds a hierarchical structure from flat account entries.
	 * @param {[string, string][]} accounts - List of [accountName, rawAmount] tuples.
	 * @param {string} accountType - The root account type (e.g. 'Assets').
	 * @param {'convert' | 'cost' | 'units'} [valuationMethod='convert'] - The valuation method.
	 * @returns {AccountItem[]} The list of root account items.
	 */
	private buildAccountHierarchy(
		accounts: [string, string][],
		accountType: string,
		valuationMethod: 'convert' | 'cost' | 'units' = 'convert',
		displayCurrency?: string,
	): AccountItem[] {
		const reportingCurrency = this.plugin.settings.operatingCurrency;
		const target = (displayCurrency || reportingCurrency || '').toUpperCase();
		const accountMap = new Map<string, AccountItem>();
		const rootAccounts: AccountItem[] = [];

		for (const [fullAccount, rawAmount] of accounts) {
			let convertedAmount: string;
			let otherCurrencies: string;

			if (valuationMethod === 'convert') {
				// Single-currency rows after `convert(...)` — pull the amount
				// out of the inventory string.
				convertedAmount = extractConvertedAmount(rawAmount, target);
				otherCurrencies = extractNonReportingCurrencies(rawAmount, target);
			} else {
				// `units(sum(position))` / `cost(sum(position))` returns the
				// raw inventory in the row's own currency. Take the first
				// currency-amount pair as the primary number; the rest go
				// into the "Other Currencies" cell.
				const firstMatch = rawAmount.match(/(-?[\d,]+\.?\d*)\s*([A-Z][A-Z0-9'._-]*)/);
				if (firstMatch) {
					convertedAmount = `${firstMatch[1]} ${firstMatch[2]}`;
				} else {
					convertedAmount = `0 ${target}`;
				}
				const parts = rawAmount.split(',').map(s => s.trim()).filter(Boolean);
				otherCurrencies = parts.slice(1).join('\n');
			}

			const amountNumber = parseFloat(convertedAmount.split(' ')[0].replace(/,/g, '')) || 0;

			const parts = fullAccount.split(':');
			let currentPath = '';

			// Build hierarchy from root to leaf
			for (let i = 0; i < parts.length; i++) {
				const part = parts[i];
				const parentPath = currentPath;
				currentPath = currentPath ? `${currentPath}:${part}` : part;
				
				if (!accountMap.has(currentPath)) {
					// Always use reporting currency for all valuation methods
					const item: AccountItem = {
						account: currentPath,
						displayName: part,
						level: i,
						amount: i === parts.length - 1 ? convertedAmount : `0.00 ${reportingCurrency}`,
						amountNumber: i === parts.length - 1 ? amountNumber : 0,
						otherCurrencies: i === parts.length - 1 ? otherCurrencies : '',
						isCategory: i < parts.length - 1,
						children: []
					};

					accountMap.set(currentPath, item);

					// Add to parent's children or root
					if (parentPath && accountMap.has(parentPath)) {
						accountMap.get(parentPath)!.children!.push(item);
					} else if (i === 0) {
						rootAccounts.push(item);
					}
				} else if (i === parts.length - 1) {
					// Update leaf account amount and other currencies
					const existing = accountMap.get(currentPath)!;
					existing.amount = convertedAmount;
					existing.amountNumber = amountNumber;
					existing.otherCurrencies = otherCurrencies;
				}
			}
		}

		// Calculate category totals (bottom-up)
		// Always use reporting currency for all valuation methods
		this.calculateCategoryTotals(rootAccounts, reportingCurrency);

		return rootAccounts;
	}

	/**
	 * Recursively calculates totals for category nodes based on children.
	 * @param {AccountItem[]} accounts - The account nodes to process.
	 * @param {string} currency - The reporting currency.
	 * @returns {number} The sum of amounts.
	 */
	private calculateCategoryTotals(accounts: AccountItem[], currency: string): number {
		let total = 0;
		for (const account of accounts) {
			if (account.children && account.children.length > 0) {
				const childTotal = this.calculateCategoryTotals(account.children, currency);
				account.amountNumber = childTotal;
				
				// Always show amount with reporting currency
				// Use formatCurrencyAmount so an empty currency (units
				// mode, where each leaf carries its own code) renders
				// cleanly as just the number — no trailing-space artifact.
				account.amount = formatCurrencyAmount(childTotal, currency);
				
				// Aggregate other currencies from children - collect unique currencies
				const childOtherCurrencies = account.children
					.map(child => child.otherCurrencies)
					.filter(curr => curr && curr.trim() !== '')
					.flatMap(curr => curr.split(/[,\n]/).map(c => c.trim()))
					.filter((curr, index, arr) => arr.indexOf(curr) === index && curr !== '') // Remove duplicates and empty strings
					.join('\n'); // Use newlines for better multi-line display
				account.otherCurrencies = childOtherCurrencies;
				
				total += childTotal;
			} else {
				total += account.amountNumber;
			}
		}
		return total;
	}

	/**
	 * Sets the valuation method (market value, at cost, or units) and reloads data.
	 * @param {'convert' | 'cost' | 'units'} method - The valuation method.
	 * @param {string} [convertTarget] - Optional currency to convert into (only used with 'convert').
	 */
	async setValuationMethod(method: 'convert' | 'cost' | 'units', convertTarget?: string) {
		await this.loadData(method, convertTarget);
	}

	/**
	 * Flattens the hierarchy for a linear list display if needed (but keeps children property).
	 * Useful for ensuring all nodes are traversable in a list.
	 * @param {AccountItem[]} accounts - The root nodes.
	 * @returns {AccountItem[]} Flattened list of all nodes.
	 */
	private flattenHierarchy(accounts: AccountItem[]): AccountItem[] {
		const result: AccountItem[] = [];
		
		const flatten = (items: AccountItem[]) => {
			for (const item of items) {
				result.push(item);
				if (item.children && item.children.length > 0) {
					flatten(item.children);
				}
			}
		};
		
		flatten(accounts);
		return result;
	}

	/**
	 * Changes the chart interval granularity and reloads only the chart data.
	 */
	async setChartInterval(interval: 'month' | 'week') {
		if (get(this.state).chartInterval === interval) return;
		this.state.update(s => ({ ...s, chartInterval: interval, chartConfig: null, chartError: null, chartLoading: true }));
		const reportingCurrency = this.plugin.settings.operatingCurrency;
		try {
			const result = await this.plugin.runQuery(queries.getHistoricalNetWorthDataQuery(interval, reportingCurrency));
			this._processChartData(result, interval, reportingCurrency);
		} catch (e) {
			Logger.error('Error loading chart data:', e);
			this.state.update(s => ({ ...s, chartLoading: false, chartError: `Failed to load chart: ${e.message}` }));
		}
	}

	/**
	 * Parses raw BQL result into chart config and updates the store.
	 * Handles both monthly (3-col) and weekly (2-col) formats.
	 */
	private _processChartData(rawResult: string, interval: 'month' | 'week', reportingCurrency: string) {
		try {
			const clean = rawResult.replace(/\r/g, '').trim();
			const records: string[][] = parseCsv(clean, { columns: false, skip_empty_lines: true, relax_column_count: true });
			if (records.length === 0) throw new Error('No data available for chart.');

			const dataMap = new Map<string, number>();
			const labels: string[] = [];
			const dataPoints: (number | null)[] = [];

			if (interval === 'month') {
				let minYear = Infinity, maxYear = -Infinity, minMonth = Infinity, maxMonth = -Infinity;
				for (const row of records) {
					if (row.length < 3) continue;
					const year = parseInt(row[0].trim());
					const monthNum = parseInt(row[1].trim());
					const nw = parseAmount(extractConvertedAmount(row[2].trim(), reportingCurrency));
					dataMap.set(`${year}-${monthNum.toString().padStart(2, '0')}`, nw.amount);
					if (year < minYear || (year === minYear && monthNum < minMonth)) { minYear = year; minMonth = monthNum; }
					if (year > maxYear || (year === maxYear && monthNum > maxMonth)) { maxYear = year; maxMonth = monthNum; }
				}
				let cy = minYear, cm = minMonth;
				while (cy < maxYear || (cy === maxYear && cm <= maxMonth)) {
					const key = `${cy}-${cm.toString().padStart(2, '0')}`;
					labels.push(new Date(cy, cm - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }).toUpperCase());
					dataPoints.push(dataMap.get(key) ?? null);
					if (++cm > 12) { cm = 1; cy++; }
				}
			} else {
				const dates: Date[] = [];
				for (const row of records) {
					if (row.length < 2) continue;
					const dateStr = row[0].trim();
					const d = new Date(dateStr + 'T00:00:00');
					if (isNaN(d.getTime())) continue;
					const nw = parseAmount(extractConvertedAmount(row[1].trim(), reportingCurrency));
					dataMap.set(dateStr, nw.amount);
					dates.push(d);
				}
				if (dates.length === 0) throw new Error('No weekly data.');
				const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
				const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
				const cur = new Date(minDate);
				while (cur <= maxDate) {
					const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
					labels.push(cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }));
					dataPoints.push(dataMap.get(key) ?? null);
					cur.setDate(cur.getDate() + 7);
				}
			}

			const xAxisTitle = interval === 'month' ? 'Month' : 'Week ending (Sunday)';
			this.state.update(s => ({ ...s, chartConfig: this._buildChartConfig(labels, dataPoints, reportingCurrency, xAxisTitle), chartError: null, chartLoading: false }));
		} catch (err) {
			Logger.error('Error processing chart data:', err);
			this.state.update(s => ({ ...s, chartConfig: null, chartError: `Failed to process chart data: ${err.message}`, chartLoading: false }));
		}
	}

	/**
	 * Builds a Chart.js line chart configuration for the Net Worth Trend.
	 */
	private _buildChartConfig(labels: string[], dataPoints: (number | null)[], currency: string, xAxisTitle: string): ChartConfiguration {
		return {
			type: 'line',
			data: {
				labels,
				datasets: [{
					label: `Net Worth (${currency})`,
					data: dataPoints,
					borderColor: 'rgb(75, 192, 192)',
					backgroundColor: 'rgba(75, 192, 192, 0.1)',
					tension: 0.3,
					fill: true,
					pointRadius: 4,
					pointHoverRadius: 6,
					spanGaps: true
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					title: {
						display: true,
						text: `Net Worth Trend (${currency})`,
						font: { size: 16 }
					},
					legend: { display: true, position: 'top' },
					tooltip: {
						mode: 'index',
						intersect: false,
						callbacks: {
							label: (context: any) => `Net Worth: ${context.parsed.y.toLocaleString()} ${currency}`
						}
					}
				},
				scales: {
					x: {
						display: true,
						title: { display: true, text: xAxisTitle },
						grid: { display: true, color: 'rgba(0, 0, 0, 0.1)' }
					},
					y: {
						display: true,
						title: { display: true, text: `Amount (${currency})` },
						grid: { display: true, color: 'rgba(0, 0, 0, 0.1)' },
						ticks: { callback: (value: any) => value.toLocaleString() }
					}
				},
				interaction: { mode: 'nearest', axis: 'x', intersect: false }
			}
		};
	}

	/**
	 * Main data fetching method.
	 * Runs Beancount queries based on the valuation method and updates state.
	 * @param {'convert' | 'cost' | 'units'} [valuationMethod='convert'] - The valuation method to use.
	 * @param {string} [convertTarget] - When valuationMethod is 'convert', the currency to convert into.
	 *                                    Defaults to the operating currency if omitted.
	 */
	async loadData(
		valuationMethod: 'convert' | 'cost' | 'units' = 'units',
		convertTarget?: string,
	) {
		this.state.update(s => ({ ...s, isLoading: true, error: null }));
		const reportingCurrency = this.plugin.settings.operatingCurrency;
		const target = (convertTarget?.trim() || reportingCurrency || '').toUpperCase();

		if (valuationMethod === 'convert' && !target) {
			this.state.update(s => ({ ...s, isLoading: false, error: "Operating currency not set." }));
			return;
		}

		try {
			// Pre-fetch the commodity list + account → currency map so we
			// can ask beancount for the precise number of each currency
			// component per account (option-B fix for the display-
			// truncation issue) AND render zero-balance leaves in their
			// declared native currency. Both cached per-instance.
			const [knownCurrencies, accountCurrencies] = await Promise.all([
				this.getKnownCurrencies(),
				this.getAccountCurrencies(),
			]);

			let query: string;
			switch (valuationMethod) {
				case 'convert':
					// Convert mode collapses everything to the target currency,
					// so only that one column is meaningful.
					query = queries.getBalanceSheetQuery(target, [target]);
					break;
				case 'cost':
					query = queries.getBalanceSheetQueryByCost(knownCurrencies);
					break;
				case 'units':
					query = queries.getBalanceSheetQueryByUnits(knownCurrencies);
					break;
			}

			const result = await this.plugin.runQuery(query);
			const cleanStdout = result.replace(/\r/g, "").trim();
			// Parse as dict so we can access columns by name. The new
			// queries return `account`, `raw`, and `bal_<CUR>` for each
			// known commodity — variable schema based on the vault.
			const records: any[] = parseCsv(cleanStdout, {
				columns: true, skip_empty_lines: true, trim: true,
			});

			let tempAssets: [string, string][] = [];
			let tempReceivables: [string, string][] = [];
			let tempLiab: [string, string][] = [];
			let tempEquity: [string, string][] = [];
			let hasUnconvertedCommodities = false;
			const unconvertedAccounts: string[] = [];
			const seenAccounts = new Set<string>();

			// Build the ordered list of column suffixes once. We try each
			// safe currency, fall back to whatever non-meta column we find.
			const safeCurrencyList = knownCurrencies
				.filter(c => /^[A-Z][A-Z0-9'._-]*$/.test(c));

			for (const r of records) {
				const account = (r.account ?? '').trim();
				const rawAmount = (r.raw ?? '').trim();
				if (!account) continue;
				seenAccounts.add(account);

				// Multi-currency detection: collect per-currency numeric
				// components from bal_<CUR> columns. Beancount yields the
				// raw display with a comma when it can't collapse to one
				// currency, but our numeric columns are authoritative —
				// any row with 2+ non-zero numeric columns is multi-currency.
				type Piece = { currency: string; value: number };
				const pieces: Piece[] = [];
				for (const cur of safeCurrencyList) {
					const col = 'bal_' + cur.replace(/[.'-]/g, '_').toLowerCase();
					// bean-query lowercases ALL alias characters in the CSV
					// header, so look up by lowercased column name.
					const raw = r[col];
					if (raw === undefined || raw === '' || raw === null) continue;
					const v = parseFloat(String(raw).replace(/,/g, ''));
					if (!isFinite(v) || v === 0) continue;
					pieces.push({ currency: cur, value: v });
				}

				const isMultiCurrency = pieces.length > 1 ||
					(valuationMethod === 'convert' && rawAmount.includes(','));
				if (isMultiCurrency && valuationMethod === 'convert') {
					hasUnconvertedCommodities = true;
					unconvertedAccounts.push(account);
				}

				// Build the display string. Priority:
				//   1. Single non-zero piece → format with currency-aware decimals.
				//   2. Multiple non-zero pieces → comma-joined formatted list.
				//   3. Pieces empty but row exists (everything netted to
				//      zero) → render "0 <native>" using the declared
				//      currency from accounts.beancount. Falls back to
				//      operating currency only as last resort.
				let amountStr: string;
				if (pieces.length === 1) {
					amountStr = formatCurrencyAmount(pieces[0].value, pieces[0].currency);
				} else if (pieces.length > 1) {
					amountStr = pieces
						.map(p => formatCurrencyAmount(p.value, p.currency))
						.join(', ');
				} else {
					const declared = accountCurrencies.get(account)
						|| (valuationMethod === 'convert' ? target : reportingCurrency || '');
					amountStr = formatCurrencyAmount(0, declared);
				}

				// Receivables (money owed *to* the user) split out of the
				// regular Assets column so the Balance Sheet doesn't fold
				// loan-shaped accounts into the bank/cash totals.
				if (account.startsWith('Assets:Receivables')) {
					tempReceivables.push([account, amountStr]);
				} else if (account.startsWith('Assets')) {
					tempAssets.push([account, amountStr]);
				} else if (account.startsWith('Liabilities')) {
					tempLiab.push([account, amountStr]);
				} else if (account.startsWith('Equity')) {
					tempEquity.push([account, amountStr]);
				}
			}

			// Determine the column-header currency. In `convert` mode the
			// rows are all expressed in the chosen target. In `units` /
			// `cost` mode the rows keep their native currencies — leave
			// the header blank in units mode (each cell already carries
			// its own currency code) and surface "Cost" only for cost
			// mode where the value semantic differs.
			const headerCurrency = valuationMethod === 'convert'
				? target
				: (valuationMethod === 'cost' ? 'Cost' : '');

			// `sum(position)` only returns accounts with at least one
			// posting — so a freshly-opened Liabilities:Treasury (or any
			// asset/equity account) silently disappears from the balance
			// sheet until its first transaction. Backfill the gaps from
			// the chart of accounts so opened accounts always show.
			try {
				const openAccounts = await getOpenAccounts(this.plugin);
				for (const acc of openAccounts) {
					if (seenAccounts.has(acc)) continue;
					// Render zero in the account's declared native currency,
					// not the operating currency — otherwise opened-but-empty
					// crypto/gold accounts misleadingly show as "0.00 UYU".
					const declared = accountCurrencies.get(acc) || target;
					const zeroAmount = formatCurrencyAmount(0, declared);
					if (acc.startsWith('Assets:Receivables')) tempReceivables.push([acc, zeroAmount]);
					else if (acc.startsWith('Assets')) tempAssets.push([acc, zeroAmount]);
					else if (acc.startsWith('Liabilities')) tempLiab.push([acc, zeroAmount]);
					else if (acc.startsWith('Equity')) tempEquity.push([acc, zeroAmount]);
				}
			} catch (e) {
				Logger.log('[BalanceSheetController] could not load open accounts list:', e);
			}

			// Build hierarchical structures
			const assetsHierarchy = this.buildAccountHierarchy(tempAssets, 'Assets', valuationMethod, target);
			const receivablesHierarchy = this.buildAccountHierarchy(tempReceivables, 'Assets', valuationMethod, target);
			const liabilitiesHierarchy = this.buildAccountHierarchy(tempLiab, 'Liabilities', valuationMethod, target);
			const equityHierarchy = this.buildAccountHierarchy(tempEquity, 'Equity', valuationMethod, target);

			// Calculate totals — header label depends on mode
			const totalAssets = this.calculateCategoryTotals(assetsHierarchy, headerCurrency);
			const totalReceivables = this.calculateCategoryTotals(receivablesHierarchy, headerCurrency);
			const totalLiabilities = this.calculateCategoryTotals(liabilitiesHierarchy, headerCurrency);
			const totalEquity = this.calculateCategoryTotals(equityHierarchy, headerCurrency);

			// Create warning message
			let unconvertedWarning = null;
			if (hasUnconvertedCommodities) {
				unconvertedWarning = `Multi-currency accounts detected. ${target} amounts are shown in the first column, other currencies are displayed separately in the second column. Only ${target} amounts are included in totals.`;
			}

			const currentState = get(this.state);

			// Update the store with all new data (preserve chart state)
			this.state.set({
				isLoading: false,
				error: null,
				assets: this.flattenHierarchy(assetsHierarchy),
				receivables: this.flattenHierarchy(receivablesHierarchy),
				liabilities: this.flattenHierarchy(liabilitiesHierarchy),
				equity: this.flattenHierarchy(equityHierarchy),
				totalAssets,
				totalReceivables,
				totalLiabilities,
				totalEquity,
				currency: headerCurrency,
				hasUnconvertedCommodities,
				unconvertedWarning,
				valuationMethod,
				chartConfig: currentState.chartConfig,
				chartError: currentState.chartError,
				chartLoading: true,
				chartInterval: currentState.chartInterval,
			});

			// Load chart data
			try {
				const chartResult = await this.plugin.runQuery(queries.getHistoricalNetWorthDataQuery(currentState.chartInterval, reportingCurrency));
				this._processChartData(chartResult, currentState.chartInterval, reportingCurrency);
			} catch (chartErr) {
				Logger.error('Error loading chart data in loadData:', chartErr);
				this.state.update(s => ({ ...s, chartLoading: false, chartError: `Failed to load chart: ${chartErr.message}` }));
			}

		} catch (e) {
			console.error("Error loading balance sheet:", e);
			this.state.update(s => ({ ...s, isLoading: false, error: e.message }));
		}
	}
}
