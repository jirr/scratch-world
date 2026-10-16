import { latLngToCell } from 'h3-js';
import { describe, expect, it } from 'vitest';
import { groupByChunk } from './cells';
import { REGION_DATASET_VERSION, REGION_RES, computeStats, type CountryInfo } from './stats';
import { cellToParent, cellToLatLng } from 'h3-js';

const CELL_KM2 = 0.01505;
/** Deux « pays » carrés fictifs : A (lng < 0) et B (lng > 0) entre 10° et 20° de latitude ; ailleurs = mer. */
const countries: CountryInfo[] = [
  { code: 'AA', name: 'Aland', areaKm2: 1000 },
  { code: 'BB', name: 'Bland', areaKm2: 3000 },
];
const countryOf = (cell7: string) => {
  const [lat, lng] = cellToLatLng(cell7);
  if (lat < 10 || lat > 20) return '';
  return lng < 0 ? 'AA' : lng > 0 ? 'BB' : '';
};

const strip = (lat: number, lng0: number, n: number) =>
  Array.from({ length: n }, (_, i) => latLngToCell(lat, lng0 + i * 0.0012, 10));

function toChunks(cells: string[]) {
  return new Map(
    [...groupByChunk(cells)].map(([key, pos]) => [key, { pos, areaKm2: pos.length * CELL_KM2 }]),
  );
}

describe('computeStats', () => {
  const a = strip(15, -15, 200);
  const b = strip(15, 15, 100);
  const sea = strip(40, 5, 50);
  const stats = computeStats(toChunks([...a, ...b, ...sea]), countryOf, countries, 123);

  it('compte cellules et aires totales', () => {
    const unique = new Set([...a, ...b, ...sea]).size;
    expect(stats.cellCount).toBe(unique);
    expect(stats.areaKm2).toBeCloseTo(unique * CELL_KM2, 9);
    expect(stats.computedAt).toBe(123);
    expect(stats.datasetVersion).toBe(REGION_DATASET_VERSION);
  });

  it('ventile par pays, trié par surface dévoilée, la mer est exclue', () => {
    const nA = new Set(a).size;
    const nB = new Set(b).size;
    expect(stats.countries.map((c) => c.code)).toEqual(['AA', 'BB']);
    expect(stats.countries[0]).toMatchObject({ name: 'Aland', cellCount: nA });
    expect(stats.countries[0]?.areaKm2).toBeCloseTo(nA * CELL_KM2, 9);
    expect(stats.countries[0]?.pct).toBeCloseTo(((nA * CELL_KM2) / 1000) * 100, 9);
    expect(stats.countries[1]?.pct).toBeCloseTo(((nB * CELL_KM2) / 3000) * 100, 9);
    expect(stats.landAreaKm2).toBeCloseTo((nA + nB) * CELL_KM2, 9);
  });

  it('calcule le pourcentage du monde émergé comme part de la somme des pays', () => {
    expect(stats.worldPct).toBeCloseTo((stats.landAreaKm2 / 4000) * 100, 9);
  });

  it('ne rattache qu’une fois par cellule de résolution 7', () => {
    const calls: string[] = [];
    computeStats(toChunks(a), (c) => (calls.push(c), 'AA'), countries);
    expect(new Set(calls).size).toBe(calls.length);
    expect(calls.every((c) => cellToParent(c, REGION_RES) === c)).toBe(true);
  });

  it('ignore un code pays inconnu et gère l’absence de données', () => {
    const unknown = computeStats(toChunks(a), () => 'ZZ', countries);
    expect(unknown.countries).toEqual([]);
    expect(unknown.worldPct).toBe(0);
    const empty = computeStats(new Map(), countryOf, countries);
    expect(empty).toMatchObject({ cellCount: 0, areaKm2: 0, worldPct: 0, countries: [] });
    expect(computeStats(new Map(), countryOf, []).worldPct).toBe(0);
  });
});
