<script lang="ts">
  import { StatsClient } from './app/stats-client.svelte';
  import { BackupSession } from './app/backup-session.svelte';
  import { profile } from './app/profile.svelte';
  import { ImportSession } from './app/import-session.svelte';
  import { clearAll } from './data/cell-store';
  import { db } from './data/db';
  import { createPositionSource } from './platform/position';
  import { ensurePersistentStorage } from './platform/storage-persist.svelte';
  import { createWakeLock } from './platform/wake-lock';
  import { Recorder } from './recording/recorder.svelte';
  import BottomBar from './ui/components/BottomBar.svelte';
  import ImportPanel from './ui/components/ImportPanel.svelte';
  import ApproximateNotice from './ui/components/ApproximateNotice.svelte';
  import InstallPrompt from './ui/components/InstallPrompt.svelte';
  import Landing from './ui/components/Landing.svelte';
  import MapScreen from './ui/components/MapScreen.svelte';
  import SettingsPanel from './ui/components/SettingsPanel.svelte';
  import PermissionNotice from './ui/components/PermissionNotice.svelte';
  import RecordingIndicator from './ui/components/RecordingIndicator.svelte';
  import RecordingSheet from './ui/components/RecordingSheet.svelte';
  import StatsPanel from './ui/components/StatsPanel.svelte';
  import UpdateToast from './ui/components/UpdateToast.svelte';
  import { initSettings, settings } from './ui/state/settings.svelte';

  const recorder = new Recorder({ source: createPositionSource(), db, wakeLock: createWakeLock() });

  const importSession = new ImportSession();
  const statsClient = new StatsClient();
  const backupSession = new BackupSession();

  let menuOpen = $state(false);
  let importOpen = $state(false);
  let statsOpen = $state(false);
  let sheetOpen = $state(false);
  let permissionOpen = $state(false);
  let approxOpen = $state(false);
  let approxShown = false;
  let retryToken = $state(0);

  $effect(() => {
    document.documentElement.dataset.theme = settings.theme;
  });

  $effect(() => {
    // Une seule fois par session : pas de fenêtre en boucle.
    if (recorder.approximate && !approxShown) {
      approxShown = true;
      approxOpen = true;
    }
  });

  $effect(() => {
    if (recorder.status === 'denied') permissionOpen = true;
  });

  function onRecord() {
    if (recorder.state === 'recording') void recorder.stop();
    else sheetOpen = true;
  }

  void ensurePersistentStorage();
  void initSettings();
</script>

{#if !profile.pseudo}
  <Landing />
{:else}
  <MapScreen
    {recorder}
    {retryToken}
    onPermissionDenied={() => (permissionOpen = true)}
    onApproximate={() => (approxOpen = true)}
  />
  <RecordingIndicator {recorder} />
  <BottomBar
    recording={recorder.state === 'recording'}
    {onRecord}
    onImport={() => (importOpen = true)}
    onStats={() => (statsOpen = true)}
    onMenu={() => (menuOpen = true)}
  />
  <StatsPanel client={statsClient} open={statsOpen} onClose={() => (statsOpen = false)} />
  <ImportPanel session={importSession} open={importOpen} onClose={() => (importOpen = false)} />
  <RecordingSheet {recorder} open={sheetOpen} onClose={() => (sheetOpen = false)} />
  <ApproximateNotice
    open={approxOpen}
    onRetry={() => retryToken++}
    onClose={() => (approxOpen = false)}
  />
  <PermissionNotice open={permissionOpen} onClose={() => (permissionOpen = false)} />
  <SettingsPanel
    open={menuOpen}
    backup={backupSession}
    onClear={() => clearAll(db)}
    onClose={() => (menuOpen = false)}
  />
  <InstallPrompt />
  <UpdateToast />
{/if}
