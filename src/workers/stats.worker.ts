import * as Comlink from 'comlink';
import { ScratchDb } from '../data/db';
import { saveStats } from '../data/stats-store';
import { createZoneLocator, type ZoneFeature } from '../domain/region-locator';
import {
  computeStats,
  REGION_DATASET_VERSION,
  type CellZones,
  type ZoneCatalog,
  type ZoneInfo,
} from '../domain/stats';
import type { StatsWorkerApi } from './stats-api';

const db = new ScratchDb();

/** Pays rattachés à un détail administratif (régions et départements), France métropolitaine. */
const DETAIL_COUNTRY = 'FR';

type Zone = ZoneInfo & ZoneFeature;

interface Dataset {
  catalog: ZoneCatalog;
  locateCountry: (cell: string) => string;
  locateRegion: (cell: string) => string;
  locateDepartment: (cell: string) => string;
}

let dataset: Promise<Dataset> | null = null;

async function fetchDataset<T>(file: string): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${file}`);
  if (!response.ok) throw new Error(`Jeu de données ${file} indisponible (${response.status})`);
  return (await response.json()) as T;
}

function loadDataset(): Promise<Dataset> {
  dataset ??= (async () => {
    const [{ countries }, { regions, departments }] = await Promise.all([
      fetchDataset<{ countries: Zone[] }>('countries-50m.v1.json'),
      fetchDataset<{ regions: Zone[]; departments: Zone[] }>('france-admin.v1.json'),
    ]);
    return {
      catalog: { countries, regions, departments },
      locateCountry: createZoneLocator(countries),
      locateRegion: createZoneLocator(regions),
      locateDepartment: createZoneLocator(departments),
    };
  })();
  return dataset;
}

let queue: Promise<unknown> = Promise.resolve();

const api: StatsWorkerApi = {
  compute() {
    const run = queue.then(async () => {
      const { catalog, locateCountry, locateRegion, locateDepartment } = await loadDataset();

      const stored = await db.meta.get('regionDataset');
      if (stored?.value !== REGION_DATASET_VERSION) {
        await db.regionCache.clear();
        await db.meta.put({ key: 'regionDataset', value: REGION_DATASET_VERSION });
      }
      const cache = new Map<string, CellZones>();
      await db.regionCache.each((row) =>
        cache.set(row.cell, {
          country: row.country,
          region: row.region,
          department: row.department,
        }),
      );

      const fresh: (CellZones & { cell: string })[] = [];
      const zonesOf = (cell: string): CellZones => {
        let zones = cache.get(cell);
        if (zones === undefined) {
          const country = locateCountry(cell);
          zones =
            country === DETAIL_COUNTRY
              ? { country, region: locateRegion(cell), department: locateDepartment(cell) }
              : { country, region: '', department: '' };
          cache.set(cell, zones);
          fresh.push({ cell, ...zones });
        }
        return zones;
      };

      const chunks = new Map<string, { pos: Uint16Array; areaKm2: number }>();
      await db.chunks.each((row) => chunks.set(row.key, { pos: row.pos, areaKm2: row.areaKm2 }));

      const stats = computeStats(chunks, zonesOf, catalog);
      if (fresh.length > 0) await db.regionCache.bulkPut(fresh);
      await saveStats(db, stats);
      return stats;
    });
    queue = run.catch(() => undefined);
    return run;
  },
};

Comlink.expose(api);
