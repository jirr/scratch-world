import Dexie, { type Table } from 'dexie';
import type { Settings } from './settings-store';

export type ImportFormat =
  'gpx' | 'kml' | 'google-records' | 'google-timeline-android' | 'google-timeline-ios';

export interface ChunkRow {
  /** Cellule H3 de résolution 5. */
  key: string;
  /** Positions des cellules de résolution 10 parmi les enfants du chunk, triées et uniques. */
  pos: Uint16Array;
  areaKm2: number;
  updatedAt: number;
}

export interface ImportRow {
  fingerprint: string;
  fileName: string;
  format: ImportFormat;
  size: number;
  importedAt: number;
  pointsRead: number;
  pointsAccepted: number;
  cellsAdded: number;
}

export interface TrackRow {
  id?: number;
  sourceId: string;
  seq: number;
  /** [lat, lng, t, acc] × n ; NaN si absent. */
  points: Float64Array;
}

export interface SettingRow {
  key: keyof Settings;
  value: unknown;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

export class ScratchDb extends Dexie {
  chunks!: Table<ChunkRow, string>;
  imports!: Table<ImportRow, string>;
  tracks!: Table<TrackRow, number>;
  settings!: Table<SettingRow, string>;
  meta!: Table<MetaRow, string>;

  constructor(name = 'scratch-world') {
    super(name);
    // Chaque version est déclarée une fois et ne doit JAMAIS être modifiée : ajouter une version.
    this.version(1).stores({
      chunks: 'key',
      imports: 'fingerprint, importedAt',
      tracks: '++id, sourceId, [sourceId+seq]',
      settings: 'key',
      meta: 'key',
    });
  }
}

export const db = new ScratchDb();
