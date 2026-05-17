// src/controllers/OverviewController.ts

import { writable, type Writable, get } from 'svelte/store';
import type BeancountPlugin from '../main';
import * as queries from '../queries/index';
import { parseSingleValue } from '../utils/index'; // Import helpers
import { Logger } from '../utils/logger';
import { sanitizeEquivalentCurrencies, collectEquivalents } from '../utils/equivalents';
import { formatCurrencyAmount, getCurrencyPrecision } from '../utils/currency-precision';
import { parseRecurringFile, toggleDiscretionaryInText } from '../services/recurring.service';
import {
    aggregateForecast,
    type CommitmentInput,
    type ForecastResult,
} from '../services/forecast.service';
import {
    parseIndicators,
    toggleIndicatorDiscretionaryInText,
    type IndicatorType,
} from '../services/indicators.service';
import { parseFxRates } from '../utils/fx-rates';
import { atomicFileWrite, createBackupFile } from '../utils/fileEditor';
import { parse as parseCsv } from 'csv-parse/sync';

// CSV-row helpers (bean-query lowercases aliases). Mirrors the same
// helpers in IndicatorsSection.svelte — kept local to avoid a
// premature shared-util extraction.
function col(row: any, name: string): any {
	const lower = name.toLowerCase();
	if (row[lower] !== undefined) return row[lower];
	if (row[name] !== undefined) return row[name];
	const bare = name.startsWith('_') ? name.slice(1) : name;
	return row[bare.toLowerCase()] ?? row[bare];
}

function parseBool(v: any): boolean {
	if (typeof v === 'boolean') return v;
	const s = String(v).toLowerCase();
	return s === 'true' || s === '1';
}

function parseNum(v: any): number {
	if (v === null || v === undefined || v === '') return 0;
	if (typeof v === 'number') return v;
	const m = String(v).match(/[+-]?[\d.]+/);
	return m ? parseFloat(m[0]) : 0;
}

/**
 * Interface representing the state of the Overview dashboard.
 */
export interface OverviewState {
	/** Whether data is loading. */
	isLoading: boolean;
	/** Error message if loading failed. */
	error: string | null;
	/** Net worth string (e.g. "1,000.00 USD"). */
	netWorth: string;
	/** Monthly income string. */
	monthlyIncome: string;
	/** Monthly expenses string. */
	monthlyExpenses: string;
	/** Savings rate percentage string (e.g. "20%"). */
	savingsRate: string;
	/** The reporting currency. */
	currency: string;
	/** Net worth, indexed by each enabled equivalent currency. Empty when none configured. */
	netWorthEquivalents: Record<string, number>;
	/** Monthly income, indexed by each enabled equivalent currency. */
	monthlyIncomeEquivalents: Record<string, number>;
	/** Monthly expenses, indexed by each enabled equivalent currency. */
	monthlyExpensesEquivalents: Record<string, number>;
	/** Projected monthly residual after fixed obligations (income minus
	 * non-discretionary recurring expenses). Null when the forecast
	 * couldn't be computed (e.g. recurring file missing). */
	forecast: ForecastResult | null;
}

/**
 * OverviewController
 *
 * Manages the state and logic for the Overview tab.
 * Fetches high-level financial metrics (Net Worth, Income, Expenses) and
 * prepares data for the Net Worth over time chart.
 */
export class OverviewController {
	private plugin: BeancountPlugin;

	// Create a Svelte store to hold the state
	public state: Writable<OverviewState>;

	/**
	 * Creates an instance of OverviewController.
	 * @param {BeancountPlugin} plugin - The main plugin instance.
	 */
	constructor(plugin: BeancountPlugin) {
		this.plugin = plugin;
		// Initialize the store with default values
		this.state = writable({
			isLoading: true,
			error: null,
			netWorth: '0.00 USD',
			monthlyIncome: '0.00 USD',
			monthlyExpenses: '0.00 USD',
			savingsRate: '0%',
			currency: plugin.settings.operatingCurrency || 'USD',
			netWorthEquivalents: {},
			monthlyIncomeEquivalents: {},
			monthlyExpensesEquivalents: {},
			forecast: null,
		});
	}

