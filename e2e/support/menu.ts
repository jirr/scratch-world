import { expect, type Page } from '@playwright/test';

/** Ouvre le menu des réglages (bouton « Menu » de la barre du bas). */
export async function openMenu(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByTestId('menu-panel')).toBeVisible();
}

/** Déplie une section du menu (idempotent : l'état ouvert persiste d'une ouverture à l'autre). */
export async function openMenuSection(page: Page, title: string): Promise<void> {
  const menu = page.getByTestId('menu-panel');
  const heading = menu.getByText(title, { exact: true });
  // `has` est relatif à chaque <details> : locator non ancré au menu.
  const section = menu.locator('details').filter({ has: page.getByText(title, { exact: true }) });
  if ((await section.getAttribute('open')) === null) await heading.click();
  await expect(section).toHaveAttribute('open', '');
}

/** Ouvre le menu, déplie « Importer des traces » et y dépose un fichier. */
export async function importFile(page: Page, path: string): Promise<void> {
  await openMenu(page);
  await openMenuSection(page, 'Importer des traces');
  await page.getByTestId('import-input').setInputFiles(path);
}
