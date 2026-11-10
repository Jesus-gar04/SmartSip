/**
 * Cuentas con Firebase Auth.
 *
 * Todo el mundo empieza como anónimo. Al crear una cuenta con correo, la
 * sesión anónima se vincula a ella (mismo uid), así que lo registrado antes se
 * conserva. Entrar con una cuenta que ya existía cambia de uid: lo anónimo
 * queda en su propio usuario.
 */
import { FirebaseError } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { ErrorCuenta, type CodigoErrorCuenta, type ServicioCuenta, type Usuario } from 'smartsip-core';

const CODIGOS: Readonly<Record<string, CodigoErrorCuenta>> = {
  'auth/email-already-in-use': 'correo-en-uso',
  'auth/credential-already-in-use': 'correo-en-uso',
  'auth/provider-already-linked': 'correo-en-uso',
  'auth/invalid-credential': 'credenciales',
  'auth/invalid-login-credentials': 'credenciales',
  'auth/wrong-password': 'credenciales',
  'auth/user-not-found': 'credenciales',
  'auth/weak-password': 'contrasena-debil',
  'auth/missing-password': 'contrasena-debil',
  'auth/invalid-email': 'correo-invalido',
  'auth/missing-email': 'correo-invalido',
  'auth/network-request-failed': 'sin-conexion',
  'auth/too-many-requests': 'demasiados-intentos',
  'auth/operation-not-allowed': 'no-permitido',
  'auth/admin-restricted-operation': 'no-permitido',
};

/** Traduce un error de Firebase Auth a un `ErrorCuenta` con la voz de SmartSip. */
export function traducirErrorAuth(error: unknown): ErrorCuenta {
  if (error instanceof ErrorCuenta) return error;
  const codigo = error instanceof FirebaseError ? CODIGOS[error.code] : undefined;
  return new ErrorCuenta(codigo ?? 'desconocido', error);
}

function aUsuario(u: User | null): Usuario | null {
  return u ? { uid: u.uid, anonimo: u.isAnonymous, email: u.email } : null;
}

const limpiarCorreo = (email: string) => email.trim().toLowerCase();

export class CuentaFirebase implements ServicioCuenta {
  readonly #auth: Auth;
  readonly #oyentes = new Set<(u: Usuario | null) => void>();
  readonly #desuscribir: () => void;
  #listo = false;

  constructor(auth: Auth) {
    this.#auth = auth;
    this.#desuscribir = onAuthStateChanged(auth, () => {
      this.#listo = true;
      this.#avisar();
    });
  }

  get usuario(): Usuario | null {
    return aUsuario(this.#auth.currentUser);
  }

  alCambiar(oyente: (usuario: Usuario | null) => void): () => void {
    this.#oyentes.add(oyente);
    if (this.#listo) oyente(this.usuario); // si aún no, llegará con el primer aviso de Firebase
    return () => this.#oyentes.delete(oyente);
  }

  /** Espera a que Firebase sepa si hay una sesión guardada. */
  async listo(): Promise<Usuario | null> {
    await this.#auth.authStateReady();
    return this.usuario;
  }

  async entrarAnonimo(): Promise<Usuario> {
    await this.#auth.authStateReady();
    const actual = this.usuario;
    if (actual) return actual;
    try {
      const { user } = await signInAnonymously(this.#auth);
      return aUsuario(user) as Usuario;
    } catch (error) {
      throw traducirErrorAuth(error);
    }
  }

  async crearCuenta(email: string, contrasena: string): Promise<Usuario> {
    const correo = limpiarCorreo(email);
    try {
      const actual = this.#auth.currentUser;
      if (actual?.isAnonymous) {
        const { user } = await linkWithCredential(actual, EmailAuthProvider.credential(correo, contrasena));
        this.#avisar(); // vincular no dispara onAuthStateChanged: el uid es el mismo
        return aUsuario(user) as Usuario;
      }
      const { user } = await createUserWithEmailAndPassword(this.#auth, correo, contrasena);
      return aUsuario(user) as Usuario;
    } catch (error) {
      throw traducirErrorAuth(error);
    }
  }

  async entrar(email: string, contrasena: string): Promise<Usuario> {
    try {
      const { user } = await signInWithEmailAndPassword(this.#auth, limpiarCorreo(email), contrasena);
      return aUsuario(user) as Usuario;
    } catch (error) {
      throw traducirErrorAuth(error);
    }
  }

  async salir(): Promise<void> {
    await signOut(this.#auth);
  }

  /** Deja de escuchar a Firebase. */
  destruir(): void {
    this.#desuscribir();
    this.#oyentes.clear();
  }

  #avisar(): void {
    const u = this.usuario;
    for (const oyente of this.#oyentes) oyente(u);
  }
}
