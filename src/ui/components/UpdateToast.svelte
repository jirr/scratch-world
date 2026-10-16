<script lang="ts">
  import { applyUpdate, dismissUpdate, updateState } from '../../app/update-service.svelte';
  import { S } from '../i18n/i18n.svelte';
</script>

{#if updateState.visible}
  <div class="toast" role="status" data-testid="update-toast">
    <span>{S.updateAvailable}</span>
    <button type="button" class="primary" onclick={() => void applyUpdate()}>
      {S.updateAction}
    </button>
    <button type="button" aria-label={S.updateDismiss} onclick={dismissUpdate}>✕</button>
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    left: 50%;
    bottom: calc(92px + env(safe-area-inset-bottom));
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border-radius: 12px;
    background: var(--surface);
    color: var(--fg);
    border: 1px solid var(--border);
    box-shadow: 0 6px 24px rgb(0 0 0 / 0.35);
    z-index: 1000;
  }
</style>
