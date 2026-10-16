import { describe, expect, it } from 'vitest';
import { MAX_SPEED_MPS, MIN_DISTANCE_M, SPEED_WINDOW_S } from './config';
import { PointFilter } from './point-filter';

const make = (maxAccuracyM = 50) =>
  new PointFilter({
    maxAccuracyM,
    maxSpeedMps: MAX_SPEED_MPS,
    minDistanceM: MIN_DISTANCE_M,
    speedWindowS: SPEED_WINDOW_S,
  });

/** 1 degré de latitude ≈ 111 km. */
const north = (km: number) => 48 + km / 111.2;

describe('PointFilter', () => {
  it('rejette les points invalides, dont (0,0)', () => {
    const f = make();
    expect(f.accept({ lat: NaN, lng: 2 })).toBe('invalid');
    expect(f.accept({ lat: 91, lng: 2 })).toBe('invalid');
    expect(f.accept({ lat: 10, lng: 181 })).toBe('invalid');
    expect(f.accept({ lat: 0, lng: 0 })).toBe('invalid');
    expect(f.accept({ lat: 0, lng: 0.0001 })).toBe('accepted');
  });

  it('rejette une précision trop faible', () => {
    const f = make(50);
    expect(f.accept({ lat: 48, lng: 2, acc: 51 })).toBe('accuracy');
    expect(f.accept({ lat: 48, lng: 2, acc: 50 })).toBe('accepted');
    expect(f.accept({ lat: 49, lng: 2 })).toBe('accepted');
  });

  it('tolère une précision plus faible pour le tout premier point seulement', () => {
    const f = new PointFilter({
      maxAccuracyM: 50,
      firstFixMaxAccuracyM: 100,
      maxSpeedMps: MAX_SPEED_MPS,
      minDistanceM: MIN_DISTANCE_M,
      speedWindowS: SPEED_WINDOW_S,
    });
    expect(f.accept({ lat: 48, lng: 2, acc: 101 })).toBe('accuracy');
    expect(f.accept({ lat: 48, lng: 2, acc: 90 })).toBe('accepted');
    expect(f.accept({ lat: north(1), lng: 2, acc: 90 })).toBe('accuracy');
  });

  it('applique l’ordre invalide > précision > doublon > vitesse', () => {
    const f = make(50);
    f.accept({ lat: 48, lng: 2, t: 1000 });
    expect(f.accept({ lat: NaN, lng: 2, acc: 500 })).toBe('invalid');
    expect(f.accept({ lat: 48, lng: 2, acc: 500, t: 2000 })).toBe('accuracy');
    expect(f.accept({ lat: 48, lng: 2, t: 2000 })).toBe('duplicate');
    expect(f.accept({ lat: north(5), lng: 2, t: 2000 })).toBe('speed');
  });

  it('écarte les doublons par distance et par horodatage non croissant', () => {
    const f = make();
    expect(f.accept({ lat: 48, lng: 2, t: 10_000 })).toBe('accepted');
    expect(f.accept({ lat: 48.00002, lng: 2, t: 20_000 })).toBe('duplicate');
    expect(f.accept({ lat: 48.001, lng: 2, t: 10_000 })).toBe('duplicate');
    expect(f.accept({ lat: 48.001, lng: 2, t: 9_000 })).toBe('duplicate');
    expect(f.accept({ lat: 48.001, lng: 2, t: 60_000 })).toBe('accepted');
  });

  it('accepte une reprise après un vol (800 km deux heures plus tard)', () => {
    const f = make();
    f.accept({ lat: 48, lng: 2, t: 0 });
    expect(f.accept({ lat: north(800), lng: 2, t: 2 * 3600_000 })).toBe('accepted');
  });

  it('rejette un point aberrant isolé puis accepte le suivant, cohérent avec le dernier accepté', () => {
    const f = make();
    expect(f.accept({ lat: 48, lng: 2, t: 0 })).toBe('accepted');
    expect(f.accept({ lat: north(50), lng: 2, t: 10_000 })).toBe('speed');
    expect(f.accept({ lat: north(0.3), lng: 2, t: 20_000 })).toBe('accepted');
  });

  it('ne teste pas la vitesse sans horodatage', () => {
    const f = make();
    f.accept({ lat: 48, lng: 2 });
    expect(f.accept({ lat: north(300), lng: 2 })).toBe('accepted');
  });

  it('repart de zéro après reset()', () => {
    const f = make();
    f.accept({ lat: 48, lng: 2, t: 0 });
    f.reset();
    expect(f.accept({ lat: 48, lng: 2, t: 0 })).toBe('accepted');
  });
});
