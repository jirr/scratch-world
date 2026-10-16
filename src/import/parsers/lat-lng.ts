/**
 * Coordonnées Google : `"45.46°, 9.19°"`, `"geo:45.46,9.19"` ou `{ latLng: … }`.
 * Retourne `null` si l'une des deux moitiés n'est pas un nombre fini.
 */
export function parseLatLng(value: unknown): { lat: number; lng: number } | null {
  if (value && typeof value === 'object' && 'latLng' in value) {
    return parseLatLng((value as { latLng: unknown }).latLng);
  }
  if (typeof value !== 'string') return null;
  const match =
    /^\s*(?:geo:)?\s*(-?\d+(?:\.\d+)?)\s*°?\s*,\s*(-?\d+(?:\.\d+)?)\s*°?\s*(?:;.*)?$/.exec(value);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}
