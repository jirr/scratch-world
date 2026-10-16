import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import Flatbush from 'flatbush';
import { cellToBoundary, cellToLatLng } from 'h3-js';
import type { MultiPolygon, Polygon, Position } from 'geojson';

export interface RegionCountry {
  code: string;
  geometry: Polygon | MultiPolygon;
}

/**
 * Rattache une cellule (résolution 7) à un pays : centre dans un polygone ; sinon, premier des 6
 * sommets qui tombe dans un pays (cellules côtières) ; sinon `''` (mer).
 */
export function createRegionLocator(countries: RegionCountry[]): (cell: string) => string {
  const polygons: { code: string; polygon: Polygon }[] = [];
  for (const country of countries) {
    const rings =
      country.geometry.type === 'Polygon'
        ? [country.geometry.coordinates]
        : country.geometry.coordinates;
    for (const coordinates of rings)
      polygons.push({ code: country.code, polygon: { type: 'Polygon', coordinates } });
  }

  const index = new Flatbush(Math.max(1, polygons.length));
  if (polygons.length === 0) index.add(0, 0, 0, 0);
  for (const { polygon } of polygons) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x, y] of polygon.coordinates[0] as Position[]) {
      minX = Math.min(minX, x as number);
      maxX = Math.max(maxX, x as number);
      minY = Math.min(minY, y as number);
      maxY = Math.max(maxY, y as number);
    }
    index.add(minX, minY, maxX, maxY);
  }
  index.finish();

  const codeAt = (lat: number, lng: number): string | null => {
    for (const id of index.search(lng, lat, lng, lat)) {
      const entry = polygons[id];
      if (entry && booleanPointInPolygon([lng, lat], entry.polygon)) return entry.code;
    }
    return null;
  };

  return (cell) => {
    const [lat, lng] = cellToLatLng(cell);
    const center = codeAt(lat, lng);
    if (center !== null) return center;
    for (const [vLat, vLng] of cellToBoundary(cell)) {
      const code = codeAt(vLat, vLng);
      if (code !== null) return code;
    }
    return '';
  };
}
