<script lang="ts">
  import { db } from '../../data/db';
  import { getSetting } from '../../data/settings-store';
  import type { Recorder } from '../../recording/recorder.svelte';
  import { S } from '../strings';

  let { recorder, open, onClose }: { recorder: Recorder; open: boolean; onClose: () => void } =
    $props();
  let dialog: HTMLDialogElement | undefined = $state();
  let wakeLock = $state(false);

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      void getSetting(db, 'wakeLockDefault').then((value) => (wakeLock = value));
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  });

  async function start() {
    dialog?.close();
    await recorder.start({ wakeLock });
  }
</script>

<dialog
  bind:this={dialog}
  onclose={onClose}
  aria-labelledby="rec-title"
  data-testid="recording-sheet"
>
  <h2 id="rec-title">{S.recordTitle}</h2>
  <p>{S.recordBody}</p>
  {#if recorder.supportsWakeLock}
    <label>
      <input type="checkbox" bind:checked={wakeLock} />
      {S.wakeLock}
    </label>
  {/if}
  <p class="actions">
    <button type="button" onclick={() => dialog?.close()}>{S.cancel}</button>
    <button type="button" class="primary" onclick={start}>{S.recordStart}</button>
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
</style>
