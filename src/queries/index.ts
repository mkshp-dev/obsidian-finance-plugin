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

export function getBalanceSheetQuery(currency: string): string {
	return `SELECT account, convert(sum(position), '${currency}') WHERE account ~ '^(Assets|Liabilities|Equity)' AND NOT close_date(account) GROUP BY account ORDER BY account`;
}

export function getBalanceSheetQueryByCost(): string {
	return `SELECT account, cost(sum(position)) WHERE account ~ '^(Assets|Liabilities|Equity)' AND NOT close_date(account) GROUP BY account ORDER BY account`;
}

export function getBalanceSheetQueryByUnits(): string {
	return `SELECT account, units(sum(position)) WHERE account ~ '^(Assets|Liabilities|Equity)' AND NOT close_date(account) GROUP BY account ORDER BY account`;
}


export function getIncomeStatementQuery(currency: string): string {
	return `SELECT account, convert(sum(position), '${currency}') WHERE account ~ '^(Income|Expenses)' AND NOT close_date(account) GROUP BY account ORDER BY account`;
}

export function getIncomeStatementQueryByCost(): string {
	return `SELECT account, cost(sum(position)) WHERE account ~ '^(Income|Expenses)' AND NOT close_date(account) GROUP BY account ORDER BY account`;
}

export function getIncomeStatementQueryByUnits(): string {
	return `SELECT account, units(sum(position)) WHERE account ~ '^(Income|Expenses)' AND NOT close_date(account) GROUP BY account ORDER BY account`;
}

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

export function getBeanCheckCommand(filePath: string, commandBase: string): string {
	// Use bean-query with ERRORS query to get validation errors
	// This keeps the plugin dependent only on bean-query
	// Note: Don't use -f csv flag as ERRORS returns formatted text
	return `${commandBase} "${filePath}" "ERRORS"`;
}

export function getHistoricalNetWorthDataQuery(interval: 'month' | 'week' = 'month', currency: string): string {
	if (interval === 'week') {
		return `SELECT last(date_add(date_trunc('week', date), 6)) AS week_end, only('${currency}', convert(last(balance), '${currency}', last(date_add(date_trunc('week', date), 6)))) WHERE account ~ '^(Assets|Liabilities)' GROUP BY date_trunc('week', date) ORDER BY week_end`;
	}
	return `SELECT year, month, only('${currency}', convert(last(balance), '${currency}', last(date_add(date(year + int(month/12), (month%12+1), 1), -1)))) WHERE account ~ '^(Assets|Liabilities)' GROUP BY year, month ORDER BY year, month`;
}


export function getHistoricalNetProfitDataQuery(interval: 'month' | 'week' = 'month', currency: string): string {
	if (interval === 'week') {
		return `SELECT last(date_add(date_trunc('week', date), 6)) AS week_end, only('${currency}', convert(sum(position), '${currency}', last(date_add(date_trunc('week', date), 6)))) WHERE account ~ '^(Income|Expenses)' GROUP BY date_trunc('week', date) ORDER BY week_end`;
	}
	return `SELECT year, month, only('${currency}', convert(sum(position), '${currency}', last(date_add(date(year + int(month/12), (month%12+1), 1), -1)))) AS _worth WHERE account ~ '^(Income|Expenses)' GROUP BY year, month ORDER BY year, month`;
}

export function getHistoricalExpenseDataQuery(interval: 'month' | 'week' = 'month', currency: string): string {
	if (interval === 'week') {
		return `SELECT last(date_add(date_trunc('week', date), 6)) AS week_end, only('${currency}', convert(sum(position), '${currency}', last(date_add(date_trunc('week', date), 6)))) WHERE account ~ '^(Expenses)' GROUP BY date_trunc('week', date) ORDER BY week_end`;
	}
	return `SELECT year, month, only('${currency}', convert(sum(position), '${currency}', last(date_add(date(year + int(month/12), (month%12+1), 1), -1)))) AS _worth WHERE account ~ '^(Expenses)' GROUP BY year, month ORDER BY year, month`;
}

