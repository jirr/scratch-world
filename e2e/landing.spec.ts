import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { stubOpenFreeMap } from './support/routes';

test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ context }) => {
  await stubOpenFreeMap(context);
});

test('la page d’accueil présente l’app, demande un pseudo puis ouvre la carte', async ({
  page,
}) => {
  await page.goto('');
  const landing = page.getByTestId('landing');
  await expect(landing.getByRole('heading', { name: 'Scratch World', level: 1 })).toBeVisible();
  await expect(landing).toContainText('aucun serveur');

  // Pseudo invalide : message, on reste sur l'accueil.
  await page.getByLabel('Ton pseudo').fill('a');
  await page.getByRole('button', { name: 'Commencer' }).click();
  await expect(page.getByRole('alert')).toContainText('2 à 24');
  await expect(landing).toBeVisible();

  await page.getByLabel('Ton pseudo').fill('  Léa  ');
  await page.getByRole('button', { name: 'Commencer' }).click();
  await expect(landing).toBeHidden();
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();

  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByTestId('pseudo-setting')).toHaveValue('Léa');

  // Mémorisé : plus de page d'accueil au rechargement.
  await page.reload();
  await expect(page.getByTestId('landing')).toHaveCount(0);
});

test('propose le téléchargement de l’application', async ({ page }) => {
  await page.goto('');
  await expect(page.getByText('Télécharger l’application')).toBeVisible();
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string }>;
    };
    (window as unknown as { __calls: number }).__calls = 0;
    event.prompt = async () => {
      (window as unknown as { __calls: number }).__calls++;
    };
    event.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(event);
  });
  await page.getByRole('button', { name: 'Installer l’application' }).click();
  expect(await page.evaluate(() => (window as unknown as { __calls: number }).__calls)).toBe(1);
});

test('la page d’accueil n’a pas de violation d’accessibilité critique ou sérieuse', async ({
  page,
}) => {
  await page.goto('');
  await expect(page.getByTestId('landing')).toBeVisible();
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    violations.filter((v) => v.impact === 'critical' || v.impact === 'serious').map((v) => v.id),
  ).toEqual([]);
});
