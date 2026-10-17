import { expect, test } from '@playwright/test';
import { openMenu, openMenuSection } from './support/menu';
import { luminanceAt } from './support/pixels';
import { stubOpenFreeMap } from './support/routes';

test.beforeEach(async ({ context }) => {
  await stubOpenFreeMap(context);
});

test('le thème et les réglages sont appliqués et persistés', async ({ page }) => {
  await page.goto('');
  await openMenu(page);

  await openMenuSection(page, 'Apparence');
  await page.getByLabel('Thème').selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await openMenuSection(page, 'Enregistrement');
  await page.getByLabel(/Conserver les traces brutes/).check();

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await openMenu(page);
  await openMenuSection(page, 'Enregistrement');
  await expect(page.getByLabel(/Conserver les traces brutes/)).toBeChecked();
});

test.describe('système en anglais', () => {
  test.use({ locale: 'en-US' });

  test('la langue suit le système et se change dans les réglages', async ({ page }) => {
    await page.goto('');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('button', { name: 'Locate me' })).toBeVisible();

    await openMenu(page);
    await openMenuSection(page, 'Appearance');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await page.getByLabel('Language').selectOption('fr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.getByRole('heading', { name: 'Réglages' })).toBeVisible();
    await expect(page.getByLabel('Langue')).toHaveValue('fr');

    // Mémorisé après rechargement, puis retour à la langue du système.
    await page.reload();
    await expect(page.getByRole('button', { name: 'Me localiser' })).toBeVisible();
    await openMenu(page);
    await openMenuSection(page, 'Apparence');
    await page.getByLabel('Langue').selectOption('system');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
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

test('le brouillard reste au-dessus de la carte après un changement de style', async ({
  context,
  page,
}) => {
  // Le diff de style de MapLibre ajoute les nouveaux calques en fin de pile, donc par-dessus le
  // brouillard (cas réel entre deux styles OpenFreeMap). Voile translucide : passe de rendu
  // ordonnée comme les routes et libellés.
  await context.route('https://tiles.openfreemap.org/styles/positron', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        version: 8,
        name: 'stub-positron',
        sources: {},
        layers: [
          { id: 'background', type: 'background', paint: { 'background-color': '#dfe6f0' } },
          {
            id: 'veil',
            type: 'background',
            paint: { 'background-color': '#fff', 'background-opacity': 0.99 },
          },
        ],
      }),
    }),
  );
  await page.setViewportSize({ width: 800, height: 700 });
  await page.goto('');
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  const [x, y] = [100, 300];
  await expect.poll(() => luminanceAt(page, x, y), { timeout: 15_000 }).toBeLessThan(100);

  await page.getByRole('button', { name: 'Style de carte' }).click();
  const picker = page.getByTestId('style-picker');
  await picker.getByRole('button', { name: 'Positron' }).click();
  // Aperçu sans brouillard : le nouveau fond est affiché.
  await expect.poll(() => luminanceAt(page, x, y), { timeout: 15_000 }).toBeGreaterThan(250);

  await picker.getByRole('button', { name: 'Fermer' }).click();
  await expect.poll(() => luminanceAt(page, x, y), { timeout: 5_000 }).toBeLessThan(100);
});
