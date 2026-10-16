import { addCells } from '../data/cell-store';
import type { ScratchDb } from '../data/db';
import { getSetting } from '../data/settings-store';
import {
  DISCOVERY_REFRESH_M,
  LIVE_MAX_ACCURACY_M,
  LIVE_FLUSH_MS,
  MAX_GAP_M,
  MAX_GAP_NO_TIME_M,
  MAX_GAP_S,
  MAX_SPEED_MPS,
  MIN_DISTANCE_M,
  SPEED_WINDOW_S,
} from '../domain/config';
import { PointFilter } from '../domain/point-filter';
import { haversineM } from '../domain/geo';
import { SpeedTracker } from '../domain/speed-mode';
import { startZoneCells } from '../domain/start-zone';
import { TrackCellizer, type TrackPoint } from '../domain/track-cellizer';
import type { PositionFix, PositionSource, PositionStatus } from '../platform/position';
import type { WakeLock } from '../platform/wake-lock';

export interface RecorderDeps {
  source: PositionSource;
  db: ScratchDb;
  wakeLock: WakeLock;
}

/** Grattage en direct : position → filtre → cellules → écriture par lots toutes les 2 s. */
export class Recorder {
  state = $state<'idle' | 'recording'>('idle');
  status = $state<PositionStatus>('idle');
  /** Cellules réellement nouvelles ajoutées pendant cette session (hors revisites). */
  cellsAdded = $state(0);
  lastFix = $state<PositionFix | null>(null);
  /** Vitesse lissée (m/s), pour choisir le pictogramme de position. */
  speedMps = $state(0);

  #deps: RecorderDeps;
  #filter: PointFilter | null = null;
  #cellizer = new TrackCellizer({
    maxGapM: MAX_GAP_M,
    maxGapS: MAX_GAP_S,
    maxGapNoTimeM: MAX_GAP_NO_TIME_M,
  });
  // Ensemble interne (dédoublonnage), pas un état réactif.
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  #pending = new Set<string>();
  #rawPoints: TrackPoint[] = [];
  #keepRaw = false;
  #startedAt = 0;
  #seq = 0;
  /** Vrai une fois la zone de départ dévoilée. */
  #lastZone: { lat: number; lng: number } | null = null;
  #speed = new SpeedTracker();
  #flushTimer: ReturnType<typeof setInterval> | null = null;
  #flushing: Promise<void> = Promise.resolve();

  constructor(deps: RecorderDeps) {
    this.#deps = deps;
  }

  get supportsWakeLock(): boolean {
    return this.#deps.wakeLock.supported;
  }

  async start(options: { wakeLock: boolean }): Promise<void> {
    if (this.state === 'recording') return;
    const { db, source, wakeLock } = this.#deps;
    this.#filter = new PointFilter({
      maxAccuracyM: LIVE_MAX_ACCURACY_M,
      maxSpeedMps: MAX_SPEED_MPS,
      minDistanceM: MIN_DISTANCE_M,
      speedWindowS: SPEED_WINDOW_S,
    });
    this.#keepRaw = await getSetting(db, 'keepRawTracks');
    this.#cellizer.reset();
    this.#pending.clear();
    this.#rawPoints = [];
    this.#seq = 0;
    this.#lastZone = null;
    this.#speed.reset();
    this.speedMps = 0;
    this.cellsAdded = 0;
    this.lastFix = null;
    this.#startedAt = Date.now();
    this.state = 'recording';

    this.#flushTimer = setInterval(() => void this.#flush(), LIVE_FLUSH_MS);
    if (options.wakeLock) await wakeLock.enable();
    await source.start(
      (fix) => this.#onFix(fix),
      (status) => this.#onStatus(status),
    );
  }

  async stop(): Promise<void> {
    if (this.state !== 'recording') return;
    this.state = 'idle';
    if (this.#flushTimer) clearInterval(this.#flushTimer);
    this.#flushTimer = null;
    await this.#deps.source.stop();
    await this.#flush();
    await this.#deps.wakeLock.disable();
  }

  #onStatus(status: PositionStatus): void {
    this.status = status;
    if (status === 'denied') void this.stop();
  }

  #onFix(fix: PositionFix): void {
    if (this.state !== 'recording' || !this.#filter) return;
    this.lastFix = fix;
    this.speedMps = this.#speed.push(fix);
    const point: TrackPoint = { lat: fix.lat, lng: fix.lng, t: fix.timestamp, acc: fix.accuracy };
    if (this.#filter.accept(point) !== 'accepted') return;
    // Zone de découverte (~1 km) : dévoilée à la première position, puis à chaque éloignement notable.
    const lastZone = this.#lastZone;
    if (
      !lastZone ||
      haversineM(lastZone.lat, lastZone.lng, point.lat, point.lng) >= DISCOVERY_REFRESH_M
    ) {
      this.#lastZone = { lat: point.lat, lng: point.lng };
      for (const cell of startZoneCells(point.lat, point.lng)) this.#pending.add(cell);
    }
    for (const cell of this.#cellizer.push(point)) this.#pending.add(cell);
    if (this.#keepRaw) this.#rawPoints.push(point);
  }

  /** Écritures sérialisées : un flush ne démarre qu'une fois le précédent terminé. */
  #flush(): Promise<void> {
    this.#flushing = this.#flushing.then(async () => {
      const { db } = this.#deps;
      if (this.#pending.size > 0) {
        const cells = [...this.#pending];
        this.#pending.clear();
        this.cellsAdded += (await addCells(db, cells)).added;
      }
      if (this.#rawPoints.length > 0) {
        const raw = this.#rawPoints;
        this.#rawPoints = [];
        const points = new Float64Array(raw.length * 4);
        raw.forEach((p, i) => points.set([p.lat, p.lng, p.t ?? NaN, p.acc ?? NaN], i * 4));
        await db.tracks.add({ sourceId: `live:${this.#startedAt}`, seq: this.#seq++, points });
      }
    });
    return this.#flushing;
  }
}
