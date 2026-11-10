/// <reference lib="webworker" />
/**
 * Service worker de SmartSip.
 *
 * - Todo lo construido queda en el teléfono: la app abre sin conexión.
 * - El clima: si no hay red, sirve el último dato.
 * - Avisos (Web Push): llegan aunque la app esté cerrada. Si la app está a
 *   la vista, el aviso se muestra dentro de ella (el cuadro de tinta con la
 *   gota) en lugar de una notificación del sistema. En iOS siempre se muestra
 *   la del sistema: Safari retira el permiso a quien recibe pushes sin mostrar nada.
 */
import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

// Actualización automática: la versión nueva toma el control enseguida.
void self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }));
registerRoute(
  ({ url }) => url.origin === 'https://api.open-meteo.com',
  new NetworkFirst({
    cacheName: 'clima',
    networkTimeoutSeconds: 5,
    plugins: [new ExpirationPlugin({ maxEntries: 8, maxAgeSeconds: 6 * 3600 })],
  }),
);

// ─── Avisos ─────────────────────────────────────────────────────────────────

interface Aviso {
  tipo: string;
  titulo: string;
  cuerpo: string;
  enMs?: number;
}

const POR_DEFECTO: Aviso = { tipo: 'prueba', titulo: 'SmartSip', cuerpo: 'Tienes un aviso de tu termo.' };

function leerAviso(e: PushEvent): Aviso {
  try {
    const a = e.data?.json() as Partial<Aviso> | undefined;
    return a && typeof a.titulo === 'string' && typeof a.cuerpo === 'string' ? { ...POR_DEFECTO, ...a } : POR_DEFECTO;
  } catch {
    return POR_DEFECTO;
  }
}

const esIos = () => /iPhone|iPad|iPod/.test(self.navigator.userAgent);
/** La app es todo menos el simulador. */
const esLaApp = (c: WindowClient) => !new URL(c.url).pathname.startsWith('/simulador');

async function mostrar(aviso: Aviso): Promise<void> {
  const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const enFoco = ventanas.find((c) => c.focused && c.visibilityState === 'visible' && esLaApp(c));
  if (enFoco) {
    enFoco.postMessage({ tipo: 'smartsip:aviso', aviso });
    if (!esIos()) return;
  }
  await self.registration.showNotification(aviso.titulo, {
    body: aviso.cuerpo,
    icon: '/iconos/icono-192.png',
    // Un recordatorio nuevo reemplaza al anterior en lugar de apilarse.
    tag: aviso.tipo,
    lang: 'es-CO',
    data: { url: '/' },
  });
}

self.addEventListener('push', (e) => {
  e.waitUntil(mostrar(leerAviso(e)));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const app = ventanas.find(esLaApp);
      if (app) await app.focus();
      else await self.clients.openWindow('/');
    })(),
  );
});
