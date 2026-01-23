// src/queries/index.ts

// --- Types for Filters (Optional but helpful) ---
/**
 * Filters for transaction queries.
 */
export interface TransactionFilters {
	/** Filter by account name substring. */
	account?: string | null;
	/** Filter by start date (YYYY-MM-DD). */
	startDate?: string | null;
	/** Filter by end date (YYYY-MM-DD). */
	endDate?: string | null;
	/** Filter by payee name substring. */
	payee?: string | null;
	/** Filter by tag (e.g. "#tag"). */
	tag?: string | null;
}

// --- Query Functions ---

/**
 * Gets all unique account names
 * @returns {string} The BQL query string.
 */
export function getAllAccountsQuery(): string {
	return `SELECT account`; // Post-processing needed for unique list
}

/**
 * Gets all unique tags
 * @returns {string} The BQL query string.
 */
export function getAllTagsQuery(): string {
	return `SELECT tags`; // Post-processing needed for unique list
}

// src/queries/index.ts

// ... (other query functions)

/**
 * Gets converted cost of all Asset accounts
 * @param {string} currency - The target currency.
 * @returns {string} The BQL query string.
 */
export function getTotalAssetsCostQuery(currency: string): string { // <-- NEW
  return `SELECT convert(sum(position), '${currency}') WHERE account ~ '^Assets'`;
}

/**
 * Gets converted cost of all Liability accounts
 * @param {string} currency - The target currency.
 * @returns {string} The BQL query string.
 */
export function getTotalLiabilitiesCostQuery(currency: string): string { // <-- NEW
   return `SELECT convert(sum(position), '${currency}') WHERE account ~ '^Liabilities'`;
}

/**
 * Gets the balance sheet (Assets, Liabilities, Equity) converted to a currency.
 * @param {string} currency - The target currency.
 * @returns {string} The BQL query string.
 */
export function getBalanceSheetQuery(currency: string): string {
	return `SELECT account, convert(sum(position), '${currency}') WHERE account ~ '^(Assets|Liabilities|Equity)' AND NOT close_date(account) GROUP BY account ORDER BY account`;
}

/**
 * Gets balance sheet at historical cost (no currency conversion)
 * @returns {string} The BQL query string.
 */
export function getBalanceSheetQueryByCost(): string {
	return `SELECT account, cost(sum(position)) WHERE account ~ '^(Assets|Liabilities|Equity)' AND NOT close_date(account) GROUP BY account ORDER BY account`;
}

/**
 * Gets balance sheet in raw units (no cost or currency conversion)
 * @returns {string} The BQL query string.
 */
export function getBalanceSheetQueryByUnits(): string {
	return `SELECT account, units(sum(position)) WHERE account ~ '^(Assets|Liabilities|Equity)' AND NOT close_date(account) GROUP BY account ORDER BY account`;
}

/**
 * Gets balances for ALL account types (Assets, Liabilities, Equity, Income, Expenses)
 * @param {string} currency - The target currency.
 * @returns {string} The BQL query string.
 */
export function getAllAccountBalancesQuery(currency: string): string {
	return `SELECT account, convert(sum(position), '${currency}') GROUP BY account ORDER BY account`;
}

/**
 * Gets transactions based on filters
 * @param {TransactionFilters} filters - The filters to apply.
 * @param {number} [limit=1000] - Max number of transactions.
 * @returns {string} The BQL query string.
 */
