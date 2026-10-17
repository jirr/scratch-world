import { latLngToCell } from 'h3-js';
import { describe, expect, it } from 'vitest';
import { groupByChunk } from './cells';
import {
  REGION_DATASET_VERSION,
  REGION_RES,
  computeStats,
  type CellZones,
  type ZoneCatalog,
} from './stats';
import { cellToParent, cellToLatLng } from 'h3-js';

const CELL_KM2 = 0.01505;
/**
 * Deux « pays » carrés fictifs : A (lng < 0) et B (lng > 0) entre 10° et 20° de latitude ; ailleurs
 * = mer. Seul A est découpé en régions (R1 : lat < 15, R2 : lat ≥ 15) et départements
 * (D1 : lng < -10, D2 : lng ≥ -10), comme seule la France l'est dans l'application.
 */
const catalog: ZoneCatalog = {
  countries: [
    { code: 'AA', name: 'Aland', areaKm2: 1000 },
    { code: 'BB', name: 'Bland', areaKm2: 3000 },
  ],
  regions: [
    { code: 'R1', name: 'Région un', areaKm2: 100 },
    { code: 'R2', name: 'Région deux', areaKm2: 200 },
  ],
  departments: [
    { code: 'D1', name: 'Département un', areaKm2: 50 },
    { code: 'D2', name: 'Département deux', areaKm2: 400 },
  ],
};
const none: CellZones = { country: '', region: '', department: '' };
const zonesOf = (cell7: string): CellZones => {
  const [lat, lng] = cellToLatLng(cell7);
  if (lat < 10 || lat > 20 || lng === 0) return none;
  if (lng > 0) return { country: 'BB', region: '', department: '' };
  return {
    country: 'AA',
    region: lat < 15 ? 'R1' : 'R2',
    department: lng < -10 ? 'D1' : 'D2',
  };
};

const strip = (lat: number, lng0: number, n: number) =>
  Array.from({ length: n }, (_, i) => latLngToCell(lat, lng0 + i * 0.0012, 10));

function toChunks(cells: string[]) {
  return new Map(
    [...groupByChunk(cells)].map(([key, pos]) => [key, { pos, areaKm2: pos.length * CELL_KM2 }]),
  );
}

describe('computeStats', () => {
  const a1 = strip(12, -15, 200);
  const a2 = strip(17, -5, 100);
  const b = strip(15, 15, 100);
  const sea = strip(40, 5, 50);
  const stats = computeStats(toChunks([...a1, ...a2, ...b, ...sea]), zonesOf, catalog, 123);
  const n1 = new Set(a1).size;
  const n2 = new Set(a2).size;
  const nB = new Set(b).size;

  it('compte cellules et aires totales', () => {
    const unique = new Set([...a1, ...a2, ...b, ...sea]).size;
    expect(stats.cellCount).toBe(unique);
    expect(stats.areaKm2).toBeCloseTo(unique * CELL_KM2, 9);
    expect(stats.computedAt).toBe(123);
    expect(stats.datasetVersion).toBe(REGION_DATASET_VERSION);
  });

  it('ventile par pays, trié par pourcentage, la mer est exclue', () => {
    const nA = n1 + n2;
    expect(stats.countries.map((c) => c.code)).toEqual(['AA', 'BB']);
    expect(stats.countries[0]).toMatchObject({ name: 'Aland', cellCount: nA });
    expect(stats.countries[0]?.areaKm2).toBeCloseTo(nA * CELL_KM2, 9);
    expect(stats.countries[0]?.pct).toBeCloseTo(((nA * CELL_KM2) / 1000) * 100, 9);
    expect(stats.countries[1]?.pct).toBeCloseTo(((nB * CELL_KM2) / 3000) * 100, 9);
    expect(stats.landAreaKm2).toBeCloseTo((nA + nB) * CELL_KM2, 9);
  });

  it('fait apparaître régions et départements dès qu’une cellule y tombe, triés par pourcentage', () => {
    expect(stats.regions.map((r) => r.code)).toEqual(['R1', 'R2']);
    expect(stats.regions[0]).toMatchObject({ name: 'Région un', cellCount: n1 });
    expect(stats.regions[0]?.pct).toBeCloseTo(((n1 * CELL_KM2) / 100) * 100, 9);
    expect(stats.regions[1]?.pct).toBeCloseTo(((n2 * CELL_KM2) / 200) * 100, 9);
    expect(stats.departments.map((d) => d.code)).toEqual(['D1', 'D2']);
    expect(stats.departments[0]).toMatchObject({ name: 'Département un', cellCount: n1 });
    expect(stats.departments[0]?.pct).toBeCloseTo(((n1 * CELL_KM2) / 50) * 100, 9);
    expect(stats.departments[1]?.areaKm2).toBeCloseTo(n2 * CELL_KM2, 9);
    expect(stats.departments[1]?.pct).toBeCloseTo(((n2 * CELL_KM2) / 400) * 100, 9);
  });

  it('n’ajoute aucune région ni aucun département hors des pays détaillés', () => {
    const only = computeStats(toChunks(b), zonesOf, catalog);
    expect(only.countries.map((c) => c.code)).toEqual(['BB']);
    expect(only.regions).toEqual([]);
    expect(only.departments).toEqual([]);
  });

  it('calcule le pourcentage du monde émergé comme part de la somme des pays', () => {
    expect(stats.worldPct).toBeCloseTo((stats.landAreaKm2 / 4000) * 100, 9);
  });

  it('ne rattache qu’une fois par cellule de résolution 7', () => {
    const calls: string[] = [];
    computeStats(toChunks(a1), (c) => (calls.push(c), { ...none, country: 'AA' }), catalog);
    expect(new Set(calls).size).toBe(calls.length);
    expect(calls.every((c) => cellToParent(c, REGION_RES) === c)).toBe(true);
  });

  it('ignore un code inconnu et gère l’absence de données', () => {
    const unknown = computeStats(
      toChunks(a1),
      () => ({ country: 'ZZ', region: 'ZZ', department: 'ZZ' }),
      catalog,
    );
    expect(unknown.countries).toEqual([]);
    expect(unknown.regions).toEqual([]);
    expect(unknown.departments).toEqual([]);
    expect(unknown.worldPct).toBe(0);
    const empty = computeStats(new Map(), zonesOf, catalog);
    expect(empty).toMatchObject({
      cellCount: 0,
      areaKm2: 0,
      worldPct: 0,
      countries: [],
      regions: [],
      departments: [],
    });
    const noCatalog = { countries: [], regions: [], departments: [] };
    expect(computeStats(new Map(), zonesOf, noCatalog).worldPct).toBe(0);
  });
});
