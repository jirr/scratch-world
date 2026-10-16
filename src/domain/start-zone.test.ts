import { latLngToCell } from 'h3-js';
import { describe, expect, it } from 'vitest';
import { cellToLatLng } from 'h3-js';
import { haversineM } from './geo';
import { startZoneCells } from './start-zone';

describe('startZoneCells', () => {
  const lat = 48.85;
  const lng = 2.35;

  it('contient la cellule de départ et ≈ π·R² / aire d’une cellule (~230 cellules pour 1 km)', () => {
    const zone = startZoneCells(lat, lng);
    expect(zone).toContain(latLngToCell(lat, lng, 10));
    expect(new Set(zone).size).toBe(zone.length);
    expect(zone.length).toBeGreaterThan(190);
    expect(zone.length).toBeLessThan(260);
  });

  it('est un disque : toutes les cellules sont dans le rayon, et le bord est atteint dans toutes les directions', () => {
    const zone = startZoneCells(lat, lng);
    const distances = zone.map((cell) => {
      const [cLat, cLng] = cellToLatLng(cell);
      return haversineM(lat, lng, cLat, cLng);
    });
    expect(Math.max(...distances)).toBeLessThanOrEqual(1000);
    expect(Math.max(...distances)).toBeGreaterThan(900);

    // Écart de rayon entre les 4 directions cardinales : un hexagone serait bien plus irrégulier.
    const reach = (angleDeg: number) => {
      const a = (angleDeg * Math.PI) / 180;
      return Math.max(
        ...zone
          .map((cell) => cellToLatLng(cell))
          .filter(([cLat, cLng]) => {
            const bearing = Math.atan2((cLng - lng) * Math.cos((lat * Math.PI) / 180), cLat - lat);
            return Math.abs(Math.atan2(Math.sin(bearing - a), Math.cos(bearing - a))) < 0.15;
          })
          .map(([cLat, cLng]) => haversineM(lat, lng, cLat, cLng)),
      );
    };
    const reaches = [0, 45, 90, 135, 180, 225, 270, 315].map(reach);
    expect(Math.max(...reaches) - Math.min(...reaches)).toBeLessThan(160);
  });

  it('se réduit à la seule cellule pour un rayon nul', () => {
    expect(startZoneCells(lat, lng, 0)).toEqual([latLngToCell(lat, lng, 10)]);
  });
});
