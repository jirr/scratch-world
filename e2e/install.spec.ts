import { expect, test } from '@playwright/test';
import { stubOpenFreeMap } from './support/routes';

test.beforeEach(async ({ context }) => {
  await stubOpenFreeMap(context);
});

test('le service worker contrôle la page et le manifest est installable', async ({ page }) => {
  await page.goto('');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  const href = await page.locator('link[rel=manifest]').getAttribute('href');
  expect(href).toBeTruthy();
  const response = await page.request.get(new URL(href ?? '', page.url()).href);
  expect(response.status()).toBe(200);

  const manifest = (await response.json()) as {
    name: string;
    short_name: string;
    display: string;
    start_url: string;
    scope: string;
    icons: { sizes: string; purpose?: string }[];
  };
  expect(manifest.name).toBeTruthy();
  expect(manifest.short_name).toBeTruthy();
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toMatch(/^\/scratch-world\//);
  expect(manifest.scope).toMatch(/^\/scratch-world\//);
  const sizes = manifest.icons.map((icon) => icon.sizes);
  expect(sizes).toContain('192x192');
  expect(sizes).toContain('512x512');
  expect(manifest.icons.some((icon) => icon.purpose?.includes('maskable'))).toBe(true);
});
