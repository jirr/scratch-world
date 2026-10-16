import { cellArea } from 'h3-js';
import { emitDataEvent } from '../app/data-events';
import { decodePos, groupByChunk, mergeSortedUnique } from '../domain/cells';
import type { ChunkRow, ScratchDb } from './db';

/**
 * Ajoute des cellules de résolution 10 (idempotent). La fusion lecture-écriture se fait dans une
 * transaction `rw` : IndexedDB sérialise les écritures concurrentes (thread principal et workers).
 * L'événement est émis après le commit, et seulement si des cellules ont réellement été ajoutées.
 */
export async function addCells(
  db: ScratchDb,
  cells: Iterable<string>,
): Promise<{ added: number; chunks: string[] }> {
  const groups = groupByChunk(cells);
  if (groups.size === 0) return { added: 0, chunks: [] };

  let added = 0;
  const changed: string[] = [];
  await db.transaction('rw', db.chunks, async () => {
    const existing = await db.chunks.bulkGet([...groups.keys()]);
    const rows: ChunkRow[] = [];
    let index = 0;
    for (const [key, incoming] of groups) {
      const previous = existing[index++];
      const { merged, added: fresh } = mergeSortedUnique(
        previous?.pos ?? new Uint16Array(0),
        incoming,
      );
      if (fresh.length === 0) continue;
      let area = 0;
      for (const pos of fresh) area += cellArea(decodePos(key, pos), 'km2');
      rows.push({
        key,
        pos: merged,
        areaKm2: (previous?.areaKm2 ?? 0) + area,
        updatedAt: Date.now(),
      });
      added += fresh.length;
      changed.push(key);
    }
    await db.chunks.bulkPut(rows);
  });

  if (added > 0) emitDataEvent({ type: 'cells-changed', chunks: changed });
  return { added, chunks: changed };
}

export async function loadAllChunks(db: ScratchDb): Promise<Map<string, Uint16Array>> {
  const result = new Map<string, Uint16Array>();
  await db.chunks.each((row) => result.set(row.key, row.pos));
  return result;
}

export async function loadChunks(db: ScratchDb, keys: string[]): Promise<Map<string, Uint16Array>> {
  const rows = await db.chunks.bulkGet(keys);
  const result = new Map<string, Uint16Array>();
  for (const row of rows) if (row) result.set(row.key, row.pos);
  return result;
}

/** Vide toutes les données de jeu (cellules, imports, traces, caches, méta) ; garde les réglages. */
export async function clearAll(db: ScratchDb): Promise<void> {
  const tables = db.tables.filter((table) => table.name !== 'settings');
  await db.transaction('rw', tables, async () => {
    await Promise.all(tables.map((table) => table.clear()));
  });
  emitDataEvent({ type: 'cells-reset' });
}
