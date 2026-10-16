import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScratchDb } from '../data/db';
import { setSetting } from '../data/settings-store';
import type { PositionFix, PositionSource, PositionStatus } from '../platform/position';
import { Recorder } from './recorder.svelte';

class FakeSource implements PositionSource {
  readonly kind = 'fake';
  readonly supportsBackground = false;
  onFix: (fix: PositionFix) => void = () => {};
  onStatus: (status: PositionStatus) => void = () => {};
  stopped = false;

  async start(onFix: (fix: PositionFix) => void, onStatus: (status: PositionStatus) => void) {
    this.onFix = onFix;
    this.onStatus = onStatus;
  }

  async stop() {
    this.stopped = true;
  }

  getCurrent(): Promise<PositionFix> {
    return Promise.reject(new Error('inutilisé'));
  }
}

const wakeLock = {
  supported: false,
  enable: vi.fn(async () => {}),
  disable: vi.fn(async () => {}),
};

let db: ScratchDb;
let source: FakeSource;
let recorder: Recorder;

/** Marche vers le nord par pas de `stepM` mètres (30 par défaut), un point par seconde. */
function walk(startMs: number, steps: number, accuracy = 10, stepM = 30): PositionFix[] {
  return Array.from({ length: steps }, (_, i) => ({
    lat: 48.85 + (i * stepM) / 111_200,
    lng: 2.35,
    accuracy,
    timestamp: startMs + i * 1000,
    speed: null,
  }));
}

beforeEach(() => {
  // Seuls les intervalles sont simulés : fake-indexeddb a besoin des vrais timers.
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  db = new ScratchDb(`rec-${Math.random()}`);
  source = new FakeSource();
  recorder = new Recorder({ source, db, wakeLock });
});

afterEach(async () => {
  vi.useRealTimers();
  await recorder.stop();
  db.close();
  await db.delete();
});

describe('Recorder', () => {
  it('écrit les cellules par lots et compte les nouvelles', async () => {
    await recorder.start({ wakeLock: false });
    for (const fix of walk(0, 20)) source.onFix(fix);

    await vi.advanceTimersByTimeAsync(2100);
    await vi.waitFor(() => expect(recorder.cellsAdded).toBeGreaterThanOrEqual(3), {
      timeout: 5000,
    });
    expect(await db.chunks.count()).toBeGreaterThan(0);

    const before = recorder.cellsAdded;
    for (const fix of walk(30_000, 20)) source.onFix(fix);
    await recorder.stop();
    // Même trajet : peu de cellules nouvelles (les zones se recouvrent).
    expect(recorder.cellsAdded).toBeLessThanOrEqual(Math.ceil(before * 1.35));
    expect(source.stopped).toBe(true);
    expect(recorder.state).toBe('idle');
  });

  it('ignore une position trop imprécise', async () => {
    await recorder.start({ wakeLock: false });
    source.onFix(walk(0, 1, 1500)[0] as PositionFix);
    await recorder.stop();
    expect(recorder.cellsAdded).toBe(0);
    expect(await db.chunks.count()).toBe(0);
  });

  it('le premier point, un peu imprécis, dévoile une petite zone sans attendre un déplacement', async () => {
    await recorder.start({ wakeLock: false });
    source.onFix(walk(0, 1, 80)[0] as PositionFix);
    await recorder.stop();
    expect(recorder.cellsAdded).toBeGreaterThanOrEqual(3);
    expect(recorder.cellsAdded).toBeLessThan(15);
  });

  it('à pied, le rayon reste petit et une position à 900 m est ignorée', async () => {
    await recorder.start({ wakeLock: false });
    source.onFix(walk(0, 1, 900)[0] as PositionFix);
    await recorder.stop();
    expect(recorder.cellsAdded).toBe(0);
  });

  it('à pied, dévoile une petite zone autour de chaque tronçon parcouru', async () => {
    await recorder.start({ wakeLock: false });
    for (const fix of walk(0, 40, 10, 1.4)) source.onFix(fix); // 1,4 m/s
    await recorder.stop();
    expect(recorder.cellsAdded).toBeGreaterThan(3);
    expect(recorder.cellsAdded).toBeLessThan(80);
  });

  it('en véhicule, la zone dévoilée est bien plus large', async () => {
    await recorder.start({ wakeLock: false });
    for (const fix of walk(0, 60, 10, 30)) source.onFix(fix); // 30 m/s
    await recorder.stop();
    expect(recorder.cellsAdded).toBeGreaterThan(300);
  });

  it('estime la vitesse pour le pictogramme de position', async () => {
    await recorder.start({ wakeLock: false });
    for (const fix of walk(0, 15)) source.onFix(fix); // 30 m/s
    expect(recorder.speedMps).toBeGreaterThan(9);
    await recorder.stop();
  });

  it('s’arrête quand la permission est refusée', async () => {
    await recorder.start({ wakeLock: false });
    source.onStatus('denied');
    await vi.waitFor(() => expect(recorder.state).toBe('idle'), { timeout: 5000 });
    expect(recorder.status).toBe('denied');
  });

  it('conserve les traces brutes seulement si le réglage est actif', async () => {
    await recorder.start({ wakeLock: false });
    for (const fix of walk(0, 5)) source.onFix(fix);
    await recorder.stop();
    expect(await db.tracks.count()).toBe(0);

    await setSetting(db, 'keepRawTracks', true);
    await recorder.start({ wakeLock: false });
    for (const fix of walk(100_000, 5)) source.onFix(fix);
    await recorder.stop();
    const tracks = await db.tracks.toArray();
    expect(tracks).toHaveLength(1);
    expect(tracks[0]?.points).toHaveLength(5 * 4);
    expect(tracks[0]?.sourceId).toMatch(/^live:\d+$/);
  });

  it('active le wake lock à la demande et le libère à l’arrêt', async () => {
    await recorder.start({ wakeLock: true });
    expect(wakeLock.enable).toHaveBeenCalled();
    await recorder.stop();
    expect(wakeLock.disable).toHaveBeenCalled();
  });
});
