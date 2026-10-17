import { expect, test } from '@playwright/test';
import { importFile } from './support/menu';
import { luminanceAt } from './support/pixels';
import { stubOpenFreeMap } from './support/routes';

const WALK = 'tests/fixtures/import/walk.gpx';

test.beforeEach(async ({ context, page }) => {
  await stubOpenFreeMap(context);
  // Caméra centrée sur le premier segment de walk.gpx (coordonnées fictives).
  await page.addInitScript(() => {
    if (!localStorage.getItem('sw:camera')) {
      localStorage.setItem('sw:camera', JSON.stringify({ lng: 2.1, lat: 47.2027, zoom: 15 }));
    }
  });
});

test('importer un GPX affiche le récapitulatif et dévoile la carte ; le réimport est détecté', async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 700 });
  await page.goto('');
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();

  // Avant l'import : brouillard au centre de la carte.
  const centerX = 400;
  const centerY = (700 - 76) / 2;
  await page.waitForTimeout(1500);
  const before = await luminanceAt(page, centerX, centerY);

  await importFile(page, WALK);

  const results = page.getByTestId('import-results');
  await expect(results).toContainText('walk.gpx');
  await expect(results).toContainText(/\d+ cellules ajoutées/);
  const added = Number(/(\d+) cellules ajoutées/.exec(await results.innerText())?.[1]);
  expect(added).toBeGreaterThan(10);

  await page.getByRole('button', { name: 'Fermer' }).click();
  await expect
    .poll(() => luminanceAt(page, centerX, centerY), { timeout: 15_000 })
    .toBeGreaterThan(before + 60);

  await importFile(page, WALK);
  await expect(page.getByTestId('import-results')).toContainText('Déjà importé');
});

test('un format inconnu est refusé avec un message clair', async ({ page }) => {
  await page.goto('');
  await importFile(page, 'tests/fixtures/import/unknown.json');
  await expect(page.getByTestId('import-results')).toContainText('Format non reconnu');
});
