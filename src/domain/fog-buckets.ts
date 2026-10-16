import { cellToBoundary, cellToLatLng, cellToParent, getHexagonEdgeLengthAvg } from 'h3-js';
import {
  CHUNK_RES,
  EARTH_CIRCUMFERENCE_M,
  KERNEL_RADIUS_FACTOR,
  STORAGE_RES,
  TILE_SIZE_PX,
} from './config';
import { decodePos } from './cells';

/** [ouest, sud, est, nord] en degrés ; l'ouest et l'est peuvent dépasser ±180. */
export type BBox = [number, number, number, number];

export const WORLD_BUCKET = 'world';
const MAX_MERCATOR_LAT = 85.0511;

export function mercator(lat: number, lng: number): [number, number] {
  const clamped = Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat));
  const sin = Math.sin((clamped * Math.PI) / 180);
  return [(lng + 180) / 360, 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)];
}

export function bucketKey(res: number, bucketCell: string): string {
  return `${res}:${bucketCell}`;
}

/** Bucket d'un chunk : un seul bucket mondial jusqu'à la résolution du chunk, un parent au-delà. */
export function bucketCellOf(res: number, chunkKey: string): string {
  return res <= CHUNK_RES ? WORLD_BUCKET : cellToParent(chunkKey, res - CHUNK_RES);
}

const bboxCache = new Map<string, BBox>();

/** Boîte englobante d'une cellule ; conservatrice (lng ±180) si elle chevauche l'antiméridien. */
export function bucketBBox(cell: string): BBox {
  const cached = bboxCache.get(cell);
  if (cached) return cached;
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const [lat, lng] of cellToBoundary(cell)) {
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  // Un pôle ou l'antiméridien dans la cellule : la plage de longitudes ne veut plus rien dire.
  const box: BBox =
    east - west > 180
      ? [-180, Math.abs(south) > 60 ? -90 : south, 180, Math.abs(north) > 60 ? 90 : north]
      : [west, south, east, north];
  bboxCache.set(cell, box);
  return box;
}

/** Le bucket intersecte-t-il la vue, aux décalages de monde -360/0/+360 près ? */
export function bboxVisible(bucket: BBox, view: BBox): boolean {
  if (bucket[3] < view[1] || bucket[1] > view[3]) return false;
  for (const shift of [-360, 0, 360]) {
    if (bucket[0] + shift <= view[2] && bucket[2] + shift >= view[0]) return true;
  }
  return false;
}

/** Vue (centre en degrés, taille en px CSS) élargie de `margin` de chaque côté. */
export function expandedViewBBox(
  lng: number,
  lat: number,
  zoom: number,
  width: number,
  height: number,
  margin = 0.5,
): BBox {
  const worldPx = TILE_SIZE_PX * 2 ** zoom;
  const halfLng = (width / 2 / worldPx) * 360 * (1 + 2 * margin);
  const [, cy] = mercator(lat, lng);
  const halfY = (height / 2 / worldPx) * (1 + 2 * margin);
  const toLat = (y: number) => (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
  return [
    lng - halfLng,
    Math.max(-90, toLat(Math.min(1, cy + halfY))),
    lng + halfLng,
    Math.min(90, toLat(Math.max(0, cy - halfY))),
  ];
}

export interface BuiltBucket {
  origin: [number, number];
  /** [dx, dy, r] × n, en unités Mercator relatives à `origin`. */
  instances: Float32Array;
}

/** Instances d'un bucket : une entrée par cellule de résolution `res` couverte par ses chunks. */
export function buildBucket(
  res: number,
  bucketCell: string,
  chunks: Iterable<[string, Uint16Array]>,
): BuiltBucket {
  const cells = new Set<string>();
  for (const [key, positions] of chunks) {
    for (const pos of positions) {
      const cell = decodePos(key, pos);
      cells.add(res === STORAGE_RES ? cell : cellToParent(cell, res));
    }
  }
  let origin: [number, number] = [0, 0];
  if (bucketCell !== WORLD_BUCKET) {
    const [lat, lng] = cellToLatLng(bucketCell);
    origin = mercator(lat, lng);
  }
  const edgeM = getHexagonEdgeLengthAvg(res, 'm');
  const instances = new Float32Array(cells.size * 3);
  let i = 0;
  for (const cell of cells) {
    const [lat, lng] = cellToLatLng(cell);
    const [x, y] = mercator(lat, lng);
    instances[i++] = x - origin[0];
    instances[i++] = y - origin[1];
    instances[i++] =
      (KERNEL_RADIUS_FACTOR * edgeM) / (EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180));
  }
  return { origin, instances };
}
