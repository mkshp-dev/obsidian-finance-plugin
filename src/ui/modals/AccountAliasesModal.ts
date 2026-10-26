// src/ui/modals/AccountAliasesModal.ts

import { App, Modal } from 'obsidian';
import type BeancountPlugin from '../../main';
import AccountAliasesComponent from './AccountAliases.svelte';
import { SvelteComponent } from 'svelte';
import { ConfirmModal } from './ConfirmModal';

/** Lists every open account with its `aliases`, for adding and removing them; changes are written on Save. */
export class AccountAliasesModal extends Modal {
	plugin: BeancountPlugin;
	private component: SvelteComponent | null = null;
	/** Called once the window has closed, e.g. so an open import picks up saved aliases. */
	private onDone?: () => void;

	constructor(app: App, plugin: BeancountPlugin, onDone?: () => void) {
		super(app);
		this.plugin = plugin;
		this.onDone = onDone;
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

	/** Asks before closing (Esc, ×, clicking outside) with unsaved changes. */
	close() {
		const component = this.component as (SvelteComponent & { hasUnsavedChanges?: () => boolean }) | null;
		if (component?.hasUnsavedChanges?.()) {
			new ConfirmModal(this.app, 'Discard alias changes?', "Your changes to account aliases haven't been saved.", () => super.close()).open();
			return;
		}
		super.close();
	}

	onClose() {
		this.component?.$destroy();
		this.component = null;
		this.contentEl.empty();
		this.onDone?.();
	}
}