	/** Resolve the vault-relative path for a structured-layout file
	 * (recurring.beancount, prices.beancount, etc.). Mirrors the
	 * resolution used by RecurringController. */
	private resolveStructuredPath(filename: string): string {
		const folder = this.plugin.settings.structuredFolderName || 'Finances';
		return `${folder}/${filename}`;
	}

	/** Flip the `discretionary` flag for a rule in recurring.beancount,
	 * then reload state so the dashboard reflects the new totals.
	 * Returns true if anything actually changed on disk. */
	public async setRuleDiscretionary(
		nickname: string,
		value: boolean,
	): Promise<boolean> {
		const adapter = this.plugin.app.vault.adapter;
		const recurringPath = this.plugin.settings.recurringFilePath?.trim()
			|| this.resolveStructuredPath('recurring.beancount');
		if (!(await adapter.exists(recurringPath))) return false;
		const current = await adapter.read(recurringPath);
		const { changed, content } = toggleDiscretionaryInText(
			current, nickname, value,
		);
		if (!changed) return false;
		// Resolve vault-relative to absolute fs path for the atomic writer
		// (mirrors the pattern in utils/structuredLayout.getTargetFile).
		// @ts-ignore — getBasePath is on FileSystemAdapter, not typed on the union.
		const vaultRoot = adapter.getBasePath() as string;
		const absPath = `${vaultRoot}/${recurringPath}`;
		await createBackupFile(absPath, true, 'OverviewController.setRuleDiscretionary');
		await atomicFileWrite(absPath, content);
		await this.loadData();
		return true;
	}

	/** Compute the monthly forecast from recurring rules + budgets +
	 * latest FX rates. Returns null on any miss — the UI hides the
	 * tile then. */
	private async computeForecast(
		operatingCurrency: string,
	): Promise<ForecastResult | null> {
		try {
			const adapter = this.plugin.app.vault.adapter;
			const recurringPath = this.plugin.settings.recurringFilePath?.trim()
				|| this.resolveStructuredPath('recurring.beancount');
			const pricesPath = this.resolveStructuredPath('prices.beancount');

			if (!(await adapter.exists(recurringPath))) return null;
			const recurringText = await adapter.read(recurringPath);
			const rules = parseRecurringFile(recurringText);
			if (rules.length === 0) return null;

			const pricesText = (await adapter.exists(pricesPath))
				? await adapter.read(pricesPath)
				: '';
			const fxRates = parseFxRates(pricesText, operatingCurrency);

			const commitments = await this.fetchCommitments();

			return aggregateForecast(rules, commitments, operatingCurrency, fxRates);
		} catch (e) {
			Logger.warn('Forecast computation failed:', e);
			return null;
		}
	}

