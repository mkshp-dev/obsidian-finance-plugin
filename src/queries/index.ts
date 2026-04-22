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


export function getTotalAssetsQuery(currency: string, rounding: number): string {
	return `SELECT round(number(only('${currency}', convert(sum(position), '${currency}'))), ${rounding}) AS _totalAssets WHERE account ~ '^Assets'`;
}

export function getTotalLiabilitiesQuery(currency: string, rounding: number): string {
	return `SELECT neg(round(number(only('${currency}', convert(sum(position), '${currency}'))), ${rounding})) AS _totalLiabilities WHERE account ~ '^Liabilities'`;
}

export function getTotalWorthQuery(currency: string, rounding: number): string {
	return `SELECT round(number(only('${currency}', convert(sum(position), '${currency}'))), ${rounding}) AS _totalWorth WHERE account ~ '^(Assets|Liabilities)'`;
}

// This Month Queries
export function getThisMonthIncomeQuery(currency: string, rounding: number): string {
	return `SELECT neg(round(number(only('${currency}', convert(sum(position), '${currency}'))), ${rounding})) AS _thisMonthIncome WHERE account ~ '^Income' AND month=month(today()) AND year=year(today())`;
}

export function getThisMonthExpensesQuery(currency: string, rounding: number): string {
	return `SELECT round(number(only('${currency}', convert(sum(position), '${currency}'))), ${rounding}) AS _thisMonthExpenses WHERE account ~ '^Expenses' AND month=month(today()) AND year=year(today())`;
}

export function getThisMonthSavingsQuery(currency: string, rounding: number): string {
	return `SELECT neg(round(number(only('${currency}', convert(sum(position), '${currency}'))), ${rounding})) AS _thisMonthNetWorthChange WHERE account ~ '^(Income|Expenses)' AND month=month(today()) AND year=year(today())`;
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
 * Query for file validation using bean-query with ERRORS query
 * Returns validation errors from the Beancount file
 * Note: ERRORS query returns formatted text, not CSV, so don't use -f csv flag
 * @param {string} filePath - Path to beancount file.
 * @param {string} commandBase - Base command (bean-query).
 * @returns {string} The validation command string.
 */
export function getBeanCheckCommand(filePath: string, commandBase: string): string {
	// Use bean-query with ERRORS query to get validation errors
	// This keeps the plugin dependent only on bean-query
	// Note: Don't use -f csv flag as ERRORS returns formatted text
	return `${commandBase} "${filePath}" "ERRORS"`;
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

// --- Price Queries ---

/**
 * Gets price history for a specific commodity.
 * @param {string} commodity - The commodity symbol.
 * @returns {string} The BQL query string.
 */
export function getPriceHistoryQuery(commodity: string): string {
	return `SELECT date, position, meta('filename') FROM #prices WHERE currency='${commodity}' ORDER BY date DESC`;
}

/**
 * Gets commodities with stale prices (older than specified days).
 * @param {number} daysOld - Number of days to consider price stale.
 * @param {string} currency - The operating currency.
 * @returns {string} The BQL query string.
 */
export function getStaleCommoditiesQuery(daysOld: number, currency: string): string {
	return `SELECT currency AS commodity_, last(date) AS lastdate_, round(getprice(last(currency), '${currency}'),2) AS price_ FROM #prices GROUP BY currency HAVING today() - last(date) > ${daysOld}`;
}

/**
 * Gets all prices ordered by date (most recent first).
 * @param {number} [limit=100] - Maximum number of prices to return.
 * @returns {string} The BQL query string.
 */
export function getAllPricesQuery(limit: number = 100): string {
	return `SELECT date, currency, position FROM #prices ORDER BY date DESC LIMIT ${limit}`;
}
