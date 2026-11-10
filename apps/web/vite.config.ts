import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Connect, type Plugin, type ViteDevServer } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const PAPEL = '#F2EBE4';

/**
 * `/api/*` en local (dev y preview), con el mismo código que corre en Vercel.
 * En modo emulador, la función habla con la Emulator Suite.
 */
function apiLocal(mode: string): Plugin {
  const montar = (middlewares: Connect.Server, cargar: () => Promise<{ POST(r: Request): Promise<Response> }>) => {
    const env = loadEnv(mode, process.cwd(), '');
    for (const [k, v] of Object.entries(env)) process.env[k] ??= v;
    if (env['VITE_USAR_EMULADOR'] === '1') {
      process.env['FIRESTORE_EMULATOR_HOST'] ??= '127.0.0.1:8080';
      process.env['FIREBASE_PROJECT_ID'] = 'demo-smartsip';
    }
    middlewares.use('/api/avisar', (req, res) => {
      const trozos: Uint8Array[] = [];
      req.on('data', (t: Uint8Array) => trozos.push(t));
      req.on('end', async () => {
        try {
          const cabeceras = new Headers();
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') cabeceras.set(k, v);
          const cuerpo = new Blob(trozos as BlobPart[]);
          const peticion = new Request(`http://localhost/api/avisar`, {
            method: req.method ?? 'GET',
            headers: cabeceras,
            ...(req.method === 'POST' ? { body: await cuerpo.text() } : {}),
          });
          const r = await (await cargar()).POST(peticion);
          res.statusCode = r.status;
          r.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(await r.text());
        } catch (error) {
          res.statusCode = 500;
          res.end(String(error));
        }
      });
    });
  };
  return {
    name: 'smartsip-api-local',
    configureServer(server: ViteDevServer) {
      montar(server.middlewares, () => server.ssrLoadModule('/api/avisar.ts') as Promise<{ POST(r: Request): Promise<Response> }>);
    },
    configurePreviewServer(server) {
      montar(server.middlewares, () => import('./api/avisar.ts'));
    },
  };
}

// El 3D (three.js) y Firebase se cargan con import() dinámico: Rolldown los
// separa solos y la primera pantalla no los espera.
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    apiLocal(mode),
    // PWA: instalable desde Safari o Chrome y usable sin conexión.
    VitePWA({
      registerType: 'autoUpdate',
      // Service worker propio (sw/sw.ts): además de guardar la app, recibe los avisos.
      strategies: 'injectManifest',
      srcDir: 'sw',
      filename: 'sw.ts',
      includeAssets: ['marca/*.svg', 'iconos/apple-touch-icon-180.png'],
      manifest: {
        id: '/',
        name: 'SmartSip',
        short_name: 'SmartSip',
        description: 'Mide lo que tomas y te avisa antes de que llegue la sed.',
        lang: 'es-CO',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: PAPEL,
        theme_color: PAPEL,
        categories: ['health', 'lifestyle'],
        icons: [
          { src: '/iconos/icono-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/iconos/icono-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/iconos/icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        // Todo lo construido queda en el teléfono: la app abre sin conexión.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: {
    target: 'es2022',
    // three.js y Firebase son grandes pero se cargan aparte y bajo demanda.
    chunkSizeWarningLimit: 1000,
  },
}));
