<script lang="ts">
  import { S } from '../strings';

  let {
    recording,
    onRecord,
    onImport,
    onStats,
    onMenu,
  }: {
    recording: boolean;
    onRecord: () => void;
    onImport: () => void;
    onStats: () => void;
    onMenu: () => void;
  } = $props();
</script>

<nav class="bar" aria-label="Navigation principale" data-testid="bottom-bar">
  <button type="button" onclick={onStats}><span>{S.navStats}</span></button>
  <button type="button" class="fab" class:active={recording} onclick={onRecord}>
    <span>{recording ? `■ ${S.recordStop}` : `● ${S.navRecord}`}</span>
  </button>
  <button type="button" onclick={onImport}><span>{S.navImport}</span></button>
  <button type="button" onclick={onMenu}><span>{S.navMenu}</span></button>
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
    flex: 1;
    min-height: 52px;
  }

  .fab {
    flex: 1.3;
    background: var(--accent);
    color: var(--accent-fg);
    border-color: var(--accent);
    font-weight: 600;
  }

  .fab.active {
    background: #e5484d;
    border-color: #e5484d;
    color: #fff;
  }
</style>
