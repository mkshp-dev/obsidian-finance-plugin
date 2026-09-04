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


function valuationDateArgument(asOfDate?: string): string {
	return asOfDate ? `, ${asOfDate}` : '';
}

function asOfDateClause(asOfDate?: string): string {
	return asOfDate ? ` AND date < ${asOfDate}` : '';
}

export function getTotalAssetsQuery(currency: string, rounding: number, asOfDate?: string): string {
	return `SELECT round(number(only('${currency}', convert(sum(position), '${currency}'${valuationDateArgument(asOfDate)}))), ${rounding}) AS _totalAssets WHERE account ~ '^Assets'${asOfDateClause(asOfDate)}`;
}

export function getTotalLiabilitiesQuery(currency: string, rounding: number, asOfDate?: string): string {
	return `SELECT neg(round(number(only('${currency}', convert(sum(position), '${currency}'${valuationDateArgument(asOfDate)}))), ${rounding})) AS _totalLiabilities WHERE account ~ '^Liabilities'${asOfDateClause(asOfDate)}`;
}

export function getTotalWorthQuery(currency: string, rounding: number, asOfDate?: string): string {
	return `SELECT round(number(only('${currency}', convert(sum(position), '${currency}'${valuationDateArgument(asOfDate)}))), ${rounding}) AS _totalWorth WHERE account ~ '^(Assets|Liabilities)'${asOfDateClause(asOfDate)}`;
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

export function getPeriodIncomeQuery(currency: string, rounding: number, startDate: string, endDate: string): string {
	return `SELECT neg(round(number(only('${currency}', convert(sum(position), '${currency}'))), ${rounding})) AS _periodIncome WHERE account ~ '^Income' AND date >= ${startDate} AND date < ${endDate}`;
}

export function getPeriodExpensesQuery(currency: string, rounding: number, startDate: string, endDate: string): string {
	return `SELECT round(number(only('${currency}', convert(sum(position), '${currency}'))), ${rounding}) AS _periodExpenses WHERE account ~ '^Expenses' AND date >= ${startDate} AND date < ${endDate}`;
}

export function getPeriodSavingsQuery(currency: string, rounding: number, startDate: string, endDate: string): string {
	return `SELECT neg(round(number(only('${currency}', convert(sum(position), '${currency}'))), ${rounding})) AS _periodNetIncome WHERE account ~ '^(Income|Expenses)' AND date >= ${startDate} AND date < ${endDate}`;
}

export function getBalanceSheetQuery(currency: string): string {
	return `SELECT account, number(only('${currency}', convert(sum(position), '${currency}'))) as operating_currency, subst('^\\([ ,]*', '(', subst('[ ,]*\\)$', ')', subst(', *[-.0-9]+ ${currency}|[-.0-9]+ ${currency} *,?', '', str(convert(sum(position), '${currency}'))))) as other_currencies WHERE account ~ '^(Assets|Liabilities|Equity)' AND NOT close_date(account) GROUP BY account ORDER BY account`;
}

export function getBalanceSheetQueryByCost(currency: string): string {
	return `SELECT account, number(only('${currency}', cost(sum(position)))) as operating_currency, subst('^\\([ ,]*', '(', subst('[ ,]*\\)$', ')', subst(', *[-.0-9]+ ${currency}|[-.0-9]+ ${currency} *,?', '', str(cost(sum(position)))))) as other_currencies WHERE account ~ '^(Assets|Liabilities|Equity)' AND NOT close_date(account) GROUP BY account ORDER BY account`;
}

export function getBalanceSheetQueryByUnits(currency: string): string {
	return `SELECT account, number(only('${currency}', units(sum(position)))) as operating_currency, subst('^\\([ ,]*', '(', subst('[ ,]*\\)$', ')', subst(', *[-.0-9]+ ${currency}|[-.0-9]+ ${currency} *,?', '', str(units(sum(position)))))) as other_currencies WHERE account ~ '^(Assets|Liabilities|Equity)' AND NOT close_date(account) GROUP BY account ORDER BY account`;
}


export function getIncomeStatementQuery(currency: string): string {
	return `SELECT account, number(only('${currency}', convert(sum(position), '${currency}'))) as operating_currency, subst('^\\([ ,]*', '(', subst('[ ,]*\\)$', ')', subst(', *[-.0-9]+ ${currency}|[-.0-9]+ ${currency} *,?', '', str(convert(sum(position), '${currency}'))))) as other_currencies WHERE account ~ '^(Income|Expenses)' AND NOT close_date(account) GROUP BY account ORDER BY account`;
}

export function getIncomeStatementQueryByCost(currency: string): string {
	return `SELECT account, number(only('${currency}', cost(sum(position)))) as operating_currency, subst('^\\([ ,]*', '(', subst('[ ,]*\\)$', ')', subst(', *[-.0-9]+ ${currency}|[-.0-9]+ ${currency} *,?', '', str(cost(sum(position)))))) as other_currencies WHERE account ~ '^(Income|Expenses)' AND NOT close_date(account) GROUP BY account ORDER BY account`;
}

export function getIncomeStatementQueryByUnits(currency: string): string {
	return `SELECT account, number(only('${currency}', units(sum(position)))) as operating_currency, subst('^\\([ ,]*', '(', subst('[ ,]*\\)$', ')', subst(', *[-.0-9]+ ${currency}|[-.0-9]+ ${currency} *,?', '', str(units(sum(position)))))) as other_currencies WHERE account ~ '^(Income|Expenses)' AND NOT close_date(account) GROUP BY account ORDER BY account`;
}

export function getTransactionsQuery(filters: TransactionFilters, limit = 1000): string {
	// `balance` is the running inventory of whichever account each row's posting hit. Without an
	// account filter, rows span every account in the ledger, so any row touching a multi-commodity
	// account (e.g. a brokerage holding dozens of tickers) renders a huge inventory string. Multiplied
	// across up to `limit` rows this can produce a multi-MB CSV response that freezes the UI thread
	// during parsing/rendering on large ledgers. Only request it once scoped to a single account.
	const selectPart = filters.account
		? `SELECT date, payee, narration, position, balance`
		: `SELECT date, payee, narration, position`;
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
		return `SELECT last(date_add(date_trunc('week', date), 6)) AS week_end, number(only('${currency}', convert(last(balance), '${currency}', last(date_add(date_trunc('week', date), 6))))) WHERE account ~ '^(Assets|Liabilities)' GROUP BY date_trunc('week', date) ORDER BY week_end`;
	}
	return `SELECT year, month, number(only('${currency}', convert(last(balance), '${currency}', last(date_add(date(year + int(month/12), (month%12+1), 1), -1))))) WHERE account ~ '^(Assets|Liabilities)' GROUP BY year, month ORDER BY year, month`;
}


