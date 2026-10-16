<script lang="ts">
  import { S } from '../strings';

  let { open, onRetry, onClose }: { open: boolean; onRetry: () => void; onClose: () => void } =
    $props();
  let dialog: HTMLDialogElement | undefined = $state();
  const titleId = $props.id();

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });
</script>

<dialog
  bind:this={dialog}
  onclose={onClose}
  aria-labelledby={titleId}
  data-testid="approximate-notice"
>
  <h2 id={titleId}>{S.approxTitle}</h2>
  <p>{S.approxBody}</p>
  <ul>
    <li>{S.approxIos}</li>
    <li>{S.approxAndroid}</li>
  </ul>
  <p class="muted">{S.approxReload}</p>
  <p class="actions">
    <button type="button" onclick={() => dialog?.close()}>{S.close}</button>
    <button
      type="button"
      class="primary"
      onclick={() => {
        dialog?.close();
        onRetry();
      }}
    >
      {S.approxRetry}
    </button>
  </p>
</dialog>

<style>
  dialog {
    max-width: min(30rem, calc(100vw - 32px));
    background: var(--surface);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 14px;
  }

  .muted {
    color: var(--muted);
  }

  .actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
</style>
