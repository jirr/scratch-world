import { registerPlugin } from '@capacitor/core';
import type {
  BackgroundGeolocationPlugin,
  CallbackError,
  Location,
  StartOptions,
} from '@capgo/background-geolocation';
import { bestFix } from './best-fix';
import {
  PositionError,
  type PositionFix,
  type PositionPermission,
  type PositionSource,
  type PositionStatus,
} from './position-source';

/** Texte de la notification Android affichée tant que l'enregistrement suit la position. */
export interface TrackingNotice {
  title: string;
  message: string;
}

/** Arrêté, au premier plan seulement (« Me localiser »), ou aussi en arrière-plan (enregistrement). */
type Mode = 'off' | 'foreground' | 'background';

interface Listener {
  onFix(fix: PositionFix): void;
  onError(error: PositionError): void;
}

/**
 * Position fournie par le plugin natif `@capgo/background-geolocation` : contrairement au
 * navigateur, elle continue écran verrouillé (service de premier plan avec notification sur
 * Android, mode d'arrière-plan « location » sur iOS).
 *
 * Le plugin n'a qu'un flux de positions : l'enregistrement (`start`) et « Me localiser »
 * (`getCurrent`) le partagent. Il ne suit la position en arrière-plan que pendant
 * l'enregistrement, et s'arrête dès que plus personne ne l'écoute.
 */
export class CapacitorPositionSource implements PositionSource {
  readonly kind = 'capacitor';
  readonly supportsBackground = true;
  readonly #plugin: BackgroundGeolocationPlugin;
  readonly #notice: () => TrackingNotice;
  #tracking: Listener | null = null;
  readonly #oneShots = new Set<Listener>();
  #mode: Mode = 'off';
  /** Incrémenté à chaque (re)démarrage : les rappels d'une session arrêtée sont ignorés. */
  #session = 0;
  /** Erreur (hors refus) sans position reçue depuis : relance au retour au premier plan. */
  #failed = false;
  /** Démarrages et arrêts du plugin, exécutés l'un après l'autre. */
  #queue: Promise<void> = Promise.resolve();

  constructor(
    notice: () => TrackingNotice,
    plugin = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation'),
  ) {
    this.#notice = notice;
    this.#plugin = plugin;
    // Android refuse de lancer le suivi depuis l'arrière-plan, et une erreur peut l'avoir coupé :
    // on retente quand l'application revient au premier plan.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || !this.#failed) return;
      this.#failed = false;
      void this.#apply(true);
    });
  }

  readonly openSettings = () => this.#plugin.openSettings();

  async start(
    onFix: (fix: PositionFix) => void,
    onStatus: (status: PositionStatus, message?: string) => void,
  ): Promise<void> {
    this.#tracking = {
      onFix: (fix) => {
        onStatus('active');
        onFix(fix);
      },
      onError: (error) => onStatus(error.status, error.message),
    };
    onStatus('starting');
    await this.#apply();
  }

  async stop(): Promise<void> {
    if (!this.#tracking) return;
    this.#tracking = null;
    await this.#apply();
  }

  getCurrent(): Promise<PositionFix> {
    return bestFix((onFix, onError) => {
      const listener: Listener = { onFix, onError };
      this.#oneShots.add(listener);
      void this.#apply();
      return () => {
        this.#oneShots.delete(listener);
        void this.#apply();
      };
    });
  }

  async permission(): Promise<PositionPermission> {
    try {
      const { location } = await this.#plugin.checkPermissions();
      return location === 'granted' || location === 'denied' ? location : 'prompt';
    } catch {
      return 'prompt';
    }
  }

  /** Aligne le plugin sur ses abonnés ; `restart` relance même si le mode voulu est inchangé. */
  #apply(restart = false): Promise<void> {
    this.#queue = this.#queue
      .then(async () => {
        const wanted: Mode = this.#tracking
          ? 'background'
          : this.#oneShots.size > 0
            ? 'foreground'
            : 'off';
        if (wanted === this.#mode && !restart) return;
        const session = ++this.#session;
        // Toujours arrêter d'abord : le plugin refuse un second démarrage (ALREADY_STARTED), y
        // compris une session restée active côté natif après un rechargement de la page.
        await this.#plugin.stop();
        this.#mode = 'off';
        if (wanted === 'off') return;
        const { title, message } = this.#notice();
        const options: StartOptions = {
          requestPermissions: true,
          stale: false,
          backgroundTitle: title,
        };
        // Le message active le suivi en arrière-plan (et la demande « Toujours » sur iOS).
        if (wanted === 'background') options.backgroundMessage = message;
        await this.#plugin.start(options, (location, error) =>
          this.#receive(session, location, error),
        );
        this.#mode = wanted;
      })
      .catch((error: unknown) => this.#fail(new PositionError('unavailable', String(error))));
    return this.#queue;
  }

  #receive(session: number, location?: Location, error?: CallbackError): void {
    if (session !== this.#session) return;
    if (error) {
      const status = error.code === 'NOT_AUTHORIZED' ? 'denied' : 'unavailable';
      this.#fail(new PositionError(status, error.message));
      return;
    }
    if (!location) return;
    const { latitude, longitude, accuracy, time, speed } = location;
    // Précision absente (Android) ou invalide (iOS : négative) : position inutilisable.
    if (typeof accuracy !== 'number' || !(accuracy >= 0)) return;
    this.#failed = false;
    const fix: PositionFix = {
      lat: latitude,
      lng: longitude,
      accuracy,
      timestamp: time ?? Date.now(),
      speed,
    };
    this.#dispatch((listener) => listener.onFix(fix));
  }

  #fail(error: PositionError): void {
    // Un refus arrête l'enregistrement (Recorder) ; les autres erreurs sont retentées plus tard.
    if (error.status !== 'denied') this.#failed = true;
    this.#dispatch((listener) => listener.onError(error));
  }

  /** Prévient chaque abonné, sur une copie : un abonné peut se désabonner pendant l'appel. */
  #dispatch(notify: (listener: Listener) => void): void {
    const listeners = [...this.#oneShots];
    if (this.#tracking) listeners.push(this.#tracking);
    for (const listener of listeners) notify(listener);
  }
}
