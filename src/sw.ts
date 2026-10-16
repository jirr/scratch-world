/// <reference lib="webworker" />
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';

declare let self: ServiceWorkerGlobalScope;

const DAY_S = 24 * 60 * 60;
const OPENFREEMAP_HOST = 'tiles.openfreemap.org';

const CACHE_TILES = 'sw-map-tiles-v1';
const CACHE_STYLES = 'sw-map-styles-v1';
const CACHE_ASSETS = 'sw-map-assets-v1';
const CACHE_DATA = 'sw-data-v1';
const RUNTIME_CACHES = [CACHE_TILES, CACHE_STYLES, CACHE_ASSETS, CACHE_DATA];

const cacheable = new CacheableResponsePlugin({ statuses: [0, 200] });

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// Tuiles vectorielles : cache d'abord, c'est ce qui permet de revoir les zones déjà visitées hors ligne.
registerRoute(
  ({ url }) => url.pathname.endsWith('.pbf') || url.pathname.endsWith('.mvt'),
  new CacheFirst({
    cacheName: CACHE_TILES,
    plugins: [
      cacheable,
      new ExpirationPlugin({
        maxEntries: 10_000,
        maxAgeSeconds: 90 * DAY_S,
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

// Styles et TileJSON : réseau en tâche de fond, cache immédiat.
registerRoute(
  ({ url }) =>
    url.hostname === OPENFREEMAP_HOST &&
    (url.pathname.startsWith('/styles/') || url.pathname === '/planet'),
  new StaleWhileRevalidate({ cacheName: CACHE_STYLES, plugins: [cacheable] }),
);

// Polices et sprites : quasi immuables.
registerRoute(
  ({ url }) =>
    url.hostname === OPENFREEMAP_HOST &&
    (url.pathname.startsWith('/fonts/') || url.pathname.startsWith('/sprites/')),
  new CacheFirst({
    cacheName: CACHE_ASSETS,
    plugins: [
      cacheable,
      new ExpirationPlugin({
        maxEntries: 500,
        maxAgeSeconds: 365 * DAY_S,
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

// Jeux de données statiques de l'application (même origine).
registerRoute(
  ({ url, sameOrigin }) =>
    sameOrigin && url.pathname.includes('/data/') && url.pathname.endsWith('.json'),
  new CacheFirst({ cacheName: CACHE_DATA, plugins: [cacheable] }),
);

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => !name.startsWith('workbox-precache') && !RUNTIME_CACHES.includes(name))
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});
