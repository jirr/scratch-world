import { expect, test } from '@playwright/test';
import { stubOpenFreeMap } from './support/routes';

const START = { latitude: 48.85, longitude: 2.35, accuracy: 10 };
/** 30 m vers le nord par pas, un point toutes les 600 ms (~50 m/s, sous le seuil de vitesse). */
const STEP_DEG = 30 / 111_200;

test.use({ permissions: ['geolocation'], geolocation: START });

test.beforeEach(async ({ context }) => {
  await stubOpenFreeMap(context);
});

test('enregistre des cellules, ignore une position imprécise, puis s’arrête', async ({
  page,
  context,
}) => {
  await page.goto('');
  await page.getByRole('button', { name: /Enregistrer/ }).click();
  await expect(page.getByTestId('recording-sheet')).toBeVisible();
  await page.getByRole('button', { name: 'Démarrer' }).click();

  const indicator = page.getByTestId('recording-indicator');
  await expect(indicator).toBeVisible();
  const count = async () => {
    const text = await indicator.innerText();
    return Number(/\+(\d+) cellules/.exec(text)?.[1] ?? NaN);
  };

  for (let i = 1; i <= 12; i++) {
    await context.setGeolocation({ ...START, latitude: START.latitude + i * STEP_DEG });
    await page.waitForTimeout(600);
  }
  await expect.poll(count, { timeout: 10_000 }).toBeGreaterThanOrEqual(3);

  await page.waitForTimeout(2500);
  const before = await count();
  await context.setGeolocation({ latitude: 49.5, longitude: 2.35, accuracy: 200 });
  await page.waitForTimeout(3000);
  expect(await count()).toBe(before);

  await page.getByRole('button', { name: /Arrêter/ }).click();
  await expect(indicator).toHaveCount(0);
});

test('la première position dévoile sa cellule sans attendre un déplacement', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: /Enregistrer/ }).click();
  await page.getByRole('button', { name: 'Démarrer' }).click();
  const indicator = page.getByTestId('recording-indicator');
  await expect(indicator).toContainText(/\+1 cellule/, { timeout: 10_000 });
});
