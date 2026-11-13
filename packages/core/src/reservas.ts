/**
 * Reservas de la preventa: lo que se pide en el formulario, cómo se valida
 * y cuántos cupos quedan. Sin Firebase: el adaptador vive en smartsip-firebase
 * y las reglas de Firestore repiten estas mismas condiciones.
 */

/** Unidades de la preventa. Si cambia, cambiar también `CUPOS` en firestore.rules. */
export const CUPOS_PREVENTA = 50;
/** Termos que puede apartar una persona en una reserva. */
export const MAX_POR_RESERVA = 2;
export const PRECIO_PREVENTA = 109_900;
export const PRECIO_ANTES = 129_900;

export type Entrega = 'universidad' | 'gimnasio' | 'domicilio';

export const ENTREGAS: ReadonlyArray<{ readonly valor: Entrega; readonly etiqueta: string; readonly pista: string }> = [
  { valor: 'universidad', etiqueta: 'En mi universidad', pista: '¿Cuál universidad?' },
  { valor: 'gimnasio', etiqueta: 'En mi gimnasio', pista: '¿Cuál gimnasio?' },
  { valor: 'domicilio', etiqueta: 'A domicilio', pista: 'Barrio y ciudad' },
];

/** Lo que escribe la persona, tal cual. */
export interface BorradorReserva {
  readonly nombre: string;
  readonly celular: string;
  readonly correo: string;
  readonly cantidad: number;
  readonly entrega: Entrega | '';
  readonly lugar: string;
  readonly acepta: boolean;
}

/** La reserva ya limpia y validada, lista para guardar. */
export interface DatosReserva {
  readonly nombre: string;
  /** Diez dígitos, sin +57 ni espacios. */
  readonly celular: string;
  readonly correo: string;
  readonly cantidad: number;
  readonly entrega: Entrega;
  readonly lugar: string;
}

export interface Reserva extends DatosReserva {
  readonly numero: number;
  readonly codigo: string;
}

export type CampoReserva = keyof BorradorReserva;
export type ErroresReserva = Partial<Record<CampoReserva, string>>;

export const BORRADOR_VACIO: BorradorReserva = {
  nombre: '',
  celular: '',
  correo: '',
  cantidad: 1,
  entrega: '',
  lugar: '',
  acepta: false,
};

const espacios = (s: string) => s.trim().replace(/\s+/g, ' ');

/** Celular de Colombia: 10 dígitos que empiezan por 3. Acepta +57, espacios y guiones. */
export function normalizarCelular(texto: string): string | null {
  let d = texto.replace(/[\s\-().]/g, '');
  if (d.startsWith('+57')) d = d.slice(3);
  else if (d.startsWith('57') && d.length === 12) d = d.slice(2);
  return /^3\d{9}$/.test(d) ? d : null;
}

/** 3001234567 → 300 123 4567 */
export function formatoCelular(celular: string): string {
  return celular.length === 10 ? `${celular.slice(0, 3)} ${celular.slice(3, 6)} ${celular.slice(6)}` : celular;
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Valida el borrador. Devuelve los datos limpios o, si algo falta, un error por campo. */
export function validarReserva(b: BorradorReserva): { ok: true; datos: DatosReserva } | { ok: false; errores: ErroresReserva } {
  const errores: ErroresReserva = {};
  const nombre = espacios(b.nombre);
  if (nombre.length < 2) errores.nombre = 'Escribe tu nombre para saber a quién le apartamos el termo.';
  else if (nombre.length > 80) errores.nombre = 'El nombre puede tener hasta 80 letras.';

  const celular = normalizarCelular(b.celular);
  if (!celular) errores.celular = 'El celular tiene 10 números y empieza por 3, como 300 123 4567.';

  const correo = b.correo.trim().toLowerCase();
  if (!CORREO.test(correo) || correo.length > 120) errores.correo = 'Revisa el correo: debe verse como nombre@correo.com.';

  if (!Number.isInteger(b.cantidad) || b.cantidad < 1 || b.cantidad > MAX_POR_RESERVA) {
    errores.cantidad = `Puedes apartar de 1 a ${MAX_POR_RESERVA} termos.`;
  }

  if (!b.entrega) errores.entrega = 'Elige dónde quieres recibir el termo.';
  const lugar = espacios(b.lugar);
  if (b.entrega && lugar.length < 2) {
    errores.lugar =
      b.entrega === 'domicilio' ? 'Escribe el barrio y la ciudad para el envío.' : `Escribe el nombre de tu ${b.entrega}.`;
  } else if (lugar.length > 120) errores.lugar = 'El lugar puede tener hasta 120 letras.';

  if (!b.acepta) errores.acepta = 'Necesitamos tu permiso para escribirte cuando el termo esté listo.';

  if (Object.keys(errores).length > 0 || !celular || !b.entrega) return { ok: false, errores };
  return { ok: true, datos: { nombre, celular, correo, cantidad: b.cantidad, entrega: b.entrega, lugar } };
}

/** 7 → SS-0007 */
export function codigoReserva(numero: number): string {
  return `SS-${String(numero).padStart(4, '0')}`;
}

export function cuposRestantes(reservados: number, total: number = CUPOS_PREVENTA): number {
  return Math.max(0, total - reservados);
}

/** 109900 → $109.900 */
export function formatoPesos(valor: number): string {
  return `$${Math.round(valor)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

/** Frase del contador, con la guía de voz: primero el dato. */
export function textoCupos(restantes: number, total: number = CUPOS_PREVENTA): string {
  if (restantes <= 0) return `Se apartaron los ${total} termos de la preventa.`;
  if (restantes === 1) return `Queda 1 termo de ${total} en la preventa.`;
  return `Quedan ${restantes} termos de ${total} en la preventa.`;
}

export type CodigoErrorReserva = 'agotado' | 'pocos' | 'sin-conexion' | 'rechazada';

export const MENSAJES_RESERVA: Readonly<Record<CodigoErrorReserva, string>> = {
  agotado: 'Los termos de la preventa ya se apartaron todos. Gracias por querer uno.',
  pocos: 'Ya no quedan tantos termos en la preventa. Baja la cantidad e inténtalo otra vez.',
  'sin-conexion': 'No hay conexión. Tus datos siguen aquí: inténtalo en un momento.',
  rechazada: 'No pudimos guardar la reserva. Revisa los datos e inténtalo otra vez.',
};

export class ErrorReserva extends Error {
  readonly codigo: CodigoErrorReserva;
  constructor(codigo: CodigoErrorReserva) {
    super(MENSAJES_RESERVA[codigo]);
    this.name = 'ErrorReserva';
    this.codigo = codigo;
  }
}
