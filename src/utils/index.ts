// src/utils/index.ts
//
// BARREL FILE — re-exports everything from the domain-specific utility modules.
// All existing `import { ... } from '../utils/index'` calls continue to work unchanged.
//
// Internal module structure:
//   queryRunner.ts  – runQuery (BQL execution)
//   fileEditor.ts   – atomicFileWrite, createBackupFile, convertWindowsPathToWsl, convertWslPathToWindows
//   formatters.ts   – extractConvertedAmountNumber, extractNonReportingCurrencies,
//                     formatCurrency, getCurrentMonthRange, parseMetadataString, debounce
//   csvParsers.ts   – parseCommoditiesListCSV, parseCommoditiesPriceDataCSV, parseCommodityDetailsCSV
//   accounts.ts     – buildAccountTree, getOpenAccounts, getPayees, getTags, getCommodities
//   journal.ts      – getTransactionEntries, getBalanceEntries, getNoteEntries
//   directives.ts   – all create/delete/update operations + generateTransactionText + validateCommodityLocation

export { runQuery, type BQLFormat } from './queryRunner';
export { splitCommandLine, execSafe } from './execSafe';
export { convertWindowsPathToWsl, convertWslPathToWindows, atomicFileWrite, createBackupFile, readFileContent, getVaultRelativePath } from './fileEditor';
export {
	parseMetadataString,
	debounce,
	parsePeriodLabel,
	formatAmount,
	formatCurrency,
	formatSignificantAmount,
} from './formatters';
export { countDecimals, parseCurrencyNumberCSV, buildPrecisionMap } from './currencyPrecision';
export { parseCommoditiesListCSV, parseCommoditiesPriceDataCSV, parseCommodityDetailsCSV, parseCombinedCommodityDataCSV, parseCommodityPriceHistoryCSV, parseAccountDetailCSV } from './csvParsers';
export { buildAccountTree, getOpenAccounts, getPayees, getTags, getCommodities } from './accounts';
export { getTransactionEntries, getBalanceEntries, getNoteEntries } from './journal';
export {
	generateTransactionText,
	createTransaction,
	createSnippet,
	updateTransaction,
	deleteTransaction,
	createBalanceAssertion,
	updateBalance,
	deleteBalance,
	createNote,
	updateNote,
	deleteNote,
	createCommodity,
	saveCommodityMetadata,
	deleteCommodityDirective,
	createPriceDirective,
	saveOpenDirective,
	saveCloseDirective,
	updateAccountReconcileMetadata,
	createPadDirective,
	validateCommodityLocation,
	updateOperatingCurrency,
	createQueryDirective,
	getQueryDirectives,
	createIndicatorDirective,
	updateIndicatorDirective,
	deleteIndicatorDirective,
	createScheduleDirective,
	updateScheduleDirective,
	deleteScheduleDirective,
	advanceScheduleDate,
	computeScheduleDisplayAmount,
	computeDueOccurrences,
	type TransactionData,
	type BalanceData,
	type NoteData,
	type CostData,
	type PriceDataPayload,
	type PostingStub,
	type ScheduleDirectiveParams,
} from './directives';

// Re-export structuredLayout helpers that some callers pull from utils/index
export { getTargetFile, getMainLedgerPath, ensureTransactionFile } from './structuredLayout';
export type { OperationType } from './structuredLayout';

// Re-export validation utilities (still implemented here until moved)
export { validatePriceSource, validateLogoUrl } from './validators';

// Re-export accountQuery helpers (build/parse the Indicator accountQuery string)
export { buildAccountQuery, parseAccountQuery } from './accountQuery';
