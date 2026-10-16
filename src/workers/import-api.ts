import type { RestoreResult } from '../data/backup';
import type { ImportPhase, ImportResult } from '../import/pipeline';

export interface ImportProgress {
  fileIndex: number;
  fileCount: number;
  fileName: string;
  phase: ImportPhase;
  ratio: number;
}

export interface ImportWorkerApi {
  importFiles(
    files: File[],
    onProgress: (progress: ImportProgress) => void,
  ): Promise<ImportResult[]>;
  /** Sauvegarde gzip (cellules, imports, et traces brutes si demandé). */
  exportBackup(options: { includeTracks: boolean; app: string }): Promise<Blob>;
  /** Restauration par fusion ; lève `BackupError` (message lisible) si le fichier est refusé. */
  restoreBackup(file: File): Promise<RestoreResult>;
  /** Interrompt l'import en cours ; les cellules déjà écrites restent, sans ligne `imports`. */
  cancel(): void;
}
