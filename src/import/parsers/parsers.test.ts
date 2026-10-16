import { describe, expect, it } from 'vitest';
import { allPoints, collect, fixture } from '../test-support';
import { parseGoogleRecords, recordToPoint } from './google-records';
import { parseGoogleTimeline } from './google-timeline';
import { MAX_XML_BYTES, parseGpx, parseKml, XmlTooLargeError } from './gpx-kml';
import { parseLatLng } from './lat-lng';

const BASE = Date.parse('2020-01-01T08:00:00Z');

describe('parseLatLng', () => {
  it('accepte les trois formes et rejette le reste', () => {
    expect(parseLatLng('45.46°, 9.19°')).toEqual({ lat: 45.46, lng: 9.19 });
    expect(parseLatLng('geo:45.46,9.19')).toEqual({ lat: 45.46, lng: 9.19 });
    expect(parseLatLng({ latLng: '-33.9°, -3.5°' })).toEqual({ lat: -33.9, lng: -3.5 });
    expect(parseLatLng('45.46°, abc°')).toBeNull();
    expect(parseLatLng('45.46')).toBeNull();
    expect(parseLatLng(12)).toBeNull();
    expect(parseLatLng(null)).toBeNull();
  });
});

describe('GPX', () => {
  it('walk.gpx : deux segments horodatés', async () => {
    const batches = await collect(parseGpx, fixture('walk.gpx'));
    const points = allPoints(batches);
    expect(points).toHaveLength(120);
    expect(new Set(batches.map((b) => b.trackId)).size).toBe(2);
    expect(points[0]).toEqual({ lat: 47.2, lng: 2.1, t: BASE });
    expect(points[119]?.lng).toBeCloseTo(2.101, 6);
    expect(points[119]?.lat).toBeCloseTo(47.2 + 0.01 + 59 * 0.00009, 5);
    expect(points[119]?.t).toBe(BASE + 20 * 60_000 + 59 * 10_000);
  });

  it('multi-track.gpx : deux traces et un point isolé', async () => {
    const batches = await collect(parseGpx, fixture('multi-track.gpx'));
    expect(allPoints(batches)).toHaveLength(61);
    expect(batches.filter((b) => b.points.length === 1)).toHaveLength(1);
  });

  it('no-time.gpx : points sans horodatage', async () => {
    const points = allPoints(await collect(parseGpx, fixture('no-time.gpx')));
    expect(points).toHaveLength(60);
    expect(points.every((p) => p.t === undefined)).toBe(true);
  });

  it('refuse un fichier XML trop volumineux', async () => {
    const huge = { size: MAX_XML_BYTES + 1 } as Blob;
    await expect(collect(parseGpx, huge)).rejects.toBeInstanceOf(XmlTooLargeError);
  });
});

describe('KML', () => {
  it('route.kml : LineString sans horodatage', async () => {
    const points = allPoints(await collect(parseKml, fixture('route.kml')));
    expect(points).toHaveLength(50);
    expect(points[0]).toEqual({ lat: 47.2, lng: 2.1 });
  });

  it('gx-track.kml : gx:Track horodaté', async () => {
    const points = allPoints(await collect(parseKml, fixture('gx-track.kml')));
    expect(points).toHaveLength(40);
    expect(points[0]?.t).toBe(BASE);
    expect(points[39]?.t).toBe(BASE + 39 * 10_000);
  });
});

describe('Google Records.json', () => {
  it('lit les variantes timestamp / timestampMs et corrige le débordement E7', async () => {
    const points = allPoints(await collect(parseGoogleRecords, fixture('records-sample.json')));
    expect(points).toHaveLength(91);
    expect(points[0]).toEqual({ lat: 47.2, lng: 2.1, t: BASE, acc: 12 });
    expect(points[50]?.t).toBe(BASE + 50 * 10_000);
    expect(points[80]?.acc).toBe(400);
    const south = points[81];
    expect(south?.lat).toBeCloseTo(-33.9, 5);
    expect(south?.lng).toBeCloseTo(-3.5, 5);
  });

  it('recordToPoint ignore un enregistrement sans coordonnées', () => {
    expect(recordToPoint({ foo: 1 })).toBeNull();
    expect(recordToPoint({ latitudeE7: 472000000, longitudeE7: 21000000 })).toEqual({
      lat: 47.2,
      lng: 2.1,
    });
  });
});

describe('Google Timeline', () => {
  it.each(['timeline-android.json', 'timeline-ios.json'])(
    '%s : trace, visite et activité',
    async (name) => {
      const batches = await collect(parseGoogleTimeline, fixture(name));
      const path = batches.find((b) => b.trackId.startsWith('path-'));
      expect(path?.points).toHaveLength(10);
      expect(path?.points[0]).toEqual({ lat: 47.2, lng: 2.1, t: BASE });
      expect(path?.points[9]?.t).toBe(BASE + 9 * 60_000);
      const visit = batches.find((b) => b.trackId.startsWith('visit-'));
      expect(visit?.points).toEqual([{ lat: 47.3, lng: 2.2, t: BASE + 3600_000 }]);
      const ends = batches.filter((b) => b.trackId.startsWith('activity-'));
      expect(ends).toHaveLength(2);
      expect(ends[1]?.points[0]?.lat).toBeCloseTo(47.4081, 5);
      expect(batches).toHaveLength(4);
    },
  );

  it('ignore rawSignals sur Android', async () => {
    const points = allPoints(await collect(parseGoogleTimeline, fixture('timeline-android.json')));
    expect(points.some((p) => p.lat === 10)).toBe(false);
  });
});
