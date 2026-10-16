import { gridPathCells, latLngToCell } from 'h3-js';
import { FALLBACK_SAMPLE_M, STORAGE_RES } from './config';
import { haversineM } from './geo';

export interface TrackPoint {
  lat: number;
  lng: number;
  /** Horodatage en millisecondes. */
  t?: number;
  /** Précision horizontale en mètres. */
  acc?: number;
}

export interface CellizerConfig {
  maxGapM: number;
  maxGapS: number;
  maxGapNoTimeM: number;
}

/** Échantillonnage linéaire lat/lng : repli quand `gridPathCells` échoue (distorsion pentagone). */
function sampledCells(a: TrackPoint, b: TrackPoint, distanceM: number): string[] {
  const steps = Math.max(1, Math.ceil(distanceM / FALLBACK_SAMPLE_M));
  const cells = new Set<string>();
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    cells.add(latLngToCell(a.lat + (b.lat - a.lat) * f, a.lng + (b.lng - a.lng) * f, STORAGE_RES));
  }
  return [...cells];
}

/** Transforme une trace de points (déjà filtrés) en cellules, en comblant les trous raisonnables. */
export class TrackCellizer {
  #prev: TrackPoint | null = null;

  constructor(private readonly cfg: CellizerConfig) {}

  /** Cellules du point et du segment depuis le point précédent. */
  push(point: TrackPoint): string[] {
    const cell = latLngToCell(point.lat, point.lng, STORAGE_RES);
    const prev = this.#prev;
    this.#prev = point;
    if (!prev) return [cell];

    const distanceM = haversineM(prev.lat, prev.lng, point.lat, point.lng);
    const timed = prev.t !== undefined && point.t !== undefined;
    const withinGap = distanceM <= this.cfg.maxGapM;
    const interpolate = timed
      ? withinGap && point.t! - prev.t! <= this.cfg.maxGapS * 1000
      : distanceM <= this.cfg.maxGapNoTimeM;
    if (!interpolate) return [cell];

    const from = latLngToCell(prev.lat, prev.lng, STORAGE_RES);
    try {
      return gridPathCells(from, cell);
    } catch {
      return sampledCells(prev, point, distanceM);
    }
  }

  reset(): void {
    this.#prev = null;
  }
}
