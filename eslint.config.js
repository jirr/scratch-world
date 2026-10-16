import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

const layer = (name) => [`**/${name}`, `**/${name}/**`];
const svelteImports = {
  group: ['svelte', 'svelte/*', '*.svelte'],
  message: 'Interdit dans cette couche.',
};

/** Règles de frontières entre couches (voir plan, « Couches et frontières »). */
const boundary = (files, { paths = [], patterns = [] }) => ({
  files,
  rules: { 'no-restricted-imports': ['error', { paths, patterns }] },
});

export default defineConfig(
  globalIgnores([
    'node_modules/',
    'dist/',
    'dist-*/',
    'coverage/',
    'playwright-report/',
    'test-results/',
    'blob-report/',
    '.lighthouseci/',
    'perf/',
    'public/',
    'tests/fixtures/',
  ]),
  js.configs.recommended,
  ts.configs.recommended,
  svelte.configs['flat/recommended'],
  prettier,
  svelte.configs['flat/prettier'],
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: { parserOptions: { parser: ts.parser } },
  },
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  boundary(['src/domain/**'], {
    paths: ['dexie', 'maplibre-gl', 'comlink'].map((name) => ({
      name,
      message: 'domain/ est pur.',
    })),
    patterns: [
      svelteImports,
      ...['data', 'map', 'ui', 'app', 'platform'].map((l) => ({
        group: layer(l),
        message: 'domain/ ne dépend d’aucune autre couche.',
      })),
    ],
  }),
  boundary(['src/data/**', 'src/import/**'], {
    paths: [{ name: 'maplibre-gl', message: 'Interdit dans data/ et import/.' }],
    patterns: [
      svelteImports,
      ...['ui', 'map'].map((l) => ({
        group: layer(l),
        message: 'Interdit dans data/ et import/.',
      })),
    ],
  }),
  boundary(['src/ui/**'], {
    paths: [{ name: 'dexie', message: 'ui/ passe par src/data/*-store.ts ou les workers.' }],
  }),
  {
    files: ['src/sw.ts'],
    languageOptions: { globals: { ...globals.serviceworker } },
  },
);
