import { expect, test } from '@playwright/test';
import { stubOpenFreeMap } from './support/routes';
import { startSwitchableServer, type SwitchableServer } from './support/switchable-server';

test.describe.configure({ mode: 'serial' });

let server: SwitchableServer;

test.beforeAll(async () => {
  server = await startSwitchableServer();
});

test.beforeEach(async ({ context }) => {
  await stubOpenFreeMap(context);
});

test.beforeEach(async ({ page }) => {
  await page.request.get(new URL('/__switch?to=current', server.url).href);
});

test.afterAll(async () => {
  await server.close();
});

test('une nouvelle version déployée déclenche le toast puis la mise à jour', async ({ page }) => {
  await page.goto(server.url);

  const readVersion = async () => {
    await page.getByRole('button', { name: 'Menu' }).click();
    const text = await page.getByTestId('app-version').innerText();
    await page.keyboard.press('Escape');
    return text;
  };

  const version = await readVersion();
  expect(version).toMatch(/^v\d+\.\d+\.\d+ \(.+\)$/);
  expect(version).not.toContain('e2e-next');

  // Le service worker doit être actif et contrôler la page avant de simuler un déploiement.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  const switched = await page.request.get(new URL('/__switch?to=next', server.url).href);
  expect(switched.ok()).toBe(true);

  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

  const toast = page.getByTestId('update-toast');
  await expect(toast).toContainText('Nouvelle version disponible', { timeout: 15_000 });

  await toast.getByRole('button', { name: 'Mettre à jour' }).click();

  await expect.poll(readVersion, { timeout: 15_000 }).toContain('e2e-next');
  await expect(page.getByTestId('update-toast')).toHaveCount(0);
});

test.describe('pendant un enregistrement', () => {
  test.use({
    permissions: ['geolocation'],
    geolocation: { latitude: 48.85, longitude: 2.35, accuracy: 10 },
  });

  test('le toast de mise à jour attend la fin de l’enregistrement', async ({ page }) => {
    await page.goto(server.url);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await page.getByRole('button', { name: /Enregistrer/ }).click();
    await page.getByRole('button', { name: 'Démarrer' }).click();
    await expect(page.getByTestId('recording-indicator')).toBeVisible();

    await page.request.get(new URL('/__switch?to=next', server.url).href);
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

    // La nouvelle version est bien en attente, mais le toast reste caché.
    await page.waitForFunction(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return Boolean(reg?.waiting);
    });
    await page.waitForTimeout(3000);
    await expect(page.getByTestId('update-toast')).toHaveCount(0);

    await page.getByRole('button', { name: /Arrêter/ }).click();
    await expect(page.getByTestId('update-toast')).toBeVisible();
  });
});
