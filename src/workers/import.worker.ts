import * as Comlink from 'comlink';
import { ScratchDb } from '../data/db';
import { getSetting } from '../data/settings-store';
import { importFile, type ImportResult } from '../import/pipeline';
import type { ImportWorkerApi } from './import-api';

const db = new ScratchDb();
let cancelled = false;

const api: ImportWorkerApi = {
  async importFiles(files, onProgress) {
    cancelled = false;
    const accuracyThresholdM = await getSetting(db, 'accuracyThresholdM');
    const keepRawTracks = await getSetting(db, 'keepRawTracks');
    const results: ImportResult[] = [];
    for (const [fileIndex, file] of files.entries()) {
      if (cancelled) break;
      results.push(
        await importFile(db, file, {
          accuracyThresholdM,
          keepRawTracks,
          isCancelled: () => cancelled,
          onProgress: (phase, ratio) =>
            onProgress({ fileIndex, fileCount: files.length, fileName: file.name, phase, ratio }),
        }),
      );
    }
    return results;
  },
  cancel() {
    cancelled = true;
  },
};

Comlink.expose(api);
