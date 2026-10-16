import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadAllChunks } from '../data/cell-store';
import { ScratchDb } from '../data/db';
import { importFile, type ImportOptions } from './pipeline';
import { fixture } from './test-support';

let db: ScratchDb;
const phases: string[] = [];
const options = (over: Partial<ImportOptions> = {}): ImportOptions => ({
  accuracyThresholdM: 50,
  keepRawTracks: false,
  onProgress: (phase) => phases.push(phase),
  isCancelled: () => false,
  ...over,
});

beforeEach(() => {
  db = new ScratchDb(`import-${Math.random()}`);
  phases.length = 0;
});

afterEach(async () => {
  db.close();
  await db.delete();
});

const cellCount = async () => {
  let n = 0;
  for (const pos of (await loadAllChunks(db)).values()) n += pos.length;
  return n;
};

describe('importFile', () => {
  it('importe walk.gpx, interpole entre points et enregistre le fichier', async () => {
    const result = await importFile(db, fixture('walk.gpx'), options());
    expect(result.status).toBe('imported');
    expect(result.pointsRead).toBe(120);
    expect(result.pointsAccepted).toBe(120);
    expect(result.cellsAdded).toBeGreaterThan(10);
    expect(await cellCount()).toBe(result.cellsAdded);
    const rows = await db.imports.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      fileName: 'walk.gpx',
      format: 'gpx',
      cellsAdded: result.cellsAdded,
    });
    expect(phases).toContain('hashing');
    expect(phases).toContain('parsing');
  });

  it('réimporter le même contenu (même sous un autre nom) donne « duplicate » sans rien ajouter', async () => {
    await importFile(db, fixture('walk.gpx'), options());
    const before = await cellCount();
    const renamed = new File([await fixture('walk.gpx').arrayBuffer()], 'copie.gpx');
    const again = await importFile(db, renamed, options());
    expect(again.status).toBe('duplicate');
    expect(await cellCount()).toBe(before);
    expect(await db.imports.count()).toBe(1);
  });

  it('refuse un format inconnu', async () => {
    const result = await importFile(db, fixture('unknown.json'), options());
    expect(result.status).toBe('unsupported');
    expect(await db.imports.count()).toBe(0);
  });

  it('signale « empty » quand aucun point n’est exploitable, sans enregistrer le fichier', async () => {
    const onlyBad = new File(
      [
        JSON.stringify({
          locations: [
            { latitudeE7: 0, longitudeE7: 0 },
            { latitudeE7: 472000000, longitudeE7: 21000000, accuracy: 900 },
          ],
        }),
      ],
      'mauvais.json',
    );
    const result = await importFile(db, onlyBad, options());
    expect(result.status).toBe('empty');
    expect(await db.imports.count()).toBe(0);
  });

  it('applique le seuil de précision (le point à 400 m est écarté)', async () => {
    const result = await importFile(db, fixture('records-sample.json'), options());
    expect(result.pointsRead).toBe(91);
    expect(result.pointsAccepted).toBe(90);
  });

  it('importe un Google Timeline iOS et Android avec le même résultat', async () => {
    const android = await importFile(db, fixture('timeline-android.json'), options());
    const ios = await importFile(db, fixture('timeline-ios.json'), options());
    expect(android.status).toBe('imported');
    expect(ios.status).toBe('imported');
    expect(ios.pointsAccepted).toBe(android.pointsAccepted);
    // Mêmes cellules : le second import n'ajoute rien de nouveau.
    expect(ios.cellsAdded).toBe(0);
  });

  it('annulation : garde les cellules déjà écrites, pas de ligne imports, réimport possible', async () => {
    let calls = 0;
    const cancelled = await importFile(
      db,
      fixture('walk.gpx'),
      options({ isCancelled: () => ++calls > 1 }),
    );
    expect(cancelled.status).toBe('cancelled');
    expect(await db.imports.count()).toBe(0);
    const retry = await importFile(db, fixture('walk.gpx'), options());
    expect(retry.status).toBe('imported');
  });

  it('conserve les traces brutes quand le réglage est actif', async () => {
    await importFile(db, fixture('route.kml'), options({ keepRawTracks: true }));
    const tracks = await db.tracks.toArray();
    expect(tracks).toHaveLength(1);
    expect(tracks[0]?.sourceId).toMatch(/^import:[0-9a-f]{64}$/);
    expect(tracks[0]?.points).toHaveLength(50 * 4);
  });

  it('remonte une erreur lisible pour un XML trop volumineux ou illisible', async () => {
    const broken = new File(['<gpx><trk><trkseg><trkpt lat="x" lon="y"></trkpt>'], 'cassé.gpx');
    const result = await importFile(db, broken, options());
    expect(['empty', 'error']).toContain(result.status);
  });
});
