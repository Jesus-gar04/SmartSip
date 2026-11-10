/**
 * Cómo se guarda lo que pasa con el termo: cada evento como un registro y
 * cada día como un resumen ya sumado, para que el historial y los hábitos se
 * lean con una consulta pequeña en lugar de recorrer todos los sorbos.
 *
 * Funciones puras: las usan el repositorio en memoria y el de Firestore, así
 * los dos suman exactamente igual.
 */
import { claveDia } from './consumo.ts';
import type { TipoCambioNivel } from './nivel.ts';
import type { EventoNivel } from './protocolo.ts';

/**
 * - `registrado`: sorbo o llenado normal.
 * - `pendiente`: descenso grande que espera "¿Lo bebiste o lo vaciaste?".
 * - `bebido` / `vaciado`: la respuesta de la persona.
 */
export type EstadoRegistro = 'registrado' | 'pendiente' | 'bebido' | 'vaciado';

export interface RegistroEvento {
  /** Id del documento: termo + id con ceros, para que se ordene solo. */
  readonly clave: string;
  readonly termoId: string;
  readonly id: number;
  readonly tipo: TipoCambioNivel;
  readonly ml: number;
  readonly nivelMl: number;
  readonly enMs: number;
  /** Día local "AAAA-MM-DD". */
  readonly dia: string;
  /** Hora local, de 0 a 23. */
  readonly hora: number;
  /** Temperatura del agua en ese momento; `null` si no se conoce (por ejemplo, un sorbo sin conexión). */
  readonly temperaturaC: number | null;
  readonly estado: EstadoRegistro;
}

export interface ResumenDia {
  readonly fecha: string;
  readonly totalMl: number;
  readonly sorbos: number;
  /** Mililitros bebidos en cada hora local, del 0 al 23. */
  readonly porHora: readonly number[];
  readonly llenados: number;
  readonly llenadoMl: number;
  /** Suma de las temperaturas de los sorbos con temperatura conocida. */
  readonly tempSumaC: number;
  readonly tempMuestras: number;
  /** Meta que tuvo ese día, si la app ya la calculó. */
  readonly metaMl: number | null;
  /** Temperatura del clima con la que se calculó la meta. */
  readonly climaC: number | null;
}

/** Lo que un registro suma a su día. */
export interface AporteDia {
  readonly fecha: string;
  readonly hora: number;
  readonly totalMl: number;
  readonly sorbos: number;
  readonly llenados: number;
  readonly llenadoMl: number;
  readonly tempSumaC: number;
  readonly tempMuestras: number;
}

const HORAS = 24;
const MS_DIA = 86_400_000;

export function claveEvento(termoId: string, id: number): string {
  return `${termoId}_${String(id).padStart(10, '0')}`;
}

export function horaLocal(enMs: number, desfaseMin: number): number {
  return new Date(enMs + desfaseMin * 60_000).getUTCHours();
}

export function aRegistro(
  termoId: string,
  evento: EventoNivel,
  temperaturaC: number | null,
  desfaseMin: number,
): RegistroEvento {
  return {
    clave: claveEvento(termoId, evento.id),
    termoId,
    id: evento.id,
    tipo: evento.tipo,
    ml: evento.ml,
    nivelMl: evento.nivelMl,
    enMs: evento.enMs,
    dia: claveDia(evento.enMs, desfaseMin),
    hora: horaLocal(evento.enMs, desfaseMin),
    temperaturaC: temperaturaC === null ? null : Math.round(temperaturaC * 10) / 10,
    estado: evento.tipo === 'descensoGrande' ? 'pendiente' : 'registrado',
  };
}

/** Lo que el registro suma a su día, o `null` si no suma nada todavía. */
export function aporte(r: RegistroEvento): AporteDia | null {
  const base = { fecha: r.dia, hora: r.hora, totalMl: 0, sorbos: 0, llenados: 0, llenadoMl: 0, tempSumaC: 0, tempMuestras: 0 };
  const bebe = (r.tipo === 'sorbo' && r.estado === 'registrado') || (r.tipo === 'descensoGrande' && r.estado === 'bebido');
  if (bebe) {
    const conTemp = r.temperaturaC !== null;
    return {
      ...base,
      totalMl: r.ml,
      sorbos: 1,
      tempSumaC: conTemp ? (r.temperaturaC ?? 0) : 0,
      tempMuestras: conTemp ? 1 : 0,
    };
  }
  if (r.tipo === 'llenado') return { ...base, llenados: 1, llenadoMl: r.ml };
  return null;
}

export function resumenVacio(fecha: string): ResumenDia {
  return {
    fecha,
    totalMl: 0,
    sorbos: 0,
    porHora: Array.from({ length: HORAS }, () => 0),
    llenados: 0,
    llenadoMl: 0,
    tempSumaC: 0,
    tempMuestras: 0,
    metaMl: null,
    climaC: null,
  };
}

export function sumarAporte(r: ResumenDia, a: AporteDia): ResumenDia {
  return {
    ...r,
    totalMl: r.totalMl + a.totalMl,
    sorbos: r.sorbos + a.sorbos,
    porHora: r.porHora.map((ml, h) => (h === a.hora ? ml + a.totalMl : ml)),
    llenados: r.llenados + a.llenados,
    llenadoMl: r.llenadoMl + a.llenadoMl,
    tempSumaC: r.tempSumaC + a.tempSumaC,
    tempMuestras: r.tempMuestras + a.tempMuestras,
  };
}

/** Temperatura promedio a la que bebiste ese día. */
export function temperaturaPromedio(r: ResumenDia): number | null {
  return r.tempMuestras === 0 ? null : r.tempSumaC / r.tempMuestras;
}

export function metaCumplida(r: ResumenDia): boolean {
  return r.metaMl !== null && r.totalMl >= r.metaMl;
}

/** "2026-11-09" + 1 → "2026-11-10". */
export function sumarDias(fecha: string, dias: number): string {
  const ms = Date.parse(`${fecha}T00:00:00Z`);
  if (Number.isNaN(ms)) throw new RangeError(`Fecha inválida: "${fecha}".`);
  return new Date(ms + dias * MS_DIA).toISOString().slice(0, 10);
}

/**
 * El repositorio solo devuelve los días que tienen datos. Esto completa el
 * rango con días vacíos, en orden, para dibujar la semana entera.
 */
export function rellenarDias(desde: string, hasta: string, dias: readonly ResumenDia[]): ResumenDia[] {
  const porFecha = new Map(dias.map((d) => [d.fecha, d]));
  const salida: ResumenDia[] = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) salida.push(porFecha.get(f) ?? resumenVacio(f));
  return salida;
}
