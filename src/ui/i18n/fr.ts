import type { BackupMessage } from '../../app/backup-session.svelte';
import type { MoveMode } from '../../domain/speed-mode';

/** Textes français ; la structure fait référence (`Messages`) pour les autres langues. */
export const fr = {
  appName: 'Scratch World',
  tagline: 'Gratte la carte du monde là où tu es allé. Tes données restent sur ton appareil.',
  updateAvailable: 'Nouvelle version disponible',
  updateAction: 'Mettre à jour',
  updateDismiss: 'Plus tard',
  updateCheck: 'Rechercher une mise à jour',
  updateChecking: 'Recherche en cours…',
  updateResults: {
    found: 'Mise à jour trouvée',
    'up-to-date': 'Vous avez la dernière version',
    unavailable: 'Vérification impossible pour le moment',
  },
  menuTitle: 'Réglages',
  settingsRecording: 'Enregistrement',
  settingsAccuracy: (m: number) => `Précision maximale acceptée (imports) : ${m} m`,
  settingsAccuracyHint:
    'Les imports ignorent les points moins précis. En direct, la zone de découverte (~1 km) tolère jusqu’à 1 km d’imprécision.',
  settingsKeepTracks: 'Conserver les traces brutes (consomme de la place)',
  settingsWakeLock: 'Garder l’écran allumé par défaut pendant l’enregistrement',
  settingsAppearance: 'Apparence',
  settingsTheme: 'Thème',
  themes: { system: 'Automatique', light: 'Clair', dark: 'Sombre' },
  settingsLanguage: 'Langue',
  languages: { system: 'Langue du système', fr: 'Français', en: 'English' },
  mapStyleOpen: 'Style de carte',
  mapStyleTitle: 'Style de carte',
  mapStylePreviewHint: 'Le brouillard est masqué pour que tu voies le rendu.',
  mapStyles: {
    auto: 'Automatique',
    liberty: 'Liberty',
    bright: 'Bright',
    positron: 'Positron',
    dark: 'Dark',
    fiord: 'Fiord',
    custom: 'Personnalisé (URL)',
  },
  settingsCustomStyle: 'URL du style (https)',
  settingsCustomStyleInvalid: 'URL invalide : le style automatique est utilisé.',
  settingsData: 'Données',
  backupExport: 'Sauvegarder',
  backupIncludeTracks: 'Inclure les traces brutes',
  backupRestore: 'Restaurer une sauvegarde',
  backupRestoreHint: 'La restauration fusionne : rien n’est supprimé.',
  backupStatus(message: BackupMessage): string {
    if (message.kind === 'exported') return 'Sauvegarde téléchargée';
    if (message.kind === 'export-failed') return 'Sauvegarde impossible';
    if (message.kind === 'restored') {
      const n = message.cellsAdded;
      return `Restauration terminée : ${n} ${n > 1 ? 'cellules ajoutées' : 'cellule ajoutée'}`;
    }
    const failure = message.failure;
    switch (failure?.reason) {
      case undefined:
        return 'Restauration impossible';
      case 'invalid-json':
        return 'Ce fichier n’est pas une sauvegarde Scratch World valide';
      case 'not-backup':
        return 'Ce fichier n’est pas une sauvegarde Scratch World';
      case 'newer-version':
        return `Sauvegarde d’une version plus récente (${failure.version}) : mets l’application à jour`;
      case 'resolution':
        return `Résolution incompatible (stockage ${failure.found.storageRes}, chunk ${failure.found.chunkRes}) : cette application utilise ${failure.expected.storageRes} et ${failure.expected.chunkRes}`;
      case 'incomplete':
        return 'Sauvegarde incomplète';
      case 'corrupt':
        return `Sauvegarde corrompue (${
          {
            positions: 'positions invalides',
            tracks: 'traces invalides',
            'out-of-chunk': 'position hors chunk',
          }[failure.part]
        })`;
    }
  },
  clearAll: 'Tout effacer',
  clearTitle: 'Tout effacer ?',
  clearBody:
    'Cellules, imports et traces brutes seront supprimés de cet appareil. Cette action est définitive : pense à sauvegarder avant. Les réglages sont conservés.',
  clearConfirm: 'Effacer définitivement',
  clearDone: 'Données effacées',
  settingsAbout: 'À propos',
  reload: 'Recharger la page',
  reloadTitle: 'Recharger la page ?',
  reloadBody: 'L’application est relancée ; tes données restent sur l’appareil.',
  reloadConfirm:
    'Attention : un import ou une restauration est en cours, le recharger l’interrompra.',
  reloadAction: 'Recharger',
  installTitle: 'Installer Scratch World',
  installBody:
    'Ajoute l’application à ton écran d’accueil : elle s’ouvre en plein écran et fonctionne hors ligne.',
  installIosBody:
    'Sur iPhone : touche le bouton Partager de Safari, puis « Sur l’écran d’accueil ».',
  installAction: 'Installer',
  installLater: 'Plus tard',
  installMenu: 'Installer l’application',
  landingTagline: 'La carte du monde à gratter',
  landingIntro:
    'Un brouillard recouvre la carte. Là où tu vas, il se dissipe : gratte le monde pas à pas.',
  landingPoints: [
    'Enregistre tes trajets en direct ou importe tes traces (GPX, KML, Google Timeline).',
    'Suis la surface dévoilée, la part du monde et les pays visités.',
    'Tout reste sur ton appareil : aucun compte, aucun serveur, utilisable hors ligne.',
  ],
  landingPseudoLabel: 'Ton pseudo',
  landingPseudoHint: 'Entre 2 et 24 caractères. Il reste sur cet appareil.',
  landingPseudoInvalid: 'Choisis un pseudo de 2 à 24 caractères.',
  landingStart: 'Commencer',
  landingInstallTitle: 'Télécharger l’application',
  landingInstallAction: 'Installer l’application',
  landingInstallNone:
    'Pour l’installer, ouvre le menu de ton navigateur et choisis « Installer l’application » ou « Ajouter à l’écran d’accueil ».',
  settingsPseudo: 'Pseudo',
  statsTitle: 'Statistiques',
  statsArea: 'Surface dévoilée',
  statsCells: 'Cellules',
  statsWorld: 'du monde émergé',
  statsComputing: 'Calcul en cours…',
  statsFailed: 'Calcul impossible pour le moment.',
  statsEmpty: 'Rien de dévoilé pour l’instant : enregistre ou importe une trace.',
  statsCountries: 'Pays',
  statsSea: 'Mer et zones non rattachées exclues du pourcentage.',
  statsDataset: 'Frontières : Natural Earth 1:50m.',
  /** Le jeu de données porte déjà les noms français (Natural Earth `NAME_FR`). */
  countryName: (_code: string, datasetName: string) => datasetName,
  lessThan: (value: string) => `< ${value}`,
  percent: (value: string) => `${value} %`,
  importTitle: 'Importer des traces',
  importBody:
    'GPX, KML, Google Timeline (Android ou iPhone) et Records.json. Les fichiers sont lus sur ton appareil et ne sont jamais envoyés ailleurs.',
  importChoose: 'Choisir des fichiers',
  importDrop: 'ou dépose-les ici',
  importProgress: 'Import en cours',
  importCancel: 'Annuler l’import',
  importPhases: { hashing: 'Empreinte du fichier', parsing: 'Lecture', writing: 'Écriture' },
  importAgain: 'Importer d’autres fichiers',
  importFailed: 'Import impossible',
  importStatus: {
    duplicate: 'Déjà importé',
    unsupported: 'Format non reconnu',
    empty: 'Aucun point exploitable',
    'too-large': 'Fichier XML trop volumineux',
    cancelled: 'Annulé',
  },
  importError: (detail: string | undefined) => (detail ? `Erreur : ${detail}` : 'Erreur'),
  importAdded: (n: number) => `${n} ${n > 1 ? 'cellules ajoutées' : 'cellule ajoutée'}`,
  recordPause: 'Pause',
  recordResume: 'Reprendre',
  recordStartNow: 'Démarrer',
  paused: 'Scratch en pause : la carte ne se dévoile plus',
  cancel: 'Annuler',
  navLabel: 'Navigation principale',
  navStats: 'Stats',
  navImport: 'Importer',
  navMenu: 'Menu',
  pinLabels: {
    idle: 'Ta position (à l’arrêt)',
    walk: 'Ta position (à pied)',
    scooter: 'Ta position (en trottinette)',
    vehicle: 'Ta position (en véhicule)',
  } satisfies Record<MoveMode, string>,
  locate: 'Me localiser',
  locating: 'Localisation en cours…',
  locateTooImprecise: (m: number) =>
    `Position trop imprécise (±${m} m) : zone non dévoilée. Réessaie dehors ou`,
  locateHowTo: 'regarde comment activer la localisation précise',
  approxTitle: 'Activer la localisation précise',
  approxBody:
    'Ton appareil ne partage qu’une position approximative (zone) : impossible de gratter la carte. Il faut autoriser la localisation précise. Un site ne peut pas redemander cette autorisation lui-même : change le réglage ci-dessous, puis réessaie.',
  approxIos:
    'iPhone : Réglages › Confidentialité › Service de localisation › Safari (ou Sites web) › active « Position exacte ».',
  approxAndroid:
    'Android (Chrome) : icône cadenas à côté de l’adresse › Autorisations › Position › choisis « Précise ». Sinon : Réglages Android › Applications › Chrome › Autorisations › Position › « Utiliser la position exacte ».',
  approxRetry: 'Réessayer',
  approxReload: 'Si rien ne change, recharge la page.',
  locateUnavailable: 'Position indisponible pour le moment.',
  close: 'Fermer',
  storagePersisted: 'Stockage persistant : oui',
  storageNotPersisted: 'Stockage persistant : non',
  permissionTitle: 'Position refusée',
  permissionBody:
    'Scratch World utilise ta position pour dévoiler la carte là où tu vas. Elle reste sur ton appareil et n’est jamais envoyée ailleurs. Tu peux quand même importer tes traces (GPX, KML, Google Timeline) sans la géolocalisation.',
  permissionHowTo: 'Pour réautoriser :',
  permissionIos: 'iPhone : Réglages › Confidentialité › Service de localisation › Safari.',
  permissionAndroid:
    'Android (Chrome) : icône cadenas à côté de l’adresse › Autorisations › Position.',
  webglTitle: 'WebGL2 requis',
  webglBody:
    'Cet appareil ou ce navigateur ne propose pas WebGL2, nécessaire pour afficher la carte. Essaie un navigateur récent (Chrome, Safari, Firefox).',
};

export type Messages = typeof fr;
