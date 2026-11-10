/**
 * Protocolo de mensajes entre el termo y la app (SPEC.md §8).
 *
 * Es el mismo para el bus en memoria del simulador y para Bluetooth: la app no
 * nota la diferencia. Las temperaturas viajan siempre en °C y los volúmenes en
 * ml; la unidad de la pantalla es una preferencia local del termo.
 */
import type { Brillo } from './bateria.ts';

export const VERSION_PROTOCOLO = 1;

export type Unidad = 'C' | 'F';

// ─── Eventos de nivel ───────────────────────────────────────────────────────
// Pasan por la cola sin conexión: tienen id secuencial y la hora del termo.

interface EventoNivelBase {
  /** Secuencial y creciente; la app confirma "hasta tal id". */
  readonly id: number;
  /** Hora del termo cuando el nivel se estabilizó. */
  readonly enMs: number;
  /** Mililitros que cambiaron, siempre positivo. */
  readonly ml: number;
  /** Nivel después del cambio. */
  readonly nivelMl: number;
}

/** T1: el nivel subió. No suma al consumo. */
export interface EventoLlenado extends EventoNivelBase {
  readonly tipo: 'llenado';
}

/** T2: el nivel bajó poco. Suma al consumo. */
export interface EventoSorbo extends EventoNivelBase {
  readonly tipo: 'sorbo';
}

/** T4: el nivel bajó de golpe. La app pregunta "¿Lo bebiste o lo vaciaste?". */
export interface EventoDescensoGrande extends EventoNivelBase {
  readonly tipo: 'descensoGrande';
}

export type EventoNivel = EventoLlenado | EventoSorbo | EventoDescensoGrande;

// ─── Del termo hacia la app ─────────────────────────────────────────────────

/**
 * Primer mensaje de cada conexión: quién es el termo. Los ids de los eventos
 * son únicos por termo y nunca se reinician (el contador vive en la memoria
 * no volátil), así que `termoId` + `id` identifica un evento para siempre.
 */
export interface MensajeHola {
  readonly tipo: 'hola';
  readonly enMs: number;
  readonly version: number;
  readonly termoId: string;
  readonly firmware: string;
  readonly capacidadMl: number;
  /** Último id que el termo asignó; 0 si aún no hay eventos. */
  readonly ultimoId: number;
}

/** T3: lectura periódica. No se encola: si no hay conexión, se pierde y se manda la siguiente. */
export interface MensajeEstado {
  readonly tipo: 'estado';
  readonly enMs: number;
  /** Sensor de la tapa, en °C, con una décima. */
  readonly temperaturaC: number;
  readonly nivelMl: number;
  /** Carga entre 0 y 1. */
  readonly bateria: number;
  readonly cargando: boolean;
  readonly tapaCerrada: boolean;
  readonly brillo: Brillo;
}

/** T5: la carga bajó del 15 %. Se manda una vez por descarga. */
export interface MensajeBateriaBaja {
  readonly tipo: 'bateriaBaja';
  readonly enMs: number;
  readonly bateria: number;
}

/** T6: al reconectar, el termo manda todo lo que guardó. */
export interface MensajeLote {
  readonly tipo: 'lote';
  readonly enMs: number;
  readonly eventos: readonly EventoNivel[];
  /** Eventos perdidos desde que se encendió porque la cola se llenó. */
  readonly descartados: number;
}

/** A4: cuántos bloques del firmware tiene el termo. Responde al inicio y a cada bloque. */
export interface MensajeFirmwareProgreso {
  readonly tipo: 'firmwareProgreso';
  readonly version: string;
  readonly recibidos: number;
  readonly bloques: number;
}

/** A4: el paquete llegó completo y sano; el termo se reinicia para instalarlo. */
export interface MensajeFirmwareListo {
  readonly tipo: 'firmwareListo';
  readonly version: string;
}

/** A4: el termo no puede actualizar ahora. */
export interface MensajeFirmwareError {
  readonly tipo: 'firmwareError';
  readonly version: string;
  readonly motivo: 'bateria' | 'suma';
}

export type MensajeTermo =
  | MensajeHola
  | EventoNivel
  | MensajeEstado
  | MensajeBateriaBaja
  | MensajeLote
  | MensajeFirmwareProgreso
  | MensajeFirmwareListo
  | MensajeFirmwareError;

// ─── De la app hacia el termo ───────────────────────────────────────────────

/** La app recibió todo hasta este id; el termo puede borrarlo de la cola. */
export interface MensajeConfirmar {
  readonly tipo: 'confirmar';
  readonly hastaId: number;
}

/** A3: preferencias de la pantalla del termo. */
export interface MensajePreferencias {
  readonly tipo: 'preferencias';
  readonly unidad?: Unidad;
  readonly brillo?: Brillo;
}

/** A4: empieza (o retoma) una actualización. */
export interface MensajeFirmwareInicio {
  readonly tipo: 'firmwareInicio';
  readonly version: string;
  readonly tamanoBytes: number;
  readonly bloques: number;
  /** Suma de verificación del paquete completo, en hex. */
  readonly suma: string;
}

/** A4: un bloque del paquete, en hex. */
export interface MensajeFirmwareBloque {
  readonly tipo: 'firmwareBloque';
  readonly version: string;
  readonly n: number;
  readonly datos: string;
}

export type MensajeApp = MensajeConfirmar | MensajePreferencias | MensajeFirmwareInicio | MensajeFirmwareBloque;

export type Direccion = 'termoAApp' | 'appATermo';

export function esEventoNivel(m: MensajeTermo): m is EventoNivel {
  return m.tipo === 'llenado' || m.tipo === 'sorbo' || m.tipo === 'descensoGrande';
}
