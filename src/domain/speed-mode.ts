import { haversineM } from './geo';

export type MoveMode = 'idle' | 'walk' | 'scooter' | 'vehicle';

const WALK_MPS = 0.4;
const SCOOTER_MPS = 3;
const VEHICLE_MPS = 9;

/** Arrêt < 0,4 m/s, marche < 3 m/s (≈ 11 km/h), trottinette < 9 m/s (≈ 32 km/h), au-delà véhicule. */
export function moveMode(speedMps: number): MoveMode {
  if (speedMps < WALK_MPS) return 'idle';
  if (speedMps < SCOOTER_MPS) return 'walk';
  if (speedMps < VEHICLE_MPS) return 'scooter';
  return 'vehicle';
}

export interface SpeedFix {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
  speed: number | null;
}

/** Vitesse lissée (m/s) : celle du GPS si fournie, sinon déduite du déplacement depuis une position d'ancrage. */
export class SpeedTracker {
  #anchor: SpeedFix | null = null;
  #speed = 0;

  push(fix: SpeedFix): number {
    let instant: number | null = null;
    if (fix.speed !== null && Number.isFinite(fix.speed) && fix.speed >= 0) {
      instant = fix.speed;
      this.#anchor = fix;
    } else if (!this.#anchor) {
      this.#anchor = fix;
    } else {
      const dt = (fix.timestamp - this.#anchor.timestamp) / 1000;
      const d = haversineM(this.#anchor.lat, this.#anchor.lng, fix.lat, fix.lng);
      if (dt > 0 && d > Math.max(fix.accuracy, this.#anchor.accuracy)) {
        // Déplacement supérieur à l'incertitude : c'est du mouvement.
        instant = d / dt;
        this.#anchor = fix;
      } else if (dt > 10) {
        // Immobile depuis un moment : le bruit du GPS n'est pas de la vitesse.
        instant = 0;
        this.#anchor = fix;
      }
    }
    if (instant !== null) this.#speed = this.#speed * 0.6 + instant * 0.4;
    return this.#speed;
  }

  reset(): void {
    this.#anchor = null;
    this.#speed = 0;
  }
}
