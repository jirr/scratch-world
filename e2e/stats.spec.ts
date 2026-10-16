import { expect, test } from '@playwright/test';
import { stubOpenFreeMap } from './support/routes';

test.beforeEach(async ({ context }) => {
  await stubOpenFreeMap(context);
});

test('les statistiques se vident, puis listent le pays après un import', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Stats' }).click();
  await expect(page.getByTestId('stats-panel')).toContainText('Rien de dévoilé');
  await page.getByRole('button', { name: 'Fermer' }).click();

  await page.getByRole('button', { name: 'Importer' }).click();
  await page.getByTestId('import-input').setInputFiles('tests/fixtures/import/walk.gpx');
  await expect(page.getByTestId('import-results')).toContainText(/cellules ajoutées/);
  await page.getByRole('button', { name: 'Fermer' }).click();

  await page.getByRole('button', { name: 'Stats' }).click();
  const countries = page.getByTestId('stats-countries');
  await expect(countries).toContainText('France', { timeout: 20_000 });
  await expect(page.getByTestId('stats-cells')).not.toHaveText('0');
  await expect(page.getByTestId('stats-world')).toContainText('%');
});
