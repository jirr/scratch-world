import { getHexagonEdgeLengthAvg } from 'h3-js';
import { EARTH_CIRCUMFERENCE_M, MIN_CELL_PX, STORAGE_RES, TILE_SIZE_PX } from './config';

/** Taille en pixels (carte 512 px) de l'arête moyenne d'une cellule de résolution `res`. */
function edgePx(res: number, zoom: number, lat: number): number {
  const zq = Math.floor(zoom * 4) / 4;
  const cos = Math.max(Math.cos((lat * Math.PI) / 180), 1e-6);
  const metersPerPx = (EARTH_CIRCUMFERENCE_M * cos) / (TILE_SIZE_PX * 2 ** zq);
  return getHexagonEdgeLengthAvg(res, 'm') / metersPerPx;
}

/** Plus fine résolution (≤ 10) dont l'arête reste ≥ `MIN_CELL_PX` ; 0 si aucune. */
export function displayRes(zoom: number, lat: number): number {
  for (let res = STORAGE_RES; res >= 0; res--) {
    if (edgePx(res, zoom, lat) >= MIN_CELL_PX) return res;
  }
  return 0;
}
