import { latLngToCell } from 'h3-js';
import { describe, expect, it } from 'vitest';
import { createRegionLocator } from './region-locator';

const square = (west: number, south: number, east: number, north: number) => ({
  type: 'Polygon' as const,
  coordinates: [
    [
      [west, south],
      [east, south],
      [east, north],
      [west, north],
      [west, south],
    ],
  ],
});

const locate = createRegionLocator([
  { code: 'AA', geometry: square(0, 0, 10, 10) },
  {
    code: 'BB',
    geometry: {
      type: 'MultiPolygon',
      coordinates: [square(20, 0, 30, 10).coordinates, square(40, 0, 50, 10).coordinates],
    },
  },
  {
    // Carré avec un trou en son centre.
    code: 'CC',
    geometry: {
      type: 'Polygon',
      coordinates: [
        square(60, 0, 80, 20).coordinates[0] as number[][],
        [
          [66, 6],
          [66, 14],
          [74, 14],
          [74, 6],
          [66, 6],
        ],
      ],
    },
  },
]);

const cell7 = (lat: number, lng: number) => latLngToCell(lat, lng, 7);

describe('createRegionLocator', () => {
  it('rattache par le centre, y compris pour un MultiPolygon', () => {
    expect(locate(cell7(5, 5))).toBe('AA');
    expect(locate(cell7(5, 25))).toBe('BB');
    expect(locate(cell7(5, 45))).toBe('BB');
  });

  it('renvoie la mer hors de tout polygone et dans un trou', () => {
    expect(locate(cell7(5, 15))).toBe('');
    expect(locate(cell7(50, 50))).toBe('');
    expect(locate(cell7(10, 70))).toBe('');
    expect(locate(cell7(2, 62))).toBe('CC');
  });

  it('rattache une cellule côtière dont seul un sommet est dans le pays', () => {
    // Centre juste hors du carré (0,0)-(10,10), mais la cellule (arête ≈ 1,4 km) mord dedans.
    const coastal = cell7(10.003, 5);
    expect(locate(coastal)).toBe('AA');
    expect(locate(cell7(10.2, 5))).toBe('');
  });

  it('fonctionne sans aucun pays', () => {
    expect(createRegionLocator([])(cell7(5, 5))).toBe('');
  });
});
