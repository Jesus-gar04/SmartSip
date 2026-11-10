/**
 * Arranque de Firebase para SmartSip.
 *
 * - Firestore con caché persistente en el navegador (IndexedDB, varias
 *   pestañas): la app funciona sin internet y sube lo pendiente al volver.
 * - En Node (pruebas) y donde no hay IndexedDB, caché en memoria.
 * - Con `emulador`, todo apunta a la Firebase Emulator Suite local.
 */
import { deleteApp, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  terminate,
  type Firestore,
} from 'firebase/firestore';

export interface ConfigFirebase {
  readonly apiKey: string;
  readonly authDomain: string;
  readonly projectId: string;
  readonly storageBucket?: string;
  readonly messagingSenderId?: string;
  readonly appId: string;
}

export interface Emulador {
  readonly host: string;
  readonly puertoFirestore: number;
  readonly puertoAuth: number;
}

export const EMULADOR_LOCAL: Emulador = { host: '127.0.0.1', puertoFirestore: 8080, puertoAuth: 9099 };

export interface OpcionesFirebase {
  /** `persistente` guarda en el dispositivo; por defecto, si hay IndexedDB. */
  readonly cache?: 'persistente' | 'memoria';
  readonly emulador?: Emulador;
  /** Nombre de la instancia; solo hace falta para tener varias a la vez (pruebas). */
  readonly nombre?: string;
}

export interface ServiciosFirebase {
  readonly app: FirebaseApp;
  readonly db: Firestore;
  readonly auth: Auth;
  /** Cierra las conexiones y libera la instancia. */
  cerrar(): Promise<void>;
}

const hayIndexedDb = (): boolean => 'indexedDB' in globalThis;

export function iniciarFirebase(config: ConfigFirebase, opciones: OpcionesFirebase = {}): ServiciosFirebase {
  const app = initializeApp(config as FirebaseOptions, opciones.nombre);
  const cache = opciones.cache ?? (hayIndexedDb() ? 'persistente' : 'memoria');
  const db = initializeFirestore(app, {
    localCache:
      cache === 'persistente'
        ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        : memoryLocalCache(),
    ignoreUndefinedProperties: true,
  });
  const auth = getAuth(app);
  if (opciones.emulador) {
    const { host, puertoFirestore, puertoAuth } = opciones.emulador;
    connectFirestoreEmulator(db, host, puertoFirestore);
    connectAuthEmulator(auth, `http://${host}:${puertoAuth}`, { disableWarnings: true });
  }
  return {
    app,
    db,
    auth,
    cerrar: async () => {
      await terminate(db);
      await deleteApp(app);
    },
  };
}

const VARIABLES = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  storageBucket: 'VITE_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'VITE_FIREBASE_APP_ID',
} as const;

const OBLIGATORIAS = ['apiKey', 'authDomain', 'projectId', 'appId'] as const;

/** Lee la configuración de variables de entorno `VITE_FIREBASE_*`. */
export function configDesdeEntorno(entorno: Readonly<Record<string, string | undefined>>): ConfigFirebase {
  const leer = (clave: keyof typeof VARIABLES) => entorno[VARIABLES[clave]]?.trim() || undefined;
  const faltan = OBLIGATORIAS.filter((c) => !leer(c)).map((c) => VARIABLES[c]);
  if (faltan.length > 0) {
    throw new Error(`Falta configurar Firebase: ${faltan.join(', ')}. Copia apps/web/.env.example como .env.local.`);
  }
  const storageBucket = leer('storageBucket');
  const messagingSenderId = leer('messagingSenderId');
  return {
    apiKey: leer('apiKey') as string,
    authDomain: leer('authDomain') as string,
    projectId: leer('projectId') as string,
    appId: leer('appId') as string,
    ...(storageBucket ? { storageBucket } : {}),
    ...(messagingSenderId ? { messagingSenderId } : {}),
  };
}
