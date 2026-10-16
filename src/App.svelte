<script lang="ts">
  import { StatsClient } from './app/stats-client.svelte';
  import { BackupSession } from './app/backup-session.svelte';
  import { ImportSession } from './app/import-session.svelte';
  import { clearAll } from './data/cell-store';
  import { db } from './data/db';
  import { createPositionSource } from './platform/position';
  import { ensurePersistentStorage } from './platform/storage-persist.svelte';
  import { createWakeLock } from './platform/wake-lock';
  import { Recorder } from './recording/recorder.svelte';
  import BottomBar from './ui/components/BottomBar.svelte';
  import ImportPanel from './ui/components/ImportPanel.svelte';
  import InstallPrompt from './ui/components/InstallPrompt.svelte';
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

  $effect(() => {
    document.documentElement.dataset.theme = settings.theme;
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

<MapScreen {recorder} onPermissionDenied={() => (permissionOpen = true)} />
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
<PermissionNotice open={permissionOpen} onClose={() => (permissionOpen = false)} />
<SettingsPanel
  open={menuOpen}
  backup={backupSession}
  onClear={() => clearAll(db)}
  onClose={() => (menuOpen = false)}
/>
<InstallPrompt />
<UpdateToast />
