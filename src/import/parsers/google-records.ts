import type { TrackPoint } from '../../domain/track-cellizer';
import { BATCH_POINTS, type Parser } from '../types';
import { streamTopLevelArrayItems } from './json-stream';

const E7 = 1e7;
const UINT32 = 2 ** 32;

/** Records.json stocke parfois des E7 négatifs comme des entiers non signés : on soustrait 2^32. */
function unsignedFix(value: number, limit: number): number {
  return value > limit ? value - UINT32 : value;
}

function toTime(record: Record<string, unknown>): number | undefined {
  const iso = record.timestamp;
  if (typeof iso === 'string') {
    const parsed = Date.parse(iso);
    if (Number.isFinite(parsed)) return parsed;
  }
  const ms = Number(record.timestampMs);
  return Number.isFinite(ms) && record.timestampMs !== undefined ? ms : undefined;
}

export function recordToPoint(record: Record<string, unknown>): TrackPoint | null {
  const latE7 = Number(record.latitudeE7);
  const lngE7 = Number(record.longitudeE7);
  if (!Number.isFinite(latE7) || !Number.isFinite(lngE7)) return null;
  const point: TrackPoint = {
    lat: unsignedFix(latE7, 900_000_000) / E7,
    lng: unsignedFix(lngE7, 1_800_000_000) / E7,
  };
  const t = toTime(record);
  if (t !== undefined) point.t = t;
  const acc = Number(record.accuracy);
  if (record.accuracy !== undefined && Number.isFinite(acc)) point.acc = acc;
  return point;
}

/** `Records.json` : une seule trace continue. */
export const parseGoogleRecords: Parser = async function* (file, onBytes) {
  let points: TrackPoint[] = [];
  for await (const { item } of streamTopLevelArrayItems(file.stream(), onBytes, ['locations'])) {
    if (!item || typeof item !== 'object') continue;
    const point = recordToPoint(item as Record<string, unknown>);
    if (!point) continue;
    points.push(point);
    if (points.length >= BATCH_POINTS) {
      yield { trackId: 'records', points };
      points = [];
    }
  }
  if (points.length > 0) yield { trackId: 'records', points };
};
