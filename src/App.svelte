<script lang="ts">
  import { StatsClient } from './app/stats-client.svelte';
  import { ImportSession } from './app/import-session.svelte';
  import { db } from './data/db';
  import { createPositionSource } from './platform/position';
  import { ensurePersistentStorage } from './platform/storage-persist.svelte';
  import { createWakeLock } from './platform/wake-lock';
  import { Recorder } from './recording/recorder.svelte';
  import BottomBar from './ui/components/BottomBar.svelte';
  import ImportPanel from './ui/components/ImportPanel.svelte';
  import MapScreen from './ui/components/MapScreen.svelte';
  import MenuPanel from './ui/components/MenuPanel.svelte';
  import PermissionNotice from './ui/components/PermissionNotice.svelte';
  import RecordingIndicator from './ui/components/RecordingIndicator.svelte';
  import RecordingSheet from './ui/components/RecordingSheet.svelte';
  import StatsPanel from './ui/components/StatsPanel.svelte';
  import UpdateToast from './ui/components/UpdateToast.svelte';

  const recorder = new Recorder({ source: createPositionSource(), db, wakeLock: createWakeLock() });

  const importSession = new ImportSession();
  const statsClient = new StatsClient();

  let menuOpen = $state(false);
  let importOpen = $state(false);
  let statsOpen = $state(false);
  let sheetOpen = $state(false);
  let permissionOpen = $state(false);

  $effect(() => {
    if (recorder.status === 'denied') permissionOpen = true;
  });

  function onRecord() {
    if (recorder.state === 'recording') void recorder.stop();
    else sheetOpen = true;
  }

  void ensurePersistentStorage();
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
<MenuPanel open={menuOpen} onClose={() => (menuOpen = false)} />
<UpdateToast />
