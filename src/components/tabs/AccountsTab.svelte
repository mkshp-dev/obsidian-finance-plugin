<script lang="ts">
	import { onMount } from 'svelte';
	import type { AccountsController } from '../../controllers/AccountsController';
	import type { AccountDetail, AccountNode } from '../../types/index';

	export let accountsController: AccountsController;

	// Subscribe to controller state with null check
	$: state = accountsController?.state;

	// Component state
	let refreshing = false;
	let initializationError = '';
	let filteredTree: AccountNode[] = [];

	onMount(() => {
		// Initial data load only if controller exists
		if (accountsController) {
			loadData().catch(err => {
				initializationError = `Failed to load initial data: ${err.message}`;
				console.error('AccountsTab initialization error:', err);
			});
		} else {
			initializationError = 'AccountsController not provided';
		}
	});

	async function loadData() {
		if (!accountsController) return;
		await accountsController.loadData();
		// Force update of filtered tree after data loads
		filteredTree = accountsController.getFilteredAccountTree();
	}

	async function handleRefresh() {
		if (!accountsController) return;
		refreshing = true;
		try {
			await accountsController.loadData();
		} catch (err) {
			console.error('Failed to refresh accounts:', err);
		} finally {
			refreshing = false;
		}
	}

	function handleSearch(event: Event) {
		if (!accountsController) return;
		const target = event.target as HTMLInputElement;
		accountsController.updateSearchFilter(target.value);
	}

	function handleAccountClick(accountFullName: string) {
		if (!accountsController) return;
		accountsController.showAccountDetail(accountFullName);
	}

	function handleExpandToggle(accountFullName: string) {
		if (!accountsController) return;
		accountsController.toggleAccountExpansion(accountFullName);
	}

	function getAccountTypeIcon(accountType: AccountDetail['accountType']): string {
		switch (accountType) {
			case 'Assets': return '💰';
			case 'Liabilities': return '💳';
			case 'Income': return '💵';
			case 'Expenses': return '💸';
			case 'Equity': return '🏦';
			default: return '📁';
		}
	}

	function getAccountTypeColor(accountType: AccountDetail['accountType']): string {
		switch (accountType) {
			case 'Assets': return 'var(--text-success)';
			case 'Liabilities': return 'var(--text-error)';
			case 'Income': return 'var(--text-success)';
			case 'Expenses': return 'var(--text-warning)';
			case 'Equity': return 'var(--text-accent)';
			default: return 'var(--text-muted)';
		}
	}

	function isAccountExpanded(accountFullName: string): boolean {
		return $state?.expandedAccounts?.has(accountFullName) || false;
	}

	function renderAccountNode(node: AccountNode, level: number = 0): any {
		const accountDetail = $state?.accountDetails?.get(node.fullName || '');
		const hasChildren = node.children && node.children.length > 0;
		const isExpanded = node.fullName ? isAccountExpanded(node.fullName) : false;
		
		return {
			node,
			accountDetail,
			hasChildren,
			isExpanded,
			level,
			icon: accountDetail ? getAccountTypeIcon(accountDetail.accountType) : '📁',
			color: accountDetail ? getAccountTypeColor(accountDetail.accountType) : 'var(--text-muted)'
		};
	}

	// Make sure we re-render when state changes
	$: {
		if (accountsController && $state) {
			filteredTree = accountsController.getFilteredAccountTree();
		} else {
			filteredTree = [];
		}
	}
	$: expandedAccounts = $state?.expandedAccounts || new Set();
</script>

