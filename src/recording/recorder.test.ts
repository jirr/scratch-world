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

/** Marche vers le nord par pas de 30 m, un point par seconde (~30 m/s). */
function walk(startMs: number, steps: number, accuracy = 10): PositionFix[] {
  return Array.from({ length: steps }, (_, i) => ({
    lat: 48.85 + (i * 30) / 111_200,
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
    // Même trajet : au plus la cellule de raccord entre la fin et le retour au départ.
    expect(recorder.cellsAdded).toBeLessThanOrEqual(before + 2);
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
    expect(recorder.cellsAdded).toBe(217);
  });

  it('tolère une position à 900 m grâce à la zone de découverte', async () => {
    await recorder.start({ wakeLock: false });
    source.onFix(walk(0, 1, 900)[0] as PositionFix);
    await recorder.stop();
    expect(recorder.cellsAdded).toBe(217);
  });

  it('ne dévoile une nouvelle zone qu’après 200 m de déplacement', async () => {
    await recorder.start({ wakeLock: false });
    for (const fix of walk(0, 5)) source.onFix(fix); // ~120 m
    await recorder.stop();
    expect(recorder.cellsAdded).toBeLessThan(217 + 40);
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
