// src/views/dashboard-view.ts
import { ItemView, WorkspaceLeaf } from 'obsidian';
import type BeancountPlugin from '../main';
import DashboardComponent from './DashboardView.svelte'; 

export const DASHBOARD_VIEW_TYPE = "beancount-dashboard-view";

export class DashboardView extends ItemView {
	plugin: BeancountPlugin;
	component: DashboardComponent; // Reference to the Svelte component

	constructor(leaf: WorkspaceLeaf, plugin: BeancountPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return DASHBOARD_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Beancount Dashboard"; // Title shown in the tab
	}

	getIcon(): string {
		return "list"; // Use a list icon
	}

	async onOpen() {
		const container = this.containerEl.children[1]; // Get the view's content container
		container.empty();

		// Mount the Svelte component, passing necessary props
		this.component = new DashboardComponent({
			target: container,
			props: {
				// Pass only what the component needs (e.g., runQuery function)
				runQuery: this.plugin.runQuery.bind(this.plugin)
			}
		});
	}

	async onClose() {
		// Destroy the Svelte component when the view is closed
		if (this.component) {
			this.component.$destroy();
		}
	}
}