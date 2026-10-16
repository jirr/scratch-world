<script lang="ts">
  import { StatsClient } from './app/stats-client.svelte';
  import { BackupSession } from './app/backup-session.svelte';
  import { profile } from './app/profile.svelte';
  import { recordingPref, setPaused } from './app/recording-pref.svelte';
  import { getSetting } from './data/settings-store';
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
  import ReloadButton from './ui/components/ReloadButton.svelte';
  import SettingsPanel from './ui/components/SettingsPanel.svelte';
  import PermissionNotice from './ui/components/PermissionNotice.svelte';
  import MapStylePicker from './ui/components/MapStylePicker.svelte';
  import PausedBadge from './ui/components/PausedBadge.svelte';
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
  let permissionOpen = $state(false);
  let approxOpen = $state(false);
  let retryToken = $state(0);

  $effect(() => {
    document.documentElement.dataset.theme = settings.theme;
  });

  $effect(() => {
    if (recorder.status === 'denied') permissionOpen = true;
  });

  async function startRecording() {
    await recorder.start({ wakeLock: await getSetting(db, 'wakeLockDefault') });
  }

  function onRecord() {
    if (recorder.state === 'recording') {
      setPaused(true);
      void recorder.stop();
    } else {
      setPaused(false);
      void startRecording();
    }
  }

  // L'enregistrement démarre tout seul : à la fin de la page d'accueil, ou à l'ouverture si la
  // localisation est déjà autorisée (sans déclencher de demande d'autorisation au chargement).
  const cameFromLanding = !profile.pseudo;
  let autoStarted = false;
  $effect(() => {
    if (!profile.pseudo || autoStarted) return;
    autoStarted = true;
    if (recordingPref.paused) return;
    void (async () => {
      const state = cameFromLanding
        ? 'prompt'
        : await navigator.permissions
            ?.query({ name: 'geolocation' })
            .then((s) => s.state)
            .catch(() => 'prompt');
      if (state === 'granted' || cameFromLanding) await startRecording();
    })();
  });

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
  <ReloadButton />
  <MapStylePicker />
  <PausedBadge paused={recordingPref.paused && recorder.state !== 'recording'} />
  <BottomBar
    recording={recorder.state === 'recording'}
    paused={recordingPref.paused}
    {onRecord}
    onImport={() => (importOpen = true)}
    onStats={() => (statsOpen = true)}
    onMenu={() => (menuOpen = true)}
  />
  <StatsPanel client={statsClient} open={statsOpen} onClose={() => (statsOpen = false)} />
  <ImportPanel session={importSession} open={importOpen} onClose={() => (importOpen = false)} />
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
