import { describe, expect, it } from 'vitest';
import { generateSyntheticCells } from './synthetic-cells';

describe('generateSyntheticCells', () => {
  it('atteint la cible de cellules uniques, de façon déterministe', () => {
    const a = generateSyntheticCells(5000, 42);
    expect(a.size).toBe(5000);
    expect([...a].slice(0, 20)).toEqual([...generateSyntheticCells(5000, 42)].slice(0, 20));
    expect([...generateSyntheticCells(5000, 7)].slice(0, 20)).not.toEqual([...a].slice(0, 20));
  });
});
