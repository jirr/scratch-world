import { expect, test, type Page } from '@playwright/test';
import { stubOpenFreeMap } from './support/routes';

const START = { latitude: 48.85, longitude: 2.35, accuracy: 10 };
/** 30 m vers le nord par pas, un point toutes les 600 ms (~50 m/s, sous le seuil de vitesse). */
const STEP_DEG = 30 / 111_200;

test.use({ permissions: ['geolocation'], geolocation: START });

test.beforeEach(async ({ context }) => {
  await stubOpenFreeMap(context);
});

/** Nombre de cellules dévoilées, lu dans le panneau de statistiques. */
async function readCells(page: Page): Promise<number> {
  await page.getByRole('button', { name: 'Stats' }).click();
  const cells = page.getByTestId('stats-cells');
  // Le panneau affiche d'abord le cache : on attend la fin du recalcul.
  await expect(page.getByTestId('stats-panel').getByRole('status')).toHaveText('', {
    timeout: 15_000,
  });
  // Sans cellule dévoilée, le panneau n'affiche pas le compteur.
  const value =
    (await cells.count()) === 0 ? 0 : Number((await cells.innerText()).replace(/\s/g, ''));
  await page.getByRole('button', { name: 'Fermer' }).click();
  return value;
}

test('l’enregistrement démarre tout seul, sans bandeau ni minuteur, et dévoile un disque de ~1 km', async ({
  page,
  context,
}) => {
  await page.goto('');
  await expect(page.getByRole('button', { name: /Pause/ })).toBeVisible({ timeout: 10_000 });
  // Réveille la source de position de Chromium si le premier fix s'est perdu au chargement.
  await context.setGeolocation({ ...START, latitude: START.latitude + 1e-6 });
  await expect(page.locator('.pin')).toBeVisible();
  // Plus de bandeau d'enregistrement ni de minuteur.
  await expect(page.getByTestId('recording-indicator')).toHaveCount(0);
  await expect(page.getByText(/Enregistrement ·/)).toHaveCount(0);

  await expect.poll(() => readCells(page), { timeout: 15_000 }).toBeGreaterThan(190);
  const start = await readCells(page);
  expect(start).toBeLessThan(260);

  for (let i = 1; i <= 12; i++) {
    await context.setGeolocation({ ...START, latitude: START.latitude + i * STEP_DEG });
    await page.waitForTimeout(600);
  }
  await expect.poll(() => readCells(page), { timeout: 15_000 }).toBeGreaterThan(start);

  // Le pictogramme de position suit la vitesse (~50 m/s simulés : véhicule).
  await expect(page.locator('.pin')).toHaveAttribute('data-mode', 'vehicle');

  // Une position trop imprécise (> 1 km) est ignorée.
  const before = await readCells(page);
  await context.setGeolocation({ latitude: 49.5, longitude: 2.35, accuracy: 1500 });
  await page.waitForTimeout(3000);
  expect(await readCells(page)).toBe(before);
});

test('Pause arrête le scratch (même après rechargement), Reprendre le relance', async ({
  page,
  context,
}) => {
  await page.goto('');
  await expect(page.getByRole('button', { name: /Pause/ })).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: /Pause/ }).click();
  await expect(page.getByTestId('paused-indicator')).toBeVisible();
  await expect(page.getByRole('button', { name: /Reprendre/ })).toBeVisible();

  // En pause, se déplacer ne dévoile rien et un rechargement ne relance pas l'enregistrement.
  await page.reload();
  await context.setGeolocation({ ...START, latitude: START.latitude + 0.01 });
  await page.waitForTimeout(3000);
  await expect(page.getByTestId('paused-indicator')).toBeVisible();
  await expect(page.getByRole('button', { name: /Reprendre/ })).toBeVisible();

  await page.getByRole('button', { name: /Reprendre/ }).click();
  await expect(page.getByRole('button', { name: /Pause/ })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('paused-indicator')).toHaveCount(0);
});
