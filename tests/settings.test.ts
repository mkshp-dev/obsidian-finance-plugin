import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/settings';

describe('Settings Defaults', () => {
	it('has correct default values for core plugin settings', () => {
		expect(DEFAULT_SETTINGS.operatingCurrency).toBe('USD');
		expect(DEFAULT_SETTINGS.maxTransactionResults).toBe(2000);
		expect(DEFAULT_SETTINGS.maxJournalResults).toBe(1000);
		expect(DEFAULT_SETTINGS.dashboardDefaultPeriod).toBe('this-month');
		expect(DEFAULT_SETTINGS.structuredFolderName).toBe('Finances');
		expect(DEFAULT_SETTINGS.fileOrganization).toBe('yearly');
		expect(DEFAULT_SETTINGS.createBackups).toBe(true);
		expect(DEFAULT_SETTINGS.onboardingCompleted).toBe(false);
	});

	it('has disabled debugMode and userSnippets by default', () => {
		expect(DEFAULT_SETTINGS.debugMode).toBe(false);
		expect(DEFAULT_SETTINGS.enableUserSnippets).toBe(false);
		expect(DEFAULT_SETTINGS.autoPriceFetch).toBe(false);
	});
});
