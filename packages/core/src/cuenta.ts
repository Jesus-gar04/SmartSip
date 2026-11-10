/**
 * Cuentas: cada persona empieza como anónima y puede crear una cuenta con
 * correo y contraseña sin perder lo que ya registró. La app solo conoce esta
 * interfaz; la implementación con Firebase Auth está en `smartsip-firebase`.
 */

export interface Usuario {
  readonly uid: string;
  readonly anonimo: boolean;
  readonly email: string | null;
}

export type CodigoErrorCuenta =
  | 'correo-en-uso'
  | 'credenciales'
  | 'contrasena-debil'
  | 'correo-invalido'
  | 'sin-conexion'
  | 'demasiados-intentos'
  | 'no-permitido'
  | 'sin-sesion'
  | 'desconocido';

/** Mensajes con la voz de SmartSip: breves, cálidos y sin culpa. */
export const MENSAJES_CUENTA: Readonly<Record<CodigoErrorCuenta, string>> = {
  'correo-en-uso': 'Ese correo ya tiene una cuenta. Entra con él.',
  credenciales: 'El correo o la contraseña no coinciden. Revísalos e inténtalo otra vez.',
  'contrasena-debil': 'Usa una contraseña de al menos 6 caracteres.',
  'correo-invalido': 'Revisa el correo; parece que le falta algo.',
  'sin-conexion': 'No hay conexión a internet. Inténtalo en un momento.',
  'demasiados-intentos': 'Demasiados intentos. Espera un poco y vuelve a probar.',
  'no-permitido': 'Este tipo de acceso no está activado.',
  'sin-sesion': 'Primero hay que entrar.',
  desconocido: 'Algo no salió como esperábamos. Inténtalo de nuevo.',
};

export class ErrorCuenta extends Error {
  readonly codigo: CodigoErrorCuenta;
  constructor(codigo: CodigoErrorCuenta, causa?: unknown) {
    super(MENSAJES_CUENTA[codigo], causa === undefined ? undefined : { cause: causa });
    this.name = 'ErrorCuenta';
    this.codigo = codigo;
  }
}

export interface ServicioCuenta {
  /** Usuario actual, o `null` si nadie ha entrado. */
  readonly usuario: Usuario | null;
  /** Avisa cada vez que cambia el usuario, empezando por el actual. */
  alCambiar(oyente: (usuario: Usuario | null) => void): () => void;
  /** Entra sin cuenta. Si ya hay un usuario, lo devuelve. */
  entrarAnonimo(): Promise<Usuario>;
  /** Crea una cuenta. Si el usuario actual es anónimo, conserva sus datos. */
  crearCuenta(email: string, contrasena: string): Promise<Usuario>;
  entrar(email: string, contrasena: string): Promise<Usuario>;
  salir(): Promise<void>;
}
