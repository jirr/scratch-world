import { describe, expect, it } from 'vitest';
import { moveMode, SpeedTracker } from './speed-mode';

describe('moveMode', () => {
  it('classe la vitesse : arrêt, marche, trottinette, véhicule', () => {
    expect(moveMode(0)).toBe('idle');
    expect(moveMode(1.4)).toBe('walk');
    expect(moveMode(2.9)).toBe('walk');
    expect(moveMode(5)).toBe('scooter');
    expect(moveMode(8.9)).toBe('scooter');
    expect(moveMode(15)).toBe('vehicle');
  });
});

const fix = (
  t: number,
  northM: number,
  extra: Partial<{ speed: number | null; accuracy: number }> = {},
) => ({
  lat: 48 + northM / 111_200,
  lng: 2,
  accuracy: 5,
  timestamp: t * 1000,
  speed: null,
  ...extra,
});

describe('SpeedTracker', () => {
  it('utilise la vitesse du GPS quand elle existe, lissée', () => {
    const tracker = new SpeedTracker();
    let speed = 0;
    for (let i = 0; i < 10; i++) speed = tracker.push(fix(i, 0, { speed: 6 }));
    expect(speed).toBeGreaterThan(5.8);
    expect(moveMode(speed)).toBe('scooter');
  });

  it('déduit la vitesse des positions successives (marche, puis trottinette)', () => {
    const tracker = new SpeedTracker();
    let speed = 0;
    for (let i = 0; i < 12; i++) speed = tracker.push(fix(i, i * 1.4 * 1));
    expect(moveMode(speed)).toBe('walk');
    for (let i = 12; i < 30; i++) speed = tracker.push(fix(i, 16.8 + (i - 12) * 6));
    expect(moveMode(speed)).toBe('scooter');
  });

  it('ignore le bruit : un jitter inférieur à la précision reste à l’arrêt', () => {
    const tracker = new SpeedTracker();
    let speed = 0;
    for (let i = 0; i < 10; i++) speed = tracker.push(fix(i, (i % 2) * 8, { accuracy: 20 }));
    expect(moveMode(speed)).toBe('idle');
  });

  it('repart de zéro après reset()', () => {
    const tracker = new SpeedTracker();
    tracker.push(fix(0, 0, { speed: 10 }));
    tracker.reset();
    expect(tracker.push(fix(1, 0))).toBe(0);
  });
});
