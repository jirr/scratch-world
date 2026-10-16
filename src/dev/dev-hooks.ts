import { cellToLatLng } from 'h3-js';
import { addCells, clearAll } from '../data/cell-store';
import { db } from '../data/db';
import { generateSyntheticCells, SYNTHETIC_CENTERS } from './synthetic-cells';
import type { MapView } from '../map/map-view';

const BATCH = 50_000;

declare global {
  interface Window {
    __scratchDev?: {
      map: MapView['map'];
      fog: MapView['fog'];
      centers: typeof SYNTHETIC_CENTERS;
      seed(count: number): Promise<number>;
      /** [lat, lng] d'une cellule semée (centre d'un pixel garanti dévoilé). */
      seedPoint(): [number, number] | null;
      clear(): Promise<void>;
    };
  }
}

/** Disponible uniquement en mode `bench` (éliminé des builds de production). */
export function installDevHooks(view: MapView): void {
  let firstCell: string | null = null;
  window.__scratchDev = {
    map: view.map,
    fog: view.fog,
    centers: SYNTHETIC_CENTERS,
    async seed(count) {
      const all = [...generateSyntheticCells(count)];
      firstCell = all[0] ?? null;
      let added = 0;
      for (let i = 0; i < all.length; i += BATCH) {
        added += (await addCells(db, all.slice(i, i + BATCH))).added;
      }
      return added;
    },
    seedPoint: () => (firstCell ? cellToLatLng(firstCell) : null),
    clear: () => clearAll(db),
  };
}
