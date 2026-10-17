<script lang="ts">
  import type { StatsClient } from '../../app/stats-client.svelte';
  import type { ZoneStats } from '../../domain/stats';
  import { i18n, S } from '../i18n/i18n.svelte';
  import Icon from './Icon.svelte';
  import Section from './Section.svelte';

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

  /** Sections par granularité, du plus large au plus fin (le monde est traité à part). */
  const zoneSections = $derived(
    client.stats
      ? [
          {
            title: S.statsCountries,
            testid: 'stats-countries-section',
            listTestid: 'stats-countries',
            zones: client.stats.countries,
            label: (z: ZoneStats) => S.countryName(z.code, z.name),
          },
          {
            title: S.statsRegions,
            testid: 'stats-regions-section',
            listTestid: 'stats-regions',
            zones: client.stats.regions,
            label: (z: ZoneStats) => z.name,
          },
          {
            title: S.statsDepartments,
            testid: 'stats-departments-section',
            listTestid: 'stats-departments',
            zones: client.stats.departments,
            label: (z: ZoneStats) => z.name,
          },
        ]
      : [],
  );
</script>

{#snippet zoneRow(name: string, value: number, area?: number, pctTestid?: string)}
  <li>
    <span class="name">{name}</span>
    {#if area !== undefined}<span class="muted area">{km2(area)}</span>{/if}
    <span class="pct" data-testid={pctTestid}>{pct(value)}</span>
    <div
      class="bar"
      role="progressbar"
      aria-label={name}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={Math.round(value * 100) / 100}
      aria-valuetext={pct(value)}
    >
      <div class="fill" class:visible={value > 0} style:width="{Math.min(100, value)}%"></div>
    </div>
  </li>
{/snippet}

<dialog
  class="page"
  bind:this={dialog}
  onclose={() => {
    client.close();
    onClose();
  }}
  aria-labelledby={titleId}
  data-testid="stats-panel"
>
  <header>
    <button
      type="button"
      class="back"
      aria-label={S.close}
      title={S.close}
      onclick={() => dialog?.close()}
    >
      <Icon name="back" />
    </button>
    <h2 id={titleId}>{S.statsTitle}</h2>
  </header>

  <div class="content">
    {#if client.stats && client.stats.cellCount > 0}
      {@const stats = client.stats}
      <Section title={S.statsWorldTitle} open testid="stats-world-section">
        {#snippet aside()}{pct(stats.worldPct)}{/snippet}
        <ul class="zones">
          {@render zoneRow(S.statsWorldTitle, stats.worldPct, undefined, 'stats-world')}
        </ul>
        <dl class="totals">
          <div>
            <dt>{S.statsArea}</dt>
            <dd data-testid="stats-area">{km2(stats.areaKm2)}</dd>
          </div>
          <div>
            <dt>{S.statsCells}</dt>
            <dd data-testid="stats-cells">{int.format(stats.cellCount)}</dd>
          </div>
        </dl>
      </Section>

      {#each zoneSections as section (section.testid)}
        <Section title={section.title} testid={section.testid}>
          {#snippet aside()}{int.format(section.zones.length)}{/snippet}
          <ul class="zones" data-testid={section.listTestid}>
            {#each section.zones as zone (zone.code)}
              {@render zoneRow(section.label(zone), zone.pct, zone.areaKm2)}
            {/each}
          </ul>
          {#if section.zones.length === 0}<p class="muted small">{S.statsNoZone}</p>{/if}
        </Section>
      {/each}

      <p class="muted small note">{S.statsSea} {S.statsDataset}</p>
    {:else if !client.computing}
      <p>{S.statsEmpty}</p>
    {/if}

    <p class="status" role="status">
      {#if client.computing}{S.statsComputing}{/if}
      {#if client.failed}{S.statsFailed}{/if}
    </p>
  </div>
</dialog>

<style>
  /* Page plein écran (la boîte modale garde focus, Échap et inertie du reste de l'application). */
  dialog.page {
    box-sizing: border-box;
    width: 100dvw;
    height: 100dvh;
    max-width: none;
    max-height: none;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: var(--bg);
    color: var(--fg);
    overflow: hidden;
  }

  dialog.page[open] {
    display: flex;
    flex-direction: column;
  }

  header {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: none;
    padding: calc(8px + env(safe-area-inset-top)) 12px 8px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
  }

  h2 {
    margin: 0;
    font-size: 1.2rem;
  }

  .back {
    display: grid;
    place-items: center;
    width: 44px;
    padding: 0;
    border-radius: 50%;
  }

  .content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    width: 100%;
    max-width: 44rem;
    margin: 0 auto;
    padding: 8px 16px calc(24px + env(safe-area-inset-bottom));
  }

  .zones {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .zones li {
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: baseline;
    column-gap: 12px;
    row-gap: 4px;
    padding: 6px 0;
  }

  .name {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .pct {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .area {
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
  }

  /* Barre de progression façon points d'expérience. */
  .bar {
    grid-column: 1 / -1;
    height: 10px;
    overflow: hidden;
    border-radius: 999px;
    background: var(--bg);
    border: 1px solid var(--border);
  }

  .fill {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(
      90deg,
      var(--accent),
      color-mix(in srgb, var(--accent) 60%, #ffd84d)
    );
    transition: width 0.4s ease;
  }

  /* Un très petit pourcentage reste visible. */
  .fill.visible {
    min-width: 8px;
  }

  .totals {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    margin: 8px 0 0;
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

  .muted {
    color: var(--muted);
  }

  .small {
    font-size: 0.8rem;
  }

  .note {
    margin-top: 16px;
  }

  .status:empty {
    display: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .fill {
      transition: none;
    }
  }
</style>
