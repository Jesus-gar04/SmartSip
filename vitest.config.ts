import { defineConfig } from 'vitest/config';

// `pnpm test`: núcleo y tokens, sin red ni emuladores.
// Las pruebas de Firebase van aparte: `pnpm test:firebase` (packages/firebase/vitest.config.ts).
export default defineConfig({
  test: {
    projects: ['packages/core', 'packages/tokens'],
    coverage: {
      provider: 'v8',
      include: ['packages/core/src/**/*.ts', 'packages/tokens/src/**/*.ts'],
      reporter: ['text', 'html'],
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
});
