export interface PositionFix {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
  speed: number | null;
}

export type PositionStatus = 'idle' | 'starting' | 'active' | 'denied' | 'unavailable' | 'error';

/** Autorisation de position, lue sans jamais afficher de demande. */
export type PositionPermission = 'granted' | 'prompt' | 'denied';

export interface PositionSource {
  /** 'browser' ou 'capacitor'. */
  readonly kind: string;
  /** Vrai si la source continue de fournir des positions application en arrière-plan. */
  readonly supportsBackground: boolean;
  /** Ouvre les réglages de l'application (natif) ; null dans le navigateur, qui n'en a pas. */
  readonly openSettings: (() => Promise<void>) | null;
  start(
    onFix: (fix: PositionFix) => void,
    onStatus: (status: PositionStatus, message?: string) => void,
  ): Promise<void>;
  stop(): Promise<void>;
  getCurrent(): Promise<PositionFix>;
  permission(): Promise<PositionPermission>;
}

/** Erreur de position normalisée : `status` dit pourquoi (refus, indisponible…). */
export class PositionError extends Error {
  constructor(
    readonly status: Exclude<PositionStatus, 'idle' | 'starting' | 'active'>,
    message: string,
  ) {
    super(message);
    this.name = 'PositionError';
  }
}