export function getHistoricalNetProfitDataQuery(interval: 'month' | 'week' = 'month', currency: string): string {
	if (interval === 'week') {
		return `SELECT last(date_add(date_trunc('week', date), 6)) AS week_end, number(only('${currency}', convert(sum(position), '${currency}', last(date_add(date_trunc('week', date), 6))))) WHERE account ~ '^(Income|Expenses)' GROUP BY date_trunc('week', date) ORDER BY week_end`;
	}
	return `SELECT year, month, number(only('${currency}', convert(sum(position), '${currency}', last(date_add(date(year + int(month/12), (month%12+1), 1), -1))))) AS _worth WHERE account ~ '^(Income|Expenses)' GROUP BY year, month ORDER BY year, month`;
}

export function getHistoricalExpenseDataQuery(interval: 'month' | 'week' = 'month', currency: string): string {
	if (interval === 'week') {
		return `SELECT last(date_add(date_trunc('week', date), 6)) AS week_end, number(only('${currency}', convert(sum(position), '${currency}', last(date_add(date_trunc('week', date), 6))))) WHERE account ~ '^(Expenses)' GROUP BY date_trunc('week', date) ORDER BY week_end`;
	}
	return `SELECT year, month, number(only('${currency}', convert(sum(position), '${currency}', last(date_add(date(year + int(month/12), (month%12+1), 1), -1))))) AS _worth WHERE account ~ '^(Expenses)' GROUP BY year, month ORDER BY year, month`;
}

