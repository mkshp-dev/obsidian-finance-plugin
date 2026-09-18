// src/services/accountDetail.service.ts

import { parse as parseCsv } from 'csv-parse/sync';
import type BeancountPlugin from '../main';
import { runQuery } from '../utils/queryRunner';
import { getAccountDetailQuery, getAccountBalanceHistoryQuery, getLastBalanceDateQuery, getLatestBalanceStatusQuery } from '../queries/index';
import { parseAccountDetailCSV, parseAccountBalanceHistoryMonthlyCSV, parseAccountBalanceHistoryWeeklyCSV } from '../utils/csvParsers';
import { computeReconciliationStatus } from './reconciliation.service';
import { Logger } from '../utils/logger';

/**
 * Full detail for a single account: open/close/currencies plus its
 * reconciliation status, used by the Account Details modal.
 */
export interface AccountDetail {
	account: string;
	openDate: string | null;
	closeDate: string | null;
	isClosed: boolean;
	currencies: string[];
	reconcileDays: number | null;
	filename: string | null;
	lineno: number | null;
	/** ISO date of the most recent PASSING balance assertion, or null if never reconciled. */
	lastBalanceDate: string | null;
	daysSinceLastBalance: number | null;
	/** True when the account needs attention: past its reconciliation window, OR its latest balance assertion is currently failing (see #272). Only meaningful when reconcileDays is set. */
	isOverdue: boolean;
	/** True when the account's MOST RECENT balance assertion (pass or fail) is currently failing. */
	isFailing: boolean;
	failingDate: string | null;
	failingDiscrepancy: string | null;
	/** Balance trend, converted to balanceHistoryCurrency. */
	balanceHistoryMonthly: Array<{ date: string; label: string; value: number }>;
	balanceHistoryWeekly: Array<{ date: string; label: string; value: number }>;
	balanceHistoryCurrency: string;
}

/**
 * On-demand detail fetch for the Account Details modal — a stateless
 * counterpart to CommoditiesController.loadCommodityDetails(), since account
 * rows in BalanceSheetController's AccountItem intentionally don't carry this
 * per-account detail (see plan: fetched fresh whenever the modal opens).
 *
 * Reuses the existing bulk getLastBalanceDateQuery/getLatestBalanceStatusQuery
 * (already run ledger-wide by reconciliation.service.ts) and filters
 * client-side to the one account, rather than adding per-account variants.
 */
export async function getAccountDetail(plugin: BeancountPlugin, account: string): Promise<AccountDetail> {
	Logger.log('[AccountDetail] Fetching detail for', account);

	const balanceHistoryCurrency = plugin.settings.operatingCurrency || 'USD';

	const [detailCsv, lastBalanceCsv, latestStatusCsv, balanceHistoryMonthlyCsv, balanceHistoryWeeklyCsv] = await Promise.all([
		runQuery(plugin, getAccountDetailQuery(account)),
		runQuery(plugin, getLastBalanceDateQuery()),
		runQuery(plugin, getLatestBalanceStatusQuery()),
		runQuery(plugin, getAccountBalanceHistoryQuery(account, 'month', balanceHistoryCurrency)),
		runQuery(plugin, getAccountBalanceHistoryQuery(account, 'week', balanceHistoryCurrency)),
	]);

	const balanceHistoryMonthly = parseAccountBalanceHistoryMonthlyCSV(balanceHistoryMonthlyCsv);
	const balanceHistoryWeekly = parseAccountBalanceHistoryWeeklyCSV(balanceHistoryWeeklyCsv);

	const detail = parseAccountDetailCSV(detailCsv);
	const isClosed = !!detail.closeDate;

	let lastBalanceDate: string | null = null;
	let daysSinceLastBalance: number | null = null;
	let isOverdue = false;

	if (!isClosed && detail.reconcileDays && detail.reconcileDays > 0) {
		const lastBalanceRows = parseCsv(lastBalanceCsv, {
			columns: true,
			skip_empty_lines: true,
			trim: true,
		}) as unknown as { account: string; last_balance_date: string }[];
		lastBalanceDate = lastBalanceRows.find(r => r.account === account)?.last_balance_date ?? null;

		const status = computeReconciliationStatus(detail.reconcileDays, lastBalanceDate);
		daysSinceLastBalance = status.daysSinceLastBalance;
		isOverdue = status.isOverdue;
	}

	const latestStatusRows = parseCsv(latestStatusCsv, {
		columns: true,
		skip_empty_lines: true,
		trim: true,
	}) as unknown as { account: string; last_date: string; last_discrepancy: string }[];
	const latestStatus = latestStatusRows.find(r => r.account === account);
	const isFailing = !!(latestStatus && latestStatus.last_discrepancy);

	return {
		...detail,
		isClosed,
		lastBalanceDate,
		daysSinceLastBalance,
		// A currently-failing assertion always needs attention, even if an
		// older passing balance is still within the interval window (#272).
		isOverdue: isOverdue || isFailing,
		isFailing,
		failingDate: isFailing ? (latestStatus.last_date || null) : null,
		failingDiscrepancy: isFailing ? latestStatus.last_discrepancy : null,
		balanceHistoryMonthly,
		balanceHistoryWeekly,
		balanceHistoryCurrency,
	};
}
