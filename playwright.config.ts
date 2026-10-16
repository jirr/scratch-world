import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://localhost:4173/scratch-world/';
const perf = process.env.PW_PERF === '1';
const perfURL = 'http://localhost:4175/';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    // Pseudo déjà choisi : les tests ne passent pas par la page d'accueil (sauf landing.spec.ts).
    storageState: {
      cookies: [],
      origins: ['http://localhost:4173', 'http://localhost:4174', 'http://localhost:4175'].map(
        (origin) => ({ origin, localStorage: [{ name: 'sw:pseudo', value: 'Testeur' }] }),
      ),
    },
    launchOptions: { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] },
  },
  webServer: perf
    ? [
        {
          command: 'pnpm exec vite preview --outDir dist-bench --port 4175 --strictPort',
          url: perfURL,
          reuseExistingServer: true,
        },
      ]
    : [
        {
          command: 'pnpm preview',
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          env: { BASE_PATH: '/scratch-world/' },
        },
      ],
  projects: [
    {
      name: 'app',
      testMatch:
        /(app|recording|import|stats|settings|backup|a11y|install-prompt|landing)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], serviceWorkers: 'block' },
    },
    {
      name: 'pwa',
      testMatch: /(offline|install|pwa-update)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], serviceWorkers: 'allow' },
    },
    ...(perf
      ? [
          {
            // GPU réel, fenêtre visible : mesure de performance locale (jamais en CI).
            name: 'perf',
            testMatch: /(fog|import|stats)\.perf\.ts/,
            timeout: 300_000,
            use: {
              ...devices['Desktop Chrome'],
              baseURL: perfURL,
              serviceWorkers: 'block' as const,
              headless: false,
              viewport: { width: 1280, height: 800 },
              launchOptions: { args: [] },
            },
          },
        ]
      : []),
  ],
});
