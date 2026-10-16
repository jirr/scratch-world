import * as Comlink from 'comlink';
import { onDataEvent } from '../app/data-events';
import { loadAllChunks, loadChunks } from '../data/cell-store';
import { ScratchDb } from '../data/db';
import {
  bboxVisible,
  bucketBBox,
  bucketCellOf,
  bucketKey,
  buildBucket,
  WORLD_BUCKET,
} from '../domain/fog-buckets';
import type { FogBucket, FogRequest, FogResponse, FogWorkerApi } from './fog-api';

const db = new ScratchDb();
const MAX_RES = 10;
const BUCKET_CACHE_MAX = 400;

let chunks = new Map<string, Uint16Array>();
let cellCount = 0;
let counter = 0;
const versions = new Map<string, number>();
const built = new Map<string, FogBucket>();
const indexes = new Map<number, Map<string, string[]>>();
let onInvalidate: ((keys: string[]) => void) | null = null;

function countCells(): number {
  let n = 0;
  for (const pos of chunks.values()) n += pos.length;
  return n;
}

/** Chunks regroupés par bucket pour une résolution d'affichage. */
function indexFor(res: number): Map<string, string[]> {
  let index = indexes.get(res);
  if (!index) {
    index = new Map();
    for (const key of chunks.keys()) {
      const cell = bucketCellOf(res, key);
      const list = index.get(cell);
      if (list) list.push(key);
      else index.set(cell, [key]);
    }
    indexes.set(res, index);
  }
  return index;
}

function invalidate(chunkKeys: Iterable<string>): void {
  const keys = new Set<string>();
  for (const chunkKey of chunkKeys) {
    for (let res = 0; res <= MAX_RES; res++) keys.add(bucketKey(res, bucketCellOf(res, chunkKey)));
  }
  for (const key of keys) {
    versions.set(key, ++counter);
    built.delete(key);
  }
  indexes.clear();
  onInvalidate?.([...keys]);
}

function bucketFor(res: number, cell: string, key: string, keys: string[]): FogBucket {
  let bucket = built.get(key);
  if (!bucket) {
    const { origin, instances } = buildBucket(
      res,
      cell,
      keys.map((k) => [k, chunks.get(k) as Uint16Array]),
    );
    bucket = { key, version: versions.get(key) ?? 0, origin, instances };
    built.set(key, bucket);
    if (built.size > BUCKET_CACHE_MAX) built.delete(built.keys().next().value as string);
  }
  return bucket;
}

const api: FogWorkerApi = {
  async init(callback) {
    onInvalidate = callback;
    chunks = await loadAllChunks(db);
    cellCount = countCells();
    onDataEvent((event) => {
      void (async () => {
        if (event.type === 'cells-reset') {
          const old = [...chunks.keys()];
          chunks = new Map();
          cellCount = 0;
          invalidate(old);
        } else if (event.type === 'cells-changed') {
          for (const [key, pos] of await loadChunks(db, event.chunks)) chunks.set(key, pos);
          cellCount = countCells();
          invalidate(event.chunks);
        }
      })();
    });
    return { cellCount, chunkCount: chunks.size };
  },

  async getBuckets(request: FogRequest) {
    const { res, bbox, have } = request;
    const visible: FogResponse['visible'] = [];
    const buckets: FogBucket[] = [];
    for (const [cell, keys] of indexFor(res)) {
      if (cell !== WORLD_BUCKET && !bboxVisible(bucketBBox(cell), bbox)) continue;
      const key = bucketKey(res, cell);
      const version = versions.get(key) ?? 0;
      visible.push({ key, version });
      if (have[key] === version) continue;
      buckets.push(bucketFor(res, cell, key, keys));
    }
    // Les tableaux restent en cache ici : on transfère des copies.
    const copies = buckets.map((b) => ({ ...b, instances: b.instances.slice() }));
    const response: FogResponse = { visible, buckets: copies, cellCount };
    return Comlink.transfer(
      response,
      copies.map((b) => b.instances.buffer),
    );
  },
};

Comlink.expose(api);
