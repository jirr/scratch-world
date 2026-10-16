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
  /** Interrompt l'import en cours ; les cellules déjà écrites restent, sans ligne `imports`. */
  cancel(): void;
}
