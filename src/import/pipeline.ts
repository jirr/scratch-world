import { addCells } from '../data/cell-store';
import type { ImportFormat, ScratchDb } from '../data/db';
import {
  MAX_GAP_M,
  MAX_GAP_NO_TIME_M,
  MAX_GAP_S,
  MAX_SPEED_MPS,
  MIN_DISTANCE_M,
  SPEED_WINDOW_S,
} from '../domain/config';
import { PointFilter } from '../domain/point-filter';
import { TrackCellizer, type TrackPoint } from '../domain/track-cellizer';
import { DETECT_BYTES, detectFormat } from './detect';
import { fingerprintFile } from './fingerprint';
import { parseGoogleRecords } from './parsers/google-records';
import { parseGoogleTimeline } from './parsers/google-timeline';
import { parseGpx, parseKml, XmlTooLargeError } from './parsers/gpx-kml';
import type { Parser } from './types';

export type ImportPhase = 'hashing' | 'parsing' | 'writing';

export type ImportStatus =
  'imported' | 'duplicate' | 'unsupported' | 'empty' | 'too-large' | 'error' | 'cancelled';

export interface ImportResult {
  fileName: string;
  status: ImportStatus;
  pointsRead: number;
  pointsAccepted: number;
  cellsAdded: number;
  durationMs: number;
  /** Détail technique d'une erreur inattendue (`status: 'error'`), non traduit. */
  message?: string;
}

export interface ImportOptions {
  accuracyThresholdM: number;
  keepRawTracks: boolean;
  onProgress: (phase: ImportPhase, ratio: number) => void;
  isCancelled: () => boolean;
}

/** Taille du lot de cellules écrit dans IndexedDB. */
export const CELL_FLUSH_SIZE = 20_000;

const PARSERS: Record<ImportFormat, Parser> = {
  gpx: parseGpx,
  kml: parseKml,
  'google-records': parseGoogleRecords,
  'google-timeline-android': parseGoogleTimeline,
  'google-timeline-ios': parseGoogleTimeline,
};

/** Importe un fichier : empreinte → détection → parseur en flux → filtre → cellules → IndexedDB. */
export async function importFile(
  db: ScratchDb,
  file: File,
  options: ImportOptions,
): Promise<ImportResult> {
  const started = performance.now();
  const result = (status: ImportStatus, extra: Partial<ImportResult> = {}): ImportResult => ({
    fileName: file.name,
    status,
    pointsRead: 0,
    pointsAccepted: 0,
    cellsAdded: 0,
    durationMs: Math.round(performance.now() - started),
    ...extra,
  });

  try {
    options.onProgress('hashing', 0);
    const fingerprint = await fingerprintFile(file);
    if (await db.imports.get(fingerprint)) return result('duplicate');

    const format = detectFormat(await file.slice(0, DETECT_BYTES).text());
    if (format === 'unsupported') return result('unsupported');

    const filter = () =>
      new PointFilter({
        maxAccuracyM: options.accuracyThresholdM,
        maxSpeedMps: MAX_SPEED_MPS,
        minDistanceM: MIN_DISTANCE_M,
        speedWindowS: SPEED_WINDOW_S,
      });
    const cellizer = new TrackCellizer({
      maxGapM: MAX_GAP_M,
      maxGapS: MAX_GAP_S,
      maxGapNoTimeM: MAX_GAP_NO_TIME_M,
    });
    let activeFilter = filter();
    let activeTrack: string | null = null;

    let pointsRead = 0;
    let pointsAccepted = 0;
    let cellsAdded = 0;
    let seq = 0;
    // Ensemble interne au pipeline : dédoublonne avant écriture.
    const pending = new Set<string>();
    let raw: TrackPoint[] = [];

    const flush = async () => {
      if (pending.size > 0) {
        options.onProgress('writing', 1);
        cellsAdded += (await addCells(db, pending)).added;
        pending.clear();
      }
      if (raw.length > 0) {
        const points = new Float64Array(raw.length * 4);
        raw.forEach((p, i) => points.set([p.lat, p.lng, p.t ?? NaN, p.acc ?? NaN], i * 4));
        await db.tracks.add({ sourceId: `import:${fingerprint}`, seq: seq++, points });
        raw = [];
      }
    };

    const parse = PARSERS[format];
    for await (const batch of parse(file, (read) =>
      options.onProgress('parsing', Math.min(1, read / Math.max(1, file.size))),
    )) {
      if (options.isCancelled()) {
        await flush();
        return result('cancelled', { pointsRead, pointsAccepted, cellsAdded });
      }
      if (batch.trackId !== activeTrack) {
        activeTrack = batch.trackId;
        activeFilter = filter();
        cellizer.reset();
      }
      for (const point of batch.points) {
        pointsRead++;
        if (activeFilter.accept(point) !== 'accepted') continue;
        pointsAccepted++;
        for (const cell of cellizer.push(point)) pending.add(cell);
        if (options.keepRawTracks) raw.push(point);
      }
      if (pending.size >= CELL_FLUSH_SIZE) await flush();
    }
    await flush();

    if (pointsAccepted === 0) {
      return result('empty', { pointsRead });
    }
    await db.imports.put({
      fingerprint,
      fileName: file.name,
      format,
      size: file.size,
      importedAt: Date.now(),
      pointsRead,
      pointsAccepted,
      cellsAdded,
    });
    return result('imported', { pointsRead, pointsAccepted, cellsAdded });
  } catch (error) {
    if (error instanceof XmlTooLargeError) return result('too-large');
    return result('error', error instanceof Error ? { message: error.message } : {});
  }
}
