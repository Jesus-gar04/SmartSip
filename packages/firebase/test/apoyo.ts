/** Utilidades para probar contra la Firebase Emulator Suite. */
import { signInAnonymously } from 'firebase/auth';
import { EMULADOR_LOCAL, iniciarFirebase, type ServiciosFirebase } from '../src/index.ts';

export const PROYECTO_PRUEBAS = 'demo-smartsip';

let contador = 0;

/** Una instancia de Firebase propia, conectada a los emuladores. */
export function firebaseDePrueba(): ServiciosFirebase {
  return iniciarFirebase(
    { apiKey: 'demo-key', authDomain: `${PROYECTO_PRUEBAS}.firebaseapp.com`, projectId: PROYECTO_PRUEBAS, appId: 'demo-app' },
    { cache: 'memoria', emulador: EMULADOR_LOCAL, nombre: `prueba-${process.pid}-${++contador}` },
  );
}

/** Instancia nueva con un usuario anónimo nuevo: cada prueba tiene sus propios datos. */
export async function usuarioDePrueba(): Promise<{ servicios: ServiciosFirebase; uid: string }> {
  const servicios = firebaseDePrueba();
  const { user } = await signInAnonymously(servicios.auth);
  return { servicios, uid: user.uid };
}
