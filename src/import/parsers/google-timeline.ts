import type { TrackPoint } from '../../domain/track-cellizer';
import type { Parser, TrackBatch } from '../types';
import { streamTopLevelArrayItems } from './json-stream';
import { parseLatLng } from './lat-lng';

function toPoint(value: unknown, t?: number): TrackPoint | null {
  const position = parseLatLng(value);
  if (!position) return null;
  return t !== undefined && Number.isFinite(t) ? { ...position, t } : position;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : null;

function parseTime(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : undefined;
}

/** Android : `time` ISO ; iOS : `startTime` + `durationMinutesOffsetFromStartTime` (parfois en chaîne). */
function pathPointTime(
  entry: Record<string, unknown>,
  startMs: number | undefined,
): number | undefined {
  const absolute = parseTime(entry.time);
  if (absolute !== undefined) return absolute;
  const offset = Number(entry.durationMinutesOffsetFromStartTime);
  if (
    startMs !== undefined &&
    entry.durationMinutesOffsetFromStartTime !== undefined &&
    Number.isFinite(offset)
  ) {
    return startMs + offset * 60_000;
  }
  return undefined;
}

/** Un segment sémantique → une trace par `timelinePath`, des points isolés pour visites et extrémités d'activité. */
export function segmentToBatches(segment: unknown, index: number): TrackBatch[] {
  const seg = asRecord(segment);
  if (!seg) return [];
  const startMs = parseTime(seg.startTime);
  const endMs = parseTime(seg.endTime);
  const batches: TrackBatch[] = [];

  if (Array.isArray(seg.timelinePath)) {
    const points: TrackPoint[] = [];
    for (const raw of seg.timelinePath) {
      const entry = asRecord(raw);
      const point = entry && toPoint(entry.point, pathPointTime(entry, startMs));
      if (point) points.push(point);
    }
    if (points.length > 0) batches.push({ trackId: `path-${index}`, points });
  }

  const visit = asRecord(seg.visit);
  const visitPoint = toPoint(asRecord(visit?.topCandidate)?.placeLocation, startMs);
  if (visitPoint) batches.push({ trackId: `visit-${index}`, points: [visitPoint] });

  const activity = asRecord(seg.activity);
  const start = toPoint(activity?.start, startMs);
  const end = toPoint(activity?.end, endMs);
  if (start) batches.push({ trackId: `activity-start-${index}`, points: [start] });
  if (end) batches.push({ trackId: `activity-end-${index}`, points: [end] });
  return batches;
}

/** Timeline Android (objet `semanticSegments`) et iOS (tableau en racine). */
export const parseGoogleTimeline: Parser = async function* (file, onBytes) {
  let index = 0;
  for await (const { key, item } of streamTopLevelArrayItems(file.stream(), onBytes, [
    'semanticSegments',
  ])) {
    if (key !== null && key !== 'semanticSegments') continue;
    yield* segmentToBatches(item, index++);
  }
};
