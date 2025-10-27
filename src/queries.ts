// src/queries.ts

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

/** Gets sum for Asset accounts */
export function getTotalAssetsQuery(): string {
	return `SELECT sum(position) WHERE account ~ '^Assets'`;
}

/** Gets sum for Liability accounts */
export function getTotalLiabilitiesQuery(): string {
	return `SELECT sum(position) WHERE account ~ '^Liabilities'`;
}

/** Gets sum for Income accounts within a date range */
export function getMonthlyIncomeQuery(startDate: string, endDate: string): string {
	return `SELECT sum(position) WHERE account ~ '^Income' AND date >= ${startDate} AND date <= ${endDate}`;
}

/** Gets sum for Expense accounts within a date range */
export function getMonthlyExpensesQuery(startDate: string, endDate: string): string {
	return `SELECT sum(position) WHERE account ~ '^Expenses' AND date >= ${startDate} AND date <= ${endDate}`;
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
export function getTransactionsQuery(filters: TransactionFilters): string {
	const selectPart = `SELECT date, payee, narration, position`; // Default columns
	const whereClauses: string[] = [];
	const orderByPart = `ORDER BY date DESC`;

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
			whereClauses.push(`HAS_TAG('${tagName}')`);
		}
	}

	// Construct the final query
	if (whereClauses.length > 0) {
		return `${selectPart} WHERE ${whereClauses.join(' AND ')} ${orderByPart}`;
	} else {
		return `${selectPart} ${orderByPart}`; // No WHERE needed
	}
}

/** Gets detailed postings for journal view (grouped) */
export function getJournalGroupedQuery(): string {
	return `SELECT date, payee, narration, tags, links, id, account, position ORDER BY date DESC, id`;
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