export function getTransactionsQuery(filters: TransactionFilters, limit: number = 1000): string {
	const selectPart = `SELECT date, payee, narration, position, balance`; // Added balance column
	const whereClauses: string[] = [];
	const orderByPart = `ORDER BY date DESC, lineno DESC LIMIT ${limit}`;

	// Build WHERE clauses based on provided filters
	if (filters.account) {

		whereClauses.push(`account ~ '^${filters.account}'`);
	}
	if (filters.startDate) {
		whereClauses.push(`date >= ${filters.startDate}`);
	}
	if (filters.endDate) {
		whereClauses.push(`date <= ${filters.endDate}`);
	}
	if (filters.payee && filters.payee.trim() !== '') {
		whereClauses.push(`payee ~ '${filters.payee.replace(/'/g, "''")}'`);
	}
	if (filters.tag && filters.tag.trim() !== '') {
		const tagName = filters.tag.replace(/^#/, '').trim().replace(/'/g, "''");
		if (tagName) {
			whereClauses.push(`'${tagName}' IN tags`); // Check tag presence
		}
	}

	// Construct the final query
	if (whereClauses.length > 0) {
		return `${selectPart} WHERE ${whereClauses.join(' AND ')} ${orderByPart}`;
	} else {
		return `${selectPart} ${orderByPart}`; // No WHERE needed
	}
}

/**
 * Query for file validation using bean-query (replaces bean-check)
 * Uses 'SELECT TRUE LIMIT 0' which validates file syntax without returning data
 * @param {string} filePath - Path to beancount file.
 * @param {string} commandBase - Base command (bean-query).
 * @returns {string} The validation command string.
 */
export function getBeanCheckCommand(filePath: string, commandBase: string): string {
	return `${commandBase} "${filePath}" "SELECT TRUE LIMIT 0"`;
}

/**
 * Gets monthly income for a period.
 * @param {string} startDate - Start date (YYYY-MM-DD).
 * @param {string} endDate - End date (YYYY-MM-DD).
 * @param {string} currency - Target currency.
 * @returns {string} The BQL query string.
 */
export function getMonthlyIncomeQuery(startDate: string, endDate: string, currency: string): string { // Must accept 3 args
	return `SELECT convert(sum(position), '${currency}') WHERE account ~ '^Income' AND date >= ${startDate} AND date <= ${endDate}`;
}

/**
 * Gets monthly expenses for a period.
 * @param {string} startDate - Start date (YYYY-MM-DD).
 * @param {string} endDate - End date (YYYY-MM-DD).
 * @param {string} currency - Target currency.
 * @returns {string} The BQL query string.
 */
export function getMonthlyExpensesQuery(startDate: string, endDate: string, currency: string): string { // Must accept 3 args
	return `SELECT convert(sum(position), '${currency}') WHERE account ~ '^Expenses' AND date >= ${startDate} AND date <= ${endDate}`;
}

/**
 * Gets historical net worth data over time intervals.
 * @param {string} [interval='month'] - The grouping interval (e.g. 'month', 'year').
 * @param {string} currency - Target currency.
 * @returns {string} The BQL query string.
 */

export function getHistoricalNetWorthDataQuery(interval: string = 'month', currency: string): string { // Must accept 2 args
	return `SELECT year, month, only('${currency}', convert(last(balance), '${currency}', last(date))) WHERE account ~ '^(Assets|Liabilities)' ORDER BY year, month`;
}

// --- Commodities Queries ---

/**
 * Gets all commodity symbols from Commodity directives.
 * @returns {string} The BQL query string.
 */
export function getAllCommoditiesQuery(): string {
	return `SELECT name AS name_ FROM #commodities GROUP BY name`;
}

/**
 * Gets enriched price data for all commodities with price directives.
 * Includes latest price, logo, date, and freshness indicator.
 * @param {string} currency - The operating currency for price conversion.
 * @returns {string} The BQL query string.
 */
export function getCommoditiesPriceDataQuery(currency: string): string {
	return `SELECT last(date) AS date_, last(currency) AS currency_, round(getprice(last(currency), '${currency}'),2) AS price_, currency_meta(last(currency), 'logo') AS logo_, bool(today()-1<last(date)) AS islatest_ FROM #prices GROUP BY currency`;
}

/**
 * Gets detailed information for a specific commodity.
 * Includes all metadata, logo, price metadata, filename, and line number.
 * @param {string} symbol - The commodity symbol.
 * @returns {string} The BQL query string.
 */
export function getCommodityDetailsQuery(symbol: string): string {
	return `SELECT name AS name_, last(meta) AS meta_, currency_meta(last(name),'logo') AS logo_, currency_meta(last(name), 'price') AS pricemetadata_, meta('filename') AS filename_, meta('lineno') AS lineno_ FROM #commodities WHERE name='${symbol}'`;
}