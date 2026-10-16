import type Dexie from 'dexie';
import { latLngToCell } from 'h3-js';

/** Copie figée de la déclaration `version(1)` de db.ts. */
export const stores = {
  chunks: 'key',
  imports: 'fingerprint, importedAt',
  tracks: '++id, sourceId, [sourceId+seq]',
  settings: 'key',
  meta: 'key',
} as const;

/** Jeu représentatif : 3 chunks (dont un pentagone), 1 import, 2 réglages. */
export async function seed(db: Dexie): Promise<void> {
  const paris = latLngToCell(48.8566, 2.3522, 5);
  const tokyo = latLngToCell(35.6762, 139.6503, 5);
  const pentagon = '85080003fffffff';
  await db.table('chunks').bulkPut([
    { key: paris, pos: Uint16Array.of(0, 7, 8, 300, 16806), areaKm2: 0.0752, updatedAt: 1 },
    { key: tokyo, pos: Uint16Array.of(12, 6386, 5000), areaKm2: 0.0451, updatedAt: 2 },
    { key: pentagon, pos: Uint16Array.of(1, 2, 3), areaKm2: 0.0451, updatedAt: 3 },
  ]);
  await db.table('imports').put({
    fingerprint: 'abc123',
    fileName: 'walk.gpx',
    format: 'gpx',
    size: 1234,
    importedAt: 10,
    pointsRead: 100,
    pointsAccepted: 90,
    cellsAdded: 11,
  });
  await db.table('settings').bulkPut([
    { key: 'accuracyThresholdM', value: 80 },
    { key: 'theme', value: 'dark' },
  ]);
}
