import { describe, expect, it } from 'vitest';
import { displayRes } from './lod';

describe('displayRes', () => {
  it('vaut 10 à zoom 15 et 45° de latitude', () => {
    expect(displayRes(15, 45)).toBe(10);
  });

  it('est croissant avec le zoom', () => {
    let previous = -1;
    for (let zoom = 0; zoom <= 20; zoom += 0.25) {
      const res = displayRes(zoom, 45);
      expect(res).toBeGreaterThanOrEqual(previous);
      previous = res;
    }
  });

  it('reste grossier à zoom 0 et fin à zoom 20', () => {
    expect(displayRes(0, 0)).toBeLessThanOrEqual(2);
    expect(displayRes(20, 0)).toBe(10);
  });

  it('n’échoue pas aux pôles', () => {
    expect(displayRes(10, 90)).toBeGreaterThanOrEqual(0);
  });
});
