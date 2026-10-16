import { cellToLatLng, gridDisk, latLngToCell } from 'h3-js';
import { DISCOVERY_RADIUS_M, STORAGE_RES } from './config';
import { haversineM } from './geo';

/** Rayon moyen d'un anneau de cellules (≈ distance entre centres voisins, ~131 m à la résolution 10). */
const RING_STEP_M = 120;

/**
 * Zone de découverte : toutes les cellules dont le centre est à moins de `radiusM` de la position,
 * donc un **disque** (et non un hexagone), dévoilé sans attendre un déplacement.
 */
export function startZoneCells(lat: number, lng: number, radiusM = DISCOVERY_RADIUS_M): string[] {
  const center = latLngToCell(lat, lng, STORAGE_RES);
  const rings = Math.ceil(radiusM / RING_STEP_M) + 1;
  return gridDisk(center, rings).filter((cell) => {
    if (cell === center) return true; // la cellule sous la position est toujours dévoilée
    const [cLat, cLng] = cellToLatLng(cell);
    return haversineM(lat, lng, cLat, cLng) <= radiusM;
  });
}
