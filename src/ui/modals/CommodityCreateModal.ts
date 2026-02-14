// src/ui/modals/CommodityCreateModal.ts

import { App, Modal, Notice } from 'obsidian';
import type BeancountPlugin from '../../main';
import CommodityCreateModalComponent from './CommodityCreateModal.svelte';
import type { CommoditiesController } from '../../controllers/CommoditiesController';
import { Logger } from '../../utils/logger';

export class CommodityCreateModal extends Modal {
    plugin: BeancountPlugin;
    private component: any;
    private controller: CommoditiesController;
    private onSuccess?: () => void;

    constructor(
        app: App, 
        plugin: BeancountPlugin, 
        controller: CommoditiesController,
        onSuccess?: () => void
    ) {
        super(app);
        this.plugin = plugin;
        this.controller = controller;
        this.onSuccess = onSuccess;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        this.modalEl.style.maxWidth = '600px';
        this.modalEl.style.width = '90vw';

        Logger.log('[CommodityCreateModal] Opening modal');

        this.component = new (CommodityCreateModalComponent as any)({
            target: contentEl,
            props: {}
        });

        // Listen to save event
        this.component.$on('save', async (e: any) => {
            const { symbol, date, priceMetadata, logoUrl } = e.detail;
            Logger.log('[CommodityCreateModal] save event', { symbol, date, priceMetadata, logoUrl });

            try {
                const result = await this.controller.createCommodity(
                    symbol,
                    date,
                    priceMetadata,
                    logoUrl
                );

                if (result.success) {
                    new Notice(`Successfully created commodity ${symbol}`);
                    this.close();
                    
                    // Call success callback if provided
                    if (this.onSuccess) {
                        this.onSuccess();
                    }
                } else {
                    new Notice(`Failed to create commodity: ${result.error || 'Unknown error'}`);
                }
            } catch (error) {
                Logger.error('[CommodityCreateModal] Error creating commodity:', error);
                new Notice(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });

        // Listen to cancel event
        this.component.$on('cancel', () => {
            Logger.log('[CommodityCreateModal] cancel event');
            this.close();
        });

        // Listen to test-price event
        this.component.$on('test-price', async (e: any) => {
            const { symbol, priceMetadata } = e.detail;
            Logger.log('[CommodityCreateModal] test-price event', { symbol, priceMetadata });

            try {
                const result = await this.controller.testPriceSource(symbol);
                
                if (result && result.success) {
                    new Notice('✅ Price source test successful');
                } else {
                    new Notice(`❌ Price test failed: ${result?.error || 'Unable to fetch price'}`);
                }
            } catch (error) {
                Logger.error('[CommodityCreateModal] test-price error:', error);
                new Notice(`❌ Price test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });

        // Listen to test-logo event
        this.component.$on('test-logo', async (e: any) => {
            const { symbol, url } = e.detail;
            Logger.log('[CommodityCreateModal] test-logo event', { symbol, url });

            try {
                const result = await this.controller.testLogoUrl(symbol, url);
                
                if (result && result.success) {
                    new Notice('✅ Logo URL is valid');
                } else {
                    new Notice(`❌ Logo test failed: ${result?.error || 'Invalid URL'}`);
                }
            } catch (error) {
                Logger.error('[CommodityCreateModal] test-logo error:', error);
                new Notice(`❌ Logo test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        if (this.component) {
            this.component.$destroy();
        }
    }
}
