import * as Comlink from 'comlink';
import { ScratchDb } from '../data/db';
import { saveStats } from '../data/stats-store';
import { createRegionLocator, type RegionCountry } from '../domain/region-locator';
import { computeStats, REGION_DATASET_VERSION, type CountryInfo } from '../domain/stats';
import type { StatsWorkerApi } from './stats-api';

const db = new ScratchDb();

interface Dataset {
  countries: (CountryInfo & RegionCountry)[];
  locate: (cell: string) => string;
}

let dataset: Promise<Dataset> | null = null;

function loadDataset(): Promise<Dataset> {
  dataset ??= (async () => {
    const response = await fetch(`${import.meta.env.BASE_URL}data/countries-50m.v1.json`);
    if (!response.ok) throw new Error(`Jeu de données pays indisponible (${response.status})`);
    const { countries } = (await response.json()) as { countries: Dataset['countries'] };
    return { countries, locate: createRegionLocator(countries) };
  })();
  return dataset;
}

let queue: Promise<unknown> = Promise.resolve();

const api: StatsWorkerApi = {
  compute() {
    const run = queue.then(async () => {
      const { countries, locate } = await loadDataset();

      const stored = await db.meta.get('regionDataset');
      if (stored?.value !== REGION_DATASET_VERSION) {
        await db.regionCache.clear();
        await db.meta.put({ key: 'regionDataset', value: REGION_DATASET_VERSION });
      }
      const cache = new Map<string, string>();
      await db.regionCache.each((row) => cache.set(row.cell, row.country));

      const fresh: { cell: string; country: string }[] = [];
      const countryOf = (cell: string) => {
        let country = cache.get(cell);
        if (country === undefined) {
          country = locate(cell);
          cache.set(cell, country);
          fresh.push({ cell, country });
        }
        return country;
      };

      const chunks = new Map<string, { pos: Uint16Array; areaKm2: number }>();
      await db.chunks.each((row) => chunks.set(row.key, { pos: row.pos, areaKm2: row.areaKm2 }));

      const stats = computeStats(chunks, countryOf, countries);
      if (fresh.length > 0) await db.regionCache.bulkPut(fresh);
      await saveStats(db, stats);
      return stats;
    });
    queue = run.catch(() => undefined);
    return run;
  },
};

Comlink.expose(api);