export function getHistoricalIncomeDataQuery(interval: 'month' | 'week' = 'month', currency: string): string {
	if (interval === 'week') {
		return `SELECT last(date_add(date_trunc('week', date), 6)) AS week_end, only('${currency}', convert(sum(position), '${currency}', last(date_add(date_trunc('week', date), 6)))) WHERE account ~ '^(Income)' GROUP BY date_trunc('week', date) ORDER BY week_end`;
	}
	return `SELECT year, month, only('${currency}', convert(sum(position), '${currency}', last(date_add(date(year + int(month/12), (month%12+1), 1), -1)))) AS _worth WHERE account ~ '^(Income)' GROUP BY year, month ORDER BY year, month`;
}
// --- List Budget/Target Quries ---	
export function getBudgetListQuery(): string {
	return `SELECT date AS _startDate, meta('name') AS _name, meta('accountQuery') AS _accountString, meta('cycle') AS _period, bool(meta('isRollover')) AS _isRollOver, meta('target') AS _budgetAmount, meta('currency') AS _currency FROM events WHERE type='Indicator' AND description='Budget'`;
}

export function getTargetListQuery(): string {
	return `SELECT date AS _startDate, meta('name') AS _name, meta('accountQuery') AS _accountString, meta('cycle') AS _period, bool(meta('isRollover')) AS _isRollOver, meta('target') AS _targetAmount, meta('currency') AS _currency FROM events WHERE type='Indicator' AND description='Target'`;
}


// --- Budget/Target Queries ---

export function getIndicatorStatusQuery(isRollOver: boolean, currency: string, accountString: string, budgetAmount: number, startDate: string, period: string): string {
	if (isRollOver) {
		if (period === 'week') {
			return `SELECT year, date_part('week', date), number(only('${currency}', convert(sum(position), '${currency}'))) AS _expenseThisCycle, ((year(today())-year(${startDate}))*52+(date_part('week', today())-date_part('week',${startDate}))+1)*${budgetAmount}-last(number(only('${currency}',convert(balance, '${currency}')))) AS _remainingThisCycle FROM account ~ '^${accountString}' OPEN ON ${startDate} ORDER BY year DESC, date_part('week', date) DESC LIMIT 1`;
		}
		return `SELECT year, month, number(only('${currency}', convert(sum(position), '${currency}'))) AS _expenseThisCycle, ((year(today())-year(${startDate}))*12+(month(today())-month(${startDate}))+1)*${budgetAmount}-last(number(only('${currency}',convert(balance, '${currency}')))) AS _remainingThisCycle FROM account ~ '^${accountString}' OPEN ON ${startDate} ORDER BY year DESC, month DESC LIMIT 1`;
	} else {
		return `SELECT date, number(only('${currency}', convert(sum(position), '${currency}'))) AS _expenseThisCycle, ${budgetAmount}-number(only('${currency}', convert(sum(position), '${currency}'))) AS _remainingThisCycle WHERE account ~ '^${accountString}' AND date_trunc('${period}', date)=date_trunc('${period}', today())`;
	}
}



// --- Commodities Queries ---

export function getAllCommoditiesQuery(): string {
	return `SELECT name AS name_ FROM #commodities GROUP BY name`;
}

export function getCommoditiesPriceDataQuery(currency: string): string {
	return `SELECT last(date) AS date_, last(currency) AS currency_, round(getprice(last(currency), '${currency}'),2) AS price_, currency_meta(last(currency), 'logo') AS logo_, bool(today()-1<last(date)) AS islatest_ FROM #prices GROUP BY currency`;
}


export function getCommodityDetailsQuery(symbol: string): string {
	return `SELECT name AS name_, last(meta) AS meta_, currency_meta(last(name),'logo') AS logo_, currency_meta(last(name), 'price') AS pricemetadata_, meta('filename') AS filename_, meta('lineno') AS lineno_ FROM #commodities WHERE name='${symbol}'`;
}

// --- Price Queries ---

export function getPriceHistoryQuery(commodity: string): string {
	return `SELECT date, position, meta('filename') FROM #prices WHERE currency='${commodity}' ORDER BY date DESC`;
}

export function getStaleCommoditiesQuery(daysOld: number, currency: string): string {
	return `SELECT currency AS commodity_, last(date) AS lastdate_, round(getprice(last(currency), '${currency}'),2) AS price_ FROM #prices GROUP BY currency HAVING today() - last(date) > ${daysOld}`;
}

export function getAllPricesQuery(limit: number = 100): string {
	return `SELECT date, currency, position FROM #prices ORDER BY date DESC LIMIT ${limit}`;
}

export function getAllCurrenciesQuery(): string {
	return `SELECT distinct(currency) AS currency_`;
}