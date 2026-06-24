/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath, URL } from 'node:url';

/**
 * Vite configuration for the NovaForged web client.
 *
 * - `base` is `./` so the built bundle works when served from an arbitrary
 *   path inside the Stake CDN iframe.
 * - `resolve.alias` exposes `@/` for `src/` imports.
 * - Vitest runs in a jsdom environment with globals enabled.
 */
export default defineConfig({
  base: './',
  plugins: [svelte()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2021',
    sourcemap: true,
    chunkSizeWarningLimit: 1500,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**', 'src/config/**'],
      // Modest floors on the pure-logic layer; raise as suites grow.
      thresholds: { statements: 75, branches: 65, functions: 75, lines: 75 },
    },
  },
});
