import { expect, test, type Page } from '@playwright/test';
import { luminanceAt } from './support/pixels';
import { stubOpenFreeMap } from './support/routes';

const VIEWPORT = { width: 800, height: 700 };
/** Centre de la carte (la barre du bas occupe 76 px). */
const CENTER = { x: VIEWPORT.width / 2, y: (VIEWPORT.height - 76) / 2 };
/** Point hors du tracé, resté sous le brouillard. */
const FOGGY = { x: 150, y: 150 };

test.beforeEach(async ({ context, page }) => {
  await stubOpenFreeMap(context);
  await page.addInitScript(() => {
    if (!localStorage.getItem('sw:camera')) {
      localStorage.setItem('sw:camera', JSON.stringify({ lng: 2.35, lat: 48.85, zoom: 14 }));
    }
  });
});

/** Nombre de cellules dévoilées, lu directement dans IndexedDB (indépendant de l'interface). */
async function readCells(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('scratch-world');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('chunks')) {
            db.close();
            resolve(0);
            return;
          }
          const request = db.transaction('chunks').objectStore('chunks').getAll();
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            db.close();
            const rows = request.result as { pos: Uint16Array }[];
            resolve(rows.reduce((total, row) => total + row.pos.length, 0));
          };
        };
      }),
  );
}

/** Trace un trait horizontal de 200 px au centre de la carte. */
async function drag(page: Page): Promise<void> {
  await page.mouse.move(CENTER.x - 100, CENTER.y);
  await page.mouse.down();
  await page.mouse.move(CENTER.x + 100, CENTER.y, { steps: 12 });
  await page.mouse.up();
}

test('le crayon dévoile la carte à moitié, le doigt dévoile des zones, un nouveau clic rétablit le brouillard', async ({
  page,
}) => {
  await page.setViewportSize(VIEWPORT);
  await page.goto('');
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  await page.waitForTimeout(1500);
  expect(await readCells(page)).toBe(0);
  const fog = await luminanceAt(page, FOGGY.x, FOGGY.y);

  const pencil = page.getByRole('button', { name: 'Dessiner' });
  await expect(pencil).toHaveAttribute('aria-pressed', 'false');
  await pencil.click();
  await expect(pencil).toHaveAttribute('aria-pressed', 'true');

  // Brouillard à 50 % : la carte est devinée sous le brouillard.
  await expect.poll(() => luminanceAt(page, FOGGY.x, FOGGY.y)).toBeGreaterThan(fog + 40);

  await drag(page);
  // Les cellules sont écrites pendant le dessin, sans attendre la sortie du mode.
  await expect.poll(() => readCells(page), { timeout: 10_000 }).toBeGreaterThan(5);

  await pencil.click();
  await expect(pencil).toHaveAttribute('aria-pressed', 'false');

  // Brouillard de nouveau opaque, sauf sur le tracé qui reste dévoilé.
  await expect.poll(() => luminanceAt(page, FOGGY.x, FOGGY.y)).toBeLessThan(fog + 10);
  await expect
    .poll(() => luminanceAt(page, CENTER.x, CENTER.y), { timeout: 15_000 })
    .toBeGreaterThan(fog + 60);

  // Hors du mode dessin, glisser déplace la carte sans rien dévoiler.
  const drawn = await readCells(page);
  await drag(page);
  await page.waitForTimeout(1000);
  expect(await readCells(page)).toBe(drawn);
});
