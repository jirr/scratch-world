import { expect, test } from '@playwright/test';
import { stubOpenFreeMap } from './support/routes';

const START = { latitude: 48.85, longitude: 2.35, accuracy: 10 };
/** 30 m vers le nord par pas, un point toutes les 600 ms (~50 m/s, sous le seuil de vitesse). */
const STEP_DEG = 30 / 111_200;

test.use({ permissions: ['geolocation'], geolocation: START });

test.beforeEach(async ({ context }) => {
  await stubOpenFreeMap(context);
});

test('l’enregistrement démarre tout seul, dévoile la zone de départ puis suit les déplacements', async ({
  page,
  context,
}) => {
  await page.goto('');
  const indicator = page.getByTestId('recording-indicator');
  await expect(indicator).toContainText(/\+217\s+cellules/, { timeout: 10_000 });

  const count = async () => {
    const text = await indicator.innerText();
    return Number(/\+(\d+) cellules/.exec(text)?.[1] ?? NaN);
  };
  for (let i = 1; i <= 12; i++) {
    await context.setGeolocation({ ...START, latitude: START.latitude + i * STEP_DEG });
    await page.waitForTimeout(600);
  }
  await expect.poll(count, { timeout: 10_000 }).toBeGreaterThan(217);

  // Le pictogramme de position suit la vitesse (~50 m/s simulés : véhicule).
  await expect(page.locator('.pin')).toHaveAttribute('data-mode', 'vehicle');

  // Une position trop imprécise est ignorée.
  await page.waitForTimeout(2500);
  const before = await count();
  await context.setGeolocation({ latitude: 49.5, longitude: 2.35, accuracy: 1500 });
  await page.waitForTimeout(3000);
  expect(await count()).toBe(before);
});

test('Pause arrête le scratch (même après rechargement), Reprendre le relance', async ({
  page,
  context,
}) => {
  await page.goto('');
  await expect(page.getByTestId('recording-indicator')).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: /Pause/ }).click();
  await expect(page.getByTestId('paused-indicator')).toBeVisible();
  await expect(page.getByTestId('recording-indicator')).toHaveCount(0);

  // En pause, se déplacer ne dévoile rien et un rechargement ne relance pas l'enregistrement.
  await page.reload();
  await context.setGeolocation({ ...START, latitude: START.latitude + 0.01 });
  await page.waitForTimeout(3000);
  await expect(page.getByTestId('paused-indicator')).toBeVisible();
  await expect(page.getByTestId('recording-indicator')).toHaveCount(0);

  await page.getByRole('button', { name: /Reprendre/ }).click();
  await expect(page.getByTestId('recording-indicator')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('paused-indicator')).toHaveCount(0);
});
