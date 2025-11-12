// src/queries/index.ts

// --- Types for Filters (Optional but helpful) ---
export interface TransactionFilters {
	account?: string | null;
	startDate?: string | null;
	endDate?: string | null;
	payee?: string | null;
	tag?: string | null;
}

// --- Query Functions ---

/** Gets all unique account names */
export function getAllAccountsQuery(): string {
	return `SELECT account`; // Post-processing needed for unique list
}

/** Gets all unique tags */
export function getAllTagsQuery(): string {
	return `SELECT tags`; // Post-processing needed for unique list
}

// src/queries/index.ts

// ... (other query functions)

/** Gets unconverted inventory of all Asset accounts */
export function getTotalAssetsInventoryQuery(): string { // <-- Renamed
  return `SELECT sum(position) WHERE account ~ '^Assets'`;
}

/** Gets converted cost of all Asset accounts */
export function getTotalAssetsCostQuery(currency: string): string { // <-- NEW
  return `SELECT convert(sum(position), '${currency}') WHERE account ~ '^Assets'`;
}

/** Gets unconverted inventory of all Liability accounts */
export function getTotalLiabilitiesInventoryQuery(): string { // <-- Renamed
  return `SELECT sum(position) WHERE account ~ '^Liabilities'`;
}

/** Gets converted cost of all Liability accounts */
export function getTotalLiabilitiesCostQuery(currency: string): string { // <-- NEW
   return `SELECT convert(sum(position), '${currency}') WHERE account ~ '^Liabilities'`;
}

/** Gets historical cost of all Asset accounts */
export function getTotalAssetsCostQueryByCost(): string {
   return `SELECT sum(cost(position)) WHERE account ~ '^Assets'`;
}

/** Gets historical cost of all Liability accounts */
export function getTotalLiabilitiesCostQueryByCost(): string {
   return `SELECT sum(cost(position)) WHERE account ~ '^Liabilities'`;
}

/** Gets units of all Asset accounts */
export function getTotalAssetsCostQueryByUnits(): string {
   return `SELECT sum(units(position)) WHERE account ~ '^Assets'`;
}

/** Gets units of all Liability accounts */
export function getTotalLiabilitiesCostQueryByUnits(): string {
   return `SELECT sum(units(position)) WHERE account ~ '^Liabilities'`;
}

export function getBalanceSheetQuery(currency: string): string {
	return `SELECT account, convert(sum(position), '${currency}') WHERE account ~ '^(Assets|Liabilities|Equity)' GROUP BY account ORDER BY account`;
}

/** Gets balance sheet at historical cost (no currency conversion) */
export function getBalanceSheetQueryByCost(): string {
	return `SELECT account, cost(sum(position)) WHERE account ~ '^(Assets|Liabilities|Equity)' GROUP BY account ORDER BY account`;
}

/** Gets balance sheet in raw units (no cost or currency conversion) */
export function getBalanceSheetQueryByUnits(): string {
	return `SELECT account, units(sum(position)) WHERE account ~ '^(Assets|Liabilities|Equity)' GROUP BY account ORDER BY account`;
}

/** Gets balances for ALL account types (Assets, Liabilities, Equity, Income, Expenses) */
export function getAllAccountBalancesQuery(currency: string): string {
	return `SELECT account, convert(sum(position), '${currency}') GROUP BY account ORDER BY account`;
}

/** Gets balances for different account types */
export function getBalanceReportQuery(reportType: 'assets' | 'liabilities' | 'equity' | 'income' | 'expenses'): string {
	let accountPrefix = '';
	switch (reportType) {
		case 'assets': accountPrefix = '^Assets'; break;
		case 'liabilities': accountPrefix = '^Liabilities'; break;
		case 'equity': accountPrefix = '^Equity'; break;
		case 'income': accountPrefix = '^Income'; break;
		case 'expenses': accountPrefix = '^Expenses'; break;
	}
	return `SELECT account, sum(position) WHERE account ~ '${accountPrefix}' GROUP BY account`;
}

/** Gets transactions based on filters */
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

/** Simple query for connection testing */
export function getTestConnectionQuery(): string {
	return `SELECT account LIMIT 1`;
}

/** Query for bean-check (Note: runQuery expects CSV, bean-check might not output CSV) */
// This might need a separate function if bean-check output needs different handling
export function getBeanCheckCommand(filePath: string, commandBase: string): string {
	const checkCommandBase = commandBase.replace(/bean-query(.exe)?$/, 'bean-check$1');
	return `${checkCommandBase} "${filePath}"`;
}

export function getMonthlyIncomeQuery(startDate: string, endDate: string, currency: string): string { // Must accept 3 args
	return `SELECT convert(sum(position), '${currency}') WHERE account ~ '^Income' AND date >= ${startDate} AND date <= ${endDate}`;
}

export function getMonthlyExpensesQuery(startDate: string, endDate: string, currency: string): string { // Must accept 3 args
	return `SELECT convert(sum(position), '${currency}') WHERE account ~ '^Expenses' AND date >= ${startDate} AND date <= ${endDate}`;
}

export function getHistoricalNetWorthDataQuery(interval: string = 'month', currency: string): string { // Must accept 2 args
	return `SELECT ${interval}, account, convert(SUM(position), '${currency}') WHERE account ~ '^(Assets|Liabilities)' GROUP BY ${interval}, account ORDER BY ${interval}, account`;
}

/** Gets all commodities with their metadata from the #commodities table */
export function getCommoditiesQuery(): string {
	return `SELECT name, meta, meta('price'), getprice(name, 'INR') FROM #commodities`;
}

/** Gets specific commodity details by name */
export function getCommodityDetailsQuery(commodity: string): string {
	return `SELECT name, meta, meta('price'), getprice(name, 'INR') FROM #commodities WHERE name = '${commodity}'`;
}

/** Checks if any commodities exist in the ledger */
export function getPriceDataAvailabilityQuery(): string {
	return `SELECT COUNT(*) as commodity_count FROM #commodities`;
}

/** Gets full journal entries with all postings for each transaction */
export function getJournalTransactionsQuery(limit: number = 1000): string {
	return `SELECT date, flag, payee, narration, tags, account, position ORDER BY date DESC, lineno DESC LIMIT ${limit}`;
}

/** Gets recent journal entries for performance (last 6 months by default) */
export function getRecentJournalTransactionsQuery(monthsBack: number = 6): string {
	const startDate = new Date();
	startDate.setMonth(startDate.getMonth() - monthsBack);
	const dateStr = startDate.toISOString().split('T')[0];
	return `SELECT date, flag, payee, narration, tags, account, position WHERE date >= ${dateStr} ORDER BY date DESC, lineno DESC LIMIT 2000`;
}