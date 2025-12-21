import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['server/**/*.test.ts'],
    exclude: ['node_modules', '.cache', 'dist', 'build'],
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      include: ['server/**/*.ts'],
      exclude: [
        'server/**/*.test.ts',
        'server/vite.ts',
        'server/test/**',
        'server/__tests__/**',
      ],
      // Enforce coverage thresholds
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
      // Fail on threshold violations
      watermarks: {
        lines: [75, 90],
        functions: [75, 90],
        branches: [70, 85],
        statements: [75, 90],
      },
    },
    // Separate threads for isolation
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },
    // Silent console during tests (can be overridden with --reporter=verbose)
    silent: false,
    // Reporter options
    reporters: process.env.CI ? ['verbose', 'json'] : ['verbose'],
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'client', 'src'),
      '@shared': path.resolve(import.meta.dirname, 'shared'),
      '@assets': path.resolve(import.meta.dirname, 'attached_assets'),
    },
  },
});
