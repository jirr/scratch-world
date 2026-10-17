import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { openMenu, openMenuSection } from './support/menu';
import { stubOpenFreeMap } from './support/routes';

const MENU_SECTIONS = [
  'Pseudo',
  'Enregistrement',
  'Apparence',
  'Importer des traces',
  'Données',
  'À propos',
];

test.beforeEach(async ({ context }) => {
  await stubOpenFreeMap(context);
});

async function violations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return violations
    .filter((v) => v.impact === 'critical' || v.impact === 'serious')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`thème ${scheme}`, () => {
    test.use({ colorScheme: scheme });

    test('écran principal sans violation critique ou sérieuse', async ({ page }) => {
      await page.goto('');
      await expect(page.locator('.maplibregl-canvas')).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    for (const [button, panel] of [
      ['Stats', 'stats-panel'],
      ['Menu', 'menu-panel'],
      ['Style de carte', 'style-picker'],
    ] as const) {
      test(`panneau ${panel}`, async ({ page }) => {
        await page.goto('');
        await page.getByRole('button', { name: button }).click();
        await expect(page.getByTestId(panel)).toBeVisible();
        expect(await violations(page)).toEqual([]);
      });
    }

    test('menu avec toutes les sections dépliées', async ({ page }) => {
      await page.goto('');
      await openMenu(page);
      for (const title of MENU_SECTIONS) await openMenuSection(page, title);
      expect(await violations(page)).toEqual([]);
    });
  });
}

test('la navigation au clavier atteint chaque bouton de la barre', async ({ page }) => {
  await page.goto('');
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  const wanted = new Set(['Stats', 'Démarrer', 'Menu']);
  const seen = new Set<string>();
  for (let i = 0; i < 25 && seen.size < wanted.size; i++) {
    await page.keyboard.press('Tab');
    const label = await page.evaluate(
      () => document.activeElement?.getAttribute('aria-label') ?? '',
    );
    if (wanted.has(label)) seen.add(label);
  }
  expect([...seen].sort()).toEqual([...wanted].sort());
});

test('Échap ferme un panneau', async ({ page }) => {
  await page.goto('');
  await page.getByRole('button', { name: 'Stats' }).click();
  await expect(page.getByTestId('stats-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('stats-panel')).toBeHidden();
});
