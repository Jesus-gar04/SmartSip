import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Estas pruebas necesitan la Firebase Emulator Suite. Se corren con
// `pnpm test:firebase`, que levanta los emuladores, corre todo y los apaga.
export default defineConfig({
  test: {
    name: 'smartsip-firebase',
    root: fileURLToPath(new URL('.', import.meta.url)),
    include: ['test/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Las pruebas de reglas vacían la base del emulador: nada en paralelo.
    fileParallelism: false,
  },
});
