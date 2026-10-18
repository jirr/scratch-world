import { isNativeApp } from '../platform/native';
import { busy } from './busy.svelte';

const DISMISS_KEY = 'sw:install-dismissed';
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;
const SHOW_DELAY_MS = 2500;

/** Événement non standard de Chromium (Android, desktop) : voir MDN `beforeinstallprompt`. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred = $state<BeforeInstallPromptEvent | null>(null);
let installed = $state(false);
let dismissedAt = $state(Number(localStorage.getItem(DISMISS_KEY) ?? 0));
let ready = $state(false);

/** Déjà installée : application native, ou PWA lancée depuis l'écran d'accueil. */
const standalone =
  isNativeApp ||
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** Safari iOS n'a pas d'événement d'installation : on affiche la marche à suivre. */
const isIos =
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const installState = {
  get isInstalled(): boolean {
    return standalone || installed;
  },
  /** Installation en un clic possible (Chrome, Edge, Android). */
  get canPrompt(): boolean {
    return deferred !== null && !installed;
  },
  get showIosHelp(): boolean {
    return isIos && !standalone && !installed;
  },
  /** La fenêtre d'invitation s'affiche ssi installable, non refusée récemment, et rien d'important en cours. */
  get visible(): boolean {
    const recentlyDismissed = Date.now() - dismissedAt < DISMISS_MS;
    return (
      ready &&
      !standalone &&
      !installed &&
      !recentlyDismissed &&
      (deferred !== null || isIos) &&
      !busy.isBusy
    );
  },
};

export async function promptInstall(): Promise<void> {
  const event = deferred;
  if (!event) return;
  deferred = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === 'dismissed') dismissInstall();
}

export function dismissInstall(): void {
  dismissedAt = Date.now();
  localStorage.setItem(DISMISS_KEY, String(dismissedAt));
}

export function initInstallService(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
  });
  // Laisse l'utilisateur découvrir la carte avant de proposer l'installation.
  setTimeout(() => (ready = true), SHOW_DELAY_MS);
}
