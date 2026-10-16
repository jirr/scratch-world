import * as Comlink from 'comlink';
import type { ImportResult } from '../import/pipeline';
import type { ImportProgress, ImportWorkerApi } from '../workers/import-api';
import { acquireBusy } from './busy.svelte';

/** Orchestre un import dans `import.worker` et expose l'état à l'interface. */
export class ImportSession {
  state = $state<'idle' | 'running' | 'done'>('idle');
  progress = $state<ImportProgress | null>(null);
  results = $state<ImportResult[]>([]);
  /** Le worker a échoué : aucun résultat par fichier n'est disponible. */
  failed = $state(false);

  #api: Comlink.Remote<ImportWorkerApi> | null = null;

  async run(files: File[]): Promise<void> {
    if (this.state === 'running' || files.length === 0) return;
    this.state = 'running';
    this.progress = null;
    this.results = [];
    this.failed = false;
    const release = acquireBusy('import');
    // new URL(...) est le motif attendu par Vite pour empaqueter un worker (pas un état réactif).
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const worker = new Worker(new URL('../workers/import.worker.ts', import.meta.url), {
      type: 'module',
    });
    this.#api = Comlink.wrap<ImportWorkerApi>(worker);
    try {
      this.results = await this.#api.importFiles(
        files,
        Comlink.proxy((progress: ImportProgress) => {
          this.progress = progress;
        }),
      );
    } catch (error) {
      console.warn('[import] échec du worker', error);
      this.failed = true;
    } finally {
      worker.terminate();
      this.#api = null;
      release();
      this.state = 'done';
    }
  }

  cancel(): void {
    void this.#api?.cancel();
  }

  reset(): void {
    if (this.state === 'done') {
      this.state = 'idle';
      this.results = [];
      this.failed = false;
    }
  }
}
