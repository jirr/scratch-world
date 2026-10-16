import type { Page } from '@playwright/test';

/** Luminance (0-255) du pixel (x, y) d'une capture d'écran de la page. */
export async function luminanceAt(page: Page, x: number, y: number): Promise<number> {
  const png = (await page.screenshot()).toString('base64');
  return page.evaluate(
    async ({ data, x, y }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${data}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
      ctx.drawImage(img, 0, 0);
      const p = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
      return 0.2126 * (p[0] ?? 0) + 0.7152 * (p[1] ?? 0) + 0.0722 * (p[2] ?? 0);
    },
    { data: png, x, y },
  );
}
