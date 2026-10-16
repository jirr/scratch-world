<script lang="ts">
  import type { Recorder } from '../../recording/recorder.svelte';
  import { S } from '../strings';

  let { recorder }: { recorder: Recorder } = $props();

  const clock = (ms: number) => {
    const total = Math.floor(ms / 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
  };
</script>

{#if recorder.state === 'recording'}
  <div class="indicator" role="status" data-testid="recording-indicator">
    <span class="dot" aria-hidden="true"></span>
    <span
      >{S.recording} · {clock(recorder.elapsedMs)} · +{recorder.cellsAdded}
      {S.cells}{#if recorder.cellsAdded === 0 && recorder.lastFix}
        · {S.accuracy} ±{Math.round(recorder.lastFix.accuracy)} m{/if}</span
    >
  </div>
{/if}

<style>
  .indicator {
    position: fixed;
    left: 12px;
    top: calc(12px + env(safe-area-inset-top));
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-radius: 999px;
    background: var(--surface);
    color: var(--fg);
    border: 1px solid var(--border);
    z-index: 20;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #e5484d;
    animation: pulse 1.2s ease-in-out infinite;
  }

  @keyframes pulse {
    50% {
      opacity: 0.3;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dot {
      animation: none;
    }
  }
</style>
