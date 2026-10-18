import { BEST_FIX_TIMEOUT_MS, GOOD_ACCURACY_M } from '../../domain/config';
import { PositionError, type PositionFix } from './position-source';

/** Démarre l'observation de la position et rend la fonction qui l'arrête. */
export type Watch = (
  onFix: (fix: PositionFix) => void,
  onError: (error: PositionError) => void,
) => () => void;

/**
 * Meilleure position obtenue en quelques secondes. Sur Android, le premier fix est souvent un fix
 * réseau grossier (plusieurs km) avant que le GPS n'accroche : on observe donc la position et on
 * garde la plus précise, en s'arrêtant dès qu'elle est assez bonne (ou au premier refus).
 */
export function bestFix(watch: Watch): Promise<PositionFix> {
  return new Promise((resolve, reject) => {
    let best: PositionFix | null = null;
    let lastError: PositionError | null = null;
    let stop: (() => void) | null = null;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      stop?.();
      if (best) resolve(best);
      else reject(lastError ?? new PositionError('unavailable', 'Aucune position reçue'));
    };
    const timer = setTimeout(finish, BEST_FIX_TIMEOUT_MS);
    stop = watch(
      (fix) => {
        if (!best || fix.accuracy < best.accuracy) best = fix;
        if (fix.accuracy <= GOOD_ACCURACY_M) finish();
      },
      (error) => {
        lastError = error;
        if (error.status === 'denied') finish();
      },
    );
    // Réponse synchrone pendant `watch` : l'arrêt n'était pas encore connu.
    if (finished) stop();
  });
}
