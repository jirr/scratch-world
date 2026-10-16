import { cellToChildren, latLngToCell } from 'h3-js';
import { describe, expect, it } from 'vitest';
import { chunkKeyOf, encodePos } from './cells';
import {
  bboxVisible,
  bucketBBox,
  bucketCellOf,
  bucketKey,
  buildBucket,
  expandedViewBBox,
  mercator,
  WORLD_BUCKET,
  type BBox,
} from './fog-buckets';

describe('mercator', () => {
  it('place (0,0) au centre et les bords aux extrémités', () => {
    expect(mercator(0, 0)).toEqual([0.5, 0.5]);
    expect(mercator(0, -180)[0]).toBe(0);
    expect(mercator(0, 180)[0]).toBe(1);
    expect(mercator(60, 0)[1]).toBeLessThan(0.5);
  });
});

describe('bucketCellOf', () => {
  const chunk = chunkKeyOf(latLngToCell(48.85, 2.35, 10));

  it('utilise un bucket mondial jusqu’à la résolution du chunk', () => {
    for (let res = 0; res <= 5; res++) expect(bucketCellOf(res, chunk)).toBe(WORLD_BUCKET);
  });

  it('utilise le parent de résolution res - 5 au-delà', () => {
    expect(bucketCellOf(10, chunk)).toBe(chunk);
    expect(bucketKey(6, bucketCellOf(6, chunk))).toMatch(/^6:[0-9a-f]+$/);
  });
});

describe('bboxVisible', () => {
  const box = (west: number, east: number): BBox => [west, -10, east, 10];

  it('détecte intersection et disjonction simples', () => {
    expect(bboxVisible(box(0, 10), box(5, 20))).toBe(true);
    expect(bboxVisible(box(0, 10), box(20, 30))).toBe(false);
    expect(bboxVisible([0, 20, 10, 30], box(0, 10))).toBe(false);
  });

  it('gère une vue à cheval sur l’antiméridien (longitudes > 180)', () => {
    const view = box(170, 200);
    expect(bboxVisible(box(-179, -170), view)).toBe(true);
    expect(bboxVisible(box(175, 179), view)).toBe(true);
    expect(bboxVisible(box(-100, -90), view)).toBe(false);
  });

  it('gère une vue à longitudes négatives profondes', () => {
    expect(bboxVisible(box(170, 179), box(-200, -170))).toBe(true);
  });
});

describe('bucketBBox', () => {
  it('encadre une cellule ordinaire', () => {
    const cell = latLngToCell(48.85, 2.35, 1);
    const [west, south, east, north] = bucketBBox(cell);
    expect(west).toBeLessThan(2.35);
    expect(east).toBeGreaterThan(2.35);
    expect(south).toBeLessThan(48.85);
    expect(north).toBeGreaterThan(48.85);
  });

  it('couvre toutes les longitudes pour une cellule qui chevauche l’antiméridien', () => {
    const cell = latLngToCell(0, 180, 1);
    const [west, , east] = bucketBBox(cell);
    expect([west, east]).toEqual([-180, 180]);
  });
});

describe('expandedViewBBox', () => {
  it('élargit la vue de 50 % de chaque côté', () => {
    const [west, , east] = expandedViewBBox(0, 0, 0, 512, 512, 0.5);
    expect(east - west).toBeCloseTo(720, 5);
  });

  it('peut dépasser ±180 près de l’antiméridien', () => {
    const [, , east] = expandedViewBBox(179, 0, 5, 800, 600);
    expect(east).toBeGreaterThan(180);
  });
});

describe('buildBucket', () => {
  const pentagonLike = latLngToCell(48.85, 2.35, 5);
  const fullChunk = (): [string, Uint16Array][] => [
    [pentagonLike, Uint16Array.from({ length: 16807 }, (_, i) => i)],
  ];

  it('produit une instance [dx, dy, r] par cellule, relative à l’origine', () => {
    const cells = cellToChildren(pentagonLike, 10).slice(0, 5);
    const positions = Uint16Array.from(cells.map(encodePos).sort((a, b) => a - b));
    const { origin, instances } = buildBucket(10, pentagonLike, [[pentagonLike, positions]]);
    expect(instances.length).toBe(15);
    expect(Math.abs(instances[0] as number)).toBeLessThan(0.001);
    expect(instances[2]).toBeGreaterThan(0);
    expect(origin[0]).toBeCloseTo(mercator(48.85, 2.35)[0], 2);
  });

  it('dédoublonne aux résolutions grossières', () => {
    const { instances } = buildBucket(7, WORLD_BUCKET, fullChunk());
    expect(instances.length / 3).toBeLessThan(16807 / 5);
  });

  it('construit un bucket res 10 plein : une instance par cellule des 16 807 enfants', () => {
    const { instances } = buildBucket(10, pentagonLike, fullChunk());
    expect(instances.length / 3).toBe(16807);
  });
});
