import type { ImportFormat } from '../data/db';

export const DETECT_BYTES = 64 * 1024;

export type DetectedFormat = ImportFormat | 'unsupported';

/** Détecte le format d'après le début du fichier (BOM et espaces ignorés). */
export function detectFormat(head: string): DetectedFormat {
  const text = head.replace(/^\uFEFF/, '').trimStart();
  if (text.startsWith('<')) {
    if (text.includes('<gpx')) return 'gpx';
    if (text.includes('<kml')) return 'kml';
    return 'unsupported';
  }
  if (text.startsWith('{')) {
    const firstKey = /^\{\s*"([^"\\]*)"\s*:/.exec(text)?.[1];
    if (firstKey === 'locations') return 'google-records';
    if (firstKey === 'semanticSegments') return 'google-timeline-android';
    // Autres clés en tête (ex. rawSignals) : on cherche la clé de niveau 1 attendue.
    if (/"semanticSegments"\s*:\s*\[/.test(text)) return 'google-timeline-android';
    if (/"locations"\s*:\s*\[/.test(text)) return 'google-records';
    return 'unsupported';
  }
  if (text.startsWith('[')) {
    const hasStart = /"startTime"\s*:\s*"/.test(text);
    const hasKind = /"(visit|activity|timelinePath)"\s*:/.test(text);
    return hasStart && hasKind ? 'google-timeline-ios' : 'unsupported';
  }
  return 'unsupported';
}
