import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@traquenard/game-ir': new URL('./packages/game-ir/src/index.ts', import.meta.url).pathname,
      '@traquenard/game-validator': new URL(
        './packages/game-validator/src/index.ts',
        import.meta.url,
      ).pathname,
      '@traquenard/engine-core': new URL('./packages/engine-core/src/index.ts', import.meta.url)
        .pathname,
      '@traquenard/engine-runtime': new URL(
        './packages/engine-runtime/src/index.ts',
        import.meta.url,
      ).pathname,
      '@traquenard/authoring-domain': new URL(
        './packages/authoring-domain/src/index.ts',
        import.meta.url,
      ).pathname,
      '@traquenard/multiplayer-protocol': new URL(
        './packages/multiplayer-protocol/src/index.ts',
        import.meta.url,
      ).pathname,
    },
  },
  test: {
    globals: true,
    environment: 'node',
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'packages/game-ir/src/**/*.ts',
        'packages/engine-core/src/**/*.ts',
        'packages/engine-runtime/src/**/*.ts',
        'packages/game-validator/src/**/*.ts',
      ],
      thresholds: { lines: 75, functions: 75, branches: 70, statements: 75 },
    },
  },
});
