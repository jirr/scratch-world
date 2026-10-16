<script lang="ts">
  import { dismissInstall, installState, promptInstall } from '../../app/install-service.svelte';
  import { S } from '../i18n/i18n.svelte';

  const titleId = $props.id();
</script>

{#if installState.visible}
  <div class="popup" role="dialog" aria-labelledby={titleId} data-testid="install-prompt">
    <img src="{import.meta.env.BASE_URL}pwa-64x64.png" alt="" width="48" height="48" />
    <div class="text">
      <strong id={titleId}>{S.installTitle}</strong>
      <span>{installState.canPrompt ? S.installBody : S.installIosBody}</span>
    </div>
    <div class="actions">
      {#if installState.canPrompt}
        <button type="button" class="primary" onclick={() => void promptInstall()}>
          {S.installAction}
        </button>
      {/if}
      <button type="button" onclick={dismissInstall}>{S.installLater}</button>
    </div>
  </div>
{/if}

<style>
  .popup {
    position: fixed;
    top: calc(12px + env(safe-area-inset-top));
    left: 50%;
    transform: translateX(-50%);
    width: min(28rem, calc(100vw - 24px));
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 6px 12px;
    align-items: center;
    padding: 12px 14px;
    border-radius: 14px;
    background: var(--surface);
    color: var(--fg);
    border: 1px solid var(--border);
    box-shadow: 0 8px 28px rgb(0 0 0 / 0.35);
    z-index: 900;
  }

  .text {
    display: grid;
    gap: 2px;
  }

  .actions {
    grid-column: 1 / -1;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
</style>
