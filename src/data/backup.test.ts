import { latLngToCell } from 'h3-js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addCells, loadAllChunks } from './cell-store';
import { BACKUP_FORMAT, BackupError, backupFileName, createBackup, restoreBackup } from './backup';
import { ScratchDb } from './db';

let source: ScratchDb;
let target: ScratchDb;

beforeEach(() => {
  source = new ScratchDb(`bk-src-${Math.random()}`);
  target = new ScratchDb(`bk-dst-${Math.random()}`);
});

afterEach(async () => {
  for (const db of [source, target]) {
    db.close();
    await db.delete();
  }
});

const walk = (lat: number, n: number) =>
  Array.from({ length: n }, (_, i) => latLngToCell(lat, 2.35 + i * 0.0006, 10));

const asJsonFile = (data: unknown) => new File([JSON.stringify(data)], 'b.json');

async function fill() {
  await addCells(source, [...walk(48.85, 80), ...walk(35.68, 40)]);
  await source.imports.put({
    fingerprint: 'f1',
    fileName: 'a.gpx',
    format: 'gpx',
    size: 10,
    importedAt: 5,
    pointsRead: 3,
    pointsAccepted: 3,
    cellsAdded: 2,
  });
  await source.tracks.add({ sourceId: 'live:1', seq: 0, points: Float64Array.of(1, 2, 3, NaN) });
}

describe('sauvegarde / restauration', () => {
  it('fait l’aller-retour : mêmes cellules, mêmes aires, mêmes imports', async () => {
    await fill();
    const blob = await createBackup(source, { includeTracks: false, app: '0.1.0+test' });
    await restoreBackup(target, blob);

    const a = await loadAllChunks(source);
    const b = await loadAllChunks(target);
    expect([...b.keys()].sort()).toEqual([...a.keys()].sort());
    for (const [key, pos] of a) expect(b.get(key)).toEqual(pos);
    const area = async (db: ScratchDb) =>
      (await db.chunks.toArray()).reduce((sum, row) => sum + row.areaKm2, 0);
    expect(await area(target)).toBeCloseTo(await area(source), 9);
    expect(await target.imports.toArray()).toEqual(await source.imports.toArray());
  });

  it('produit un gzip valide au format attendu', async () => {
    await fill();
    const blob = await createBackup(source, { includeTracks: false, app: 'x' });
    const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
    expect([...head]).toEqual([0x1f, 0x8b]);
    const text = await new Response(
      blob.stream().pipeThrough(new DecompressionStream('gzip')),
    ).text();
    const parsed = JSON.parse(text) as {
      format: string;
      version: number;
      storageRes: number;
      chunkRes: number;
    };
    expect(parsed).toMatchObject({
      format: BACKUP_FORMAT,
      version: 1,
      storageRes: 10,
      chunkRes: 5,
    });
  });

  it('n’inclut les traces brutes que sur demande, et les restaure sans doublon', async () => {
    await fill();
    const without = await restoreBackup(
      target,
      await createBackup(source, { includeTracks: false, app: 'x' }),
    );
    expect(without.tracksAdded).toBe(0);

    const withTracks = await createBackup(source, { includeTracks: true, app: 'x' });
    expect((await restoreBackup(target, withTracks)).tracksAdded).toBe(1);
    expect((await restoreBackup(target, withTracks)).tracksAdded).toBe(0);
    const [track] = await target.tracks.toArray();
    expect(track?.points[0]).toBe(1);
    expect(Number.isNaN(track?.points[3])).toBe(true);
  });

  it('fusionne avec une base non vide sans rien perdre', async () => {
    await fill();
    await addCells(target, walk(40.0, 30));
    const before = await loadAllChunks(target);
    const result = await restoreBackup(
      target,
      await createBackup(source, { includeTracks: false, app: 'x' }),
    );
    expect(result.cellsAdded).toBeGreaterThan(0);

    const after = await loadAllChunks(target);
    for (const [key, pos] of before) {
      const merged = new Set(after.get(key));
      expect([...pos].every((p) => merged.has(p))).toBe(true);
    }
    // Rejouer la même restauration n'ajoute rien.
    const again = await restoreBackup(
      target,
      await createBackup(source, { includeTracks: false, app: 'x' }),
    );
    expect(again).toMatchObject({ cellsAdded: 0, importsAdded: 0 });
  });

  it('accepte aussi un JSON non compressé', async () => {
    await fill();
    const gz = await createBackup(source, { includeTracks: false, app: 'x' });
    const text = await new Response(
      gz.stream().pipeThrough(new DecompressionStream('gzip')),
    ).text();
    const result = await restoreBackup(target, new File([text], 'plain.json'));
    expect(result.cellsAdded).toBeGreaterThan(0);
  });

  const base = {
    format: BACKUP_FORMAT,
    version: 1,
    storageRes: 10,
    chunkRes: 5,
    chunks: [],
    imports: [],
    tracks: [],
  };

  it.each([
    ['une version plus récente', { ...base, version: 2 }, /plus récente/],
    [
      'une résolution de stockage différente',
      { ...base, storageRes: 11 },
      /Résolution incompatible/,
    ],
    ['une résolution de chunk différente', { ...base, chunkRes: 4 }, /Résolution incompatible/],
    ['un autre format', { ...base, format: 'autre' }, /pas une sauvegarde/],
    [
      'une sauvegarde sans tableaux',
      { format: BACKUP_FORMAT, version: 1, storageRes: 10, chunkRes: 5 },
      /incomplète/,
    ],
    [
      'des positions corrompues',
      { ...base, chunks: [{ key: '85283473fffffff', pos: 'AAAA', areaKm2: 1 }] },
      /corrompue/,
    ],
    [
      'une position hors chunk',
      { ...base, chunks: [{ key: '85283473fffffff', pos: '//8=', areaKm2: 1 }] },
      /hors chunk/,
    ],
  ])('refuse %s', async (_name, data, message) => {
    await expect(restoreBackup(target, asJsonFile(data))).rejects.toThrow(message);
    expect(await target.chunks.count()).toBe(0);
  });

  it('refuse un fichier qui n’est pas du JSON', async () => {
    await expect(restoreBackup(target, new File(['pas du json'], 'x.json'))).rejects.toBeInstanceOf(
      BackupError,
    );
  });

  it('nomme le fichier avec la date du jour', () => {
    expect(backupFileName(new Date('2026-10-16T12:00:00Z'))).toBe(
      'scratch-world-2026-10-16.json.gz',
    );
  });
});
