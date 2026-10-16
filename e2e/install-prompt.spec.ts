import { expect, test, type Page } from '@playwright/test';
import { stubOpenFreeMap } from './support/routes';

test.beforeEach(async ({ context }) => {
  await stubOpenFreeMap(context);
});

/** Chromium headless ne déclenche pas `beforeinstallprompt` : on le simule. */
async function fireInstallPrompt(page: Page) {
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string }>;
    };
    (window as unknown as { __installCalls: number }).__installCalls = 0;
    event.prompt = async () => {
      (window as unknown as { __installCalls: number }).__installCalls++;
    };
    event.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(event);
  });
}

test('la fenêtre d’installation s’affiche et déclenche l’invite du navigateur', async ({
  page,
}) => {
  await page.goto('');
  await fireInstallPrompt(page);
  const popup = page.getByTestId('install-prompt');
  await expect(popup).toBeVisible({ timeout: 10_000 });
  await popup.getByRole('button', { name: 'Installer' }).click();
  expect(
    await page.evaluate(() => (window as unknown as { __installCalls: number }).__installCalls),
  ).toBe(1);
  await expect(popup).toBeHidden();
});

test('« Plus tard » masque la fenêtre, même après rechargement', async ({ page }) => {
  await page.goto('');
  await fireInstallPrompt(page);
  const popup = page.getByTestId('install-prompt');
  await expect(popup).toBeVisible({ timeout: 10_000 });
  await popup.getByRole('button', { name: 'Plus tard' }).click();
  await expect(popup).toBeHidden();

  await page.reload();
  await fireInstallPrompt(page);
  await page.waitForTimeout(3500);
  await expect(page.getByTestId('install-prompt')).toBeHidden();

  // L'installation reste proposée dans les réglages.
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('button', { name: 'Installer l’application' })).toBeVisible();
});
