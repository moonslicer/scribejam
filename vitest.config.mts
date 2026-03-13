import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    environmentMatchGlobs: [['tests/renderer/**', 'jsdom']],
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts', 'tests/renderer/**/*.test.tsx'],
    setupFiles: ['tests/setup/rendering.ts']
  }
});
