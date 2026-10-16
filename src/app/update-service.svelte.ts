import { registerSW } from 'virtual:pwa-register';
import { busy } from './busy.svelte';

const CHECK_INTERVAL_MS = 3_600_000;

export type UpdateCheckResult = 'found' | 'up-to-date' | 'unavailable';

let needRefresh = $state(false);
let dismissed = $state(false);
let registration: ServiceWorkerRegistration | undefined;
let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;

/** Le toast est visible ssi une version attend, n'a pas été écartée et rien d'important n'est en cours. */
export const updateState = {
  get visible(): boolean {
    return needRefresh && !dismissed && !busy.isBusy;
  },
};

export async function checkForUpdate(): Promise<UpdateCheckResult> {
  if (!registration || !navigator.onLine) return 'unavailable';
  if (!registration.installing) {
    try {
      await registration.update();
    } catch (error) {
      console.warn('[update] échec de la vérification', error);
      return 'unavailable';
    }
  }
  return needRefresh || registration.installing || registration.waiting ? 'found' : 'up-to-date';
}

/**
 * Active la version en attente puis recharge dès qu'elle contrôle la page.
 * On écoute `controllerchange` nous-mêmes : workbox-window ne recharge que si la page était déjà
 * contrôlée au chargement, ce qui n'est pas le cas pendant la toute première session.
 */
export async function applyUpdate(): Promise<void> {
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), {
    once: true,
  });
  await updateSW?.();
}

export function dismissUpdate(): void {
  dismissed = true;
}

export function initUpdateService(): void {
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      needRefresh = true;
      dismissed = false;
    },
    onRegisteredSW(_url, reg) {
      registration = reg;
    },
    onRegisterError(error) {
      console.error('[update] enregistrement du service worker impossible', error);
    },
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkForUpdate();
  });
  setInterval(() => void checkForUpdate(), CHECK_INTERVAL_MS);
}
