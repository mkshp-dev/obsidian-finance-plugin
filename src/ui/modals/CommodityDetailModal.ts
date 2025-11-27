import { App, Modal, Notice } from 'obsidian';
import type BeancountPlugin from '../../main';
import CommodityDetailModalComponent from './CommodityDetailModal.svelte';
import type { CommoditiesController } from '../../controllers/CommoditiesController';
import { get } from 'svelte/store';

export class CommodityDetailModal extends Modal {
    plugin: BeancountPlugin;
    private component: any;
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
        this.modalEl.style.maxWidth = '800px';
        this.modalEl.style.width = '85vw';

        console.debug('[CommodityDetailModal] onOpen:', { symbol: this.symbol });

        // Load commodity details first
        try {
            await this.controller.loadCommodityDetails(this.symbol);
        } catch (e) {
            console.warn('Could not load commodity details before opening modal', e);
        }

        const selected = get((this.controller as any).selectedCommodity) || (this.controller as any).getCommodityBySymbol(this.symbol) || { symbol: this.symbol, metadata: {} };

        this.component = new (CommodityDetailModalComponent as any)({
            target: contentEl,
            props: {
                symbol: this.symbol,
                commodity: selected
            }
        });

        // Listen to events
        this.component.$on('save-metadata', async (e: any) => {
            const { symbol, metadata } = e.detail;
            console.debug('[CommodityDetailModal] save-metadata event', { symbol, metadata });
            const result = await this.controller.saveMetadata(symbol, metadata);
            console.debug('[CommodityDetailModal] save-metadata result ->', result);
            if (result && result.success) {
                const backupInfo = result.backup_file ? `Backup: ${result.backup_file}` : '';
                const targetInfo = result.target_file ? `Target: ${result.target_file}` : '';
                new Notice(`Metadata saved. ${backupInfo} ${targetInfo}`.trim());
            } else {
                new Notice('Failed to save metadata');
            }
        });

        this.component.$on('test-price', async (e: any) => {
            const { symbol } = e.detail;
            console.debug('[CommodityDetailModal] test-price event', { symbol });
            const res = await this.controller.testPriceSource(symbol);
            console.debug('[CommodityDetailModal] test-price result ->', res);
            if (res && res.success) new Notice('Price test successful');
            else new Notice(`Price test failed: ${res?.error || 'unknown'}`);
        });

        this.component.$on('test-logo', async (e: any) => {
            const { symbol, url } = e.detail;
            console.debug('[CommodityDetailModal] test-logo event', { symbol, url });
            const res = await this.controller.testLogoUrl(symbol, url);
            console.debug('[CommodityDetailModal] test-logo result ->', res);
            if (res && res.success) new Notice('Logo test successful');
            else new Notice(`Logo test failed: ${res?.error || 'unknown'}`);
        });

        this.component.$on('close', () => this.close());
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        if (this.component) this.component.$destroy();
    }
}
