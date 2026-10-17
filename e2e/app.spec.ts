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

    // « Me localiser » dévoile un disque de 100 m (quelques cellules) sans déplacement.
    await page.getByRole('button', { name: 'Stats' }).click();
    await expect(page.getByTestId('stats-cells')).toHaveText(/^[1-7]$/, {
      timeout: 15_000,
    });
  });

  test('à l’ouverture, la position est actualisée et l’écran recentré dessus', async ({ page }) => {
    // Dernière vue enregistrée loin de la position (Atlantique) : elle ne doit pas être conservée.
    await page.addInitScript(() =>
      localStorage.setItem('sw:camera', JSON.stringify({ lng: -30, lat: 20, zoom: 3 })),
    );
    await page.goto('');
    await expect(page.locator('.maplibregl-marker')).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(
        async () => {
          const camera = await page.evaluate(() =>
            JSON.parse(localStorage.getItem('sw:camera') ?? 'null'),
          );
          return camera && Math.hypot(camera.lng - 2.2945, camera.lat - 48.8584) < 0.01;
        },
        { timeout: 15_000 },
      )
      .toBe(true);
  });
});

test.describe('localisation imprécise', () => {
  test.use({
    permissions: ['geolocation'],
    geolocation: { latitude: 48.8584, longitude: 2.2945, accuracy: 3000 },
  });

  test('« Me localiser » affiche le message avec le lien vers l’aide, sans pop-up automatique', async ({
    page,
    context,
  }) => {
    await page.goto('');
    await page.getByRole('button', { name: 'Me localiser' }).click();
    // L'enregistrement automatique observe déjà la position : on la fait bouger pour réveiller Chromium.
    await context.setGeolocation({ latitude: 48.8585, longitude: 2.2945, accuracy: 3000 });
    await expect(
      page.getByRole('status').filter({ hasText: 'Position trop imprécise (±3000 m)' }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('approximate-notice')).toBeHidden();

    await page.getByRole('button', { name: /comment activer la localisation précise/ }).click();
    await expect(page.getByTestId('approximate-notice')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Activer la localisation précise' }),
    ).toBeVisible();
  });

  test('l’enregistrement affiche le même message tant qu’aucune cellule n’est dévoilée', async ({
    page,
  }) => {
    await page.goto('');
    // La localisation automatique à l'ouverture attend jusqu'à ~12 s une position plus précise.
    await expect(
      page.getByRole('status').filter({ hasText: 'Position trop imprécise' }),
    ).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId('approximate-notice')).toBeHidden();
  });
});
