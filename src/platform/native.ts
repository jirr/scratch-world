import { Capacitor } from '@capacitor/core';

/** Vrai dans l'application native (Capacitor, Android ou iOS), faux dans le navigateur et la PWA. */
export const isNativeApp = Capacitor.isNativePlatform();
