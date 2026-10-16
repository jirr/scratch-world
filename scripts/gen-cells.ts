/**
 * Génère une sauvegarde synthétique (format « scratch-world-backup » v1) dans perf/.
 * Usage : pnpm gen:cells [nombre-de-cellules]   (défaut 500000)
 */
import { cellArea } from 'h3-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { decodePos, groupByChunk } from '../src/domain/cells';
import { CHUNK_RES, STORAGE_RES } from '../src/domain/config';
import { generateSyntheticCells } from '../src/dev/synthetic-cells';

const count = Number(process.argv[2] ?? 500_000);
const chunks = [...groupByChunk(generateSyntheticCells(count))].map(([key, pos]) => {
  let areaKm2 = 0;
  for (const p of pos) areaKm2 += cellArea(decodePos(key, p), 'km2');
  const bytes = Buffer.from(pos.buffer, pos.byteOffset, pos.byteLength);
  return { key, pos: bytes.toString('base64'), areaKm2 };
});

const backup = {
  format: 'scratch-world-backup',
  version: 1,
  app: 'synthetic',
  createdAt: new Date().toISOString(),
  storageRes: STORAGE_RES,
  chunkRes: CHUNK_RES,
  chunks,
  imports: [],
  tracks: [],
};

mkdirSync('perf', { recursive: true });
const file = `perf/synthetic-${count}.json.gz`;
writeFileSync(file, gzipSync(JSON.stringify(backup)));
console.log(`${file} : ${chunks.length} chunks`);
