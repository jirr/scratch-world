import { areNeighborCells, cellToLatLng, latLngToCell } from 'h3-js';
import { describe, expect, it } from 'vitest';
import { MAX_GAP_M, MAX_GAP_NO_TIME_M, MAX_GAP_S } from './config';
import { haversineM } from './geo';
import { TrackCellizer } from './track-cellizer';

const cfg = { maxGapM: MAX_GAP_M, maxGapS: MAX_GAP_S, maxGapNoTimeM: MAX_GAP_NO_TIME_M };
const LAT = 45;
/** Écart de longitude (degrés) correspondant à `m` mètres vers l'est à 45° N. */
const lngFor = (m: number) => m / (111_320 * Math.cos((LAT * Math.PI) / 180));

describe('haversineM', () => {
  it('mesure ~111 km pour un degré de latitude', () => {
    expect(haversineM(0, 0, 1, 0)).toBeGreaterThan(110_000);
    expect(haversineM(0, 0, 1, 0)).toBeLessThan(112_000);
  });
});

describe('TrackCellizer', () => {
  it('relie un segment de 2 km parcouru en 60 s par des cellules contiguës', () => {
    const z = new TrackCellizer(cfg);
    z.push({ lat: LAT, lng: 5, t: 0 });
    const cells = z.push({ lat: LAT, lng: 5 + lngFor(2000), t: 60_000 });
    expect(cells.length).toBeGreaterThan(12);
    for (let i = 1; i < cells.length; i++) {
      expect(areNeighborCells(cells[i - 1] as string, cells[i] as string)).toBe(true);
    }
  });

  it('n’interpole pas un trou de 6 km', () => {
    const z = new TrackCellizer(cfg);
    z.push({ lat: LAT, lng: 5, t: 0 });
    const cells = z.push({ lat: LAT, lng: 5 + lngFor(6000), t: 60_000 });
    expect(cells).toEqual([latLngToCell(LAT, 5 + lngFor(6000), 10)]);
  });

  it('n’interpole pas 2 km séparés de 20 minutes', () => {
    const z = new TrackCellizer(cfg);
    z.push({ lat: LAT, lng: 5, t: 0 });
    expect(z.push({ lat: LAT, lng: 5 + lngFor(2000), t: 20 * 60_000 })).toHaveLength(1);
  });

  it('sans horodatage : interpole 800 m mais pas 1 200 m', () => {
    const short = new TrackCellizer(cfg);
    short.push({ lat: LAT, lng: 5 });
    expect(short.push({ lat: LAT, lng: 5 + lngFor(800) }).length).toBeGreaterThan(1);

    const long = new TrackCellizer(cfg);
    long.push({ lat: LAT, lng: 5 });
    expect(long.push({ lat: LAT, lng: 5 + lngFor(1200) })).toHaveLength(1);
  });

  it('repart de zéro après reset()', () => {
    const z = new TrackCellizer(cfg);
    z.push({ lat: LAT, lng: 5, t: 0 });
    z.reset();
    expect(z.push({ lat: LAT, lng: 5 + lngFor(500), t: 1000 })).toHaveLength(1);
  });

  it('couvre un segment qui traverse un pentagone sans lever d’erreur', () => {
    const z = new TrackCellizer(cfg);
    const [lat, lng] = cellToLatLng('85080003fffffff');
    z.push({ lat: lat - 0.01, lng: lng - 0.01, t: 0 });
    expect(z.push({ lat: lat + 0.01, lng: lng + 0.01, t: 60_000 }).length).toBeGreaterThan(1);
  });
});
