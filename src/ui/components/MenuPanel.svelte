<script lang="ts">
  import { VERSION_LABEL } from '../../app/build-info';
  import { checkForUpdate, type UpdateCheckResult } from '../../app/update-service.svelte';
  import { storageState } from '../../platform/storage-persist.svelte';
  import { S } from '../strings';

  let { open, onClose }: { open: boolean; onClose: () => void } = $props();
  let dialog: HTMLDialogElement | undefined = $state();

  const messages: Record<UpdateCheckResult, string> = {
    found: S.updateFound,
    'up-to-date': S.updateNone,
    unavailable: S.updateUnavailable,
  };

  let checking = $state(false);
  let result = $state<UpdateCheckResult | null>(null);

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });

  async function onCheck() {
    checking = true;
    result = null;
    result = await checkForUpdate();
    checking = false;
  }
</script>

<dialog bind:this={dialog} onclose={onClose} aria-labelledby="menu-title" data-testid="menu-panel">
  <h2 id="menu-title">{S.menuTitle}</h2>
  <p class="muted" data-testid="app-version">{VERSION_LABEL}</p>
  <p class="muted">
    {storageState.persisted ? S.storagePersisted : S.storageNotPersisted}
  </p>
  <button type="button" onclick={onCheck} disabled={checking}>
    {checking ? S.updateChecking : S.updateCheck}
  </button>
  {#if result}
    <p data-testid="update-check-result">{messages[result]}</p>
  {/if}
  <p><button type="button" class="primary" onclick={() => dialog?.close()}>{S.close}</button></p>
</dialog>

<style>
  dialog {
    min-width: min(22rem, calc(100vw - 32px));
    background: var(--surface);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 14px;
  }

  .muted {
    color: var(--muted);
  }
</style>
