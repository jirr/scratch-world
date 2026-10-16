import { haversineM } from './geo';
import type { TrackPoint } from './track-cellizer';

export type FilterResult = 'accepted' | 'invalid' | 'accuracy' | 'duplicate' | 'speed';

export interface PointFilterConfig {
  maxAccuracyM: number;
  maxSpeedMps: number;
  minDistanceM: number;
  speedWindowS: number;
}

/**
 * Filtre partagé par le direct et les imports. Ordre des règles : invalide, précision, doublon,
 * vitesse. Seuls les points acceptés deviennent « dernier point ».
 */
export class PointFilter {
  #last: TrackPoint | null = null;

  constructor(private readonly cfg: PointFilterConfig) {}

  accept(p: TrackPoint): FilterResult {
    if (
      !Number.isFinite(p.lat) ||
      !Number.isFinite(p.lng) ||
      Math.abs(p.lat) > 90 ||
      Math.abs(p.lng) > 180 ||
      (p.lat === 0 && p.lng === 0)
    ) {
      return 'invalid';
    }
    if (p.acc !== undefined && p.acc > this.cfg.maxAccuracyM) return 'accuracy';

    const last = this.#last;
    if (last) {
      const timed = last.t !== undefined && p.t !== undefined;
      const distanceM = haversineM(last.lat, last.lng, p.lat, p.lng);
      if ((timed && p.t! <= last.t!) || distanceM < this.cfg.minDistanceM) return 'duplicate';
      if (timed) {
        const dtS = (p.t! - last.t!) / 1000;
        if (dtS <= this.cfg.speedWindowS && distanceM / dtS > this.cfg.maxSpeedMps) return 'speed';
      }
    }
    this.#last = p;
    return 'accepted';
  }

  reset(): void {
    this.#last = null;
  }
}
