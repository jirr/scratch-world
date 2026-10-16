import { BrowserPositionSource } from './browser-position-source';
import type { PositionSource } from './position-source';

export * from './position-source';

/** Unique point à modifier pour brancher une autre source (Capacitor). */
export function createPositionSource(): PositionSource {
  return new BrowserPositionSource();
}
