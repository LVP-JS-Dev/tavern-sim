import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Vitest configuration for Tavern Tycoon Alpha
 *
 * Aligns with tsconfig.json settings:
 * - Path aliases match @/* -> ./src/*
 * - Node.js environment for CLI application
 * - ES2022 target compatibility
 */
export default defineConfig({
  test: {
    // Test file patterns
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],

    // Environment setup for Node.js CLI application
    environment: 'node',

    // Global test utilities (describe, it, expect, etc.)
    globals: true,

    // Parallel test execution for performance
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 1,
        maxThreads: 4,
      },
    },

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts', // Barrel export file
        'src/types/', // Type definitions only
      ],
      // Coverage thresholds for quality gates
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },

    // Timeout for long-running tests (e.g., integration tests)
    testTimeout: 10000,
    hookTimeout: 10000,

    // Fail fast on first test failure in CI
    bail: 0,

    // Retry failed tests once
    retry: 0,

    // Reporters for test output
    reporters: ['default'],

    // Watch mode excludes
    watchExclude: ['node_modules/**', 'dist/**', 'coverage/**'],
  },

  // Path resolution matching tsconfig.json
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // Define constants for tests
  define: {
    __TEST__: true,
  },
});
