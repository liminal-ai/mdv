import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    environmentMatchGlobs: [['tests/client/**', 'jsdom']],
  },
});
