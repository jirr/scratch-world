import type { Map as MapLibreMap } from 'maplibre-gl';
import { addBrushCells, brushRadiusM, strokePoints, type LngLat } from '../domain/brush';

/** Délai max. entre deux écritures pendant un tracé : le brouillard se dissipe en direct. */
const FLUSH_INTERVAL_MS = 300;

export type DrawFlush = (cells: Set<string>) => Promise<unknown>;

/**
 * Dessin au doigt : un tracé à un seul pointeur dévoile les cellules sous le pinceau. Un second
 * pointeur (pincement) interrompt le tracé et laisse MapLibre zoomer. Le déplacement de la carte à
 * un doigt/à la souris est désactivé tant que le contrôleur est actif.
 */
export class DrawController {
  readonly #map: MapLibreMap;
  readonly #target: HTMLElement;
  readonly #flush: DrawFlush;
  readonly #pointers = new Set<number>();
  readonly #previousTouchAction: string;
  #strokeId: number | null = null;
  #last: LngLat | null = null;
  #pending = new Set<string>();
  #timer: ReturnType<typeof setTimeout> | null = null;
  #writes: Promise<void> = Promise.resolve();

  constructor(map: MapLibreMap, flush: DrawFlush) {
    this.#map = map;
    this.#flush = flush;
    this.#target = map.getCanvasContainer();
    map.dragPan.disable();
    // Sans déplacement à un doigt, MapLibre laisserait le navigateur zoomer la page au pincement.
    this.#previousTouchAction = this.#target.style.touchAction;
    this.#target.style.touchAction = 'none';
    this.#target.addEventListener('pointerdown', this.#onDown);
    this.#target.addEventListener('pointermove', this.#onMove);
    this.#target.addEventListener('pointerup', this.#onUp);
    this.#target.addEventListener('pointercancel', this.#onUp);
  }

  /** Arrête le dessin, écrit les cellules en attente et rend la carte déplaçable. */
  async stop(): Promise<void> {
    this.#target.removeEventListener('pointerdown', this.#onDown);
    this.#target.removeEventListener('pointermove', this.#onMove);
    this.#target.removeEventListener('pointerup', this.#onUp);
    this.#target.removeEventListener('pointercancel', this.#onUp);
    this.#target.style.touchAction = this.#previousTouchAction;
    this.#map.dragPan.enable();
    this.#endStroke();
    this.#writeNow();
    await this.#writes;
  }

  #point(event: PointerEvent): LngLat {
    const rect = this.#target.getBoundingClientRect();
    const { lng, lat } = this.#map.unproject([event.clientX - rect.left, event.clientY - rect.top]);
    return { lng, lat };
  }

  #onDown = (event: PointerEvent) => {
    this.#pointers.add(event.pointerId);
    if (this.#pointers.size > 1) {
      this.#endStroke();
      return;
    }
    this.#strokeId = event.pointerId;
    const point = this.#point(event);
    this.#last = point;
    addBrushCells(this.#pending, [point], brushRadiusM(this.#map.getZoom(), point.lat));
    this.#target.setPointerCapture?.(event.pointerId);
    this.#scheduleWrite();
  };

  #onMove = (event: PointerEvent) => {
    if (event.pointerId !== this.#strokeId || !this.#last) return;
    const point = this.#point(event);
    const radius = brushRadiusM(this.#map.getZoom(), point.lat);
    addBrushCells(this.#pending, strokePoints(this.#last, point, radius), radius);
    this.#last = point;
    this.#scheduleWrite();
  };

  #onUp = (event: PointerEvent) => {
    this.#pointers.delete(event.pointerId);
    if (event.pointerId !== this.#strokeId) return;
    this.#endStroke();
    this.#writeNow();
  };

  #endStroke(): void {
    this.#strokeId = null;
    this.#last = null;
  }

  /** Au plus une écriture programmée à la fois, pour ne pas écrire à chaque mouvement. */
  #scheduleWrite(): void {
    this.#timer ??= setTimeout(() => this.#writeNow(), FLUSH_INTERVAL_MS);
  }

  /** Écritures sérialisées : chaque lot part dans l'ordre, une erreur n'interrompt pas la suite. */
  #writeNow(): void {
    clearTimeout(this.#timer ?? undefined);
    this.#timer = null;
    if (this.#pending.size === 0) return;
    const batch = this.#pending;
    this.#pending = new Set();
    this.#writes = this.#writes
      .then(() => this.#flush(batch))
      .then(
        () => undefined,
        (error: unknown) => console.error('Dessin : écriture des cellules impossible', error),
      );
  }
}
