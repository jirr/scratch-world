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

test('le calque de brouillard s’initialise (overlay debug)', async ({ page }) => {
  await page.goto('?debug=1');
  await expect(page.getByTestId('fog-debug')).toContainText(/res \d+/);
  await expect(page.getByTestId('fog-debug')).toContainText('cells 0');
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

    // « Me localiser » dévoile une petite zone (19 cellules) sans déplacement.
    await page.getByRole('button', { name: 'Stats' }).click();
    await expect(page.getByTestId('stats-cells')).toHaveText('19', { timeout: 15_000 });
  });
});

test.describe('localisation approximative', () => {
  test.use({
    permissions: ['geolocation'],
    geolocation: { latitude: 48.8584, longitude: 2.2945, accuracy: 5000 },
  });

  test('« Me localiser » demande de passer en position précise', async ({ page }) => {
    await page.goto('');
    await page.getByRole('button', { name: 'Me localiser' }).click();
    await expect(page.getByTestId('approximate-notice')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Localisation trop approximative' }),
    ).toBeVisible();
  });

  test('l’enregistrement affiche aussi la demande, après plusieurs positions grossières', async ({
    page,
    context,
  }) => {
    await page.goto('');
    await page.getByRole('button', { name: /Enregistrer/ }).click();
    await page.getByRole('button', { name: 'Démarrer' }).click();
    for (let i = 1; i <= 3; i++) {
      await context.setGeolocation({
        latitude: 48.8584 + i * 0.001,
        longitude: 2.2945,
        accuracy: 5000,
      });
      await page.waitForTimeout(300);
    }
    await expect(page.getByTestId('approximate-notice')).toBeVisible({ timeout: 10_000 });
  });
});
