/**
 * Firebase para la app y para el termo simulado. Cada uno es una instancia
 * con nombre propio: si se abren en el mismo navegador, son dos usuarios
 * distintos, igual que un celular y un termo de verdad.
 */
import type { ServiciosFirebase } from 'smartsip-firebase';

type Modulo = typeof import('smartsip-firebase');

export interface ServiciosApp {
  readonly fb: Modulo;
  readonly servicios: ServiciosFirebase;
}

const instancias = new Map<string, Promise<ServiciosApp>>();

/**
 * `app` para la PWA; `termo` para el simulador; `reservas` para el formulario
 * de la preventa (anónimo, sin tocar la sesión de la app). Se crea una vez por página.
 */
export function servicios(quien: 'app' | 'termo' | 'reservas'): Promise<ServiciosApp> {
  let p = instancias.get(quien);
  if (!p) {
    const nombre = quien === 'app' ? '[DEFAULT]' : quien;
    // Con `pnpm --filter smartsip-web dev:emulador`, todo va a la Emulator Suite
    // local (pnpm emuladores) y no toca el proyecto real.
    const emulador = import.meta.env['VITE_USAR_EMULADOR'] === '1';
    p = import('smartsip-firebase').then((fb) => ({
      fb,
      servicios: emulador
        ? fb.iniciarFirebase(
            { apiKey: 'demo-key', authDomain: 'demo-smartsip.firebaseapp.com', projectId: 'demo-smartsip', appId: 'demo-app' },
            { nombre, emulador: fb.EMULADOR_LOCAL },
          )
        : fb.iniciarFirebase(fb.configDesdeEntorno(import.meta.env as Record<string, string | undefined>), { nombre }),
    }));
    instancias.set(quien, p);
  }
  return p;
}
