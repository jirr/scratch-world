<script lang="ts">
  import { S } from '../i18n/i18n.svelte';

  let {
    open,
    openSettings,
    onRetry,
    onClose,
  }: {
    open: boolean;
    /** Application native : ouvre ses réglages (null dans le navigateur). */
    openSettings: (() => Promise<void>) | null;
    onRetry: () => void;
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
  data-testid="approximate-notice"
>
  <h2 id={titleId}>{S.approxTitle}</h2>
  {#if openSettings}
    <p>{S.approxAppBody}</p>
    <ul>
      <li>{S.approxAppIos}</li>
      <li>{S.approxAppAndroid}</li>
    </ul>
  {:else}
    <p>{S.approxBody}</p>
    <ul>
      <li>{S.approxIos}</li>
      <li>{S.approxAndroid}</li>
    </ul>
    <p class="muted">{S.approxReload}</p>
  {/if}
  <p class="actions">
    {#if openSettings}
      <button type="button" onclick={() => void openSettings()}>{S.openSettings}</button>
    {/if}
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
    flex-wrap: wrap;
    gap: 8px;
    justify-content: flex-end;
  }
</style>
