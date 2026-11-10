/**
 * Rutas de la PWA: la app en `/` y el simulador en `/simulador`. Sin
 * librería de rutas: son dos páginas y el simulador se carga aparte, para
 * que la app no descargue el 3D si no lo usa.
 */
import { lazy, Suspense } from 'react';
import { AppPwa } from './app/AppPwa.tsx';

const PaginaSimulador = lazy(() =>
  import('./paginas/Simulador.tsx').then((m) => ({ default: m.PaginaSimulador })),
);

const esSimulador = () => /^\/simulador\/?$/.test(location.pathname);

export function App() {
  if (esSimulador()) {
    document.title = 'SmartSip · Simulador';
    return (
      <Suspense fallback={null}>
        <PaginaSimulador />
      </Suspense>
    );
  }
  document.title = 'SmartSip';
  return <AppPwa />;
}
