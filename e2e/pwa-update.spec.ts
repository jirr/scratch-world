import { expect, test } from '@playwright/test';
import { startSwitchableServer, type SwitchableServer } from './support/switchable-server';

let server: SwitchableServer;

test.beforeAll(async () => {
  server = await startSwitchableServer();
});

test.afterAll(async () => {
  await server.close();
});

test('une nouvelle version déployée déclenche le toast puis la mise à jour', async ({ page }) => {
  await page.goto(server.url);

  const version = page.getByTestId('app-version');
  await expect(version).toContainText(/^v\d+\.\d+\.\d+ \(.+\)$/);
  await expect(version).not.toContainText('e2e-next');

  // Le service worker doit être actif et contrôler la page avant de simuler un déploiement.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  const switched = await page.request.get(new URL('/__switch?to=next', server.url).href);
  expect(switched.ok()).toBe(true);

  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

  const toast = page.getByTestId('update-toast');
  await expect(toast).toContainText('Nouvelle version disponible', { timeout: 15_000 });

  await toast.getByRole('button', { name: 'Mettre à jour' }).click();

  await expect(page.getByTestId('app-version')).toContainText('e2e-next', { timeout: 15_000 });
  await expect(page.getByTestId('update-toast')).toHaveCount(0);
});
