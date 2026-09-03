import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(__dirname),
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      all: false,
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'dist/**'],
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
