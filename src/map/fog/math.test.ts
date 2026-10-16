import { describe, expect, it } from 'vitest';
import { clipOffset, clipScale, noiseOffset, worldCopies, type ViewState } from './math';

const view = (overrides: Partial<ViewState> = {}): ViewState => ({
  cx: 0.5,
  cy: 0.5,
  zoom: 0,
  width: 512,
  height: 512,
  ...overrides,
});

describe('clipScale / clipOffset', () => {
  it('envoie le centre de la vue au centre du clip-space', () => {
    expect(clipOffset(view(), 0.5, 0.5)).toEqual([0, -0]);
  });

  it('envoie un demi-écran vers l’est à +1 et vers le nord à +1', () => {
    const v = view({ zoom: 3, width: 800, height: 600 });
    const [sx, sy] = clipScale(v);
    const halfWidthMerc = 400 / (512 * 8);
    const halfHeightMerc = 300 / (512 * 8);
    expect(clipOffset(v, 0.5 + halfWidthMerc, 0.5)[0]).toBeCloseTo(1, 10);
    expect(clipOffset(v, 0.5, 0.5 - halfHeightMerc)[1]).toBeCloseTo(1, 10);
    expect(sx).toBeGreaterThan(0);
    expect(sy).toBeLessThan(0);
  });

  it('reste précis à zoom 20 (décalage de 1 m)', () => {
    const v = view({ zoom: 20, width: 390, height: 844, cx: 0.5123456789, cy: 0.3987654321 });
    const metersPerMerc = 40_075_016.686;
    const [dx] = clipOffset(v, v.cx + 1 / metersPerMerc, v.cy);
    const [sx] = clipScale(v);
    expect(dx).toBeCloseTo(sx / metersPerMerc, 8);
  });
});

describe('worldCopies', () => {
  it('ne dessine qu’une copie quand la vue tient dans le monde', () => {
    expect(worldCopies(view({ zoom: 5 }))).toEqual([0]);
  });

  it('en dessine plusieurs à bas zoom et près du bord', () => {
    expect(worldCopies(view({ zoom: 0, width: 1500 }))).toEqual([-1, 0, 1]);
    expect(worldCopies(view({ zoom: 4, cx: 0.999, width: 1000 }))).toEqual([0, 1]);
  });
});

describe('noiseOffset', () => {
  it('reste dans [0, taille) et varie avec le centre', () => {
    const a = noiseOffset(view({ zoom: 10, cx: 0.4, cy: 0.3 }), 256);
    const b = noiseOffset(view({ zoom: 10, cx: 0.4001, cy: 0.3 }), 256);
    for (const n of [...a, ...b]) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(256);
    }
    expect(a[0]).not.toBe(b[0]);
  });
});
