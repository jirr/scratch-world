<script lang="ts">
  import { S } from '../i18n/i18n.svelte';
  import Icon from './Icon.svelte';

  let {
    recording,
    paused,
    onRecord,
    onImport,
    onStats,
    onMenu,
  }: {
    recording: boolean;
    paused: boolean;
    onRecord: () => void;
    onImport: () => void;
    onStats: () => void;
    onMenu: () => void;
  } = $props();

  const recordLabel = $derived(
    recording ? S.recordPause : paused ? S.recordResume : S.recordStartNow,
  );
</script>

<nav class="bar" aria-label={S.navLabel} data-testid="bottom-bar">
  <!-- Icônes seules : le libellé reste accessible (aria-label) et en info-bulle (title). -->
  <button type="button" aria-label={S.navStats} title={S.navStats} onclick={onStats}>
    <Icon name="stats" />
  </button>
  <button
    type="button"
    class="fab"
    class:paused={!recording}
    aria-label={recordLabel}
    title={recordLabel}
    onclick={onRecord}
  >
    <Icon name={recording ? 'pause' : 'play'} />
  </button>
  <button type="button" aria-label={S.navImport} title={S.navImport} onclick={onImport}>
    <Icon name="import" />
  </button>
  <button type="button" aria-label={S.navMenu} title={S.navMenu} onclick={onMenu}>
    <Icon name="menu" />
  </button>
</nav>

<style>
  .bar {
    position: fixed;
    inset: auto 0 0 0;
    display: flex;
    justify-content: space-around;
    align-items: center;
    gap: 8px;
    padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
    background: var(--surface);
    border-top: 1px solid var(--border);
    z-index: 10;
  }

  button {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    min-width: 0;
    min-height: 52px;
    padding: 4px 6px;
  }

  .fab {
    flex: 1.3;
    background: var(--accent);
    color: var(--accent-fg);
    border-color: var(--accent);
  }

  .fab.paused {
    background: var(--surface);
    color: var(--fg);
    border-color: var(--accent);
  }

  .fab.paused :global(.icon) {
    color: var(--accent);
  }
</style>
