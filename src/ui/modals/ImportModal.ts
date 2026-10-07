// src/ui/modals/ImportModal.ts

import { App, Modal } from 'obsidian';
import type BeancountPlugin from '../../main';
import ImportModalComponent from './ImportModal.svelte';
import { SvelteComponent } from 'svelte';

/** Imports a bank statement (CSV from the vault) into the ledger. */
export class ImportModal extends Modal {
	plugin: BeancountPlugin;
	private component: SvelteComponent | null = null;
	private onComplete?: () => void | Promise<void>;

	constructor(app: App, plugin: BeancountPlugin, onComplete?: () => void | Promise<void>) {
		super(app);
		this.plugin = plugin;
		this.onComplete = onComplete;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		this.modalEl.setCssStyles({ maxWidth: '960px', width: '92vw' });
		this.setTitle('Import bank statement');

		this.component = new ImportModalComponent({
			target: contentEl,
			props: {
				plugin: this.plugin,
				close: () => this.close(),
				onComplete: this.onComplete,
			},
		});
	}

	onClose() {
		this.component?.$destroy();
		this.component = null;
		this.contentEl.empty();
	}
}
