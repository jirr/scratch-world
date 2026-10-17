import { EARTH_CIRCUMFERENCE_M, TILE_SIZE_PX } from './config';
import { haversineM } from './geo';
import { startZoneCells } from './start-zone';

/** Taille du pinceau à l'écran (rayon, en px CSS). */
export const BRUSH_PX = 20;
/** Rayon minimal : une seule cellule (les centres voisins sont à ~131 m à la résolution 10). */
export const MIN_BRUSH_RADIUS_M = 40;
/** Rayon maximal : borne le nombre de cellules par échantillon quand la carte est très dézoomée. */
export const MAX_BRUSH_RADIUS_M = 2000;
/** Plafond d'échantillons par segment : au-delà, ils sont espacés davantage (zoom extrême). */
const MAX_SAMPLES_PER_SEGMENT = 64;
const MAX_LAT = 85;

export interface LngLat {
  lng: number;
  lat: number;
}

/** Rayon du pinceau en mètres au zoom et à la latitude donnés, borné à [MIN, MAX]. */
export function brushRadiusM(zoom: number, lat: number, brushPx = BRUSH_PX): number {
  const cos = Math.cos((Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * Math.PI) / 180);
  const metersPerPx = (EARTH_CIRCUMFERENCE_M * cos) / (TILE_SIZE_PX * 2 ** zoom);
  return Math.max(MIN_BRUSH_RADIUS_M, Math.min(MAX_BRUSH_RADIUS_M, brushPx * metersPerPx));
}

/**
 * Points du segment `from` → `to` (`from` exclu, `to` inclus), espacés d'au plus `stepM` mètres, pour
 * qu'un geste rapide ne laisse aucun trou. Des disques de rayon `r` espacés de `r` se recouvrent.
 */
export function strokePoints(from: LngLat, to: LngLat, stepM: number): LngLat[] {
  const distance = haversineM(from.lat, from.lng, to.lat, to.lng);
  const count = Math.min(MAX_SAMPLES_PER_SEGMENT, Math.max(1, Math.ceil(distance / stepM)));
  const points: LngLat[] = [];
  for (let i = 1; i < count; i++) {
    const t = i / count;
    points.push({
      lng: from.lng + (to.lng - from.lng) * t,
      lat: from.lat + (to.lat - from.lat) * t,
    });
  }
  points.push(to);
  return points;
}

/** Ajoute à `target` les cellules des disques de rayon `radiusM` centrés sur `points`. */
export function addBrushCells(target: Set<string>, points: LngLat[], radiusM: number): void {
  for (const point of points) {
    // La longitude peut sortir de [-180, 180] sur les copies du monde de la carte.
    const lng = ((((point.lng + 180) % 360) + 360) % 360) - 180;
    const lat = Math.max(-MAX_LAT, Math.min(MAX_LAT, point.lat));
    for (const cell of startZoneCells(lat, lng, radiusM)) target.add(cell);
  }
}
