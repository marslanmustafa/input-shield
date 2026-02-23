import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/**'],
    },
  },
  resolve: {
    // tells vitest to resolve .js imports → .ts files during testing
    extensions: ['.ts', '.js'],
  },
});
