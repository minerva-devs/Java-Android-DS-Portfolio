import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    name: '@rbalchii/anchor-engine',
    environment: 'node',
    include: ['engine/tests/**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.git/**',
      '**/test-wasm/**',
      '**/*.cjs',
      '**/coverage/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', 'tests/**/*.test.ts'],
      exclude: [
        'src/types/**/*.ts',
        'src/index.ts',
        '**/*.d.ts',
      ],
    },
    testTimeout: 30000,
    hookTimeout: 10000,
    reporters: ['verbose'],
    define: {
      __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
      __TEST__: JSON.stringify(true),
    },
    // Provide globals that Emscripten-based WASM modules expect
    setupFiles: ['./tests/vitest-setup.ts'],
  },
});

// Root setup file (separate)