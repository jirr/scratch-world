import type { TrackPoint } from '../domain/track-cellizer';

/** Lot de points d'une même trace (même `trackId` = continuation de la trace). */
export interface TrackBatch {
  trackId: string;
  points: TrackPoint[];
}

/** Un parseur lit le fichier en flux et produit des lots ; `onBytes` rapporte la progression. */
export type Parser = (file: Blob, onBytes: (read: number) => void) => AsyncGenerator<TrackBatch>;

export const BATCH_POINTS = 5000;