export function getHistoricalIncomeDataQuery(interval: 'month' | 'week' = 'month', currency: string): string {
	if (interval === 'week') {
		return `SELECT last(date_add(date_trunc('week', date), 6)) AS week_end, number(only('${currency}', convert(sum(position), '${currency}', last(date_add(date_trunc('week', date), 6))))) WHERE account ~ '^(Income)' GROUP BY date_trunc('week', date) ORDER BY week_end`;
	}
	return `SELECT year, month, number(only('${currency}', convert(sum(position), '${currency}', last(date_add(date(year + int(month/12), (month%12+1), 1), -1))))) AS _worth WHERE account ~ '^(Income)' GROUP BY year, month ORDER BY year, month`;
}
// --- List Budget/Target Quries ---	
export function getBudgetListQuery(): string {
	return `SELECT date AS _startDate, meta('name') AS _name, meta('accountQuery') AS _accountString, meta('cycle') AS _period, bool(meta('isRollover')) AS _isRollOver, meta('target') AS _budgetAmount, meta('currency') AS _currency, meta('tag') AS _tag, meta('tagMode') AS _tagMode, meta('filename') AS _filename, meta('lineno') AS _lineno FROM events WHERE type='Indicator' AND description='Budget'`;
}

export function getTargetListQuery(): string {
	return `SELECT date AS _startDate, meta('name') AS _name, meta('accountQuery') AS _accountString, meta('cycle') AS _period, bool(meta('isRollover')) AS _isRollOver, meta('target') AS _targetAmount, meta('currency') AS _currency, meta('tag') AS _tag, meta('tagMode') AS _tagMode, meta('filename') AS _filename, meta('lineno') AS _lineno FROM events WHERE type='Indicator' AND description='Target'`;
}

// --- Scheduled/Recurring Transactions Query ---

/** Max postings a single schedule can carry — the SELECT enumerates this many
 * posting{N}Account/Amount/Currency meta columns unconditionally (most are
 * NULL for schedules with fewer postings), since BQL can't select a dynamic
 * number of columns in one query. */
export const MAX_SCHEDULE_POSTINGS = 8;

export function getScheduleListQuery(): string {
	const postingCols: string[] = [];
	for (let i = 1; i <= MAX_SCHEDULE_POSTINGS; i++) {
		postingCols.push(`meta('posting${i}Account') AS _p${i}account`);
		postingCols.push(`meta('posting${i}Amount') AS _p${i}amount`);
		postingCols.push(`meta('posting${i}Currency') AS _p${i}currency`);
	}
	return `SELECT date AS _startDateCol, description AS _name, meta('frequency') AS _frequency, meta('startDate') AS _startDate, meta('nextDate') AS _nextDate, meta('lastGenerated') AS _lastGenerated, bool(meta('active')) AS _active, meta('payee') AS _payee, meta('narration') AS _narration, meta('flag') AS _flag, meta('tags') AS _tags, meta('links') AS _links, meta('displayAmount') AS _displayAmount, meta('displayCurrency') AS _displayCurrency, meta('postingCount') AS _postingCount, ${postingCols.join(', ')}, meta('filename') AS _filename, meta('lineno') AS _lineno FROM events WHERE type='Recurring'`;
}

