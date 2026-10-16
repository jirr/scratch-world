import { describe, expect, it } from 'vitest';
import { discoveryRadiusM, maxAccuracyForRadius, refreshDistanceM } from './discovery';
import { startZoneCells } from './start-zone';

describe('rayon de découverte selon la vitesse', () => {
  it('est petit à pied, plus large en trottinette, large en véhicule', () => {
    expect(discoveryRadiusM('idle')).toBe(discoveryRadiusM('walk'));
    expect(discoveryRadiusM('walk')).toBeLessThan(discoveryRadiusM('scooter'));
    expect(discoveryRadiusM('scooter')).toBeLessThan(discoveryRadiusM('vehicle'));
    expect(discoveryRadiusM('vehicle')).toBe(1000);
  });

  it('dévoile peu de cellules à pied et beaucoup en véhicule', () => {
    const walk = startZoneCells(48.85, 2.35, discoveryRadiusM('walk')).length;
    const car = startZoneCells(48.85, 2.35, discoveryRadiusM('vehicle')).length;
    expect(walk).toBeGreaterThanOrEqual(3);
    expect(walk).toBeLessThan(15);
    expect(car).toBeGreaterThan(150);
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
