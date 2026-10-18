import {
  PositionError,
  type PositionFix,
  type PositionPermission,
  type PositionSource,
  type PositionStatus,
} from './position-source';
import { bestFix } from './best-fix';

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
  /** Le navigateur coupe la géolocalisation dès que la page est masquée (arrière-plan, verrouillage). */
  readonly supportsBackground = false;
  readonly openSettings = null;
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

  getCurrent(): Promise<PositionFix> {
    if (!('geolocation' in navigator)) {
      return Promise.reject(
        new PositionError('unavailable', 'Géolocalisation non prise en charge'),
      );
    }
    return bestFix((onFix, onError) => {
      const watchId = navigator.geolocation.watchPosition(
        (position) => onFix(toFix(position)),
        (error) => onError(toError(error)),
        OPTIONS,
      );
      return () => navigator.geolocation.clearWatch(watchId);
    });
  }

  async permission(): Promise<PositionPermission> {
    try {
      return (await navigator.permissions?.query({ name: 'geolocation' }))?.state ?? 'prompt';
    } catch {
      return 'prompt';
    }
  }
}
