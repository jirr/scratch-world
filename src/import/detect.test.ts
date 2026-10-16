import { describe, expect, it } from 'vitest';
import { detectFormat } from './detect';
import { fixtureText } from './test-support';

const head = (name: string) => fixtureText(name).slice(0, 65536);

describe('detectFormat', () => {
  it.each([
    ['walk.gpx', 'gpx'],
    ['multi-track.gpx', 'gpx'],
    ['route.kml', 'kml'],
    ['gx-track.kml', 'kml'],
    ['records-sample.json', 'google-records'],
    ['timeline-android.json', 'google-timeline-android'],
    ['timeline-ios.json', 'google-timeline-ios'],
    ['unknown.json', 'unsupported'],
  ])('%s → %s', (name, format) => {
    expect(detectFormat(head(name))).toBe(format);
  });

  it('ignore BOM et espaces initiaux', () => {
    expect(detectFormat('\uFEFF  \n<gpx></gpx>')).toBe('gpx');
    expect(detectFormat('\uFEFF {"locations": []}')).toBe('google-records');
  });

  it('reconnaît semanticSegments même s’il n’est pas la première clé', () => {
    expect(detectFormat('{"rawSignals": [], "semanticSegments": [{}]}')).toBe(
      'google-timeline-android',
    );
  });

  it('refuse le reste', () => {
    expect(detectFormat('')).toBe('unsupported');
    expect(detectFormat('<html></html>')).toBe('unsupported');
    expect(detectFormat('[1,2,3]')).toBe('unsupported');
    expect(detectFormat('texte')).toBe('unsupported');
  });
});
