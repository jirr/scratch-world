/** Résolution H3 des cellules stockées (arête moyenne ~75,9 m). Changer impose une migration Dexie. */
export const STORAGE_RES = 10;
/** Résolution du parent qui regroupe les cellules (7^5 = 16 807 enfants : la position tient en Uint16). */
export const CHUNK_RES = 5;

/** Interpolation d'une trace entre deux points consécutifs. */
export const MAX_GAP_M = 5000;
export const MAX_GAP_S = 600;
/** Sans horodatage, on n'interpole que sur de courtes distances. */
export const MAX_GAP_NO_TIME_M = 1000;
/** Pas d'échantillonnage du repli linéaire (si `gridPathCells` échoue près d'un pentagone). */
export const FALLBACK_SAMPLE_M = 30;

/** Taille minimale (px) de l'arête d'une cellule affichée ; fixe la résolution d'affichage. */
export const MIN_CELL_PX = 2.5;
export const TILE_SIZE_PX = 512;
export const EARTH_CIRCUMFERENCE_M = 40_075_016.686;

/** Rayon du noyau radial du brouillard, en arêtes de cellule (la zone dévoilée ≈ 0,87 arête). */
export const KERNEL_RADIUS_FACTOR = 2.6;
/** Échelle du masque hors-écran par rapport au drawing buffer. */
export const MASK_SCALE = 0.5;
/** Plafond de mémoire des instances conservées côté GPU/CPU, en octets. */
export const GPU_CACHE_MAX_BYTES = 32 * 1024 * 1024;

/** Filtrage des points : au-delà de cette vitesse (360 km/h) le point est jugé aberrant. */
export const MAX_SPEED_MPS = 100;
/** En dessous de cette distance au dernier point accepté, le point est un doublon. */
export const MIN_DISTANCE_M = 5;
/** Le test de vitesse ne s'applique que si les deux points sont proches dans le temps (reprise après un vol). */
export const SPEED_WINDOW_S = 600;
/** Intervalle d'écriture des cellules du direct. */
export const LIVE_FLUSH_MS = 2000;

/** Imprécision maximale des positions du direct : la zone de découverte (~1 km) absorbe l'erreur. */
export const LIVE_MAX_ACCURACY_M = 1000;
/** Imprécision maximale pour que « Me localiser » gratte la zone de départ. */
export const LOCATE_MAX_ACCURACY_M = 300;

/** « Me localiser » s'arrête dès qu'une position est au moins aussi précise... */
export const GOOD_ACCURACY_M = 100;
/** ...ou après ce délai (ms), avec la meilleure position reçue. */
export const BEST_FIX_TIMEOUT_MS = 12_000;
