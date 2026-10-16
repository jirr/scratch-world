<script lang="ts">
  import { S } from '../strings';

  let { paused }: { paused: boolean } = $props();
</script>

{#if paused}
  <div class="badge" role="status" data-testid="paused-indicator">
    <span>⏸ {S.paused}</span>
  </div>
{/if}

<style>
  .badge {
    position: fixed;
    left: 12px;
    top: calc(12px + env(safe-area-inset-top));
    padding: 6px 12px;
    border-radius: 999px;
    background: var(--surface);
    color: var(--fg);
    border: 1px solid var(--border);
    z-index: 20;
  }
</style>
