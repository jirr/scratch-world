import type { Messages } from './fr';

/** Noms des territoires sans code ISO 3166-1 du jeu de données (codes ADM0_A3 de Natural Earth). */
const NON_ISO_COUNTRIES: Record<string, string> = {
  SOL: 'Somaliland',
  CYN: 'Northern Cyprus',
  KAS: 'Siachen Glacier',
  IOA: 'Australian Indian Ocean Territories',
  ATC: 'Ashmore and Cartier Islands',
};

const regionNames = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' });

export const en: Messages = {
  appName: 'Scratch World',
  tagline: 'Scratch off the world map wherever you’ve been. Your data stays on your device.',
  updateAvailable: 'New version available',
  updateAction: 'Update',
  updateDismiss: 'Later',
  updateCheck: 'Check for updates',
  updateChecking: 'Checking…',
  updateResults: {
    found: 'Update found',
    'up-to-date': 'You have the latest version',
    unavailable: 'Can’t check right now',
  },
  menuTitle: 'Settings',
  settingsRecording: 'Recording',
  settingsAccuracy: (m: number) => `Maximum accepted accuracy (imports): ${m} m`,
  settingsAccuracyHint:
    'Imports skip less accurate points. Live, the discovery zone (100 m) tolerates up to 200 m of inaccuracy.',
  settingsKeepTracks: 'Keep raw tracks (uses storage)',
  settingsWakeLock: 'Keep the screen on by default while recording',
  settingsAppearance: 'Appearance',
  settingsTheme: 'Theme',
  themes: { system: 'Automatic', light: 'Light', dark: 'Dark' },
  settingsLanguage: 'Language',
  languages: { system: 'System language', fr: 'Français', en: 'English' },
  mapStyleOpen: 'Map style',
  mapStyleTitle: 'Map style',
  mapStylePreviewHint: 'The fog is hidden so you can see the result.',
  mapStyles: {
    auto: 'Automatic',
    liberty: 'Liberty',
    bright: 'Bright',
    positron: 'Positron',
    dark: 'Dark',
    fiord: 'Fiord',
    custom: 'Custom (URL)',
  },
  settingsCustomStyle: 'Style URL (https)',
  settingsCustomStyleInvalid: 'Invalid URL: the automatic style is used.',
  settingsData: 'Data',
  backupExport: 'Back up',
  backupIncludeTracks: 'Include raw tracks',
  backupRestore: 'Restore a backup',
  backupRestoreHint: 'Restoring merges: nothing is deleted.',
  backupStatus(message) {
    if (message.kind === 'exported') return 'Backup downloaded';
    if (message.kind === 'export-failed') return 'Backup failed';
    if (message.kind === 'restored') {
      const n = message.cellsAdded;
      return `Restore complete: ${n} ${n === 1 ? 'cell added' : 'cells added'}`;
    }
    const failure = message.failure;
    switch (failure?.reason) {
      case undefined:
        return 'Restore failed';
      case 'invalid-json':
        return 'This file is not a valid Scratch World backup';
      case 'not-backup':
        return 'This file is not a Scratch World backup';
      case 'newer-version':
        return `Backup from a newer version (${failure.version}): update the app`;
      case 'resolution':
        return `Incompatible resolution (storage ${failure.found.storageRes}, chunk ${failure.found.chunkRes}): this app uses ${failure.expected.storageRes} and ${failure.expected.chunkRes}`;
      case 'incomplete':
        return 'Incomplete backup';
      case 'corrupt':
        return `Corrupted backup (${
          {
            positions: 'invalid positions',
            tracks: 'invalid tracks',
            'out-of-chunk': 'position outside chunk',
          }[failure.part]
        })`;
    }
  },
  clearAll: 'Erase everything',
  clearTitle: 'Erase everything?',
  clearBody:
    'Cells, imports and raw tracks will be deleted from this device. This cannot be undone: back up first. Settings are kept.',
  clearConfirm: 'Erase permanently',
  clearDone: 'Data erased',
  settingsAbout: 'About',
  reload: 'Reload page',
  reloadTitle: 'Reload the page?',
  reloadBody: 'The app restarts; your data stays on the device.',
  reloadConfirm: 'Warning: an import or a restore is in progress, reloading will interrupt it.',
  reloadAction: 'Reload',
  installTitle: 'Install Scratch World',
  installBody: 'Add the app to your home screen: it opens full screen and works offline.',
  installIosBody: 'On iPhone: tap Safari’s Share button, then “Add to Home Screen”.',
  installAction: 'Install',
  installLater: 'Later',
  installMenu: 'Install the app',
  landingTagline: 'The scratch-off world map',
  landingIntro:
    'Fog covers the map. Wherever you go, it clears: scratch off the world step by step.',
  landingPoints: [
    'Record your trips live or import your tracks (GPX, KML, Google Timeline).',
    'Track the area revealed, your share of the world and the countries visited.',
    'Everything stays on your device: no account, no server, works offline.',
  ],
  landingPseudoLabel: 'Your nickname',
  landingPseudoHint: '2 to 24 characters. It stays on this device.',
  landingPseudoInvalid: 'Choose a nickname of 2 to 24 characters.',
  landingStart: 'Start',
  landingInstallTitle: 'Get the app',
  landingInstallAction: 'Install the app',
  landingInstallNone:
    'To install it, open your browser menu and choose “Install app” or “Add to Home Screen”.',
  settingsPseudo: 'Nickname',
  statsTitle: 'Statistics',
  statsArea: 'Area revealed',
  statsCells: 'Cells',
  statsWorldTitle: 'World',
  statsComputing: 'Computing…',
  statsFailed: 'Statistics are unavailable right now.',
  statsEmpty: 'Nothing revealed yet: record or import a track.',
  statsCountries: 'Countries',
  statsRegions: 'Regions',
  statsDepartments: 'Departments',
  statsNoZone: 'No zone revealed yet.',
  statsSea: 'Sea and unassigned areas are excluded from the percentage.',
  statsDataset: 'Borders: Natural Earth 1:50m; regions and departments: france-geojson.',
  countryName: (code: string, datasetName: string) =>
    NON_ISO_COUNTRIES[code] ??
    (/^[A-Z]{2}$/.test(code) ? regionNames.of(code) : undefined) ??
    datasetName,
  lessThan: (value: string) => `< ${value}`,
  percent: (value: string) => `${value}%`,
  importTitle: 'Import tracks',
  importBody:
    'GPX, KML, Google Timeline (Android or iPhone) and Records.json. Files are read on your device and never sent anywhere.',
  importChoose: 'Choose files',
  importDrop: 'or drop them here',
  importProgress: 'Importing',
  importCancel: 'Cancel import',
  importPhases: { hashing: 'File fingerprint', parsing: 'Reading', writing: 'Writing' },
  importAgain: 'Import more files',
  importFailed: 'Import failed',
  importStatus: {
    duplicate: 'Already imported',
    unsupported: 'Unrecognized format',
    empty: 'No usable points',
    'too-large': 'XML file too large',
    cancelled: 'Cancelled',
  },
  importError: (detail: string | undefined) => (detail ? `Error: ${detail}` : 'Error'),
  importAdded: (n: number) => `${n} ${n === 1 ? 'cell added' : 'cells added'}`,
  recordPause: 'Pause',
  recordResume: 'Resume',
  recordStartNow: 'Start',
  paused: 'Scratching paused: the map is no longer revealed',
  cancel: 'Cancel',
  navLabel: 'Main navigation',
  navStats: 'Stats',
  navMenu: 'Menu',
  pinLabels: {
    idle: 'Your position (standing still)',
    walk: 'Your position (on foot)',
    scooter: 'Your position (on a scooter)',
    vehicle: 'Your position (in a vehicle)',
  },
  locate: 'Locate me',
  draw: 'Draw',
  locating: 'Locating…',
  locateTooImprecise: (m: number) =>
    `Position too imprecise (±${m} m): area not revealed. Try again outdoors or`,
  locateHowTo: 'see how to enable precise location',
  approxTitle: 'Enable precise location',
  approxBody:
    'Your device only shares an approximate position (area): the map can’t be scratched. Precise location must be allowed. A website can’t ask for this permission again by itself: change the setting below, then try again.',
  approxIos:
    'iPhone: Settings › Privacy & Security › Location Services › Safari (or Safari Websites) › turn on “Precise Location”.',
  approxAndroid:
    'Android (Chrome): lock icon next to the address › Permissions › Location › choose “Precise”. Otherwise: Android Settings › Apps › Chrome › Permissions › Location › “Use precise location”.',
  approxRetry: 'Try again',
  approxReload: 'If nothing changes, reload the page.',
  locateUnavailable: 'Position unavailable right now.',
  close: 'Close',
  storagePersisted: 'Persistent storage: yes',
  storageNotPersisted: 'Persistent storage: no',
  permissionTitle: 'Location denied',
  permissionBody:
    'Scratch World uses your position to reveal the map where you go. It stays on your device and is never sent anywhere. You can still import your tracks (GPX, KML, Google Timeline) without geolocation.',
  permissionHowTo: 'To allow it again:',
  permissionIos: 'iPhone: Settings › Privacy & Security › Location Services › Safari.',
  permissionAndroid: 'Android (Chrome): lock icon next to the address › Permissions › Location.',
  webglTitle: 'WebGL2 required',
  webglBody:
    'This device or browser doesn’t support WebGL2, which is needed to display the map. Try a recent browser (Chrome, Safari, Firefox).',
};
