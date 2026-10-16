import { cellToChildren, latLngToCell } from 'h3-js';
import { describe, expect, it } from 'vitest';
import { chunkKeyOf, decodePos, encodePos, groupByChunk, mergeSortedUnique } from './cells';

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('encodePos / decodePos', () => {
  it('fait l’aller-retour sur 1 000 cellules aléatoires', () => {
    const rand = mulberry32(1);
    for (let i = 0; i < 1000; i++) {
      const cell = latLngToCell(rand() * 170 - 85, rand() * 360 - 180, 10);
      const pos = encodePos(cell);
      expect(pos).toBeGreaterThanOrEqual(0);
      expect(pos).toBeLessThan(16807);
      expect(decodePos(chunkKeyOf(cell), pos)).toBe(cell);
    }
  });

  it('fait l’aller-retour sous un pentagone', () => {
    const pentagon = '85080003fffffff';
    const children = cellToChildren(pentagon, 10);
    expect(children.length).toBeGreaterThan(1000);
    for (const cell of children.filter((_, i) => i % 50 === 0)) {
      expect(chunkKeyOf(cell)).toBe(pentagon);
      expect(decodePos(pentagon, encodePos(cell))).toBe(cell);
    }
  });
});

describe('mergeSortedUnique', () => {
  const u = (...n: number[]) => Uint16Array.from(n);

  it('gère les tableaux vides', () => {
    expect(mergeSortedUnique(u(), u())).toEqual({ merged: u(), added: u() });
    expect(mergeSortedUnique(u(), u(1, 2))).toEqual({ merged: u(1, 2), added: u(1, 2) });
    expect(mergeSortedUnique(u(1, 2), u())).toEqual({ merged: u(1, 2), added: u() });
  });

  it('n’ajoute rien en cas de recouvrement total', () => {
    expect(mergeSortedUnique(u(1, 2, 3), u(1, 2, 3))).toEqual({ merged: u(1, 2, 3), added: u() });
  });

  it('entrelace des ensembles disjoints et recouvrants', () => {
    expect(mergeSortedUnique(u(1, 5, 9), u(2, 5, 10))).toEqual({
      merged: u(1, 2, 5, 9, 10),
      added: u(2, 10),
    });
  });
});

describe('groupByChunk', () => {
  it('regroupe par chunk avec positions triées et uniques', () => {
    const a = latLngToCell(48.85, 2.35, 10);
    const b = latLngToCell(48.8501, 2.3501, 10);
    const far = latLngToCell(-33.86, 151.2, 10);
    const groups = groupByChunk([b, a, a, far]);
    expect(groups.size).toBe(2);
    const paris = groups.get(chunkKeyOf(a));
    expect(paris).toBeDefined();
    expect([...(paris as Uint16Array)]).toEqual(
      [...new Set([encodePos(a), encodePos(b)])].sort((x, y) => x - y),
    );
  });
});
