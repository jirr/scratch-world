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
</script>

<nav class="bar" aria-label={S.navLabel} data-testid="bottom-bar">
  <button type="button" onclick={onStats}><Icon name="stats" /><span>{S.navStats}</span></button>
  <button type="button" class="fab" class:paused={!recording} onclick={onRecord}>
    <Icon name={recording ? 'pause' : 'play'} />
    <span>{recording ? S.recordPause : paused ? S.recordResume : S.recordStartNow}</span>
  </button>
  <button type="button" onclick={onImport}><Icon name="import" /><span>{S.navImport}</span></button>
  <button type="button" onclick={onMenu}><Icon name="menu" /><span>{S.navMenu}</span></button>
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
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    flex: 1;
    min-width: 0;
    min-height: 52px;
    padding: 4px 6px;
    font-size: 0.8125rem;
    font-weight: 500;
  }

  .fab {
    flex: 1.3;
    background: var(--accent);
    color: var(--accent-fg);
    border-color: var(--accent);
    font-size: 0.9375rem;
    font-weight: 700;
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
