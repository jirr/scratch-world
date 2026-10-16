import { gridDisk, gridPathCells, latLngToCell } from 'h3-js';
import { STORAGE_RES } from '../domain/config';
import { haversineM } from '../domain/geo';

/** Centres fictifs (aucune donnée réelle) autour desquels les cellules sont semées. */
export const SYNTHETIC_CENTERS: readonly [number, number][] = [
  [47.2, 2.1],
  [36.5, -101.0],
  [-14.2, -52.3],
  [26.8, 78.4],
  [-27.5, 134.7],
];

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HOP_M = 20_000;

/**
 * Jusqu'à `target` cellules uniques : 60 % de marches aléatoires denses autour des centres,
 * 40 % de polylignes entre centres. Déterministe pour une graine donnée.
 */
export function generateSyntheticCells(target: number, seed = 42): Set<string> {
  const rand = mulberry32(seed);
  const cells = new Set<string>();
  const walkTarget = Math.floor(target * 0.6);

  let guard = 0;
  while (cells.size < walkTarget && guard++ < target * 20) {
    const [lat, lng] = SYNTHETIC_CENTERS[Math.floor(rand() * SYNTHETIC_CENTERS.length)] as [
      number,
      number,
    ];
    let cell = latLngToCell(lat + (rand() - 0.5) * 0.4, lng + (rand() - 0.5) * 0.4, STORAGE_RES);
    const steps = 2000 + Math.floor(rand() * 3000);
    for (let i = 0; i < steps && cells.size < walkTarget; i++) {
      const around = gridDisk(cell, 1);
      for (const c of around) cells.add(c);
      cell = around[1 + Math.floor(rand() * (around.length - 1))] ?? cell;
    }
  }

  guard = 0;
  while (cells.size < target && guard++ < 10_000) {
    const a = SYNTHETIC_CENTERS[Math.floor(rand() * SYNTHETIC_CENTERS.length)] as [number, number];
    const b = SYNTHETIC_CENTERS[Math.floor(rand() * SYNTHETIC_CENTERS.length)] as [number, number];
    if (a === b) continue;
    const jitter = () => (rand() - 0.5) * 0.6;
    const distance = haversineM(a[0], a[1], b[0], b[1]);
    const hops = Math.max(1, Math.ceil(distance / HOP_M));
    const jlat = jitter();
    const jlng = jitter();
    let previous = latLngToCell(a[0] + jlat, a[1] + jlng, STORAGE_RES);
    for (let h = 1; h <= hops && cells.size < target; h++) {
      const f = h / hops;
      const next = latLngToCell(
        a[0] + (b[0] - a[0]) * f + jlat,
        a[1] + (b[1] - a[1]) * f + jlng,
        STORAGE_RES,
      );
      try {
        for (const c of gridPathCells(previous, next)) {
          if (cells.size >= target) break;
          cells.add(c);
        }
      } catch {
        cells.add(next);
      }
      previous = next;
    }
  }
  return cells;
}
