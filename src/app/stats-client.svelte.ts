import * as Comlink from 'comlink';
import { db } from '../data/db';
import { getCachedStats } from '../data/stats-store';
import type { Stats } from '../domain/stats';
import type { StatsWorkerApi } from '../workers/stats-api';
import { onDataEvent } from './data-events';

const REFRESH_DEBOUNCE_MS = 3000;

/** Affiche le cache tout de suite, recalcule dans `stats.worker`, et suit les changements de cellules. */
export class StatsClient {
  stats = $state<Stats | null>(null);
  computing = $state(false);
  failed = $state(false);

  #worker: Worker | null = null;
  #api: Comlink.Remote<StatsWorkerApi> | null = null;
  #stopEvents: (() => void) | null = null;
  #timer: ReturnType<typeof setTimeout> | null = null;

  async open(): Promise<void> {
    this.stats = await getCachedStats(db);
    // new URL(...) est le motif attendu par Vite pour empaqueter un worker (pas un état réactif).
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    this.#worker = new Worker(new URL('../workers/stats.worker.ts', import.meta.url), {
      type: 'module',
    });
    this.#api = Comlink.wrap<StatsWorkerApi>(this.#worker);
    this.#stopEvents = onDataEvent((event) => {
      if (event.type === 'cells-changed' || event.type === 'cells-reset') this.#schedule();
    });
    await this.refresh();
  }

  close(): void {
    this.#stopEvents?.();
    this.#stopEvents = null;
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    this.#worker?.terminate();
    this.#worker = null;
    this.#api = null;
  }

  async refresh(): Promise<void> {
    const api = this.#api;
    if (!api) return;
    this.computing = true;
    this.failed = false;
    try {
      const stats = await api.compute();
      if (this.#api === api) this.stats = stats;
    } catch (error) {
      if (this.#api === api) {
        console.warn('[stats] échec du calcul', error);
        this.failed = true;
      }
    } finally {
      if (this.#api === api) this.computing = false;
    }
  }

  #schedule(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = setTimeout(() => void this.refresh(), REFRESH_DEBOUNCE_MS);
  }
}
