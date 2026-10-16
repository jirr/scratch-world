import { latLngToCell } from 'h3-js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { onDataEvent, type DataEvent } from '../app/data-events';
import { addCells, clearAll, loadAllChunks, loadChunks } from './cell-store';
import { ScratchDb } from './db';
import { DEFAULT_SETTINGS, getSetting, setSetting } from './settings-store';

let db: ScratchDb;
let events: DataEvent[];
let stop: () => void;

beforeEach(() => {
  db = new ScratchDb(`test-${Math.random()}`);
  events = [];
  stop = onDataEvent((e) => events.push(e));
});

afterEach(async () => {
  stop();
  db.close();
  await db.delete();
});

function walk(n: number): string[] {
  return Array.from({ length: n }, (_, i) => latLngToCell(48.85, 2.35 + i * 0.0006, 10));
}

describe('addCells', () => {
  it('est idempotent : second appel sans ajout ni événement', async () => {
    const cells = walk(50);
    const first = await addCells(db, cells);
    expect(first.added).toBeGreaterThan(0);
    const eventsAfterFirst = events.length;
    expect(eventsAfterFirst).toBe(1);

    const second = await addCells(db, cells);
    expect(second.added).toBe(0);
    expect(events).toHaveLength(eventsAfterFirst);
  });

  it('ajoute seulement les cellules nouvelles et cumule l’aire', async () => {
    const cells = walk(40);
    const a = await addCells(db, cells.slice(0, 30));
    const b = await addCells(db, cells);
    expect(a.added + b.added).toBe(new Set(cells).size);

    const total = (await db.chunks.toArray()).reduce((sum, row) => sum + row.areaKm2, 0);
    expect(total).toBeGreaterThan(a.added * 0.01505 * 0.9);
    expect(total).toBeLessThan(new Set(cells).size * 0.01505 * 1.1);
  });

  it('émet les chunks modifiés après commit', async () => {
    await addCells(db, walk(5));
    expect(events[0]?.type).toBe('cells-changed');
    expect(await db.chunks.count()).toBeGreaterThan(0);
  });

  it('ne fait rien pour une entrée vide', async () => {
    expect(await addCells(db, [])).toEqual({ added: 0, chunks: [] });
    expect(events).toHaveLength(0);
  });
});

describe('chargement et effacement', () => {
  it('relit les chunks écrits', async () => {
    const { chunks } = await addCells(db, walk(20));
    const all = await loadAllChunks(db);
    expect([...all.keys()].sort()).toEqual([...chunks].sort());
    const some = await loadChunks(db, [chunks[0] as string, 'inconnu']);
    expect([...some.keys()]).toEqual([chunks[0]]);
  });

  it('clearAll vide les données, garde les réglages et émet cells-reset', async () => {
    await addCells(db, walk(10));
    await setSetting(db, 'theme', 'dark');
    await db.meta.put({ key: 'stats', value: 1 });
    events.length = 0;

    await clearAll(db);
    expect(await db.chunks.count()).toBe(0);
    expect(await db.meta.count()).toBe(0);
    expect(await getSetting(db, 'theme')).toBe('dark');
    expect(events).toEqual([{ type: 'cells-reset' }]);
  });
});

describe('settings', () => {
  it('renvoie les valeurs par défaut puis la valeur écrite, avec événement', async () => {
    expect(await getSetting(db, 'accuracyThresholdM')).toBe(DEFAULT_SETTINGS.accuracyThresholdM);
    expect(await getSetting(db, 'keepRawTracks')).toBe(false);
    await setSetting(db, 'accuracyThresholdM', 120);
    expect(await getSetting(db, 'accuracyThresholdM')).toBe(120);
    expect(events).toContainEqual({ type: 'settings-changed', key: 'accuracyThresholdM' });
  });
});
