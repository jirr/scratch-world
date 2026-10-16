import { acquireBusy } from '../app/busy.svelte';
import { addCells } from '../data/cell-store';
import type { ScratchDb } from '../data/db';
import { getSetting } from '../data/settings-store';
import {
  APPROXIMATE_ACCURACY_M,
  APPROXIMATE_CONSECUTIVE_FIXES,
  FIRST_FIX_MAX_ACCURACY_M,
  LIVE_FLUSH_MS,
  MAX_GAP_M,
  MAX_GAP_NO_TIME_M,
  MAX_GAP_S,
  MAX_SPEED_MPS,
  MIN_DISTANCE_M,
  SPEED_WINDOW_S,
} from '../domain/config';
import { PointFilter } from '../domain/point-filter';
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
  elapsedMs = $state(0);
  lastFix = $state<PositionFix | null>(null);
  /** Vrai si les positions reçues sont trop imprécises : probablement une localisation « approximative ». */
  approximate = $state(false);

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
  #started = false;
  #coarseStreak = 0;
  #flushTimer: ReturnType<typeof setInterval> | null = null;
  #tickTimer: ReturnType<typeof setInterval> | null = null;
  #releaseBusy: (() => void) | null = null;
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
      maxAccuracyM: await getSetting(db, 'accuracyThresholdM'),
      firstFixMaxAccuracyM: FIRST_FIX_MAX_ACCURACY_M,
      maxSpeedMps: MAX_SPEED_MPS,
      minDistanceM: MIN_DISTANCE_M,
      speedWindowS: SPEED_WINDOW_S,
    });
    this.#keepRaw = await getSetting(db, 'keepRawTracks');
    this.#cellizer.reset();
    this.#pending.clear();
    this.#rawPoints = [];
    this.#seq = 0;
    this.#started = false;
    this.cellsAdded = 0;
    this.elapsedMs = 0;
    this.lastFix = null;
    this.approximate = false;
    this.#coarseStreak = 0;
    this.#startedAt = Date.now();
    this.#releaseBusy = acquireBusy('recording');
    this.state = 'recording';

    this.#flushTimer = setInterval(() => void this.#flush(), LIVE_FLUSH_MS);
    this.#tickTimer = setInterval(() => {
      this.elapsedMs = Date.now() - this.#startedAt;
    }, 1000);
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
    if (this.#tickTimer) clearInterval(this.#tickTimer);
    this.#flushTimer = this.#tickTimer = null;
    await this.#deps.source.stop();
    await this.#flush();
    await this.#deps.wakeLock.disable();
    this.#releaseBusy?.();
    this.#releaseBusy = null;
  }

  #onStatus(status: PositionStatus): void {
    this.status = status;
    if (status === 'denied') void this.stop();
  }

  #onFix(fix: PositionFix): void {
    if (this.state !== 'recording' || !this.#filter) return;
    this.lastFix = fix;
    this.#coarseStreak = fix.accuracy > APPROXIMATE_ACCURACY_M ? this.#coarseStreak + 1 : 0;
    this.approximate = this.#coarseStreak >= APPROXIMATE_CONSECUTIVE_FIXES;
    const point: TrackPoint = { lat: fix.lat, lng: fix.lng, t: fix.timestamp, acc: fix.accuracy };
    if (this.#filter.accept(point) !== 'accepted') return;
    if (!this.#started) {
      this.#started = true;
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
