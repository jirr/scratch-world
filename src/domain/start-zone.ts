import { gridDisk, latLngToCell } from 'h3-js';
import { START_ZONE_RINGS, STORAGE_RES } from './config';

/** Petite zone (cellule + anneaux voisins) dévoilée à la première position, sans attendre un déplacement. */
export function startZoneCells(lat: number, lng: number, rings = START_ZONE_RINGS): string[] {
  return gridDisk(latLngToCell(lat, lng, STORAGE_RES), rings);
}
