import { readFileSync } from 'node:fs';
import type { BrowserContext } from '@playwright/test';

const style = readFileSync(new URL('../fixtures/style.json', import.meta.url), 'utf8');

/** Sert un style local à la place d'OpenFreeMap et coupe les autres requêtes vers ce service. */
export async function stubOpenFreeMap(context: BrowserContext): Promise<void> {
  await context.route('https://tiles.openfreemap.org/**', (route) => {
    if (new URL(route.request().url()).pathname.startsWith('/styles/')) {
      return route.fulfill({ contentType: 'application/json', body: style });
    }
    return route.abort();
  });
}
