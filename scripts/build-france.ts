/**
 * Télécharge les régions et départements de France métropolitaine (gregoiredavid/france-geojson,
 * versions simplifiées, données IGN/OpenStreetMap sous licence ouverte) et écrit
 * public/data/france-admin.v1.json : code, nom, surface (km²) et géométrie arrondie à 4 décimales.
 * Usage : pnpm build:france
 */
import area from '@turf/area';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Feature, MultiPolygon, Polygon } from 'geojson';

const BASE = 'https://raw.githubusercontent.com/gregoiredavid/france-geojson/master';
const URL_REGIONS = `${BASE}/regions-version-simplifiee.geojson`;
const URL_DEPARTMENTS = `${BASE}/departements-version-simplifiee.geojson`;

interface FranceProps {
  code: string;
  nom: string;
}

const round = (n: number) => Math.round(n * 1e4) / 1e4;
const roundCoords = (c: unknown): unknown =>
  Array.isArray(c) && typeof c[0] === 'number'
    ? c.slice(0, 2).map((v) => round(v as number))
    : (c as unknown[]).map(roundCoords);

async function load(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Téléchargement impossible (${url}) : ${response.status}`);
  const collection = (await response.json()) as {
    features: Feature<Polygon | MultiPolygon, FranceProps>[];
  };
  const zones = collection.features
    .map((feature) => ({
      code: feature.properties.code,
      name: feature.properties.nom,
      areaKm2: Math.round(area(feature) / 1e6),
      geometry: {
        type: feature.geometry.type,
        coordinates: roundCoords(feature.geometry.coordinates),
      },
    }))
    .sort((a, b) => b.areaKm2 - a.areaKm2);
  const codes = new Set(zones.map((z) => z.code));
  if (codes.size !== zones.length) throw new Error(`Code en double dans ${url}`);
  return zones;
}

const [regions, departments] = await Promise.all([load(URL_REGIONS), load(URL_DEPARTMENTS)]);

mkdirSync('public/data', { recursive: true });
const file = 'public/data/france-admin.v1.json';
writeFileSync(
  file,
  JSON.stringify({ dataset: 'france-geojson-simplifiee-v1', regions, departments }),
);
console.log(`${file} : ${regions.length} régions, ${departments.length} départements`);
