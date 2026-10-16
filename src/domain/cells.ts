import { cellToChildPos, cellToParent, childPosToCell } from 'h3-js';
import { CHUNK_RES, STORAGE_RES } from './config';

/** Clé du chunk (cellule H3 de résolution `CHUNK_RES`) qui contient la cellule. */
export function chunkKeyOf(cell: string): string {
  return cellToParent(cell, CHUNK_RES);
}

/** Position de la cellule parmi les enfants de son chunk. */
export function encodePos(cell: string): number {
  return cellToChildPos(cell, CHUNK_RES);
}

export function decodePos(chunkKey: string, pos: number): string {
  return childPosToCell(pos, chunkKey, STORAGE_RES);
}

/** Fusionne deux tableaux triés sans doublon ; `added` = éléments de `b` absents de `a`. */
export function mergeSortedUnique(
  a: Uint16Array,
  b: Uint16Array,
): { merged: Uint16Array; added: Uint16Array } {
  const merged = new Uint16Array(a.length + b.length);
  const added = new Uint16Array(b.length);
  let i = 0;
  let j = 0;
  let m = 0;
  let n = 0;
  while (i < a.length || j < b.length) {
    const x = i < a.length ? (a[i] as number) : Infinity;
    const y = j < b.length ? (b[j] as number) : Infinity;
    if (x < y) {
      merged[m++] = x;
      i++;
    } else if (y < x) {
      merged[m++] = y;
      added[n++] = y;
      j++;
    } else {
      merged[m++] = x;
      i++;
      j++;
    }
  }
  return { merged: merged.slice(0, m), added: added.slice(0, n) };
}

/** Regroupe des cellules par chunk : positions triées et uniques. */
export function groupByChunk(cells: Iterable<string>): Map<string, Uint16Array> {
  const groups = new Map<string, number[]>();
  for (const cell of cells) {
    const key = chunkKeyOf(cell);
    const list = groups.get(key);
    if (list) list.push(encodePos(cell));
    else groups.set(key, [encodePos(cell)]);
  }
  const result = new Map<string, Uint16Array>();
  for (const [key, list] of groups) {
    const sorted = Uint16Array.from(list).sort();
    let unique = 0;
    for (let i = 0; i < sorted.length; i++) {
      if (i === 0 || sorted[i] !== sorted[i - 1]) sorted[unique++] = sorted[i] as number;
    }
    result.set(key, sorted.slice(0, unique));
  }
  return result;
}
