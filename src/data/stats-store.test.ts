import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Stats } from '../domain/stats';
import { ScratchDb } from './db';
import { getCachedStats, saveStats } from './stats-store';

let db: ScratchDb;

beforeEach(() => {
  db = new ScratchDb(`test-${Math.random()}`);
});

afterEach(async () => {
  db.close();
  await db.delete();
});

const stats: Stats = {
  cellCount: 3,
  areaKm2: 0.05,
  landAreaKm2: 0.05,
  worldPct: 0.001,
  countries: [{ code: 'FR', name: 'France', areaKm2: 0.05, pct: 0.001, cellCount: 3 }],
  regions: [{ code: '28', name: 'Normandie', areaKm2: 0.05, pct: 0.002, cellCount: 3 }],
  departments: [{ code: '14', name: 'Calvados', areaKm2: 0.05, pct: 0.004, cellCount: 3 }],
  computedAt: 1,
  datasetVersion: 'v',
};

describe('getCachedStats', () => {
  it('renvoie null sans cache et relit des statistiques enregistrées', async () => {
    expect(await getCachedStats(db)).toBeNull();
    await saveStats(db, stats);
    expect(await getCachedStats(db)).toEqual(stats);
  });

  it('complète à vide les régions et départements absents d’un ancien cache', async () => {
    const { regions, departments, ...legacy } = stats;
    expect(regions.length + departments.length).toBeGreaterThan(0);
    await db.meta.put({ key: 'stats', value: legacy });
    expect(await getCachedStats(db)).toEqual({ ...legacy, regions: [], departments: [] });
  });
});
