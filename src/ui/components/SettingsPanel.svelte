<script lang="ts">
  import { VERSION_LABEL } from '../../app/build-info';
  import { installState, promptInstall } from '../../app/install-service.svelte';
  import { profile, setPseudo } from '../../app/profile.svelte';
  import {
    checkForUpdate,
    updatesEnabled,
    type UpdateCheckResult,
  } from '../../app/update-service.svelte';
  import type { BackupSession } from '../../app/backup-session.svelte';
  import type { ImportSession } from '../../app/import-session.svelte';
  import { storageState } from '../../platform/storage-persist.svelte';
  import { changeSetting, settings } from '../state/settings.svelte';
  import { S } from '../i18n/i18n.svelte';
  import ClearDialog from './ClearDialog.svelte';
  import ImportSection from './ImportSection.svelte';
  import Section from './Section.svelte';

  let {
    open,
    backup,
    importSession,
    onClear,
    onClose,
  }: {
    open: boolean;
    backup: BackupSession;
    importSession: ImportSession;
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

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      cleared = false;
      importSession.reset();
      dialog.showModal();
      // Pas d'autofocus sur le pseudo (clavier mobile) : focus sur le panneau lui-même.
      dialog.focus();
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
  oncancel={(e) => importSession.state === 'running' && e.preventDefault()}
  aria-labelledby={titleId}
  tabindex="-1"
  data-testid="menu-panel"
>
  <h2 id={titleId}>{S.menuTitle}</h2>

  <Section title={S.settingsPseudo}>
    <label class="field">
      <span>{S.landingPseudoLabel}</span>
      <input
        type="text"
        data-testid="pseudo-setting"
        value={profile.pseudo}
        maxlength="24"
        onchange={(e) => {
          if (!setPseudo(e.currentTarget.value)) e.currentTarget.value = profile.pseudo;
        }}
      />
    </label>
  </Section>

  <Section title={S.settingsRecording}>
    <label class="field">
      <span>{S.settingsAccuracy(settings.accuracyThresholdM)}</span>
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
  </Section>

  <Section title={S.settingsAppearance}>
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
      <span>{S.settingsLanguage}</span>
      <select
        value={settings.language}
        onchange={(e) =>
          void changeSetting('language', e.currentTarget.value as typeof settings.language)}
      >
        {#each Object.entries(S.languages) as [value, label] (value)}
          <option {value}>{label}</option>
        {/each}
      </select>
    </label>
  </Section>

  <ImportSection session={importSession} />

  <Section title={S.settingsData}>
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
    <p
      role="status"
      data-testid="backup-status"
      class:error={backup.message?.kind === 'export-failed' ||
        backup.message?.kind === 'restore-failed'}
    >
      {#if backup.message}{S.backupStatus(backup.message)}{:else if cleared}{S.clearDone}{/if}
    </p>
  </Section>

  <Section title={S.settingsAbout}>
    <p class="muted" data-testid="app-version">{VERSION_LABEL}</p>
    <p class="muted">{storageState.persisted ? S.storagePersisted : S.storageNotPersisted}</p>
    {#if installState.canPrompt}
      <p>
        <button type="button" onclick={() => void promptInstall()}>{S.installMenu}</button>
      </p>
    {/if}
    {#if updatesEnabled}
      <button type="button" onclick={onCheck} disabled={checking}>
        {checking ? S.updateChecking : S.updateCheck}
      </button>
      {#if updateResult}<p data-testid="update-check-result">
          {S.updateResults[updateResult]}
        </p>{/if}
    {/if}
  </Section>

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
  input[type='text'] {
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
