import { describe, expect, it } from 'vitest';
import { discoveryRadiusM, maxAccuracyForRadius, refreshDistanceM } from './discovery';

describe('rayon de découverte', () => {
  it('vaut 100 m quel que soit le mode de déplacement', () => {
    for (const mode of ['idle', 'walk', 'scooter', 'vehicle'] as const) {
      expect(discoveryRadiusM(mode)).toBe(100);
    }
  });

  it('exige plus de précision pour un petit rayon, et borne la tolérance', () => {
    expect(maxAccuracyForRadius(150)).toBe(300);
    expect(maxAccuracyForRadius(50)).toBe(150);
    expect(maxAccuracyForRadius(1000)).toBe(1000);
    expect(maxAccuracyForRadius(5000)).toBe(1000);
  });

  it('rafraîchit la zone tous les tiers de rayon, au moins 30 m', () => {
    expect(refreshDistanceM(150)).toBe(50);
    expect(refreshDistanceM(30)).toBe(30);
    expect(refreshDistanceM(1000)).toBeCloseTo(333.3, 1);
  });
});
