<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  export let symbol: string;
  export let commodity: any = { symbol: '', metadata: {}, logo_url: null, price_meta: null, latest_price: null };

  const dispatch = createEventDispatcher();

  // Allow simultaneous editing
  let editingLogo = false;
  let editingPrice = false;
  let logoInput = '';
  let priceInput = '';

  onMount(() => {
    console.debug('[CommodityDetailModal.svelte] Mounted');
    logoInput = commodity?.metadata?.logo || commodity?.logo_url || '';
    priceInput = commodity?.metadata?.price || commodity?.price_meta || '';
    console.debug('[CommodityDetailModal.svelte] onMount', { symbol, logoInput, priceInput, commodity });
  });

  function toggleEditLogo() {
    editingLogo = !editingLogo;
  }
  function toggleEditPrice() {
    editingPrice = !editingPrice;
  }

  function saveMetadata() {
    const newMeta = { ...(commodity?.metadata || {}) };
    if (logoInput && logoInput.trim() !== '') newMeta.logo = logoInput.trim();
    else delete newMeta.logo;
    if (priceInput && priceInput.trim() !== '') newMeta.price = priceInput.trim();
    else delete newMeta.price;

    console.debug('[CommodityDetailModal.svelte] dispatch save-metadata', { symbol, newMeta });
    dispatch('save-metadata', { symbol, metadata: newMeta });
    editingLogo = false;
    editingPrice = false;
  }

  function testPrice() {
    console.debug('[CommodityDetailModal.svelte] dispatch test-price', { symbol, priceInput });
    dispatch('test-price', { symbol });
  }

  function testLogo() {
    console.debug('[CommodityDetailModal.svelte] dispatch test-logo', { symbol, url: logoInput });
    dispatch('test-logo', { symbol, url: logoInput });
  }
  
  function close() {
    dispatch('close');
  }
</script>

<style>
  .header { display:flex; align-items:center; gap:12px }
  .placeholder { width:48px; height:48px; display:flex; align-items:center; justify-content:center; background:#eee; border-radius:6px; font-weight:700 }
  .metadata-table { width:100%; border-collapse: collapse; margin-top:8px }
  .metadata-table .row { display:flex; gap:12px; padding:6px 0; border-bottom:1px solid #eee }
  .actions { margin-top:8px; display:flex; gap:8px }
  .muted { color:#666 }
</style>

<div>
  <div class="header">
    {#if commodity?.metadata?.logo || commodity?.logo_url}
      <img src={commodity?.metadata?.logo || commodity?.logo_url} alt="logo" width="48" height="48" on:error={() => { /* ignore broken images */ }} />
    {:else}
      <div class="placeholder">¤</div>
    {/if}
    <div>
      <div><strong>{symbol}</strong></div>
    </div>
  </div>

  <h4>All Metadata</h4>
  {#if commodity?.metadata && Object.keys(commodity.metadata).length > 0}
    <div class="metadata-table">
      {#each Object.entries(commodity.metadata) as [key, value]}
        <div class="row">
          <div style="width:30%;"><strong>{key}</strong></div>
          <div style="flex:1">{typeof value === 'string' ? value : JSON.stringify(value)}</div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="muted">No metadata present</div>
  {/if}

  <h4 style="margin-top:12px">Logo</h4>
  {#if !editingLogo}
    <div class="muted">{commodity?.metadata?.logo || 'No logo set'}</div>
    <div class="actions">
      <button on:click={toggleEditLogo}>{commodity?.metadata?.logo ? 'Edit Logo' : 'Add Logo'}</button>
      <button on:click={testLogo}>Test Logo</button>
    </div>
  {:else}
    <input type="text" bind:value={logoInput} placeholder="Enter logo URL" style="width:100%" />
    <div class="actions">
      <button on:click={testLogo}>Test Logo</button>
      <button on:click={saveMetadata}>Save</button>
      <button on:click={toggleEditLogo}>Cancel</button>
    </div>
    <div class="muted">One-line: Enter a direct image URL (e.g. https://site.com/logo.png)</div>
  {/if}

  <h4 style="margin-top:12px">Price</h4>
  {#if !editingPrice}
    <div class="muted">{commodity?.metadata?.price || commodity?.price_meta || 'No price metadata'}</div>
    <div class="actions">
      <button on:click={toggleEditPrice}>{commodity?.metadata?.price ? 'Edit Price' : 'Add Price'}</button>
      <button on:click={testPrice}>Test Price Source</button>
    </div>
  {:else}
    <input type="text" bind:value={priceInput} placeholder="Enter price metadata like 'USD:yahoo/AAPL'" style="width:100%" />
    <div class="actions">
      <button on:click={testPrice}>Test Price Source</button>
      <button on:click={saveMetadata}>Save</button>
      <button on:click={toggleEditPrice}>Cancel</button>
    </div>
    <div class="muted">One-line: Enter price source (e.g. USD:yahoo/AAPL)</div>
  {/if}

  <div style="margin-top:16px; display:flex; gap:8px; justify-content:flex-end">
    <button on:click={close}>Close</button>
  </div>
</div>
