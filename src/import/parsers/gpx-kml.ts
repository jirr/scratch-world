import { gpx, kml } from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';
import type { Feature, Geometry } from 'geojson';
import type { TrackPoint } from '../../domain/track-cellizer';
import { BATCH_POINTS, type Parser, type TrackBatch } from '../types';

export const MAX_XML_BYTES = 300 * 1024 * 1024;

export class XmlTooLargeError extends Error {
  constructor() {
    super('Fichier XML trop volumineux');
    this.name = 'XmlTooLargeError';
  }
}

function toTime(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : undefined;
}

function lineToPoints(coords: number[][], times: unknown): TrackPoint[] {
  const points: TrackPoint[] = [];
  const list = Array.isArray(times) ? times : [];
  coords.forEach((c, i) => {
    const [lng, lat] = c;
    if (lng === undefined || lat === undefined) return;
    const t = toTime(list[i]);
    points.push(t === undefined ? { lat, lng } : { lat, lng, t });
  });
  return points;
}

function* featureBatches(feature: Feature<Geometry | null>, index: number): Generator<TrackBatch> {
  const geometry = feature.geometry;
  if (!geometry) return;
  const times = (feature.properties as { coordinateProperties?: { times?: unknown } } | null)
    ?.coordinateProperties?.times;

  if (geometry.type === 'LineString') {
    yield* chunk(`line-${index}`, lineToPoints(geometry.coordinates, times));
  } else if (geometry.type === 'MultiLineString') {
    for (const [s, coords] of geometry.coordinates.entries()) {
      const segTimes = Array.isArray(times) ? times[s] : undefined;
      yield* chunk(`line-${index}-${s}`, lineToPoints(coords, segTimes));
    }
  } else if (geometry.type === 'Point') {
    const time = (feature.properties as { time?: unknown } | null)?.time;
    const [lng, lat] = geometry.coordinates;
    if (lng !== undefined && lat !== undefined) {
      const t = toTime(time);
      yield {
        trackId: `point-${index}`,
        points: [t === undefined ? { lat, lng } : { lat, lng, t }],
      };
    }
  }
}

function* chunk(trackId: string, points: TrackPoint[]): Generator<TrackBatch> {
  for (let i = 0; i < points.length; i += BATCH_POINTS) {
    yield { trackId, points: points.slice(i, i + BATCH_POINTS) };
  }
}

type Convert = (doc: Document) => { features: Feature<Geometry | null>[] };

function makeXmlParser(convert: Convert): Parser {
  return async function* (file, onBytes) {
    if (file.size > MAX_XML_BYTES) throw new XmlTooLargeError();
    const text = await file.text();
    onBytes(file.size / 2);
    const doc = new DOMParser().parseFromString(text, 'text/xml');
    const collection = convert(doc as unknown as Document);
    onBytes(file.size);
    for (const [index, feature] of collection.features.entries()) {
      yield* featureBatches(feature as Feature<Geometry | null>, index);
    }
  };
}

export const parseGpx = makeXmlParser(gpx);
export const parseKml = makeXmlParser(kml);
