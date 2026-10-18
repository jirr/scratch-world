import { isNativeApp } from '../native';
import { BrowserPositionSource } from './browser-position-source';
import { CapacitorPositionSource, type TrackingNotice } from './capacitor-position-source';
import type { PositionSource } from './position-source';

export * from './position-source';
export type { TrackingNotice };

/**
 * Unique point de choix de la source : dans l'application native, le plugin qui suit la position
 * écran verrouillé ; sinon le navigateur, qui s'arrête dès que la page est masquée. `notice` donne
 * le texte de la notification Android, relu à chaque démarrage (langue courante).
 */
export function createPositionSource(notice: () => TrackingNotice): PositionSource {
  return isNativeApp ? new CapacitorPositionSource(notice) : new BrowserPositionSource();
}
