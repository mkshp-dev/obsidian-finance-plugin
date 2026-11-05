// src/ui/modals/ForceReconcileModal.ts

import { App, Modal, Notice, Setting } from 'obsidian';
import type BeancountPlugin from '../../main';
import { getOpenAccounts, createPadDirective } from '../../utils';
import { Logger } from '../../utils/logger';

export interface FailingBalanceInfo {
	date: string | null;
	discrepancy: string | null;
}

/** Returns the ISO date (YYYY-MM-DD) one day before the given ISO date. */
function dayBefore(isoDate: string): string {
	const d = new Date(`${isoDate}T00:00:00`);
	d.setDate(d.getDate() - 1);
	return d.toISOString().split('T')[0];
}

/**
 * "Force reconcile" — inserts a Beancount `pad` directive to make a
 * currently-failing balance assertion pass. This is a plug/escape-hatch
 * (Beancount auto-generates a transaction that moves the difference into a
 * chosen account), not a fix for whatever caused the discrepancy — this is
 * the first place in the plugin that ever writes a `pad` directive.
 *
 * The pad is dated ONE DAY BEFORE the failing balance assertion, not the
 * same day — verified directly against bean-check/bean-query: a same-date
 * pad does NOT satisfy the balance (Beancount's pad/balance interaction
 * requires the pad to strictly precede the balance's date), even though
 * pads.beancount is included before balances.beancount in this project's
 * file layout. File include order only affects same-date tie-breaking
 * between directives in general — it does not change Beancount's pad
 * algorithm, which keys off the date ordering itself.
 */
export class ForceReconcileModal extends Modal {
	private plugin: BeancountPlugin;
	private account: string;
	private failingInfo: FailingBalanceInfo;
	private onSuccess?: () => Promise<void>;

	private padAccount = '';
	private confirmButton: HTMLButtonElement | null = null;

	constructor(app: App, plugin: BeancountPlugin, account: string, failingInfo: FailingBalanceInfo, onSuccess?: () => Promise<void>) {
		super(app);
		this.plugin = plugin;
		this.account = account;
		this.failingInfo = failingInfo;
		this.onSuccess = onSuccess;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		this.setTitle('Force reconcile');

		let openAccounts: string[] = [];
		try {
			openAccounts = (await getOpenAccounts(this.plugin)).filter(a => a !== this.account);
		} catch (e) {
			Logger.error('[ForceReconcileModal] Failed to fetch open accounts:', e);
		}

		const infoParts: string[] = [];
		if (this.failingInfo.discrepancy) infoParts.push(`off by ${this.failingInfo.discrepancy}`);
		if (this.failingInfo.date) infoParts.push(`as of ${this.failingInfo.date}`);

		contentEl.createEl('p', {
			text: `${this.account} is currently failing its balance assertion${infoParts.length ? ` (${infoParts.join(', ')})` : ''}. Inserting a pad directive lets Beancount auto-generate a transaction to plug the gap — use it only when the difference is genuine, not to mask a mistake.`,
		});

		new Setting(contentEl)
			.setName('Pad account')
			.setDesc('Where the plugging transaction moves the difference to/from (commonly an equity "opening balance" or "adjustments" account).')
			.addDropdown(dropdown => {
				dropdown.addOption('', '-- select an account --');
				openAccounts.forEach(acc => { dropdown.addOption(acc, acc); });
				dropdown.setValue(this.padAccount).onChange(value => {
					this.padAccount = value;
					this.updateConfirmState();
				});
			});

		const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container beancount-modal-buttons' });

		const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', () => this.close());

		this.confirmButton = buttonContainer.createEl('button', { text: 'Insert pad directive', cls: 'mod-warning' });
		this.confirmButton.disabled = true;
		this.confirmButton.addEventListener('click', () => { void this.handleConfirm(); });
	}

	private updateConfirmState() {
		if (this.confirmButton) {
			this.confirmButton.disabled = !this.padAccount;
		}
	}

	private async handleConfirm() {
		if (!this.padAccount) {
			new Notice('Please select a pad account');
			return;
		}
		if (!this.failingInfo.date) {
			new Notice('Could not determine the failing balance date.');
			return;
		}

		const createBackup = this.plugin.settings.createBackups ?? true;
		const padDate = dayBefore(this.failingInfo.date);
		const result = await createPadDirective(this.plugin, padDate, this.account, this.padAccount, createBackup);
		if (!result.success) {
			new Notice(`Failed to insert pad directive: ${result.error || 'Unknown error'}`);
			return;
		}
		new Notice(`Pad directive inserted for ${this.account}`);
		if (this.onSuccess) {
			try {
				await this.onSuccess();
			} catch (e) {
				Logger.error('[ForceReconcileModal] onSuccess callback failed:', e);
			}
		}
		this.close();
	}
}
