<!-- src/ui/partials/dashboard/cards/CommodityCard.svelte -->
<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import type { CommodityInfo } from "../../../../controllers/CommoditiesController";

	export let commodity: CommodityInfo;
	export let index: number = 0;

	const dispatch = createEventDispatcher();

	function handleClick() {
		dispatch("click", { commodity });
	}

	function handleLogoError(e: Event) {
		const target = e.target as HTMLImageElement;
		if (target) {
			target.style.display = "none";
		}
	}

	// Helper to get initials from symbol
	function getInitials(symbol: string): string {
		if (!symbol) return "?";
		return symbol.slice(0, 2).toUpperCase();
	}

	// Helper to generate a consistent color based on symbol
	function getSymbolColor(symbol: string): string {
		if (!symbol) return "var(--background-modifier-border)";
		let hash = 0;
		for (let i = 0; i < symbol.length; i++) {
			hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
		}
		const colors = [
			"#3b82f6", // blue
			"#10b981", // emerald
			"#f59e0b", // amber
			"#ef4444", // red
			"#8b5cf6", // violet
			"#ec4899", // pink
			"#06b6d4", // cyan
			"#f97316", // orange
		];
		return colors[Math.abs(hash) % colors.length];
	}

	// Helper to format the price date
	function formatStatusTime(dateStr: string | null | undefined): string {
		if (!dateStr) return "No data";

		try {
			const date = new Date(dateStr);
			const now = new Date();
			// Strip time for day comparison
			const d1 = new Date(
				date.getFullYear(),
				date.getMonth(),
				date.getDate(),
			);
			const d2 = new Date(
				now.getFullYear(),
				now.getMonth(),
				now.getDate(),
			);
			const diffMs = d2.getTime() - d1.getTime();
			const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

			if (diffDays === 0) return "Today";
			if (diffDays === 1) return "Yesterday";
			if (diffDays < 7) return `${diffDays}d ago`;
			return date.toLocaleDateString(undefined, {
				month: "short",
				day: "numeric",
			});
		} catch (e) {
			return dateStr;
		}
	}
</script>

