import type { CapacitorConfig } from '@capacitor/cli';

/** Applications natives Android et iOS : le build web (`dist/`, base `/`) dans une WebView. */
const config: CapacitorConfig = {
  appId: 'io.github.jirr.scratchworld',
  appName: 'Scratch World',
  webDir: 'dist',
  backgroundColor: '#161b26',
  android: {
    // Exigé par @capgo/background-geolocation : avec le pont récent, la WebView ne reçoit plus
    // les positions après 5 minutes en arrière-plan.
    useLegacyBridge: true,
  },
};

export default config;
