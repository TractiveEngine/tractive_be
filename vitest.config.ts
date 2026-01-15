import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    include: ['tests/**/*.test.ts'],
    testTimeout: 60000, // 60 seconds for tests
    hookTimeout: 60000, // 60 seconds for hooks
    pool: 'forks', // Run tests in separate processes
    poolOptions: {
      forks: {
        singleFork: true, // Run all tests sequentially in a single fork
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  css: {
    postcss: false, // Disable PostCSS for tests
  },
});
