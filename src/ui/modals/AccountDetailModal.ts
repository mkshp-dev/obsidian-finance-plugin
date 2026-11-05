// src/ui/modals/AccountDetailModal.ts

import { App, Modal, Notice } from 'obsidian';
import type BeancountPlugin from '../../main';
import AccountDetailModalComponent from './AccountDetailModal.svelte';
import { SvelteComponent } from 'svelte';
import { getAccountDetail } from '../../services/accountDetail.service';
import { updateAccountReconcileMetadata } from '../../utils';
import { UnifiedTransactionModal } from './UnifiedTransactionModal';
import { ForceReconcileModal } from './ForceReconcileModal';
import { Logger } from '../../utils/logger';

/**
 * View + edit modal for a single account: open/close/currencies and
 * reconciliation status, with an editable `reconcile:` interval and quick
 * access to the Balance and Force reconcile actions. No controller
 * dependency — all data access goes through plain service/directive
 * functions, so this can be opened from any view that has `app`/`plugin`
 * (the sidebar's Reconciliation tab, or a right-click on the Balance Sheet
 * tab) without threading a tab-specific controller through it.
 */
export class AccountDetailModal extends Modal {
	private plugin: BeancountPlugin;
	private account: string;
	private component: SvelteComponent | null = null;
	private onSaved?: () => Promise<void>;

	constructor(app: App, plugin: BeancountPlugin, account: string, onSaved?: () => Promise<void>) {
		super(app);
		this.plugin = plugin;
		this.account = account;
		this.onSaved = onSaved;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		this.modalEl.addClass('beancount-modal-account-detail');
		this.setTitle('Account details');

		let detail;
		try {
			detail = await getAccountDetail(this.plugin, this.account);
		} catch (e) {
			Logger.error('[AccountDetailModal] Failed to load account detail:', e);
			new Notice('Failed to load account details.');
			this.close();
			return;
		}

		this.component = new (AccountDetailModalComponent)({
			target: contentEl,
			props: { account: this.account, detail },
		});

		this.component.$on('save-reconcile', (e: CustomEvent<{ reconcileDays: number | null }>) => {
			void this.handleSaveReconcile(e.detail.reconcileDays, detail);
		});

		this.component.$on('add-balance', () => {
			new UnifiedTransactionModal(this.app, this.plugin, null, async () => {
				await this.refresh();
			}, { tab: 'balance', account: this.account }).open();
		});

		this.component.$on('force-reconcile', () => {
			new ForceReconcileModal(
				this.app,
				this.plugin,
				this.account,
				{ date: detail.failingDate, discrepancy: detail.failingDiscrepancy },
				async () => {
					await this.refresh();
				}
			).open();
		});

		this.component.$on('close', () => this.close());
	}

	private async handleSaveReconcile(reconcileDays: number | null, detail: { filename: string | null; lineno: number | null }) {
		if (!detail.filename || !detail.lineno) {
			new Notice('Could not locate this account in the ledger file.');
			return;
		}
		const createBackup = this.plugin.settings.createBackups ?? true;
		const result = await updateAccountReconcileMetadata(
			this.plugin,
			this.account,
			detail.filename,
			detail.lineno,
			reconcileDays,
			createBackup
		);
		if (!result.success) {
			new Notice(`Failed to save: ${result.error || 'Unknown error'}`);
			return;
		}
		new Notice('Reconciliation interval updated');
		await this.refresh();
	}

	/** Re-fetches account detail, refreshes the modal in place, and notifies the caller. */
	private async refresh() {
		if (this.onSaved) {
			try {
				await this.onSaved();
			} catch (e) {
				Logger.error('[AccountDetailModal] onSaved callback failed:', e);
			}
		}
		try {
			const refreshed = await getAccountDetail(this.plugin, this.account);
			this.component?.$set({ detail: refreshed });
		} catch (e) {
			Logger.error('[AccountDetailModal] Failed to refresh account detail:', e);
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
		if (this.component) this.component.$destroy();
	}
}
