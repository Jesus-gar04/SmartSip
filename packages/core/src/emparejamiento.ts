/**
 * Emparejamiento por código (U1): la app muestra un código de 6 dígitos y el
 * termo (el simulador, por ahora) lo escribe para unirse a esa cuenta. El
 * código caduca a los 10 minutos y sirve una sola vez.
 *
 * La app nunca muestra el simulador ni pide contraseñas al termo: el código
 * es el único secreto compartido.
 */

export const DIGITOS_CODIGO = 6;
export const VIGENCIA_CODIGO_MS = 10 * 60_000;

export type EstadoEmparejamiento = 'esperando' | 'emparejado';

export interface Emparejamiento {
  readonly codigo: string;
  /** Usuario de la app que pidió el código. */
  readonly uid: string;
  readonly estado: EstadoEmparejamiento;
  readonly expiraEnMs: number;
  /** Lo completa el termo al escribir el código. */
  readonly termoId: string | null;
  readonly termoUid: string | null;
}

/** "123456": seis dígitos, con ceros a la izquierda si toca. */
export function generarCodigo(azar: () => number = Math.random): string {
  const n = Math.floor(azar() * 10 ** DIGITOS_CODIGO) % 10 ** DIGITOS_CODIGO;
  return String(n).padStart(DIGITOS_CODIGO, '0');
}

/** Deja solo dígitos ("123 456" → "123456"). */
export function limpiarCodigo(texto: string): string {
  return texto.replace(/\D/g, '').slice(0, DIGITOS_CODIGO);
}

export function esCodigoValido(codigo: string): boolean {
  return new RegExp(`^\\d{${DIGITOS_CODIGO}}$`).test(codigo);
}

/** "123456" → "123 456", más fácil de dictar y de leer de lejos. */
export function formatoCodigo(codigo: string): string {
  return codigo.length === DIGITOS_CODIGO ? `${codigo.slice(0, 3)} ${codigo.slice(3)}` : codigo;
}

export function vigente(e: Emparejamiento, ahoraMs: number): boolean {
  return e.estado === 'esperando' && ahoraMs < e.expiraEnMs;
}

/** Canal de mensajes entre la app de una persona y su termo. */
export function idCanal(uid: string, termoId: string): string {
  return `${uid}_${termoId}`;
}

export type CodigoErrorEmparejamiento = 'no-existe' | 'vencido' | 'usado' | 'invalido' | 'sin-conexion';

export const MENSAJES_EMPAREJAMIENTO: Readonly<Record<CodigoErrorEmparejamiento, string>> = {
  'no-existe': 'Ese código no existe. Revisa los números en la app.',
  vencido: 'Ese código ya venció. Pide uno nuevo en la app.',
  usado: 'Ese código ya se usó. Pide uno nuevo en la app.',
  invalido: 'El código tiene 6 números.',
  'sin-conexion': 'No hay conexión. Inténtalo en un momento.',
};

export class ErrorEmparejamiento extends Error {
  readonly codigo: CodigoErrorEmparejamiento;
  constructor(codigo: CodigoErrorEmparejamiento) {
    super(MENSAJES_EMPAREJAMIENTO[codigo]);
    this.name = 'ErrorEmparejamiento';
    this.codigo = codigo;
  }
}