/**
 * Dedupe check used before materializing a due occurrence: does a
 * transaction already exist tagged `scheduled: "<name>"` on this exact date?
 * (e.g. the confirm modal was resubmitted, or nextDate drifted stale.)
 * Mirrors the `FROM postings WHERE id = ...` lookup shape already used by
 * updateTransaction()/deleteTransaction() in transactionDirectives.ts.
 *
 * NOTE: uses `entry_meta()`, not `meta()` — when querying `FROM postings`,
 * `meta()` resolves *posting-level* metadata (empty here, since `scheduled`
 * is set on the transaction), while `entry_meta()` resolves the parent
 * transaction's metadata. Verified directly against bean-query: `meta()`
 * returned blank for every row, `entry_meta()` returned the tag correctly.
 *
 * Also, the metadata key must start lowercase — beancount grammar requires
 * `[a-z][a-zA-Z0-9\-_]*` for metadata keys.
 */
export function getScheduledOccurrenceExistsQuery(name: string, date: string): string {
	const sanitizedName = name.replace(/'/g, "''");
	return `SELECT id FROM postings WHERE entry_meta('scheduled') = '${sanitizedName}' AND date = ${date} LIMIT 1`;
}


// --- Budget/Target Queries ---

/**
 * Returns the total of postings to the indicator's account that fall within
 * the CURRENT cycle (week / month / quarter / year), aggregated into ONE row.
 *
 * Design notes:
 *   - The previous implementation for rollover indicators grouped by
 *     (year, month) and returned `ORDER BY ... DESC LIMIT 1`. That subtly
 *     broke when the current cycle had no postings yet: the LIMIT 1 would
 *     return the most recent PAST cycle's row, so `_expenseThisCycle`
 *     reflected last cycle's spending displayed as if it were this cycle's.
 *   - The new query has no non-aggregate columns in SELECT, so bean-query
 *     produces exactly one aggregated row (or zero rows if there are no
 *     matching postings). That eliminates the wrong-cycle-row class of bugs.
 *   - For rollover indicators we no longer compute `_remainingThisCycle` in
 *     SQL — the client recomputes it from `getIndicatorBalanceQuery` so the
 *     no-postings-ever case (which previously returned zero SQL rows and
 *     therefore zero rollover) is handled correctly.
 */
export function getIndicatorStatusQuery(currency: string, accountString: string, period: string, tag?: string | null, tagMode?: 'has' | 'not_has'): string {
	// Tag filter: optional, can either require a tag (#tag IN tags) or exclude one (NOT IN tags).
	// Strip a leading '#' if the user typed it; escape single quotes by doubling per bean-query string literal rules.
	const sanitizedTag = tag ? tag.trim().replace(/^#/, '').replace(/'/g, "''") : '';
	const tagClause = sanitizedTag
		? (tagMode === 'not_has' ? `NOT '${sanitizedTag}' IN tags` : `'${sanitizedTag}' IN tags`)
		: '';
	// Aggregate-only SELECT → single row.
	//   `sum(position)` totals all matching postings into a multi-currency inventory.
	//   `convert(..., currency)` reduces that inventory to the indicator's display currency.
	//   `only(currency, ...)` extracts the numeric leg in that currency.
	//   `number(...)` strips the currency tag so the CSV value is a plain number.
	// The `date_trunc(period, date) = date_trunc(period, today())` filter restricts
	// the sum to postings whose cycle bucket matches today's cycle bucket — i.e. THIS cycle.
	return `SELECT number(only('${currency}', convert(sum(position), '${currency}'))) AS _expenseThisCycle WHERE account ~ '^${accountString}' AND date_trunc('${period}', date)=date_trunc('${period}', today())${tagClause ? ` AND ${tagClause}` : ''}`;
}

/**
 * Returns the cumulative balance of postings to the account on or after
 * `startDate`, aggregated into ONE row. Used by rollover indicators to derive
 * `remaining = elapsedCycles * targetAmount - balance` on the client.
 *
 * Why this exists as a separate query:
 *   - Rollover semantics need TWO different aggregation scopes in one report:
 *       (a) current-cycle expense (filtered to today's cycle)
 *       (b) total accumulated balance since the indicator started
 *     bean-query doesn't combine those two scopes cleanly in a single SELECT,
 *     so we run two queries and combine the values client-side.
 *   - `sum(position)` over all postings since `startDate` is equivalent to
 *     `last(balance)` for accounts that don't carry an opening inventory,
 *     which is the case for every account a budget/target would target
 *     (expenses for budgets, assets for savings targets).
 */
export function getIndicatorBalanceQuery(currency: string, accountString: string, startDate: string, tag?: string | null, tagMode?: 'has' | 'not_has'): string {
	// Same tag-clause handling as in getIndicatorStatusQuery — kept inline rather than
	// extracted to keep each query function self-contained and easy to read in isolation.
	const sanitizedTag = tag ? tag.trim().replace(/^#/, '').replace(/'/g, "''") : '';
	const tagClause = sanitizedTag
		? (tagMode === 'not_has' ? `NOT '${sanitizedTag}' IN tags` : `'${sanitizedTag}' IN tags`)
		: '';
	// `date >= ${startDate}` uses bean-query's date-literal syntax (unquoted YYYY-MM-DD),
	// matching the pattern already used elsewhere in this file (see `getTransactionsQuery`).
	return `SELECT number(only('${currency}', convert(sum(position), '${currency}'))) AS _balance WHERE account ~ '^${accountString}' AND date>=${startDate}${tagClause ? ` AND ${tagClause}` : ''}`;
}



// --- Commodities Queries ---

function escapeBqlString(value: string): string {
	return value.replace(/'/g, "''");
}

export function getAllCommoditiesQuery(): string {
	return `SELECT name AS name_ FROM #commodities GROUP BY name`;
}

export function getCommoditiesPriceDataQuery(currency: string): string {
	const safeCurrency = escapeBqlString(currency);
	// Rounded to a generous 10 decimals (not hardcoded to 2) so low-value/crypto
	// commodity prices aren't truncated before the client applies per-currency
	// display precision — see CurrencyPrecisionService.
	return `SELECT last(date) AS date_, last(currency) AS currency_, currency_meta(last(currency), 'name') AS displayname_, round(getprice(last(currency), '${safeCurrency}'),10) AS price_, currency_meta(last(currency), 'logo') AS logo_, bool(today()-1<last(date)) AS islatest_ FROM #prices GROUP BY currency`;
}



/**
 * Combined holdings query: all data needed to populate the commodity tab in one pass.
 * For each currency held in Asset accounts, returns:
 *   - currency_  : commodity symbol (e.g. "DOGE")
 *   - displayname_: human-readable display name from commodity metadata
 *   - units_     : raw inventory string (e.g. "65.64 DOGE")
 *   - valueOp_   : holdings converted to operating currency (e.g. "658.37 INR")
 *   - price_     : latest price in operating currency (e.g. 10.03)
 *   - logo_      : logo URL from commodity metadata
 */
export function getCombinedCommodityDataQuery(operatingCurrency: string): string {
	const safeOperatingCurrency = escapeBqlString(operatingCurrency);
	// See getCommoditiesPriceDataQuery — 10 decimals to avoid truncating price_ server-side.
	return `SELECT currency AS currency_, currency_meta(last(currency), 'name') AS displayname_, units(sum(position)) AS units_, convert(sum(position), '${safeOperatingCurrency}') AS valueOp_, round(getprice(last(currency), '${safeOperatingCurrency}'), 10) AS price_, currency_meta(last(currency), 'logo') AS logo_ WHERE account ~ '^Assets' GROUP BY currency`;
}


export function getCommodityDetailsQuery(symbol: string): string {
	const safeSymbol = escapeBqlString(symbol);
	return `SELECT name AS name_, currency_meta(last(name), 'name') AS displayname_, last(meta) AS meta_, currency_meta(last(name),'logo') AS logo_, currency_meta(last(name), 'price') AS pricemetadata_, meta('filename') AS filename_, meta('lineno') AS lineno_ FROM #commodities WHERE name='${safeSymbol}'`;
}

export function getCommodityPriceHistoryQuery(symbol: string): string {
	const safeSymbol = escapeBqlString(symbol);
	return `SELECT date AS date_, amount AS amount_ FROM #prices WHERE currency='${safeSymbol}' ORDER BY date`;
}

// --- Price Queries ---

export function getAllCurrenciesQuery(): string {
	return `SELECT distinct(currency) AS currency_`;
}

// --- Currency Precision Queries ---
// Bootstrap data for CurrencyPrecisionService: infers each currency's typical
// decimal precision from how it's actually written in the ledger (postings +
// price directives), the same signal Beancount's own DisplayContext uses.

export function getPostingsCurrencyNumberQuery(): string {
	return `SELECT currency, number`;
}

export function getPriceDirectivesCurrencyAmountQuery(): string {
	return `SELECT currency, amount FROM #prices`;
}

// --- Reconciliation Queries ---

/**
 * Returns open accounts that have a `reconcile` metadata key on their open directive.
 * The value is the number of days the user wants between reconciliations.
 *
 * Uses `open.meta['reconcile']` dict-key access on the `#accounts` table,
 * since `account_meta()` is not available in all beanquery versions.
 */
export function getReconcileAccountsQuery(): string {
	return `SELECT account, open.meta['reconcile'] AS reconcile_days FROM #accounts WHERE NOT bool(close) AND open.meta['reconcile'] IS NOT NULL`;
}

/**
 * Returns the most recent PASSING balance assertion date for each account
 * that has at least one balance directive. Uses the dedicated `#balances`
 * table which exposes `account` as a plain string (unlike `#entries.accounts`
 * which is a set and cannot be grouped).
 *
 * `WHERE discrepancy IS NULL` excludes failed assertions: bean-query still
 * records a row for a `balance` directive that didn't check out, with the
 * mismatch amount in `discrepancy`. Without this filter, an account with a
 * failing assertion would be reported as "reconciled" on the assertion's
 * date even though the ledger doesn't actually balance (issue #272).
 */
export function getLastBalanceDateQuery(): string {
	return `SELECT account, max(date) AS last_balance_date FROM #balances WHERE discrepancy IS NULL GROUP BY account`;
}

/**
 * Returns each account's MOST RECENT balance assertion regardless of whether
 * it passed, using the same `last(...)`-per-group idiom as
 * getCommodityDetailsQuery/getCommoditiesPriceDataQuery. Unlike
 * getLastBalanceDateQuery (which must stay filtered to passing assertions for
 * the overdue calculation, see #272), this answers a different question:
 * "is this account's latest balance check currently failing?" —
 * `last_discrepancy IS NOT NULL` means yes. Used to gate the "Force
 * reconcile" (pad directive) action, which only makes sense against an
 * actually-failing assertion.
 */
export function getLatestBalanceStatusQuery(): string {
	return `SELECT account, last(date) AS last_date, last(discrepancy) AS last_discrepancy FROM #balances GROUP BY account`;
}

/**
 * Returns open/close dates, declared currencies, `reconcile` metadata, and
 * the open directive's filename/lineno (for later in-place metadata edits)
 * for a single account. `.date`/`.currencies`/`.meta['filename']`/
 * `.meta['lineno']` extrapolate the proven `open.meta['reconcile']` idiom
 * from getReconcileAccountsQuery — verify against a real bean-query before
 * relying on this in production.
 */
export function getAccountDetailQuery(account: string): string {
	const safeAccount = escapeBqlString(account);
	return `SELECT account, open.date AS open_date, close.date AS close_date, open.currencies AS currencies, open.meta['reconcile'] AS reconcile_days, open.meta['filename'] AS filename, open.meta['lineno'] AS lineno FROM #accounts WHERE account = '${safeAccount}'`;
}
