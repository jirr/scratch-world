import * as Comlink from 'comlink';
import { backupFileName } from '../data/backup';
import type { ImportWorkerApi } from '../workers/import-api';
import { acquireBusy } from './busy.svelte';
import { APP_VERSION, GIT_SHA } from './build-info';

export interface BackupMessage {
  kind: 'success' | 'error';
  text: string;
}

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
      this.message = { kind: 'success', text: 'Sauvegarde téléchargée' };
    } catch (error) {
      this.message = {
        kind: 'error',
        text: error instanceof Error ? error.message : 'Sauvegarde impossible',
      };
    } finally {
      this.working = false;
    }
  }

  async restore(file: File): Promise<void> {
    this.working = true;
    this.message = null;
    const release = acquireBusy('restore');
    try {
      const r = await this.#withWorker((api) => api.restoreBackup(file));
      const cells = `${r.cellsAdded} ${r.cellsAdded > 1 ? 'cellules ajoutées' : 'cellule ajoutée'}`;
      this.message = { kind: 'success', text: `Restauration terminée : ${cells}` };
    } catch (error) {
      this.message = {
        kind: 'error',
        text: error instanceof Error ? error.message : 'Restauration impossible',
      };
    } finally {
      release();
      this.working = false;
    }
  }
}
