import type { MoveMode } from './speed-mode';

/** Rayon (m) de la zone dévoilée, identique pour tous les modes de déplacement. */
export const DISCOVERY_RADIUS_BY_MODE: Record<MoveMode, number> = {
  idle: 500,
  walk: 500,
  scooter: 500,
  vehicle: 500,
};

export function discoveryRadiusM(mode: MoveMode): number {
  return DISCOVERY_RADIUS_BY_MODE[mode];
}

/** Imprécision maximale tolérée : deux fois le rayon (au moins 150 m, au plus 1 km). */
export function maxAccuracyForRadius(radiusM: number): number {
  return Math.min(1000, Math.max(150, 2 * radiusM));
}

/** Une nouvelle zone est dévoilée quand on s'éloigne d'au moins un tiers de rayon (mini 30 m). */
export function refreshDistanceM(radiusM: number): number {
  return Math.max(30, radiusM / 3);
}
