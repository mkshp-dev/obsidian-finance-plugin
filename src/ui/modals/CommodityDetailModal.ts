import { App, Modal, Notice } from 'obsidian';
import type BeancountPlugin from '../../main';
import CommodityDetailModalComponent from './CommodityDetailModal.svelte';
import type { CommoditiesController } from '../../controllers/CommoditiesController';
import { get } from 'svelte/store';
import { SvelteComponent } from 'svelte';

export class CommodityDetailModal extends Modal {
    plugin: BeancountPlugin;
    private component: SvelteComponent | null = null;
    private controller: CommoditiesController;
    private symbol: string;

    constructor(app: App, plugin: BeancountPlugin, controller: CommoditiesController, symbol: string) {
        super(app);
        this.plugin = plugin;
        this.controller = controller;
        this.symbol = symbol;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        this.modalEl.addClass('beancount-modal-commodity-detail');

        console.debug('[CommodityDetailModal] onOpen:', { symbol: this.symbol });

        // Load commodity details first
        try {
            await this.controller.loadCommodityDetails(this.symbol);
        } catch (e) {
            console.warn('Could not load commodity details before opening modal', e);
        }

        // Access selectedCommodity store via controller — cast to unknown to access the store property
        const ctrl = this.controller as unknown as { selectedCommodity: { subscribe: (cb: (v: unknown) => void) => () => void }; getCommodityBySymbol: (s: string) => unknown };
        const selected = get(ctrl.selectedCommodity) || ctrl.getCommodityBySymbol(this.symbol) || { symbol: this.symbol, metadata: {} };

        this.component = new (CommodityDetailModalComponent)({
            target: contentEl,
            props: {
                symbol: this.symbol,
                commodity: selected
            }
        });

        // Listen to events
        this.component.$on('save-metadata', (e: CustomEvent<{ symbol: string; metadata: Record<string, unknown> }>) => {
            void (async () => {
                const { symbol, metadata } = e.detail;
                console.debug('[CommodityDetailModal] save-metadata event', { symbol, metadata });
                const result = await this.controller.saveMetadata(symbol, metadata);
                console.debug('[CommodityDetailModal] save-metadata result ->', result);
                if (result && result.success) {
                    new Notice('Metadata saved successfully');

                    // Reload commodity details to reflect changes in the modal
                    try {
                        await this.controller.loadCommodityDetails(symbol);
                        const updated = get(ctrl.selectedCommodity) || { symbol, metadata: {} };
                        // Update component props with fresh data
                        this.component!.$set({ commodity: updated });
                        console.debug('[CommodityDetailModal] Commodity details reloaded and UI updated');
                    } catch (reloadError) {
                        console.warn('[CommodityDetailModal] Failed to reload commodity details:', reloadError);
                    }
                } else {
                    new Notice('Failed to save metadata');
                }
            })();
        });

        this.component.$on('test-price', (e: CustomEvent<{ symbol: string }>) => {
            void (async () => {
                const { symbol } = e.detail;
                console.debug('[CommodityDetailModal] test-price event', { symbol });
                const res = await this.controller.testPriceSource(symbol);
                console.debug('[CommodityDetailModal] test-price result ->', res);
                if (res && res.success) new Notice('Price test successful');
                else new Notice(`Price test failed: ${res?.error || 'unknown'}`);
            })();
        });

        this.component.$on('test-logo', (e: CustomEvent<{ symbol: string; url: string }>) => {
            void (async () => {
                const { symbol, url } = e.detail;
                console.debug('[CommodityDetailModal] test-logo event', { symbol, url });
                const res = await this.controller.testLogoUrl(symbol, url);
                console.debug('[CommodityDetailModal] test-logo result ->', res);
                if (res && res.success) new Notice('Logo test successful');
                else new Notice(`Logo test failed: ${res?.error || 'unknown'}`);
            })();
        });

        this.component.$on('close', () => this.close());

        this.component.$on('delete', (e: CustomEvent<{ symbol: string }>) => {
            void (async () => {
                const { symbol } = e.detail;
                console.debug('[CommodityDetailModal] delete event', { symbol });
                const result = await this.controller.deleteCommodity(symbol);
                if (result && result.success) {
                    new Notice(`${symbol} commodity deleted`);
                    this.close();
                } else {
                    new Notice(`Failed to delete ${symbol}: ${result?.error || 'unknown error'}`);
                }
            })();
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        if (this.component) this.component.$destroy();
    }
}
