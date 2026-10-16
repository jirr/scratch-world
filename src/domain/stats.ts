import { cellToParent } from 'h3-js';
import { decodePos } from './cells';

/** Version du jeu de données de pays : un changement invalide le cache de rattachement. */
export const REGION_DATASET_VERSION = 'ne50m-5.1.2-v1';
/** Résolution de rattachement cellule → pays (arête ≈ 1,4 km, cohérente avec le 1:50m). */
export const REGION_RES = 7;

export interface CountryInfo {
  code: string;
  name: string;
  areaKm2: number;
}

export interface CountryStats {
  code: string;
  name: string;
  /** Surface dévoilée dans ce pays. */
  areaKm2: number;
  /** Part de la surface du pays. */
  pct: number;
  cellCount: number;
}

export interface Stats {
  cellCount: number;
  areaKm2: number;
  /** Surface dévoilée rattachée à un pays (hors mer). */
  landAreaKm2: number;
  /** Part de la surface terrestre émergée (somme des pays). */
  worldPct: number;
  countries: CountryStats[];
  computedAt: number;
  datasetVersion: string;
}

export interface ChunkArea {
  pos: Uint16Array;
  areaKm2: number;
}

/**
 * Statistiques à partir des chunks. L'aire d'une cellule vaut `areaKm2 / pos.length` de son chunk
 * (la variation sur ~250 km² est négligeable).
 */
export function computeStats(
  chunks: Map<string, ChunkArea>,
  countryOf: (cell7: string) => string,
  countries: CountryInfo[],
  now = Date.now(),
): Stats {
  const info = new Map(countries.map((c) => [c.code, c]));
  const perCountry = new Map<string, { areaKm2: number; cellCount: number }>();
  const memo = new Map<string, string>();
  let cellCount = 0;
  let areaKm2 = 0;
  let landAreaKm2 = 0;

  for (const [key, { pos, areaKm2: chunkArea }] of chunks) {
    const cellArea = pos.length > 0 ? chunkArea / pos.length : 0;
    cellCount += pos.length;
    areaKm2 += chunkArea;
    for (const p of pos) {
      const cell7 = cellToParent(decodePos(key, p), REGION_RES);
      let code = memo.get(cell7);
      if (code === undefined) {
        code = countryOf(cell7);
        memo.set(cell7, code);
      }
      if (!info.has(code)) continue;
      landAreaKm2 += cellArea;
      const entry = perCountry.get(code);
      if (entry) {
        entry.areaKm2 += cellArea;
        entry.cellCount++;
      } else {
        perCountry.set(code, { areaKm2: cellArea, cellCount: 1 });
      }
    }
  }

  const totalLand = countries.reduce((sum, c) => sum + c.areaKm2, 0);
  return {
    cellCount,
    areaKm2,
    landAreaKm2,
    worldPct: totalLand > 0 ? (landAreaKm2 / totalLand) * 100 : 0,
    countries: [...perCountry]
      .map(([code, v]) => {
        const c = info.get(code) as CountryInfo;
        return {
          code,
          name: c.name,
          areaKm2: v.areaKm2,
          pct: c.areaKm2 > 0 ? (v.areaKm2 / c.areaKm2) * 100 : 0,
          cellCount: v.cellCount,
        };
      })
      .sort((a, b) => b.areaKm2 - a.areaKm2),
    computedAt: now,
    datasetVersion: REGION_DATASET_VERSION,
  };
}
