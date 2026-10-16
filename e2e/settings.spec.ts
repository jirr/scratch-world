import { expect, test } from '@playwright/test';
import { stubOpenFreeMap } from './support/routes';

test.beforeEach(async ({ context }) => {
  await stubOpenFreeMap(context);
});

test('le thème et les réglages sont appliqués et persistés', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Menu' }).click();

  await page.getByLabel('Thème').selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.getByLabel(/Conserver les traces brutes/).check();

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByLabel(/Conserver les traces brutes/)).toBeChecked();
});

test('le bouton de la carte recharge l’application après confirmation', async ({ page }) => {
  await page.goto('');
  await page.evaluate(() => ((window as unknown as { __marker: boolean }).__marker = true));
  await page.getByRole('button', { name: 'Recharger la page' }).click();
  await expect(page.getByTestId('reload-dialog')).toBeVisible();

  await page.getByRole('button', { name: 'Annuler' }).click();
  await expect(page.getByTestId('reload-dialog')).toBeHidden();
  expect(await page.evaluate(() => (window as unknown as { __marker?: boolean }).__marker)).toBe(
    true,
  );

  await page.getByRole('button', { name: 'Recharger la page' }).click();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Recharger', exact: true }).click(),
  ]);
  expect(
    await page.evaluate(() => (window as unknown as { __marker?: boolean }).__marker),
  ).toBeUndefined();
});

test('le style de carte se choisit depuis la carte et s’applique tout de suite', async ({
  page,
}) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Style de carte' }).click();
  const picker = page.getByTestId('style-picker');
  await expect(picker).toBeVisible();

  // Le choix charge le style immédiatement, panneau ouvert (la carte reste visible derrière).
  const request = page.waitForRequest(/tiles\.openfreemap\.org\/styles\/positron/);
  await picker.getByRole('button', { name: 'Positron' }).click();
  await request;
  await expect(picker.getByRole('button', { name: 'Positron' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  await expect(picker).toContainText('brouillard est masqué');

  // URL personnalisée invalide : signalée, repli sur le style automatique.
  await picker.getByRole('button', { name: /Personnalisé/ }).click();
  await page.getByLabel(/URL du style/).fill('pas une url');
  await page.getByLabel(/URL du style/).blur();
  await expect(page.getByText('URL invalide')).toBeVisible();

  // Mémorisé après rechargement.
  await page.reload();
  await page.getByRole('button', { name: 'Style de carte' }).click();
  await expect(
    page.getByTestId('style-picker').getByRole('button', { name: /Personnalisé/ }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('style-picker')).toBeHidden();
});
