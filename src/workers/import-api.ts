import type { BackupFailure, RestoreResult } from '../data/backup';
import type { ImportPhase, ImportResult } from '../import/pipeline';

export interface ImportProgress {
  fileIndex: number;
  fileCount: number;
  fileName: string;
  phase: ImportPhase;
  ratio: number;
}

/** Restauration : résultat, ou raison du refus (une `BackupError` ne traverse pas Comlink intacte). */
export type RestoreOutcome =
  { ok: true; result: RestoreResult } | { ok: false; failure: BackupFailure };

export interface ImportWorkerApi {
  importFiles(
    files: File[],
    onProgress: (progress: ImportProgress) => void,
  ): Promise<ImportResult[]>;
  /** Sauvegarde gzip (cellules, imports, et traces brutes si demandé). */
  exportBackup(options: { includeTracks: boolean; app: string }): Promise<Blob>;
  /** Restauration par fusion ; un fichier refusé donne `ok: false` avec la raison. */
  restoreBackup(file: File): Promise<RestoreOutcome>;
  /** Interrompt l'import en cours ; les cellules déjà écrites restent, sans ligne `imports`. */
  cancel(): void;
}
