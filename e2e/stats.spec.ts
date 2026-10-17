import { expect, test } from '@playwright/test';
import { importFile } from './support/menu';
import { stubOpenFreeMap } from './support/routes';

test.beforeEach(async ({ context }) => {
  await stubOpenFreeMap(context);
});

test('les statistiques se vident, puis listent pays, région et département après un import', async ({
  page,
}) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Stats' }).click();
  await expect(page.getByTestId('stats-panel')).toContainText('Rien de dévoilé');
  await page.getByRole('button', { name: 'Fermer' }).click();

  await importFile(page, 'tests/fixtures/import/walk.gpx');
  await expect(page.getByTestId('import-results')).toContainText(/cellules ajoutées/);
  await page.getByRole('button', { name: 'Fermer' }).click();

  await page.getByRole('button', { name: 'Stats' }).click();
  // Le monde est déplié par défaut ; les autres niveaux sont repliés.
  await expect(page.getByTestId('stats-world-section')).toHaveJSProperty('open', true);
  await expect(page.getByTestId('stats-cells')).not.toHaveText('0', { timeout: 20_000 });
  await expect(page.getByTestId('stats-world')).toContainText('%');
  for (const id of ['countries', 'regions', 'departments']) {
    await expect(page.getByTestId(`stats-${id}-section`)).toHaveJSProperty('open', false);
  }

  // La trace de la fixture (47,2 °N ; 2,1 °E) est dans le Cher, en Centre-Val de Loire, en France.
  const expected = [
    ['countries', 'France'],
    ['regions', 'Centre-Val de Loire'],
    ['departments', 'Cher'],
  ] as const;
  for (const [id, name] of expected) {
    const section = page.getByTestId(`stats-${id}-section`);
    await section.locator('summary').click();
    await expect(section).toHaveJSProperty('open', true);
    const zones = page.getByTestId(`stats-${id}`);
    await expect(zones).toContainText(name, { timeout: 20_000 });
    const bar = zones.getByRole('progressbar', { name });
    await expect(bar).toBeVisible();
    await expect(bar).toHaveAttribute('aria-valuenow', /^\d+(\.\d+)?$/);
    await expect(zones.getByRole('listitem').filter({ hasText: name })).toContainText('%');
  }
});
