<script lang="ts">
  import { S } from '../strings';

  let { open, onClose }: { open: boolean; onClose: () => void } = $props();
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
  data-testid="permission-notice"
>
  <h2 id={titleId}>{S.permissionTitle}</h2>
  <p>{S.permissionBody}</p>
  <p>{S.permissionHowTo}</p>
  <ul>
    <li>{S.permissionIos}</li>
    <li>{S.permissionAndroid}</li>
  </ul>
  <button type="button" class="primary" onclick={() => dialog?.close()}>{S.close}</button>
</dialog>

<style>
  dialog {
    max-width: min(30rem, calc(100vw - 32px));
    background: var(--surface);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 14px;
  }
</style>
