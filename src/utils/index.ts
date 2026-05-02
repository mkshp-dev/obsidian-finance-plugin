// src/utils/index.ts
//
// BARREL FILE — re-exports everything from the domain-specific utility modules.
// All existing `import { ... } from '../utils/index'` calls continue to work unchanged.
//
// Internal module structure:
//   queryRunner.ts  – runQuery (BQL execution)
//   fileEditor.ts   – atomicFileWrite, createBackupFile, convertWindowsPathToWsl, convertWslPathToWindows
//   formatters.ts   – parseSingleValue, parseAmount, extractConvertedAmount, extractNonReportingCurrencies,
//                     formatCurrency, getCurrentMonthRange, parseMetadataString, debounce
//   csvParsers.ts   – parseCommoditiesListCSV, parseCommoditiesPriceDataCSV, parseCommodityDetailsCSV
//   accounts.ts     – buildAccountTree, getOpenAccounts, getPayees, getTags, getCommodities
//   journal.ts      – getTransactionEntries, getBalanceEntries, getNoteEntries
//   directives.ts   – all create/update/delete write operations + generateTransactionText + validateCommodityLocation

export { runQuery, type BQLFormat } from './queryRunner';
export { convertWindowsPathToWsl, convertWslPathToWindows, atomicFileWrite, createBackupFile } from './fileEditor';
export {
	parseSingleValue,
	parseAmount,
	extractConvertedAmount,
	extractNonReportingCurrencies,
	formatCurrency,
	getCurrentMonthRange,
	parseMetadataString,
	debounce,
} from './formatters';
export { parseCommoditiesListCSV, parseCommoditiesPriceDataCSV, parseCommodityDetailsCSV, parseCommoditiesHoldingsCSV } from './csvParsers';
export { buildAccountTree, getOpenAccounts, getPayees, getTags, getCommodities } from './accounts';
export { getTransactionEntries, getBalanceEntries, getNoteEntries } from './journal';
export {
	generateTransactionText,
	createTransaction,
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
	validateCommodityLocation,
	updateOperatingCurrency,
	createQueryDirective,
	deleteQueryDirective,
	getQueryDirectives,
	parseQueryDirectives,
	createIndicatorDirective,
	type IndicatorDirectiveParams,
} from './directives';

// Re-export structuredLayout helpers that some callers pull from utils/index
export { getTargetFile, getMainLedgerPath, ensureYearFile } from './structuredLayout';
export type { OperationType } from './structuredLayout';

// Re-export validation utilities (still implemented here until moved)
export { validatePriceSource, validateLogoUrl } from './validators';