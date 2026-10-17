import { latLngToCell } from 'h3-js';
import { describe, expect, it } from 'vitest';
import {
  addBrushCells,
  brushRadiusM,
  MAX_BRUSH_RADIUS_M,
  MIN_BRUSH_RADIUS_M,
  strokePoints,
} from './brush';
import { haversineM } from './geo';

describe('brushRadiusM', () => {
  it('reste dans les bornes, du monde entier au zoom maximal', () => {
    for (const zoom of [0, 1.5, 5, 10, 15, 20, 22]) {
      for (const lat of [0, 48.85, 85, -90]) {
        const radius = brushRadiusM(zoom, lat);
        expect(radius).toBeGreaterThanOrEqual(MIN_BRUSH_RADIUS_M);
        expect(radius).toBeLessThanOrEqual(MAX_BRUSH_RADIUS_M);
      }
    }
  });

  it('diminue quand on zoome et quand on monte en latitude', () => {
    expect(brushRadiusM(9, 0)).toBeGreaterThan(brushRadiusM(10, 0));
    expect(brushRadiusM(9, 0)).toBeGreaterThan(brushRadiusM(9, 60));
  });
});

describe('strokePoints', () => {
  const from = { lng: 2.35, lat: 48.85 };

  it('finit sur le point d’arrivée et espace les points d’au plus un pas (aucun trou)', () => {
    // ~2,4 km pour un pas de 50 m : sous le plafond d'échantillons par segment.
    const to = { lng: 2.38, lat: 48.86 };
    const points = strokePoints(from, to, 50);
    expect(points[points.length - 1]).toEqual(to);
    let previous = from;
    for (const point of points) {
      expect(haversineM(previous.lat, previous.lng, point.lat, point.lng)).toBeLessThanOrEqual(
        50.5,
      );
      previous = point;
    }
  });

  it('donne le seul point d’arrivée pour un segment plus court qu’un pas', () => {
    const to = { lng: 2.35001, lat: 48.85001 };
    expect(strokePoints(from, to, 50)).toEqual([to]);
  });
});

describe('addBrushCells', () => {
  it('dévoile toutes les cellules traversées par un geste rapide', () => {
    const from = { lng: 2.35, lat: 48.85 };
    const to = { lng: 2.39, lat: 48.86 };
    // Dès ~2 arêtes de rayon, la cellule sous n'importe quel point du trait est dévoilée.
    const radius = 300;
    const cells = new Set<string>();
    addBrushCells(cells, [from, ...strokePoints(from, to, radius)], radius);

    // Chaque point du segment, échantillonné finement, est dans une cellule dévoilée.
    for (let i = 0; i <= 400; i++) {
      const t = i / 400;
      const lng = from.lng + (to.lng - from.lng) * t;
      const lat = from.lat + (to.lat - from.lat) * t;
      expect(cells.has(latLngToCell(lat, lng, 10))).toBe(true);
    }
  });

  it('ramène une longitude hors de [-180, 180] (copie du monde) sur la bonne cellule', () => {
    const wrapped = new Set<string>();
    const direct = new Set<string>();
    addBrushCells(wrapped, [{ lng: 2.35 + 360, lat: 48.85 }], MIN_BRUSH_RADIUS_M);
    addBrushCells(direct, [{ lng: 2.35, lat: 48.85 }], MIN_BRUSH_RADIUS_M);
    expect([...wrapped]).toEqual([...direct]);
  });
});
