import { areNeighborCells, latLngToCell } from 'h3-js';
import { describe, expect, it } from 'vitest';
import { startZoneCells } from './start-zone';

describe('startZoneCells', () => {
  it('contient la cellule de départ et ses voisines (217 cellules à 8 anneaux ≈ 1 km)', () => {
    const zone = startZoneCells(48.85, 2.35);
    const center = latLngToCell(48.85, 2.35, 10);
    expect(zone).toHaveLength(217);
    expect(new Set(zone).size).toBe(217);
    expect(zone).toContain(center);
    expect(zone.filter((c) => areNeighborCells(center, c))).toHaveLength(6);
  });

  it('se réduit à la seule cellule avec 0 anneau', () => {
    expect(startZoneCells(48.85, 2.35, 0)).toEqual([latLngToCell(48.85, 2.35, 10)]);
  });
});
