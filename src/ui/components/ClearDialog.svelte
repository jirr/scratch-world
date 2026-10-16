<script lang="ts">
  import { S } from '../i18n/i18n.svelte';

  let { open, onConfirm, onClose }: { open: boolean; onConfirm: () => void; onClose: () => void } =
    $props();
  let dialog: HTMLDialogElement | undefined = $state();
  let cancelButton: HTMLButtonElement | undefined = $state();
  const titleId = $props.id();

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // Focus initial sur « Annuler » : jamais sur l’action destructive.
      cancelButton?.focus();
    }
    if (!open && dialog.open) dialog.close();
  });
</script>

<dialog bind:this={dialog} onclose={onClose} aria-labelledby={titleId} data-testid="clear-dialog">
  <h2 id={titleId}>{S.clearTitle}</h2>
  <p>{S.clearBody}</p>
  <p class="actions">
    <button type="button" bind:this={cancelButton} onclick={() => dialog?.close()}
      >{S.cancel}</button
    >
    <button
      type="button"
      class="danger"
      onclick={() => {
        onConfirm();
        dialog?.close();
      }}
    >
      {S.clearConfirm}
    </button>
  </p>
</dialog>

<style>
  dialog {
    max-width: min(26rem, calc(100vw - 32px));
    background: var(--surface);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 14px;
  }

  .actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .danger {
    background: var(--danger);
    border-color: var(--danger);
    color: #fff;
  }
</style>
