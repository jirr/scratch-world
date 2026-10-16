import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [svelte()],
  test: {
    environment: 'node',
    setupFiles: ['fake-indexeddb/auto'],
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/import/**', 'src/data/**'],
      reporter: ['text', 'lcov'],
      thresholds: { lines: 80, branches: 80 },
    },
  },
});
