<script lang="ts">
  import { S } from '../i18n/i18n.svelte';

  let {
    open,
    openSettings,
    onClose,
  }: {
    open: boolean;
    /** Application native : ouvre ses réglages (null dans le navigateur). */
    openSettings: (() => Promise<void>) | null;
    onClose: () => void;
  } = $props();
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
    {#if openSettings}
      <li>{S.permissionAppIos}</li>
      <li>{S.permissionAppAndroid}</li>
    {:else}
      <li>{S.permissionIos}</li>
      <li>{S.permissionAndroid}</li>
    {/if}
  </ul>
  <p class="actions">
    {#if openSettings}
      <button type="button" onclick={() => void openSettings()}>{S.openSettings}</button>
    {/if}
    <button type="button" class="primary" onclick={() => dialog?.close()}>{S.close}</button>
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

  .actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
</style>
