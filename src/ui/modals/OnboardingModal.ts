// src/ui/modals/OnboardingModal.ts
import { App, Modal } from 'obsidian';
import type BeancountPlugin from '../../main';
import OnboardingModalComponent from './OnboardingModal.svelte';
import { SvelteComponent } from 'svelte';

export class OnboardingModal extends Modal {
    plugin: BeancountPlugin;
    private component: SvelteComponent | null = null;

    constructor(app: App, plugin: BeancountPlugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        this.modalEl.addClass('beancount-modal-onboarding');

        this.component = new (OnboardingModalComponent)({
            target: contentEl,
            props: {
                app: this.app,
                plugin: this.plugin,
                modal: this,
            },
        });
    }

    onClose() {
        if (this.component) {
            this.component.$destroy();
            this.component = null;
        }
        const { contentEl } = this;
        contentEl.empty();
    }
}
