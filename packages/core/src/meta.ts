/**
 * Meta diaria de agua (caso U2): peso, actividad y clima.
 *
 * Es una regla del producto, no una recomendación médica. Fórmula acordada:
 *   base      = 35 ml por kg
 *   actividad = +0 (baja), +350 (media), +700 ml (alta)
 *   clima     = +100 ml por cada 3 °C completos por encima de 27 °C
 *   total     redondeado a 100 ml y acotado entre 1,5 y 4,0 L
 *
 * Con 69 kg y actividad baja da 2,4 L; a 33 °C sube a 2,6 L.
 */
import { ESPACIO_UNIDAD, formatoLitros } from './formato.ts';

export type Actividad = 'baja' | 'media' | 'alta';

export interface PerfilMeta {
  readonly pesoKg: number;
  readonly actividad: Actividad;
}

export interface ClimaDia {
  /** Temperatura máxima prevista para el día, en °C. */
  readonly temperaturaC: number;
}

export interface ReglasMeta {
  readonly mlPorKg: number;
  readonly mlPorActividad: Readonly<Record<Actividad, number>>;
  readonly umbralCalorC: number;
  readonly pasoCalorC: number;
  readonly mlPorPasoCalor: number;
  readonly redondeoMl: number;
  readonly minimoMl: number;
  readonly maximoMl: number;
}

export const REGLAS_META: ReglasMeta = {
  mlPorKg: 35,
  mlPorActividad: { baja: 0, media: 350, alta: 700 },
  umbralCalorC: 27,
  pasoCalorC: 3,
  mlPorPasoCalor: 100,
  redondeoMl: 100,
  minimoMl: 1500,
  maximoMl: 4000,
};

export interface Meta {
  /** Lo que se muestra: redondeado y acotado. */
  readonly totalMl: number;
  readonly pesoMl: number;
  readonly actividadMl: number;
  readonly climaMl: number;
  /** Lo que se usó para calcularla, para poder explicar cambios. */
  readonly perfil: PerfilMeta;
  readonly clima: ClimaDia;
}

export function calcularMeta(perfil: PerfilMeta, clima: ClimaDia, reglas: ReglasMeta = REGLAS_META): Meta {
  if (!(perfil.pesoKg > 0)) throw new RangeError('El peso debe ser positivo.');
  const pesoMl = perfil.pesoKg * reglas.mlPorKg;
  const actividadMl = reglas.mlPorActividad[perfil.actividad];
  const pasos = Math.max(0, Math.floor((clima.temperaturaC - reglas.umbralCalorC) / reglas.pasoCalorC));
  const climaMl = pasos * reglas.mlPorPasoCalor;
  const crudo = pesoMl + actividadMl + climaMl;
  const redondeado = Math.round(crudo / reglas.redondeoMl) * reglas.redondeoMl;
  const totalMl = Math.min(reglas.maximoMl, Math.max(reglas.minimoMl, redondeado));
  return { totalMl, pesoMl, actividadMl, climaMl, perfil, clima };
}

/**
 * Una línea que explica por qué cambió la meta (detalle 5 de SPEC.md §5),
 * o `null` si la cifra no cambió.
 * Ejemplo: "Hoy hace 33 °C, subimos tu meta a 2,6 L."
 */
export function explicarCambio(anterior: Meta, nueva: Meta): string | null {
  if (anterior.totalMl === nueva.totalMl) return null;
  const litros = formatoLitros(nueva.totalMl);
  const sube = nueva.totalMl > anterior.totalMl;

  if (nueva.climaMl !== anterior.climaMl) {
    const t = `${Math.round(nueva.clima.temperaturaC)}${ESPACIO_UNIDAD}°C`;
    return sube
      ? `Hoy hace ${t}, así que subimos tu meta a ${litros}.`
      : `Hoy el día está más fresco (${t}): tu meta vuelve a ${litros}.`;
  }
  if (nueva.actividadMl !== anterior.actividadMl) {
    return `Con tu nueva rutina, tu meta queda en ${litros}.`;
  }
  return `Con tu peso actualizado (${Math.round(nueva.perfil.pesoKg)}${ESPACIO_UNIDAD}kg), tu meta queda en ${litros}.`;
}
