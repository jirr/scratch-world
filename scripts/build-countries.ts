/**
 * Télécharge Natural Earth 1:50m (domaine public, v5.1.2) et écrit public/data/countries-50m.v1.json :
 * code, nom français, surface (km²) et géométrie arrondie à 4 décimales.
 * Usage : pnpm build:countries
 */
import area from '@turf/area';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Feature, MultiPolygon, Polygon } from 'geojson';

const URL_NE =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson';

interface NeProps {
  ISO_A2_EH: string;
  ADM0_A3: string;
  NAME_FR: string | null;
  NAME: string;
}

const round = (n: number) => Math.round(n * 1e4) / 1e4;
const roundCoords = (c: unknown): unknown =>
  Array.isArray(c) && typeof c[0] === 'number'
    ? c.slice(0, 2).map((v) => round(v as number))
    : (c as unknown[]).map(roundCoords);

const response = await fetch(URL_NE);
if (!response.ok) throw new Error(`Téléchargement impossible : ${response.status}`);
const collection = (await response.json()) as {
  features: Feature<Polygon | MultiPolygon, NeProps>[];
};

const countries = collection.features
  .map((feature) => {
    const p = feature.properties;
    const code = p.ISO_A2_EH && p.ISO_A2_EH !== '-99' ? p.ISO_A2_EH : p.ADM0_A3;
    const geometry = {
      type: feature.geometry.type,
      coordinates: roundCoords(feature.geometry.coordinates),
    };
    return {
      code,
      a3: p.ADM0_A3,
      name: p.NAME_FR || p.NAME,
      areaKm2: Math.round(area(feature) / 1e6),
      geometry,
    };
  })
  .sort((a, b) => b.areaKm2 - a.areaKm2);

// Quelques territoires partagent le code ISO d'un pays (ex. Ashmore et Cartier avec l'Australie) :
// le plus grand garde le code ISO, les autres prennent leur code ADM0_A3.
const used = new Set<string>();
for (const c of countries) {
  if (used.has(c.code)) c.code = c.a3;
  if (used.has(c.code)) throw new Error(`Code pays en double : ${c.code}`);
  used.add(c.code);
}

mkdirSync('public/data', { recursive: true });
const file = 'public/data/countries-50m.v1.json';
writeFileSync(
  file,
  JSON.stringify({
    dataset: 'ne50m-5.1.2-v1',
    countries: countries.map(({ a3: _a3, ...country }) => country),
  }),
);
const total = countries.reduce((sum, c) => sum + c.areaKm2, 0);
console.log(`${file} : ${countries.length} pays, ${Math.round(total / 1e6)} M km²`);
