<script lang="ts">
  import { VERSION_LABEL } from '../../app/build-info';
  import { checkForUpdate, type UpdateCheckResult } from '../../app/update-service.svelte';
  import type { BackupSession } from '../../app/backup-session.svelte';
  import { isValidStyleUrl } from '../../map/styles';
  import { storageState } from '../../platform/storage-persist.svelte';
  import { changeSetting, settings } from '../state/settings.svelte';
  import { S } from '../strings';
  import ClearDialog from './ClearDialog.svelte';

  let {
    open,
    backup,
    onClear,
    onClose,
  }: {
    open: boolean;
    backup: BackupSession;
    onClear: () => Promise<void>;
    onClose: () => void;
  } = $props();
  let dialog: HTMLDialogElement | undefined = $state();
  let clearOpen = $state(false);
  let includeTracks = $state(false);
  let checking = $state(false);
  let updateResult = $state<UpdateCheckResult | null>(null);
  let cleared = $state(false);
  const titleId = $props.id();

  const updateMessages: Record<UpdateCheckResult, string> = {
    found: S.updateFound,
    'up-to-date': S.updateNone,
    unavailable: S.updateUnavailable,
  };
  const styleInvalid = $derived(
    settings.mapStyle === 'custom' &&
      settings.customStyleUrl !== '' &&
      !isValidStyleUrl(settings.customStyleUrl),
  );

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      cleared = false;
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  });

  async function onCheck() {
    checking = true;
    updateResult = null;
    updateResult = await checkForUpdate();
    checking = false;
  }

  async function confirmClear() {
    await onClear();
    backup.message = null;
    cleared = true;
  }
</script>

<dialog
  class="sheet"
  bind:this={dialog}
  onclose={onClose}
  aria-labelledby={titleId}
  data-testid="menu-panel"
>
  <h2 id={titleId}>{S.menuTitle}</h2>

  <section aria-labelledby="{titleId}-rec">
    <h3 id="{titleId}-rec">{S.settingsRecording}</h3>
    <label class="field">
      <span>{S.settingsAccuracy} : {settings.accuracyThresholdM} m</span>
      <input
        type="range"
        min="10"
        max="200"
        step="5"
        value={settings.accuracyThresholdM}
        oninput={(e) => void changeSetting('accuracyThresholdM', Number(e.currentTarget.value))}
      />
      <small class="muted">{S.settingsAccuracyHint}</small>
    </label>
    <label class="check">
      <input
        type="checkbox"
        checked={settings.keepRawTracks}
        onchange={(e) => void changeSetting('keepRawTracks', e.currentTarget.checked)}
      />
      {S.settingsKeepTracks}
    </label>
    <label class="check">
      <input
        type="checkbox"
        checked={settings.wakeLockDefault}
        onchange={(e) => void changeSetting('wakeLockDefault', e.currentTarget.checked)}
      />
      {S.settingsWakeLock}
    </label>
  </section>

  <section aria-labelledby="{titleId}-look">
    <h3 id="{titleId}-look">{S.settingsAppearance}</h3>
    <label class="field">
      <span>{S.settingsTheme}</span>
      <select
        value={settings.theme}
        onchange={(e) =>
          void changeSetting('theme', e.currentTarget.value as typeof settings.theme)}
      >
        {#each Object.entries(S.themes) as [value, label] (value)}
          <option {value}>{label}</option>
        {/each}
      </select>
    </label>
    <label class="field">
      <span>{S.settingsMapStyle}</span>
      <select
        value={settings.mapStyle}
        onchange={(e) =>
          void changeSetting('mapStyle', e.currentTarget.value as typeof settings.mapStyle)}
      >
        {#each Object.entries(S.mapStyles) as [value, label] (value)}
          <option {value}>{label}</option>
        {/each}
      </select>
    </label>
    {#if settings.mapStyle === 'custom'}
      <label class="field">
        <span>{S.settingsCustomStyle}</span>
        <input
          type="url"
          inputmode="url"
          placeholder="https://…/style.json"
          value={settings.customStyleUrl}
          aria-invalid={styleInvalid}
          onchange={(e) => void changeSetting('customStyleUrl', e.currentTarget.value.trim())}
        />
        {#if styleInvalid}<small class="error" role="alert">{S.settingsCustomStyleInvalid}</small
          >{/if}
      </label>
    {/if}
  </section>

  <section aria-labelledby="{titleId}-data">
    <h3 id="{titleId}-data">{S.settingsData}</h3>
    <label class="check">
      <input type="checkbox" bind:checked={includeTracks} />
      {S.backupIncludeTracks}
    </label>
    <div class="row">
      <button
        type="button"
        disabled={backup.working}
        onclick={() => void backup.export(includeTracks)}
      >
        {S.backupExport}
      </button>
      <label class="button-like">
        <span>{S.backupRestore}</span>
        <input
          type="file"
          data-testid="restore-input"
          disabled={backup.working}
          onchange={(e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = '';
            if (file) void backup.restore(file);
          }}
        />
      </label>
    </div>
    <small class="muted">{S.backupRestoreHint}</small>
    <p class="row">
      <button type="button" class="danger" onclick={() => (clearOpen = true)}>{S.clearAll}</button>
    </p>
    <p role="status" data-testid="backup-status" class:error={backup.message?.kind === 'error'}>
      {#if backup.message}{backup.message.text}{:else if cleared}{S.clearDone}{/if}
    </p>
  </section>

  <section aria-labelledby="{titleId}-about">
    <h3 id="{titleId}-about">{S.settingsAbout}</h3>
    <p class="muted" data-testid="app-version">{VERSION_LABEL}</p>
    <p class="muted">{storageState.persisted ? S.storagePersisted : S.storageNotPersisted}</p>
    <button type="button" onclick={onCheck} disabled={checking}>
      {checking ? S.updateChecking : S.updateCheck}
    </button>
    {#if updateResult}<p data-testid="update-check-result">{updateMessages[updateResult]}</p>{/if}
  </section>

  <p class="row end">
    <button type="button" class="primary" onclick={() => dialog?.close()}>{S.close}</button>
  </p>
</dialog>

<ClearDialog
  open={clearOpen}
  onConfirm={() => void confirmClear()}
  onClose={() => (clearOpen = false)}
/>

<style>
  dialog {
    background: var(--surface);
    color: var(--fg);
    border: 1px solid var(--border);
  }

  h3 {
    margin: 16px 0 6px;
    font-size: 1rem;
  }

  section {
    border-top: 1px solid var(--border);
    padding-bottom: 4px;
  }

  .field {
    display: grid;
    gap: 4px;
    margin: 10px 0;
  }

  .check {
    display: flex;
    gap: 8px;
    align-items: center;
    margin: 8px 0;
  }

  .row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }

  .end {
    justify-content: flex-end;
  }

  select,
  input[type='url'] {
    font: inherit;
    padding: 8px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--fg);
  }

  .muted {
    color: var(--muted);
  }

  .error {
    color: var(--danger-text);
  }

  .danger {
    background: var(--danger);
    border-color: var(--danger);
    color: #fff;
  }

  .button-like {
    position: relative;
    display: inline-flex;
    align-items: center;
    min-height: 40px;
    padding: 8px 14px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
    cursor: pointer;
  }

  .button-like:focus-within {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }

  .button-like input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
</style>
