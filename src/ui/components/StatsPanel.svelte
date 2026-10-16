<script lang="ts">
  import type { StatsClient } from '../../app/stats-client.svelte';
  import { i18n, S } from '../i18n/i18n.svelte';

  let { client, open, onClose }: { client: StatsClient; open: boolean; onClose: () => void } =
    $props();
  let dialog: HTMLDialogElement | undefined = $state();
  const titleId = $props.id();

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      void client.open();
    }
    if (!open && dialog.open) dialog.close();
  });

  const int = $derived(new Intl.NumberFormat(i18n.locale, { maximumFractionDigits: 0 }));
  const dec = $derived(
    new Intl.NumberFormat(i18n.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  );

  const km2 = (n: number) => `${n < 10 ? dec.format(n) : int.format(n)} km²`;
  const pct = (n: number) =>
    n > 0 && n < 0.01 ? S.percent(S.lessThan(dec.format(0.01))) : S.percent(dec.format(n));
</script>

<dialog
  class="sheet"
  bind:this={dialog}
  onclose={() => {
    client.close();
    onClose();
  }}
  aria-labelledby={titleId}
  data-testid="stats-panel"
>
  <h2 id={titleId}>{S.statsTitle}</h2>

  {#if client.stats && client.stats.cellCount > 0}
    {@const stats = client.stats}
    <dl class="totals">
      <div>
        <dt>{S.statsArea}</dt>
        <dd data-testid="stats-area">{km2(stats.areaKm2)}</dd>
      </div>
      <div>
        <dt>{S.statsCells}</dt>
        <dd data-testid="stats-cells">{int.format(stats.cellCount)}</dd>
      </div>
      <div>
        <dt>{S.statsWorld}</dt>
        <dd data-testid="stats-world">{pct(stats.worldPct)}</dd>
      </div>
    </dl>
    <h3>{S.statsCountries}</h3>
    <ul class="countries" data-testid="stats-countries">
      {#each stats.countries as country (country.code)}
        <li>
          <span class="name">{S.countryName(country.code, country.name)}</span>
          <span>{km2(country.areaKm2)}</span>
          <span class="muted">{pct(country.pct)}</span>
        </li>
      {/each}
    </ul>
    <p class="muted small">{S.statsSea} {S.statsDataset}</p>
  {:else if !client.computing}
    <p>{S.statsEmpty}</p>
  {/if}

  <p class="status" role="status">
    {#if client.computing}{S.statsComputing}{/if}
    {#if client.failed}{S.statsFailed}{/if}
  </p>

  <p class="actions">
    <button type="button" class="primary" onclick={() => dialog?.close()}>{S.close}</button>
  </p>
</dialog>

<style>
  dialog {
    background: var(--surface);
    color: var(--fg);
    border: 1px solid var(--border);
  }

  .totals {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin: 0 0 12px;
  }

  .totals dt {
    color: var(--muted);
    font-size: 0.8rem;
  }

  .totals dd {
    margin: 0;
    font-weight: 700;
    font-size: 1.1rem;
  }

  .countries {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 40dvh;
    overflow: auto;
  }

  .countries li {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 12px;
    padding: 6px 0;
    border-bottom: 1px solid var(--border);
  }

  .muted {
    color: var(--muted);
  }

  .small {
    font-size: 0.8rem;
  }

  .status:empty {
    display: none;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
  }
</style>
