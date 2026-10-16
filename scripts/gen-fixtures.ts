/**
 * Génère les fichiers d'import fictifs de tests/fixtures/import (coordonnées synthétiques).
 * Usage : pnpm gen:fixtures [--large]   (--large : perf/records-large.json, ~200 Mo, non commité)
 */
import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import { once } from 'node:events';

const OUT = 'tests/fixtures/import';
const LAT0 = 47.2;
const LNG0 = 2.1;
/** ≈ 10 m vers le nord. */
const STEP = 0.00009;
const BASE = Date.parse('2020-01-01T08:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString();

mkdirSync(OUT, { recursive: true });

const gpxHeader =
  '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="scratch-world-fixtures" xmlns="http://www.topografix.com/GPX/1/1">\n';

function trkseg(lat0: number, lng0: number, n: number, startMs: number, withTime = true): string {
  const points = Array.from({ length: n }, (_, i) => {
    const time = withTime ? `<time>${iso(startMs + i * 10_000)}</time>` : '';
    return `<trkpt lat="${(lat0 + i * STEP).toFixed(5)}" lon="${lng0.toFixed(5)}">${time}</trkpt>`;
  });
  return `<trkseg>\n${points.join('\n')}\n</trkseg>`;
}

writeFileSync(
  `${OUT}/walk.gpx`,
  `${gpxHeader}<trk><name>Balade fictive</name>\n${trkseg(LAT0, LNG0, 60, BASE)}\n${trkseg(LAT0 + 0.01, LNG0 + 0.001, 60, BASE + 20 * 60_000)}\n</trk>\n</gpx>\n`,
);
writeFileSync(
  `${OUT}/multi-track.gpx`,
  `${gpxHeader}<wpt lat="47.3" lon="2.2"><time>${iso(BASE)}</time><name>Point isolé</name></wpt>\n<trk><name>A</name>${trkseg(LAT0, LNG0, 30, BASE)}</trk>\n<trk><name>B</name>${trkseg(LAT0 + 0.02, LNG0, 30, BASE + 3600_000)}</trk>\n</gpx>\n`,
);
writeFileSync(
  `${OUT}/no-time.gpx`,
  `${gpxHeader}<trk><name>Sans heure</name>${trkseg(LAT0, LNG0, 60, 0, false)}</trk>\n</gpx>\n`,
);

const kmlHeader =
  '<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">\n<Document>\n';
const lineCoords = Array.from(
  { length: 50 },
  (_, i) => `${LNG0},${(LAT0 + i * STEP).toFixed(5)},0`,
).join(' ');
writeFileSync(
  `${OUT}/route.kml`,
  `${kmlHeader}<Placemark><name>Parcours fictif</name><LineString><coordinates>${lineCoords}</coordinates></LineString></Placemark>\n</Document>\n</kml>\n`,
);
const when = Array.from({ length: 40 }, (_, i) => `<when>${iso(BASE + i * 10_000)}</when>`).join(
  '\n',
);
const coord = Array.from(
  { length: 40 },
  (_, i) => `<gx:coord>${LNG0} ${(LAT0 + i * STEP).toFixed(5)} 0</gx:coord>`,
).join('\n');
writeFileSync(
  `${OUT}/gx-track.kml`,
  `${kmlHeader}<Placemark><name>Trace horodatée</name><gx:Track>\n${when}\n${coord}\n</gx:Track></Placemark>\n</Document>\n</kml>\n`,
);

// Records.json : variantes timestamp / timestampMs, point imprécis, débordement E7 non signé.
const e7 = (deg: number) => Math.round(deg * 1e7);
const unsigned = (v: number) => (v < 0 ? v + 2 ** 32 : v);
const locations: Record<string, unknown>[] = [];
for (let i = 0; i < 50; i++) {
  locations.push({
    latitudeE7: e7(LAT0 + i * STEP),
    longitudeE7: e7(LNG0),
    accuracy: 12,
    timestamp: iso(BASE + i * 10_000),
  });
}
for (let i = 50; i < 80; i++) {
  locations.push({
    latitudeE7: e7(LAT0 + i * STEP),
    longitudeE7: e7(LNG0),
    accuracy: 15,
    timestampMs: String(BASE + i * 10_000),
  });
}
locations.push({
  latitudeE7: e7(LAT0 + 80 * STEP),
  longitudeE7: e7(LNG0),
  accuracy: 400,
  timestamp: iso(BASE + 80 * 10_000),
});
for (let i = 0; i < 10; i++) {
  locations.push({
    latitudeE7: unsigned(e7(-33.9 + i * STEP)),
    longitudeE7: unsigned(e7(-3.5)),
    accuracy: 10,
    timestamp: iso(BASE + 3 * 3600_000 + i * 10_000),
  });
}
writeFileSync(`${OUT}/records-sample.json`, JSON.stringify({ locations }, null, 1));

// Timeline Android : objet avec semanticSegments (+ rawSignals ignoré).
const ll = (lat: number, lng: number) => `${lat.toFixed(5)}°, ${lng.toFixed(5)}°`;
writeFileSync(
  `${OUT}/timeline-android.json`,
  JSON.stringify(
    {
      semanticSegments: [
        {
          startTime: iso(BASE),
          endTime: iso(BASE + 600_000),
          timelinePath: Array.from({ length: 10 }, (_, i) => ({
            point: ll(LAT0 + i * 10 * STEP, LNG0),
            time: iso(BASE + i * 60_000),
          })),
        },
        {
          startTime: iso(BASE + 3600_000),
          endTime: iso(BASE + 7200_000),
          visit: { topCandidate: { placeLocation: { latLng: ll(47.3, 2.2) } } },
        },
        {
          startTime: iso(BASE + 7200_000),
          endTime: iso(BASE + 7500_000),
          activity: { start: { latLng: ll(47.4, 2.3) }, end: { latLng: ll(47.4081, 2.3) } },
        },
      ],
      rawSignals: [{ position: { LatLng: ll(10, 10) } }],
    },
    null,
    1,
  ),
);
// Timeline iOS : tableau en racine, « geo:lat,lng », décalages en minutes stockés en chaînes.
const geo = (lat: number, lng: number) => `geo:${lat.toFixed(5)},${lng.toFixed(5)}`;
writeFileSync(
  `${OUT}/timeline-ios.json`,
  JSON.stringify(
    [
      {
        startTime: iso(BASE),
        endTime: iso(BASE + 600_000),
        timelinePath: Array.from({ length: 10 }, (_, i) => ({
          point: geo(LAT0 + i * 10 * STEP, LNG0),
          durationMinutesOffsetFromStartTime: String(i),
        })),
      },
      {
        startTime: iso(BASE + 3600_000),
        endTime: iso(BASE + 7200_000),
        visit: { topCandidate: { placeLocation: geo(47.3, 2.2) } },
      },
      {
        startTime: iso(BASE + 7200_000),
        endTime: iso(BASE + 7500_000),
        activity: { start: geo(47.4, 2.3), end: geo(47.4081, 2.3) },
      },
    ],
    null,
    1,
  ),
);
writeFileSync(`${OUT}/unknown.json`, JSON.stringify({ hello: 'world', items: [1, 2, 3] }, null, 1));

if (process.argv.includes('--large')) {
  mkdirSync('perf', { recursive: true });
  const target = 200 * 1024 * 1024;
  const stream = createWriteStream('perf/records-large.json');
  let written = 0;
  let seed = 7;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  let lat = LAT0;
  let lng = LNG0;
  let t = BASE;
  const write = async (chunk: string) => {
    written += chunk.length;
    if (!stream.write(chunk)) await once(stream, 'drain');
  };
  await write('{"locations":[');
  let first = true;
  while (written < target) {
    lat += (rand() - 0.5) * 0.00014;
    lng += (rand() - 0.5) * 0.00014;
    t += 5000;
    const rec = `{"latitudeE7":${e7(lat)},"longitudeE7":${e7(lng)},"accuracy":12,"timestamp":"${iso(t)}"}`;
    await write(first ? rec : `,${rec}`);
    first = false;
  }
  await write(']}');
  stream.end();
  await once(stream, 'finish');
  console.log(`perf/records-large.json : ${(written / 1024 / 1024).toFixed(0)} Mo`);
}