	/** Read all indicator commitments from events.beancount: Budgets +
	 * Savings + legacy Targets (the latter two treated as 'savings').
	 * For each, fetch actual current-cycle spend via BQL. Items with
	 * incomplete metadata are dropped silently — the tile shouldn't
	 * fail because of one bad indicator. Reads the file directly too
	 * so the `discretionary` opt-out flag (events.beancount metadata)
	 * is honored. */
	private async fetchCommitments(): Promise<CommitmentInput[]> {
		// Read the events file once to pick up custom metadata flags
		// (discretionary, targetPercent) per indicator. BQL doesn't
		// expose unknown metadata fields, so we cross-reference by
		// (type, name) from a text parse.
		const adapter = this.plugin.app.vault.adapter;
		const eventsPath = this.resolveStructuredPath('events.beancount');
		const metaMap = new Map<string, { discretionary: boolean; targetPercent?: number }>();
		try {
			if (await adapter.exists(eventsPath)) {
				const parsed = parseIndicators(await adapter.read(eventsPath));
				for (const ind of parsed) {
					metaMap.set(`${ind.type}|${ind.name}`, {
						discretionary: ind.discretionary === true,
						targetPercent: ind.targetPercent,
					});
				}
			}
		} catch (e) {
			Logger.warn('events.beancount metadata scan failed:', e);
		}

		const fetchSource = async (
			listQuery: string,
			amountField: string,
			originalType: 'Budget' | 'Target' | 'Savings',
			kind: 'budget' | 'savings',
		): Promise<CommitmentInput[]> => {
			try {
				const listCsv = await this.plugin.runQuery(listQuery);
				const rows = parseCsv(listCsv, {
					columns: true, skip_empty_lines: true, trim: true,
				}) as any[];

				const out: CommitmentInput[] = [];
				await Promise.all(rows.map(async (r) => {
					const name = col(r, '_name') || '';
					const accountString = col(r, '_accountString') || '';
					const cycle = col(r, '_period') || 'Monthly';
					const isRollOver = parseBool(col(r, '_isRollOver'));
					const target = parseNum(col(r, amountField));
					const currency = col(r, '_currency') || '';
					const startDate = col(r, '_startDate') || '';
					const extraMeta = metaMap.get(`${originalType}|${name}`);
					// Accept either a positive fixed target OR a positive
					// targetPercent (percent-based, target can be 0).
					const hasPercent = (extraMeta?.targetPercent ?? 0) > 0;
					if (!name || !accountString || !currency) return;
					if (target <= 0 && !hasPercent) return;

					const period = cycle.toLowerCase() === 'weekly' ? 'week' : 'month';
					let actualSpend = 0;
					try {
						const statusCsv = await this.plugin.runQuery(
							queries.getIndicatorStatusQuery(
								isRollOver, currency, accountString, target,
								startDate, period,
							),
						);
						const statusRows = parseCsv(statusCsv, {
							columns: true, skip_empty_lines: true, trim: true,
						}) as any[];
						if (statusRows.length > 0) {
							actualSpend = Math.abs(parseNum(
								col(statusRows[0], '_expenseThisCycle'),
							));
						}
					} catch (e) {
						Logger.warn(`${originalType} '${name}' status query failed:`, e);
					}

					out.push({
						name,
						kind,
						originalType,
						target,
						actualSpend,
						nativeCurrency: currency,
						cycle,
						discretionary: extraMeta?.discretionary === true,
						...(extraMeta?.targetPercent !== undefined
							? { targetPercent: extraMeta.targetPercent }
							: {}),
					});
				}));
				return out;
			} catch (e) {
				Logger.warn(`${originalType} list query failed:`, e);
				return [];
			}
		};

		const [budgets, targets, savings] = await Promise.all([
			fetchSource(queries.getBudgetListQuery(), '_budgetAmount', 'Budget', 'budget'),
			fetchSource(queries.getTargetListQuery(), '_targetAmount', 'Target', 'savings'),
			fetchSource(queries.getSavingsListQuery(), '_targetAmount', 'Savings', 'savings'),
		]);
		return [...budgets, ...targets, ...savings];
	}

	/** Flip the `discretionary` flag for an indicator in
	 * events.beancount, then reload state. Mirrors
	 * setRuleDiscretionary but operates on Budget/Target/Savings
	 * indicators instead of recurring rules. */
	public async setIndicatorDiscretionary(
		name: string,
		type: IndicatorType,
		value: boolean,
	): Promise<boolean> {
		const adapter = this.plugin.app.vault.adapter;
		const eventsPath = this.resolveStructuredPath('events.beancount');
		if (!(await adapter.exists(eventsPath))) return false;
		const current = await adapter.read(eventsPath);
		const { changed, content } = toggleIndicatorDiscretionaryInText(
			current, name, type, value,
		);
		if (!changed) return false;
		// @ts-ignore — getBasePath is on FileSystemAdapter, not typed on the union.
		const vaultRoot = adapter.getBasePath() as string;
		const absPath = `${vaultRoot}/${eventsPath}`;
		await createBackupFile(absPath, true, 'OverviewController.setIndicatorDiscretionary');
		await atomicFileWrite(absPath, content);
		await this.loadData();
		return true;
	}

