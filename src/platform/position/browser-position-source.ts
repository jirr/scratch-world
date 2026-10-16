import {
  PositionError,
  type PositionFix,
  type PositionSource,
  type PositionStatus,
} from './position-source';

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

  getCurrent(): Promise<PositionFix> {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new PositionError('unavailable', 'Géolocalisation non prise en charge'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve(toFix(position)),
        (error) => reject(toError(error)),
        OPTIONS,
      );
    });
  }
}
