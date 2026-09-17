import { defineConfig } from 'vitest/config';

// A relative base lets the same build run from a GitHub Pages repository
// subpath (https://<owner>.github.io/operating-leverage-lab/) and from any
// local static server without rebuilding.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
