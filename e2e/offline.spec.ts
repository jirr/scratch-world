import { expect, test } from '@playwright/test';
import { stubOpenFreeMap } from './support/routes';

test.beforeEach(async ({ context }) => {
  await stubOpenFreeMap(context);
});

test('le shell se charge hors ligne après une première visite', async ({ page, context }) => {
  await page.goto('');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  // Le precache est rempli à l'installation ; on attend sa présence avant de couper le réseau.
  await page.waitForFunction(async () =>
    (await caches.keys()).some((k) => k.startsWith('workbox-precache')),
  );

  await context.setOffline(true);
  await page.reload();

  await expect(page.getByTestId('bottom-bar')).toBeVisible();
  await expect(page.getByTestId('map')).toBeVisible();
});
