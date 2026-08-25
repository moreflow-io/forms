import { defineConfig } from 'vitest/config';

// Explicit local config so the package tests run identically inside the
// Moreflow monorepo (where a root vitest config would otherwise be picked up)
// and in the standalone moreflow-io/forms mirror.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
});
