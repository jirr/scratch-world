import { CHUNK_RES, STORAGE_RES } from '../domain/config';
import { addChunks } from './cell-store';
import type { ImportRow, ScratchDb } from './db';

export const BACKUP_FORMAT = 'scratch-world-backup';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  app: string;
  createdAt: string;
  storageRes: number;
  chunkRes: number;
  chunks: { key: string; pos: string; areaKm2: number }[];
  imports: ImportRow[];
  tracks: { sourceId: string; seq: number; points: string }[];
}

export interface RestoreResult {
  cellsAdded: number;
  chunks: number;
  importsAdded: number;
  tracksAdded: number;
}

/** Raison du refus d'un fichier de sauvegarde ; le texte affiché est choisi par l'interface. */
export type BackupFailure =
  | { reason: 'invalid-json' }
  | { reason: 'not-backup' }
  | { reason: 'newer-version'; version: string }
  | {
      reason: 'resolution';
      found: { storageRes: string; chunkRes: string };
      expected: { storageRes: number; chunkRes: number };
    }
  | { reason: 'incomplete' }
  | { reason: 'corrupt'; part: 'positions' | 'tracks' | 'out-of-chunk' };

/** Fichier de sauvegarde refusé ; `failure` décrit la raison. */
export class BackupError extends Error {
  constructor(readonly failure: BackupFailure) {
    super(`Backup rejected: ${failure.reason}`);
    this.name = 'BackupError';
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const STEP = 0x8000;
  for (let i = 0; i < bytes.length; i += STEP) {
    binary += String.fromCharCode(...bytes.subarray(i, i + STEP));
  }
  return btoa(binary);
}

function base64ToBytes(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Les tableaux typés sont sérialisés en little-endian (toutes les plateformes ciblées).
const encodeUint16 = (a: Uint16Array) =>
  bytesToBase64(new Uint8Array(a.buffer, a.byteOffset, a.byteLength));
const encodeFloat64 = (a: Float64Array) =>
  bytesToBase64(new Uint8Array(a.buffer, a.byteOffset, a.byteLength));

function decodeUint16(text: string): Uint16Array {
  const bytes = base64ToBytes(text);
  if (bytes.length % 2 !== 0) throw new BackupError({ reason: 'corrupt', part: 'positions' });
  return new Uint16Array(bytes.buffer, 0, bytes.length / 2);
}

function decodeFloat64(text: string): Float64Array {
  const bytes = base64ToBytes(text);
  if (bytes.length % 8 !== 0) throw new BackupError({ reason: 'corrupt', part: 'tracks' });
  return new Float64Array(bytes.buffer, 0, bytes.length / 8);
}

async function gzip(text: string): Promise<Blob> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).blob();
}

async function readText(file: Blob): Promise<string> {
  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  const isGzip = head[0] === 0x1f && head[1] === 0x8b;
  const stream = isGzip
    ? file.stream().pipeThrough(new DecompressionStream('gzip'))
    : file.stream();
  return new Response(stream).text();
}

/** Nom de fichier proposé : scratch-world-AAAA-MM-JJ.json.gz */
export function backupFileName(date = new Date()): string {
  return `scratch-world-${date.toISOString().slice(0, 10)}.json.gz`;
}

export async function createBackup(
  db: ScratchDb,
  options: { includeTracks: boolean; app: string },
): Promise<Blob> {
  const backup: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    app: options.app,
    createdAt: new Date().toISOString(),
    storageRes: STORAGE_RES,
    chunkRes: CHUNK_RES,
    chunks: (await db.chunks.toArray()).map((row) => ({
      key: row.key,
      pos: encodeUint16(row.pos),
      areaKm2: row.areaKm2,
    })),
    imports: await db.imports.toArray(),
    tracks: options.includeTracks
      ? (await db.tracks.toArray()).map((row) => ({
          sourceId: row.sourceId,
          seq: row.seq,
          points: encodeFloat64(row.points),
        }))
      : [],
  };
  return gzip(JSON.stringify(backup));
}

function parseBackup(text: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError({ reason: 'invalid-json' });
  }
  const backup = data as Partial<BackupFile> | null;
  if (!backup || backup.format !== BACKUP_FORMAT) {
    throw new BackupError({ reason: 'not-backup' });
  }
  if (typeof backup.version !== 'number' || backup.version > BACKUP_VERSION) {
    throw new BackupError({ reason: 'newer-version', version: String(backup.version) });
  }
  if (backup.storageRes !== STORAGE_RES || backup.chunkRes !== CHUNK_RES) {
    throw new BackupError({
      reason: 'resolution',
      found: { storageRes: String(backup.storageRes), chunkRes: String(backup.chunkRes) },
      expected: { storageRes: STORAGE_RES, chunkRes: CHUNK_RES },
    });
  }
  if (
    !Array.isArray(backup.chunks) ||
    !Array.isArray(backup.imports) ||
    !Array.isArray(backup.tracks)
  ) {
    throw new BackupError({ reason: 'incomplete' });
  }
  return backup as BackupFile;
}

const CHUNK_CHILDREN = 7 ** (STORAGE_RES - CHUNK_RES);

/** Positions triées et sans doublon ; refuse une position hors du chunk. */
function sortedUnique(pos: Uint16Array): Uint16Array {
  const sorted = Uint16Array.from(pos).sort();
  let n = 0;
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i] as number;
    if (p >= CHUNK_CHILDREN) throw new BackupError({ reason: 'corrupt', part: 'out-of-chunk' });
    if (i === 0 || p !== sorted[i - 1]) sorted[n++] = p;
  }
  return sorted.slice(0, n);
}

/** Restauration par **fusion** : union des cellules, imports ajoutés, traces absentes ajoutées. */
export async function restoreBackup(db: ScratchDb, file: Blob): Promise<RestoreResult> {
  const backup = parseBackup(await readText(file));

  const groups = new Map<string, Uint16Array>();
  for (const chunk of backup.chunks) {
    if (groups.has(chunk.key)) continue;
    groups.set(chunk.key, sortedUnique(decodeUint16(chunk.pos)));
  }
  const { added } = await addChunks(db, groups);

  const knownImports = new Set(await db.imports.toCollection().primaryKeys());
  const newImports = backup.imports.filter((row) => !knownImports.has(row.fingerprint));
  await db.imports.bulkPut(newImports);

  let tracksAdded = 0;
  for (const track of backup.tracks) {
    const exists = await db.tracks
      .where('[sourceId+seq]')
      .equals([track.sourceId, track.seq])
      .count();
    if (exists > 0) continue;
    await db.tracks.add({
      sourceId: track.sourceId,
      seq: track.seq,
      points: decodeFloat64(track.points),
    });
    tracksAdded++;
  }
  return {
    cellsAdded: added,
    chunks: groups.size,
    importsAdded: newImports.length,
    tracksAdded,
  };
}
