import { cellToParent } from 'h3-js';
import { decodePos } from './cells';

/** Version des jeux de données (pays, régions, départements) : un changement invalide le cache de rattachement. */
export const REGION_DATASET_VERSION = 'ne50m-5.1.2+fr-admin-v1';
/** Résolution de rattachement cellule → zone (arête ≈ 1,4 km, cohérente avec le 1:50m). */
export const REGION_RES = 7;

/** Zone administrative du jeu de données (pays, région ou département). */
export interface ZoneInfo {
  code: string;
  name: string;
  areaKm2: number;
}

export interface ZoneStats {
  code: string;
  name: string;
  /** Surface dévoilée dans cette zone. */
  areaKm2: number;
  /** Part de la surface de la zone. */
  pct: number;
  cellCount: number;
}

/** Zones auxquelles une cellule de résolution 7 appartient (`''` quand aucune). */
export interface CellZones {
  country: string;
  region: string;
  department: string;
}

export interface ZoneCatalog {
  countries: ZoneInfo[];
  regions: ZoneInfo[];
  departments: ZoneInfo[];
}

export interface Stats {
  cellCount: number;
  areaKm2: number;
  /** Surface dévoilée rattachée à un pays (hors mer). */
  landAreaKm2: number;
  /** Part de la surface terrestre émergée (somme des pays). */
  worldPct: number;
  countries: ZoneStats[];
  /** Régions de France métropolitaine. */
  regions: ZoneStats[];
  /** Départements de France métropolitaine. */
  departments: ZoneStats[];
  computedAt: number;
  datasetVersion: string;
}

export interface ChunkArea {
  pos: Uint16Array;
  areaKm2: number;
}

type Tally = Map<string, { areaKm2: number; cellCount: number }>;

function tally(totals: Tally, code: string, cellArea: number): void {
  const entry = totals.get(code);
  if (entry) {
    entry.areaKm2 += cellArea;
    entry.cellCount++;
  } else {
    totals.set(code, { areaKm2: cellArea, cellCount: 1 });
  }
}

/** Zones touchées, de la plus avancée (pourcentage) à la moins avancée. */
function summarize(totals: Tally, zones: ZoneInfo[]): ZoneStats[] {
  const info = new Map(zones.map((z) => [z.code, z]));
  return [...totals]
    .flatMap(([code, v]) => {
      const zone = info.get(code);
      if (!zone) return [];
      return {
        code,
        name: zone.name,
        areaKm2: v.areaKm2,
        pct: zone.areaKm2 > 0 ? (v.areaKm2 / zone.areaKm2) * 100 : 0,
        cellCount: v.cellCount,
      };
    })
    .sort((a, b) => b.pct - a.pct || b.areaKm2 - a.areaKm2);
}

/**
 * Statistiques à partir des chunks. L'aire d'une cellule vaut `areaKm2 / pos.length` de son chunk
 * (la variation sur ~250 km² est négligeable). Une zone apparaît dès qu'une cellule dévoilée s'y
 * trouve.
 */
export function computeStats(
  chunks: Map<string, ChunkArea>,
  zonesOf: (cell7: string) => CellZones,
  catalog: ZoneCatalog,
  now = Date.now(),
): Stats {
  const countryCodes = new Set(catalog.countries.map((c) => c.code));
  const perCountry: Tally = new Map();
  const perRegion: Tally = new Map();
  const perDepartment: Tally = new Map();
  const memo = new Map<string, CellZones>();
  let cellCount = 0;
  let areaKm2 = 0;
  let landAreaKm2 = 0;

  for (const [key, { pos, areaKm2: chunkArea }] of chunks) {
    const cellArea = pos.length > 0 ? chunkArea / pos.length : 0;
    cellCount += pos.length;
    areaKm2 += chunkArea;
    for (const p of pos) {
      const cell7 = cellToParent(decodePos(key, p), REGION_RES);
      let zones = memo.get(cell7);
      if (zones === undefined) {
        zones = zonesOf(cell7);
        memo.set(cell7, zones);
      }
      if (zones.region !== '') tally(perRegion, zones.region, cellArea);
      if (zones.department !== '') tally(perDepartment, zones.department, cellArea);
      if (!countryCodes.has(zones.country)) continue;
      landAreaKm2 += cellArea;
      tally(perCountry, zones.country, cellArea);
    }
  }

  const totalLand = catalog.countries.reduce((sum, c) => sum + c.areaKm2, 0);
  return {
    cellCount,
    areaKm2,
    landAreaKm2,
    worldPct: totalLand > 0 ? (landAreaKm2 / totalLand) * 100 : 0,
    countries: summarize(perCountry, catalog.countries),
    regions: summarize(perRegion, catalog.regions),
    departments: summarize(perDepartment, catalog.departments),
    computedAt: now,
    datasetVersion: REGION_DATASET_VERSION,
  };
}
