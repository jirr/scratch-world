export interface WakeLock {
  readonly supported: boolean;
  /** Maintient l'écran allumé ; se ré-acquiert au retour au premier plan jusqu'à `disable()`. */
  enable(): Promise<void>;
  disable(): Promise<void>;
}

export function createWakeLock(): WakeLock {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  let sentinel: WakeLockSentinel | null = null;
  let wanted = false;

  async function acquire() {
    if (!supported || sentinel || document.visibilityState !== 'visible') return;
    try {
      sentinel = await navigator.wakeLock.request('screen');
      sentinel.addEventListener('release', () => {
        sentinel = null;
      });
    } catch (error) {
      console.warn('[wake-lock] refusé', error);
    }
  }

  const onVisible = () => {
    if (wanted && document.visibilityState === 'visible') void acquire();
  };

  return {
    supported,
    async enable() {
      if (!supported) return;
      wanted = true;
      document.addEventListener('visibilitychange', onVisible);
      await acquire();
    },
    async disable() {
      wanted = false;
      document.removeEventListener('visibilitychange', onVisible);
      const current = sentinel;
      sentinel = null;
      await current?.release();
    },
  };
}
