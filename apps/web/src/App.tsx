/**
 * Rutas de la PWA: la app en `/`, el simulador en `/simulador` y la
 * reserva de la preventa en `/preventa` (adonde lleva el QR). Sin librería
 * de rutas: el simulador y la reserva se cargan aparte, para que la app no
 * descargue lo que no usa.
 */
import { lazy, Suspense } from 'react';
import { AppPwa } from './app/AppPwa.tsx';

const PaginaSimulador = lazy(() =>
  import('./paginas/Simulador.tsx').then((m) => ({ default: m.PaginaSimulador })),
);

const PaginaReservar = lazy(() =>
  import('./paginas/Reservar.tsx').then((m) => ({ default: m.PaginaReservar })),
);

const esSimulador = () => /^\/simulador\/?$/.test(location.pathname);
const esPreventa = () => /^\/preventa\/?$/.test(location.pathname);

export function App() {
  if (esSimulador()) {
    document.title = 'SmartSip · Simulador';
    return (
      <Suspense fallback={null}>
        <PaginaSimulador />
      </Suspense>
    );
  }
  if (esPreventa()) {
    document.title = 'SmartSip · Reserva tu termo';
    return (
      <Suspense fallback={null}>
        <PaginaReservar />
      </Suspense>
    );
  }
  document.title = 'SmartSip';
  return <AppPwa />;
}