<!-- Account Detail Modal -->
{#if $state?.showAccountDetails && $state?.selectedAccount}
	<div class="account-detail-modal">
		<div class="account-detail-content">
			<div class="account-detail-header">
				<h3>
					{getAccountTypeIcon($state.selectedAccount.accountType)}
					{$state.selectedAccount.fullName}
				</h3>
				<button 
					class="close-button" 
					on:click={() => accountsController?.closeAccountDetail()}
					aria-label="Close"
				>
					×
				</button>
			</div>
			
			<div class="account-detail-body">
				<div class="detail-section">
					<h4>Account Information</h4>
					<div class="detail-grid">
						<div class="detail-item">
							<span class="detail-label">Type:</span>
							<span class="detail-value">{$state.selectedAccount.accountType}</span>
						</div>
						<div class="detail-item">
							<span class="detail-label">Current Balance:</span>
							<span class="detail-value balance" style="color: {getAccountTypeColor($state.selectedAccount.accountType)}">
								{$state.selectedAccount.balance}
							</span>
						</div>
						<div class="detail-item">
							<span class="detail-label">Status:</span>
							<span class="detail-value">
								{$state.selectedAccount.isActive ? '🟢 Active' : '⚪ Inactive'}
							</span>
						</div>
					</div>
				</div>

				<div class="detail-actions">
					<button class="action-button primary">
						📊 View Transactions
					</button>
					<button class="action-button secondary">
						➕ Add Transaction
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<div class="accounts-tab">
	{#if initializationError}
		<div class="error-state">
			<div class="error-message">
				❌ {initializationError}
			</div>
			<button class="retry-button" on:click={() => window.location.reload()}>
				Reload Plugin
			</button>
		</div>
	{:else if !accountsController}
		<div class="error-state">
			<div class="error-message">
				❌ AccountsController not initialized. Type: {typeof accountsController}
			</div>
		</div>
	{:else if !$state}
		<div class="loading-state">
			<div class="spinner"></div>
			<p>Initializing accounts controller...</p>
		</div>
	{:else}
		<!-- Header with search and refresh -->
		<div class="accounts-header">
			<div class="search-container">
				<input 
					type="text" 
					placeholder="Search accounts..." 
					class="account-search"
					on:input={handleSearch}
					value={$state?.searchFilter || ''}
				/>
			</div>
			<button 
				class="refresh-button" 
				on:click={handleRefresh} 
				disabled={$state?.isLoading || refreshing}
			>
				{#if $state?.isLoading || refreshing}
					<div class="spinner"></div>
					Refreshing...
				{:else}
					🔄 Refresh
				{/if}
			</button>
		</div>

		<!-- Error state -->
		{#if $state?.error}
			<div class="error-state">
				<div class="error-message">
					❌ {$state.error}
				</div>
				<button class="retry-button" on:click={handleRefresh}>
					Try Again
				</button>
			</div>
		{/if}

		<!-- Loading state -->
		{#if $state?.isLoading && !$state?.error}
			<div class="loading-state">
				<div class="spinner"></div>
				<p>Loading accounts...</p>
			</div>
		{/if}

		<!-- Account hierarchy -->
		{#if !$state?.isLoading && !$state?.error && accountsController}
			<div class="accounts-container">
				{#each filteredTree as node (node.fullName || node.name)}
					{@const cardData = renderAccountNode(node, 0)}
					<div class="account-card" style="margin-left: {cardData.level * 20}px">
						<div class="card-header">
							{#if cardData.hasChildren}
								<button 
									class="expand-button"
									on:click|stopPropagation={() => handleExpandToggle(cardData.node.fullName)}
									aria-label={cardData.isExpanded ? 'Collapse' : 'Expand'}
								>
									{cardData.isExpanded ? '▼' : '▶'}
								</button>
							{:else}
								<span class="expand-spacer"></span>
							{/if}
							
							<div 
								class="card-content"
								class:clickable={cardData.accountDetail}
								on:click|stopPropagation={() => {
									if (cardData.accountDetail && cardData.node.fullName) {
										handleAccountClick(cardData.node.fullName);
									}
								}}
								role={cardData.accountDetail ? 'button' : undefined}
								tabindex={cardData.accountDetail ? 0 : undefined}
								on:keydown={(e) => {
									if (cardData.accountDetail && cardData.node.fullName && (e.key === 'Enter' || e.key === ' ')) {
										e.preventDefault();
										handleAccountClick(cardData.node.fullName);
									}
								}}
							>
								<div class="account-info">
									<span class="account-icon">{cardData.icon}</span>
									<span class="account-name">{cardData.node.name}</span>
								</div>
								
								{#if cardData.accountDetail}
									<div class="account-balance" style="color: {cardData.color}">
										{cardData.accountDetail.balance}
									</div>
								{/if}
							</div>
						</div>

						{#if cardData.hasChildren && cardData.isExpanded && cardData.level < 15}
							<div class="children-container">
								{#each cardData.node.children as childNode (childNode.fullName || childNode.name)}
									{@const childCardData = renderAccountNode(childNode, cardData.level + 1)}
									{#if childCardData.level < 15}
										<div class="account-card" style="margin-left: {childCardData.level * 20}px">
											<div class="card-header">
												{#if childCardData.hasChildren}
													<button 
														class="expand-button"
														on:click|stopPropagation={() => handleExpandToggle(childCardData.node.fullName)}
														aria-label={childCardData.isExpanded ? 'Collapse' : 'Expand'}
													>
														{childCardData.isExpanded ? '▼' : '▶'}
													</button>
												{:else}
													<span class="expand-spacer"></span>
												{/if}
												
												<div 
													class="card-content"
													class:clickable={childCardData.accountDetail}
													on:click|stopPropagation={() => {
														if (childCardData.accountDetail && childCardData.node.fullName) {
															handleAccountClick(childCardData.node.fullName);
														}
													}}
													role={childCardData.accountDetail ? 'button' : undefined}
													tabindex={childCardData.accountDetail ? 0 : undefined}
													on:keydown={(e) => {
														if (childCardData.accountDetail && childCardData.node.fullName && (e.key === 'Enter' || e.key === ' ')) {
															e.preventDefault();
															handleAccountClick(childCardData.node.fullName);
														}
													}}
												>
													<div class="account-info">
														<span class="account-icon">{childCardData.icon}</span>
														<span class="account-name">{childCardData.node.name}</span>
													</div>
													
													{#if childCardData.accountDetail}
														<div class="account-balance" style="color: {childCardData.color}">
															{childCardData.accountDetail.balance}
														</div>
													{/if}
												</div>
											</div>

											{#if childCardData.hasChildren && childCardData.isExpanded && childCardData.level < 14}
												<div class="children-container">
													{#each childCardData.node.children as grandChildNode}
														{@const grandChildCardData = renderAccountNode(grandChildNode, childCardData.level + 1)}
														{#if grandChildCardData.level < 14}
															<div class="account-card" style="margin-left: {grandChildCardData.level * 20}px">
																<div class="card-header">
																	{#if grandChildCardData.hasChildren}
																		<button 
																			class="expand-button"
																			on:click|stopPropagation={() => handleExpandToggle(grandChildCardData.node.fullName)}
																			aria-label={grandChildCardData.isExpanded ? 'Collapse' : 'Expand'}
																		>
																			{grandChildCardData.isExpanded ? '▼' : '▶'}
																		</button>
																	{:else}
																		<span class="expand-spacer"></span>
																	{/if}
																	
																	<div 
																		class="card-content"
																		class:clickable={grandChildCardData.accountDetail}
																		on:click|stopPropagation={() => {
																			if (grandChildCardData.accountDetail && grandChildCardData.node.fullName) {

																				handleAccountClick(grandChildCardData.node.fullName);
																			}
																		}}
																		role={grandChildCardData.accountDetail ? 'button' : undefined}
																		tabindex={grandChildCardData.accountDetail ? 0 : undefined}
																		on:keydown={(e) => {
																			if (grandChildCardData.accountDetail && grandChildCardData.node.fullName && (e.key === 'Enter' || e.key === ' ')) {
																				e.preventDefault();
																				handleAccountClick(grandChildCardData.node.fullName);
																			}
																		}}
																	>
																		<div class="account-info">
																			<span class="account-icon">{grandChildCardData.icon}</span>
																			<span class="account-name">{grandChildCardData.node.name}</span>
																		</div>
																		
																		{#if grandChildCardData.accountDetail}
																			<div class="account-balance" style="color: {grandChildCardData.color}">
																				{grandChildCardData.accountDetail.balance}
																			</div>
																		{/if}
																	</div>
																</div>

																{#if grandChildCardData.hasChildren && grandChildCardData.isExpanded && grandChildCardData.level < 13}
																	<div class="children-container">
																		{#each grandChildCardData.node.children as greatGrandChildNode}
																			{@const greatGrandChildCardData = renderAccountNode(greatGrandChildNode, grandChildCardData.level + 1)}
																			{#if greatGrandChildCardData.level < 13}
																				<div class="account-card" style="margin-left: {greatGrandChildCardData.level * 20}px">
																					<div class="card-header">
																						{#if greatGrandChildCardData.hasChildren}
																							<button 
																								class="expand-button"
																								on:click|stopPropagation={() => {

																									handleExpandToggle(greatGrandChildCardData.node.fullName);
																								}}
																								aria-label={greatGrandChildCardData.isExpanded ? 'Collapse' : 'Expand'}
																							>
																								{greatGrandChildCardData.isExpanded ? '▼' : '▶'}
																							</button>
																						{:else}
																							<span class="expand-spacer"></span>
																						{/if}
																						
																						<div 
																							class="card-content"
																							class:clickable={greatGrandChildCardData.accountDetail}
																							on:click|stopPropagation={() => {
																								if (greatGrandChildCardData.accountDetail && greatGrandChildCardData.node.fullName) {

																									handleAccountClick(greatGrandChildCardData.node.fullName);
																								}
																							}}
																							role={greatGrandChildCardData.accountDetail ? 'button' : undefined}
																							tabindex={greatGrandChildCardData.accountDetail ? 0 : undefined}
																							on:keydown={(e) => {
																								if (greatGrandChildCardData.accountDetail && greatGrandChildCardData.node.fullName && (e.key === 'Enter' || e.key === ' ')) {
																									e.preventDefault();
																									handleAccountClick(greatGrandChildCardData.node.fullName);
																								}
																							}}
																						>
																							<div class="account-info">
																								<span class="account-icon">{greatGrandChildCardData.icon}</span>
																								<span class="account-name">{greatGrandChildCardData.node.name}</span>
																							</div>
																							
																							{#if greatGrandChildCardData.accountDetail}
																								<div class="account-balance" style="color: {greatGrandChildCardData.color}">
																									{greatGrandChildCardData.accountDetail.balance}
																								</div>
																							{/if}
																						</div>
																					</div>

																					{#if greatGrandChildCardData.hasChildren && greatGrandChildCardData.isExpanded && greatGrandChildCardData.level < 12}
																						<div class="children-container">
																							{#each greatGrandChildCardData.node.children as level5Node}
																								{@const level5CardData = renderAccountNode(level5Node, greatGrandChildCardData.level + 1)}
																								{#if level5CardData.level < 12}
																									<div class="account-card" style="margin-left: {level5CardData.level * 20}px">
																										<div class="card-header">
																											<span class="expand-spacer"></span>
																											<div 
																												class="card-content clickable"
																												on:click|stopPropagation={() => {
																													if (level5CardData.accountDetail && level5CardData.node.fullName) {

																														handleAccountClick(level5CardData.node.fullName);
																													}
																												}}
																												role="button"
																												tabindex="0"
																												on:keydown={(e) => {
																													if (level5CardData.accountDetail && level5CardData.node.fullName && (e.key === 'Enter' || e.key === ' ')) {
																														e.preventDefault();
																														handleAccountClick(level5CardData.node.fullName);
																													}
																												}}
																											>
																												<div class="account-info">
																													<span class="account-icon">{level5CardData.icon}</span>
																													<span class="account-name">{level5CardData.node.name}</span>
																												</div>
																												
																												{#if level5CardData.accountDetail}
																													<div class="account-balance" style="color: {level5CardData.color}">
																														{level5CardData.accountDetail.balance}
																													</div>
																												{/if}
																											</div>
																										</div>

																										{#if level5CardData.hasChildren}
																											<div class="children-container">
																												<div class="max-depth-warning">
																													📁 More accounts available - use search to filter deeper levels
																												</div>
																											</div>
																										{/if}
																									</div>
																								{/if}
																							{/each}
																						</div>
																					{/if}
																				</div>
																			{/if}
																		{/each}
																	</div>
																{/if}
															</div>
														{/if}
													{/each}
												</div>
											{/if}
										</div>
									{/if}
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style>
	.accounts-tab {
		padding: 16px;
		height: 100%;
		overflow-y: auto;
	}

	.accounts-header {
		display: flex;
		gap: 12px;
		margin-bottom: 16px;
		align-items: center;
	}

	.search-container {
		flex: 1;
	}

	.account-search {
		width: 100%;
		padding: 8px 12px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 6px;
		background: var(--background-primary);
		color: var(--text-normal);
	}

	.refresh-button {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 6px;
		background: var(--background-primary);
		color: var(--text-normal);
		cursor: pointer;
		white-space: nowrap;
	}

	.refresh-button:hover {
		background: var(--background-modifier-hover);
	}

	.refresh-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.spinner {
		width: 16px;
		height: 16px;
		border: 2px solid var(--background-modifier-border);
		border-top: 2px solid var(--text-accent);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	.error-state, .loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px 20px;
		text-align: center;
	}

	.error-message {
		color: var(--text-error);
		margin-bottom: 12px;
	}

	.retry-button {
		padding: 8px 16px;
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		border: none;
		border-radius: 6px;
		cursor: pointer;
	}

	.accounts-container {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.account-card {
		border: 1px solid var(--background-modifier-border);
		border-radius: 8px;
		background: var(--background-primary);
		transition: all 0.2s ease;
	}

	.account-card:hover {
		border-color: var(--background-modifier-border-hover);
		box-shadow: 0 2px 8px var(--background-modifier-box-shadow);
	}

	.card-header {
		display: flex;
		align-items: center;
		padding: 12px;
	}

	.expand-button {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 4px;
		margin-right: 8px;
		font-size: 12px;
		min-width: 20px;
	}

	.expand-button:hover {
		color: var(--text-normal);
	}

	.expand-spacer {
		width: 28px;
		margin-right: 8px;
	}

	.card-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex: 1;
		padding: 4px 8px;
		border-radius: 4px;
		transition: background 0.2s ease;
	}

	.card-content.clickable {
		cursor: pointer;
	}

	.card-content.clickable:hover {
		background: var(--background-modifier-hover);
	}

	.account-info {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.account-icon {
		font-size: 16px;
	}

	.account-name {
		font-weight: 500;
		color: var(--text-normal);
	}

	.account-balance {
		font-family: var(--font-monospace);
		font-weight: 600;
		font-size: 14px;
	}

	.children-container {
		border-top: 1px solid var(--background-modifier-border);
		padding: 8px 0;
	}

	/* Account Detail Modal */
	.account-detail-modal {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.account-detail-content {
		background: var(--background-primary);
		border-radius: 12px;
		max-width: 500px;
		width: 90%;
		max-height: 80vh;
		overflow-y: auto;
		box-shadow: 0 10px 30px var(--background-modifier-box-shadow);
	}

	.account-detail-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 20px 24px;
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.account-detail-header h3 {
		margin: 0;
		color: var(--text-normal);
		font-size: 18px;
	}

	.close-button {
		background: none;
		border: none;
		font-size: 24px;
		color: var(--text-muted);
		cursor: pointer;
		padding: 4px;
		line-height: 1;
	}

	.close-button:hover {
		color: var(--text-normal);
	}

	.account-detail-body {
		padding: 24px;
	}

	.detail-section {
		margin-bottom: 24px;
	}

	.detail-section h4 {
		margin: 0 0 12px 0;
		color: var(--text-normal);
		font-size: 16px;
	}

	.detail-grid {
		display: grid;
		gap: 12px;
	}

	.detail-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 0;
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.detail-item:last-child {
		border-bottom: none;
	}

	.detail-label {
		color: var(--text-muted);
		font-weight: 500;
	}

	.detail-value {
		color: var(--text-normal);
		font-weight: 600;
	}

	.detail-value.balance {
		font-family: var(--font-monospace);
	}

	.detail-actions {
		display: flex;
		gap: 12px;
		justify-content: flex-end;
	}

	.action-button {
		padding: 10px 16px;
		border-radius: 6px;
		border: none;
		cursor: pointer;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.action-button.primary {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
	}

	.action-button.primary:hover {
		background: var(--interactive-accent-hover);
	}

	.action-button.secondary {
		background: var(--background-secondary);
		color: var(--text-normal);
		border: 1px solid var(--background-modifier-border);
	}

	.action-button.secondary:hover {
		background: var(--background-modifier-hover);
	}

	.max-depth-warning {
		padding: 8px 12px;
		margin: 8px;
		background: var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		color: var(--text-muted);
		font-size: 12px;
		text-align: center;
	}
</style>