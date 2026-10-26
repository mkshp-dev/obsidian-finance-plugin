// src/ui/modals/AccountAliasesModal.ts

import { App, Modal } from 'obsidian';
import type BeancountPlugin from '../../main';
import AccountAliasesComponent from './AccountAliases.svelte';
import { SvelteComponent } from 'svelte';

/** Lists every open account with its `aliases`, for adding and removing them. */
export class AccountAliasesModal extends Modal {
	plugin: BeancountPlugin;
	private component: SvelteComponent | null = null;

	constructor(app: App, plugin: BeancountPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		this.modalEl.setCssStyles({ maxWidth: '760px', width: '90vw' });
		this.setTitle('Account aliases');

		this.component = new AccountAliasesComponent({
			target: contentEl,
			props: { plugin: this.plugin },
		});
	}

	onClose() {
		this.component?.$destroy();
		this.component = null;
		this.contentEl.empty();
	}
}