<div class="commodity-card-wrapper" class:is-operating={commodity?.isOperatingCurrency}>
	<button
		class="commodity-card"
		on:click={handleClick}
		aria-label="View details for {commodity?.symbol || `UNKNOWN_${index}`}"
		type="button"
	>
		<div class="card-header">
			<div class="identity">
				<div class="logo-box">
					{#if commodity?.logoUrl}
						<img
							src={commodity.logoUrl}
							alt={commodity.symbol}
							class="logo-img"
							on:error={handleLogoError}
						/>
					{:else}
						<div class="initials-fallback">
							{getInitials(commodity?.symbol)}
						</div>
					{/if}
				</div>
				<div class="name-box">
					<span class="symbol-text"
						>{commodity?.symbol || `UNKNOWN_${index}`}</span
					>
					{#if commodity?.isOperatingCurrency}
						<span class="operating-badge" title="Operating currency for this ledger">Operating</span>
					{/if}
				</div>
			</div>

			{#if commodity?.currentPrice}
				<div
					class="status-pill {commodity?.isPriceLatest
						? 'live'
						: 'stale'}"
				>
					<span class="status-dot"></span>
					<span class="status-label">
						{commodity?.isPriceLatest
							? "LIVE"
							: formatStatusTime(commodity?.priceDate)}
					</span>
				</div>
			{/if}
		</div>

		<div class="card-body">
			{#if commodity?.currentPrice}
				<div class="price-container">
					<span class="price-main"
						>{commodity.currentPrice.split(" ")[0]}</span
					>
					<span class="price-currency"
						>{commodity.currentPrice.split(" ")[1] || ""}</span
					>
				</div>
			{:else}
				<div class="no-price-state">
					<span class="no-price-text">Price unavailable</span>
				</div>
			{/if}

			{#if commodity?.holdingsRaw}
				<div class="holdings-row">
					<span class="holdings-label">Holdings</span>
					<span class="holdings-value">{commodity.holdingsRaw}</span>
				</div>
			{/if}
		</div>

		<div class="card-footer">
			<span class="details-text">View Details</span>
			<div class="arrow-box">
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<line x1="5" y1="12" x2="19" y2="12"></line>
					<polyline points="12 5 19 12 12 19"></polyline>
				</svg>
			</div>
		</div>
	</button>
</div>

<style>
	.commodity-card-wrapper {
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: 14px;
		transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
		position: relative;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.commodity-card-wrapper:hover {
		border-color: var(--interactive-accent);
		transform: translateY(-3px);
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
	}

	.commodity-card-wrapper::after {
		content: "";
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 3px;
		background: var(--interactive-accent);
		opacity: 0;
		transition: opacity 0.2s ease;
	}

	.commodity-card-wrapper:hover::after {
		opacity: 1;
	}

	.commodity-card {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		padding: 18px;
		gap: 20px;
		background: transparent;
		border: none;
		cursor: pointer;
		text-align: left;
		color: inherit;
		font-family: inherit;
	}

	.commodity-card:focus-visible {
		outline: 2px solid var(--interactive-accent);
		outline-offset: -2px;
	}

	/* HEADER SECTION */
	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		width: 100%;
	}

	.identity {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.logo-box {
		width: 36px;
		height: 36px;
		border-radius: 10px;
		background: var(--background-secondary);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		border: 1px solid var(--background-modifier-border-hover);
		flex-shrink: 0;
	}

	.logo-img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		background: white;
		padding: 2px;
	}

	.initials-fallback {
		font-weight: 800;
		font-size: 14px;
		color: var(--text-muted);
		background: var(--background-secondary);
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		letter-spacing: -0.5px;
	}

	.symbol-text {
		font-weight: 700;
		font-size: 15px;
		color: var(--text-normal);
		letter-spacing: 0.5px;
	}

	/* STATUS PILL */
	.status-pill {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		border-radius: 20px;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.5px;
	}

	.status-pill.live {
		background: color-mix(in srgb, var(--text-success), transparent 85%);
		color: var(--text-success);
		border: 1px solid
			color-mix(in srgb, var(--text-success), transparent 70%);
	}

	.status-pill.stale {
		background: color-mix(in srgb, var(--text-warning), transparent 85%);
		color: var(--text-warning);
		border: 1px solid
			color-mix(in srgb, var(--text-warning), transparent 70%);
	}

	.status-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: currentColor;
	}

	.live .status-dot {
		box-shadow: 0 0 6px var(--text-success);
		animation: pulse 2s infinite;
	}

	@keyframes pulse {
		0% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.5;
			transform: scale(1.2);
		}
		100% {
			opacity: 1;
			transform: scale(1);
		}
	}

	/* BODY SECTION */
	.card-body {
		display: flex;
		flex-direction: column;
	}

	.price-container {
		display: flex;
		align-items: baseline;
		gap: 4px;
	}

	.price-main {
		font-size: 28px;
		font-weight: 800;
		color: var(--text-accent);
		letter-spacing: -1px;
		line-height: 1;
	}

	.price-currency {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-muted);
	}

	.no-price-state {
		margin-top: 4px;
	}

	.no-price-text {
		color: var(--text-muted);
		font-style: italic;
		font-size: 14px;
	}

	/* FOOTER SECTION */
	.card-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: auto;
		padding-top: 14px;
		border-top: 1px solid var(--background-modifier-border);
		color: var(--text-muted);
		transition: all 0.2s ease;
	}

	.details-text {
		font-size: 13px;
		font-weight: 600;
	}

	.arrow-box {
		width: 20px;
		height: 20px;
		transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
	}

	.arrow-box svg {
		width: 100%;
		height: 100%;
	}

	.commodity-card:hover .card-footer {
		color: var(--interactive-accent);
	}

	.commodity-card:hover .arrow-box {
		transform: translateX(6px);
	}

	/* OPERATING-CURRENCY HIGHLIGHT */
	.commodity-card-wrapper.is-operating {
		border-color: var(--interactive-accent);
		box-shadow: 0 0 0 1px var(--interactive-accent),
			0 4px 14px rgba(0, 0, 0, 0.05);
	}
	.commodity-card-wrapper.is-operating::after {
		opacity: 1;
	}

	.operating-badge {
		display: inline-block;
		margin-left: 8px;
		padding: 2px 7px;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-on-accent);
		background: var(--interactive-accent);
		border-radius: 999px;
		vertical-align: middle;
	}

	/* HOLDINGS ROW */
	.holdings-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-top: 10px;
		padding-top: 10px;
		border-top: 1px dashed var(--background-modifier-border);
		font-size: 12px;
	}
	.holdings-label {
		color: var(--text-faint);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-weight: 600;
	}
	.holdings-value {
		color: var(--text-normal);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
</style>
