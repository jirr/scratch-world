import { expect, test } from '@playwright/test';
import { stubOpenFreeMap } from './support/routes';

test.beforeEach(async ({ context }) => {
  await stubOpenFreeMap(context);
});

test('la carte est affichée', async ({ page }) => {
  await page.goto('');
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  await expect(page.getByTestId('bottom-bar')).toBeVisible();
});

test.describe('géolocalisation refusée', () => {
  test.use({ permissions: [] });

  test('affiche le message explicatif', async ({ page }) => {
    await page.goto('');
    await page.getByRole('button', { name: 'Me localiser' }).click();
    await expect(page.getByTestId('permission-notice')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Position refusée' })).toBeVisible();
  });
});

test.describe('géolocalisation accordée', () => {
  test.use({
    permissions: ['geolocation'],
    geolocation: { latitude: 48.8584, longitude: 2.2945, accuracy: 10 },
  });

  test('affiche le marqueur de position', async ({ page }) => {
    await page.goto('');
    await page.getByRole('button', { name: 'Me localiser' }).click();
    await expect(page.locator('.maplibregl-marker')).toBeVisible();
  });
});
