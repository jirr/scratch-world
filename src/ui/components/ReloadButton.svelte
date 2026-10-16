<script lang="ts">
  import { busy } from '../../app/busy.svelte';
  import { S } from '../i18n/i18n.svelte';
  import Icon from './Icon.svelte';

  let dialog: HTMLDialogElement | undefined = $state();
  const titleId = $props.id();
</script>

<button
  type="button"
  class="round reload"
  aria-label={S.reload}
  title={S.reload}
  onclick={() => dialog?.showModal()}
>
  <Icon name="refresh" />
</button>

<dialog bind:this={dialog} aria-labelledby={titleId} data-testid="reload-dialog">
  <h2 id={titleId}>{S.reloadTitle}</h2>
  <p>{S.reloadBody}</p>
  {#if busy.isBusy}<p class="warn" role="alert">{S.reloadConfirm}</p>{/if}
  <p class="actions">
    <button type="button" onclick={() => dialog?.close()}>{S.cancel}</button>
    <button type="button" class="primary" onclick={() => location.reload()}>{S.reloadAction}</button
    >
  </p>
</dialog>

<style>
  .reload {
    position: fixed;
    right: 12px;
    top: calc(12px + env(safe-area-inset-top));
    z-index: 5;
  }

  dialog {
    max-width: min(26rem, calc(100vw - 32px));
    background: var(--surface);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 14px;
  }

  .warn {
    color: var(--danger-text);
  }

  .actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
</style>
