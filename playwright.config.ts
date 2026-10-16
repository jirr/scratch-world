import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://localhost:4173/scratch-world/';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    launchOptions: { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] },
  },
  webServer: {
    command: 'pnpm preview',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    env: { BASE_PATH: '/scratch-world/' },
  },
  projects: [
    {
      name: 'app',
      testMatch: /(app)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], serviceWorkers: 'block' },
    },
    {
      name: 'pwa',
      testMatch: /(offline|install|pwa-update)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], serviceWorkers: 'allow' },
    },
  ],
});
