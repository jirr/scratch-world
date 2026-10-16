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