	/**
	 * Loads all overview data from Beancount.
	 * Fetches total assets, liabilities, monthly income/expenses, and historical data for the chart.
	 */
	async loadData() {
		this.state.update(s => ({ ...s, isLoading: true, error: null, chartError: null }));

		const reportingCurrency = this.plugin.settings.operatingCurrency;
		if (!reportingCurrency) {
			this.state.set({
				...get(this.state), // Svelte 4/5 way to get current value
				isLoading: false,
				error: "Operating currency is not set in plugin settings.",
			});
			return;
		}

		try {
			const equivalents = sanitizeEquivalentCurrencies(
				this.plugin.settings.equivalentCurrencies,
				reportingCurrency,
			);
			const fetchEquivalents = (factory: (c: string, r: number) => string) =>
				equivalents.length === 0
					? Promise.resolve({} as Record<string, number>)
					: collectEquivalents(this.plugin, equivalents, factory);

			// Round in BQL at the currency's natural storage precision so we
			// don't lose meaningful digits before parsing (e.g. BTC).
			const storage = getCurrencyPrecision(reportingCurrency).storage;

			const [
				netWorthResult, incomeResult, expensesResult, savingsResult,
				netWorthEquivalents, monthlyIncomeEquivalents, monthlyExpensesEquivalents,
				forecast,
			] = await Promise.all([
				this.plugin.runQuery(queries.getTotalWorthQuery(reportingCurrency, storage)),
				this.plugin.runQuery(queries.getThisMonthIncomeQuery(reportingCurrency, storage)),
				this.plugin.runQuery(queries.getThisMonthExpensesQuery(reportingCurrency, storage)),
				this.plugin.runQuery(queries.getThisMonthSavingsQuery(reportingCurrency, storage)),
				fetchEquivalents(queries.getTotalWorthQuery),
				fetchEquivalents(queries.getThisMonthIncomeQuery),
				fetchEquivalents(queries.getThisMonthExpensesQuery),
				this.computeForecast(reportingCurrency),
			]);

			// Process KPI Data
			Logger.log("OverviewController: Net Worth Result:", netWorthResult);
			const netWorthNum = parseFloat(parseSingleValue(netWorthResult)) || 0;
			Logger.log("OverviewController: Parsed Net Worth:", netWorthNum);

			const incomeAmount = parseFloat(parseSingleValue(incomeResult)) || 0;
			const expensesAmount = parseFloat(parseSingleValue(expensesResult)) || 0;
			const savingsNum = parseFloat(parseSingleValue(savingsResult)) || 0;

			const newState: Partial<OverviewState> = {
				netWorth: formatCurrencyAmount(netWorthNum, reportingCurrency),
				monthlyIncome: formatCurrencyAmount(incomeAmount, reportingCurrency),
				monthlyExpenses: formatCurrencyAmount(expensesAmount, reportingCurrency),
				savingsRate: incomeAmount > 0 ? `${((savingsNum / incomeAmount) * 100).toFixed(0)}%` : 'N/A',
				currency: reportingCurrency,
				netWorthEquivalents,
				monthlyIncomeEquivalents,
				monthlyExpensesEquivalents,
				forecast,
			};

			// Update the store with KPI data
			this.state.update(s => ({ ...s, ...newState, isLoading: false, error: null }));

		} catch (e) {
			Logger.error("Error loading overview data:", e);
			this.state.update(s => ({ ...s, isLoading: false, error: `Failed to load data: ${e.message}` }));
		}
	}
}
