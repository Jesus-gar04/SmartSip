/**
 * El día contado por tandas: cada vez que llenas el termo empieza una tanda
 * nueva, con los sorbos que le siguen. Es como la gente recuerda su día
 * ("lo llené a las 9 y me lo tomé antes del almuerzo"), no como una lista de
 * cuarenta renglones iguales.
 */
import type { RegistroEvento } from './registros.ts';

export type Franja = 'madrugada' | 'mañana' | 'tarde' | 'noche';

export interface Tanda {
  /** El llenado que abre la tanda; `null` si el día empezó con agua de antes. */
  readonly llenado: RegistroEvento | null;
  /** Sorbos y descensos grandes, en orden. */
  readonly movimientos: readonly RegistroEvento[];
  readonly inicioMs: number;
  readonly finMs: number;
  /** Agua en el termo al empezar y al terminar la tanda. */
  readonly nivelInicialMl: number;
  readonly nivelFinalMl: number;
  /** Lo que tomaste: sorbos más descensos que dijiste haber bebido. */
  readonly bebidoMl: number;
  readonly sorbos: number;
  readonly vaciadoMl: number;
  /** Temperaturas del agua que tomaste, si se conocen. */
  readonly tempMinC: number | null;
  readonly tempMaxC: number | null;
  readonly franja: Franja;
}

export function franjaDe(hora: number): Franja {
  if (hora < 6) return 'madrugada';
  if (hora < 12) return 'mañana';
  if (hora < 19) return 'tarde';
  return 'noche';
}

function cerrar(llenado: RegistroEvento | null, movimientos: RegistroEvento[]): Tanda | null {
  const primero = llenado ?? movimientos[0];
  if (!primero) return null;
  const ultimo = movimientos.at(-1) ?? primero;
  const nivelInicialMl = llenado ? llenado.nivelMl : primero.nivelMl + primero.ml;
  let bebidoMl = 0;
  let sorbos = 0;
  let vaciadoMl = 0;
  const temps: number[] = [];
  for (const m of movimientos) {
    if (m.tipo === 'sorbo') {
      bebidoMl += m.ml;
      sorbos += 1;
      if (m.temperaturaC !== null) temps.push(m.temperaturaC);
    } else if (m.tipo === 'descensoGrande') {
      if (m.estado === 'bebido') {
        bebidoMl += m.ml;
        if (m.temperaturaC !== null) temps.push(m.temperaturaC);
      } else if (m.estado === 'vaciado') vaciadoMl += m.ml;
    }
  }
  return {
    llenado,
    movimientos,
    inicioMs: primero.enMs,
    finMs: ultimo.enMs,
    nivelInicialMl,
    nivelFinalMl: ultimo.nivelMl,
    bebidoMl,
    sorbos,
    vaciadoMl,
    tempMinC: temps.length ? Math.min(...temps) : null,
    tempMaxC: temps.length ? Math.max(...temps) : null,
    franja: franjaDe(primero.hora),
  };
}

/** Los eventos deben venir en orden de tiempo, como los da el repositorio. */
export function agruparEnTandas(eventos: readonly RegistroEvento[]): Tanda[] {
  const tandas: Tanda[] = [];
  let llenado: RegistroEvento | null = null;
  let movimientos: RegistroEvento[] = [];
  for (const e of eventos) {
    if (e.tipo === 'llenado') {
      const t = cerrar(llenado, movimientos);
      if (t) tandas.push(t);
      llenado = e;
      movimientos = [];
    } else {
      movimientos.push(e);
    }
  }
  const t = cerrar(llenado, movimientos);
  if (t) tandas.push(t);
  return tandas;
}

/** "49 min", "1 h", "2 h 05 min". */
export function duracionCorta(ms: number): string {
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${Math.max(1, min)} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto === 0 ? `${h} h` : `${h} h ${String(resto).padStart(2, '0')} min`;
}
