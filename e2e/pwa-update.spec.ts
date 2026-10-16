import { expect, test } from '@playwright/test';
import { stubOpenFreeMap } from './support/routes';
import { startSwitchableServer, type SwitchableServer } from './support/switchable-server';

let server: SwitchableServer;

test.beforeAll(async () => {
  server = await startSwitchableServer();
});

test.beforeEach(async ({ context }) => {
  await stubOpenFreeMap(context);
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
