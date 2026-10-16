<script lang="ts">
  import { S } from '../i18n/i18n.svelte';
  import Icon from './Icon.svelte';

  let { paused }: { paused: boolean } = $props();
</script>

{#if paused}
  <div class="badge" role="status" data-testid="paused-indicator">
    <Icon name="pause" size={16} /><span>{S.paused}</span>
  </div>
{/if}

<style>
  .badge {
    position: fixed;
    left: 12px;
    top: calc(12px + env(safe-area-inset-top));
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 999px;
    background: var(--surface);
    color: var(--fg);
    border: 1px solid var(--border);
    z-index: 20;
  }
</style>
