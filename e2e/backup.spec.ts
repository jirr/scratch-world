import { expect, test } from '@playwright/test';
import { stubOpenFreeMap } from './support/routes';

test.beforeEach(async ({ context }) => {
  await stubOpenFreeMap(context);
});

test('sauvegarder, tout effacer, restaurer : même nombre de cellules', async ({
  page,
}, testInfo) => {
  await page.goto('');

  await page.getByRole('button', { name: 'Importer' }).click();
  await page.getByTestId('import-input').setInputFiles('tests/fixtures/import/walk.gpx');
  await expect(page.getByTestId('import-results')).toContainText(/cellules ajoutées/);
  await page.getByRole('button', { name: 'Fermer' }).click();

  const readCells = async () => {
    await page.getByRole('button', { name: 'Stats' }).click();
    const cells = page.getByTestId('stats-cells');
    await expect(cells).toBeVisible();
    const text = await cells.innerText();
    await page.getByRole('button', { name: 'Fermer' }).click();
    return text;
  };
  const before = await readCells();
  expect(Number(before.replace(/\s/g, ''))).toBeGreaterThan(10);

  // Sauvegarde.
  await page.getByRole('button', { name: 'Menu' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Sauvegarder' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^scratch-world-\d{4}-\d{2}-\d{2}\.json\.gz$/);
  const file = testInfo.outputPath('backup.json.gz');
  await download.saveAs(file);

  // Effacement : le focus initial est sur « Annuler », jamais sur l'action destructive.
  await page.getByRole('button', { name: 'Tout effacer' }).click();
  await expect(page.getByRole('button', { name: 'Annuler' })).toBeFocused();
  await page.getByRole('button', { name: 'Annuler' }).click();
  await page.getByRole('button', { name: 'Tout effacer' }).click();
  await page.getByRole('button', { name: 'Effacer définitivement' }).click();
  await expect(page.getByTestId('backup-status')).toHaveText('Données effacées');
  await page.getByRole('button', { name: 'Fermer' }).click();

  await page.getByRole('button', { name: 'Stats' }).click();
  await expect(page.getByTestId('stats-panel')).toContainText('Rien de dévoilé');
  await page.getByRole('button', { name: 'Fermer' }).click();

  // Restauration.
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByTestId('restore-input').setInputFiles(file);
  await expect(page.getByTestId('backup-status')).toContainText('Restauration terminée');
  await page.getByRole('button', { name: 'Fermer' }).click();

  expect(await readCells()).toBe(before);
});

test('refuse un fichier qui n’est pas une sauvegarde', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByTestId('restore-input').setInputFiles('tests/fixtures/import/unknown.json');
  await expect(page.getByTestId('backup-status')).toContainText('pas une sauvegarde');
});
