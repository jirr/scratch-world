import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

function gitShortSha(): string | undefined {
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return undefined;
  }
}

const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __GIT_SHA__: JSON.stringify(process.env.BUILD_SHA ?? gitShortSha() ?? 'unknown'),
  },
  server: { allowedHosts: ['.trycloudflare.com'] },
  preview: { allowedHosts: ['.trycloudflare.com'] },
  worker: { format: 'es' },
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'prompt',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: false,
      manifest: {
        name: 'Scratch World',
        short_name: 'Scratch World',
        description:
          'Gratte la carte du monde là où tu es allé. Tes données restent sur ton appareil.',
        lang: 'fr',
        display: 'standalone',
        orientation: 'any',
        start_url: base,
        scope: base,
        theme_color: '#161b26',
        background_color: '#161b26',
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        maximumFileSizeToCacheInBytes: 3_145_728,
      },
      devOptions: { enabled: false },
      pwaAssets: { config: true },
    }),
  ],
});
