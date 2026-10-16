import {
  PositionError,
  type PositionFix,
  type PositionSource,
  type PositionStatus,
} from './position-source';

import { BEST_FIX_TIMEOUT_MS, GOOD_ACCURACY_M } from '../../domain/config';

const OPTIONS: PositionOptions = { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 };

function toFix(position: GeolocationPosition): PositionFix {
  const { latitude, longitude, accuracy, speed } = position.coords;
  return { lat: latitude, lng: longitude, accuracy, timestamp: position.timestamp, speed };
}

function toError(error: GeolocationPositionError): PositionError {
  return new PositionError(
    error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable',
    error.message,
  );
}

/** Seul point d'entrée vers `navigator.geolocation`. */
export class BrowserPositionSource implements PositionSource {
  readonly kind = 'browser';
  readonly supportsBackground = false;
  #watchId: number | null = null;

  async start(
    onFix: (fix: PositionFix) => void,
    onStatus: (status: PositionStatus, message?: string) => void,
  ): Promise<void> {
    if (!('geolocation' in navigator)) {
      onStatus('unavailable', 'Géolocalisation non prise en charge');
      return;
    }
    await this.stop();
    onStatus('starting');
    this.#watchId = navigator.geolocation.watchPosition(
      (position) => {
        onStatus('active');
        onFix(toFix(position));
      },
      (error) => {
        const { status, message } = toError(error);
        onStatus(status, message);
      },
      OPTIONS,
    );
  }

  async stop(): Promise<void> {
    if (this.#watchId === null) return;
    navigator.geolocation.clearWatch(this.#watchId);
    this.#watchId = null;
  }

  /**
   * Meilleure position obtenue en quelques secondes. Sur Android, le premier fix est souvent un fix
   * réseau grossier (plusieurs km) avant que le GPS n'accroche : on observe donc la position et on
   * garde la plus précise, en s'arrêtant dès qu'elle est assez bonne.
   */
  getCurrent(): Promise<PositionFix> {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new PositionError('unavailable', 'Géolocalisation non prise en charge'));
        return;
      }
      let best: PositionFix | null = null;
      let lastError: PositionError | null = null;
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        navigator.geolocation.clearWatch(watchId);
        clearTimeout(timer);
        if (best) resolve(best);
        else reject(lastError ?? new PositionError('unavailable', 'Aucune position reçue'));
      };
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const fix = toFix(position);
          if (!best || fix.accuracy < best.accuracy) best = fix;
          if (fix.accuracy <= GOOD_ACCURACY_M) finish();
        },
        (error) => {
          lastError = toError(error);
          if (error.code === error.PERMISSION_DENIED) finish();
        },
        OPTIONS,
      );
      const timer = setTimeout(finish, BEST_FIX_TIMEOUT_MS);
    });
  }
}
