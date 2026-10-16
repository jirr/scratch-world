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
  await page.getByLabel('Style de carte').selectOption('custom');
  await page.getByLabel(/URL du style/).fill('pas une url');
  await page.getByLabel(/URL du style/).blur();
  await expect(page.getByText('URL invalide')).toBeVisible();

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByLabel(/Conserver les traces brutes/)).toBeChecked();
  await expect(page.getByLabel('Style de carte')).toHaveValue('custom');
});
