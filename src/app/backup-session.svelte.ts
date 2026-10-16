import * as Comlink from 'comlink';
import { backupFileName, type BackupFailure } from '../data/backup';
import type { ImportWorkerApi, RestoreOutcome } from '../workers/import-api';
import { acquireBusy } from './busy.svelte';
import { APP_VERSION, GIT_SHA } from './build-info';

/** Issue de la dernière opération ; le texte est choisi par l'interface (langue courante). */
export type BackupMessage =
  | { kind: 'exported' }
  | { kind: 'restored'; cellsAdded: number }
  | { kind: 'export-failed' }
  | { kind: 'restore-failed'; failure: BackupFailure | null };

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Sauvegarde et restauration, exécutées dans `import.worker`. */
export class BackupSession {
  working = $state(false);
  message = $state<BackupMessage | null>(null);

  async #withWorker<T>(task: (api: Comlink.Remote<ImportWorkerApi>) => Promise<T>): Promise<T> {
    // new URL(...) est le motif attendu par Vite pour empaqueter un worker (pas un état réactif).
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const worker = new Worker(new URL('../workers/import.worker.ts', import.meta.url), {
      type: 'module',
    });
    try {
      return await task(Comlink.wrap<ImportWorkerApi>(worker));
    } finally {
      worker.terminate();
    }
  }

  async export(includeTracks: boolean): Promise<void> {
    this.working = true;
    this.message = null;
    try {
      const blob = await this.#withWorker((api) =>
        api.exportBackup({ includeTracks, app: `${APP_VERSION}+${GIT_SHA}` }),
      );
      download(blob, backupFileName());
      this.message = { kind: 'exported' };
    } catch (error) {
      console.warn('[backup] échec de la sauvegarde', error);
      this.message = { kind: 'export-failed' };
    } finally {
      this.working = false;
    }
  }

  async restore(file: File): Promise<void> {
    this.working = true;
    this.message = null;
    const release = acquireBusy('restore');
    try {
      const outcome = await this.#withWorker<RestoreOutcome>((api) => api.restoreBackup(file));
      this.message = outcome.ok
        ? { kind: 'restored', cellsAdded: outcome.result.cellsAdded }
        : { kind: 'restore-failed', failure: outcome.failure };
    } catch (error) {
      console.warn('[backup] échec de la restauration', error);
      this.message = { kind: 'restore-failed', failure: null };
    } finally {
      release();
      this.working = false;
    }
  }
}
