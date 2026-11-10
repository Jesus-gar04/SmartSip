/**
 * Física térmica simulada: ley de enfriamiento de Newton.
 *
 *   T(t) = T_amb + (T_0 − T_amb) · e^(−k·t)
 *
 * El coeficiente k depende del aislamiento, de la tapa y del nivel de líquido.
 * Con k constante durante un paso, la solución cerrada es exacta: no se
 * acumula error aunque el paso sea largo.
 */

export interface ReglasTermicas {
  /**
   * k con el termo cerrado y lleno, por hora. 0,05 h⁻¹ da que el agua baje de
   * 95 °C a unos 63 °C en 12 h con 25 °C de ambiente.
   */
  readonly kCerradoLlenoPorHora: number;
  /** Con la tapa abierta el calor escapa este número de veces más rápido. */
  readonly factorTapaAbierta: number;
  /**
   * Fracción de llenado mínima que se usa en el cálculo: con muy poca agua la
   * masa térmica es pequeña, pero k no puede crecer sin límite.
   */
  readonly fraccionMinima: number;
}

export const REGLAS_TERMICAS: ReglasTermicas = {
  kCerradoLlenoPorHora: 0.05,
  factorTapaAbierta: 10,
  fraccionMinima: 0.15,
};

export interface CondicionTermica {
  readonly tapaCerrada: boolean;
  /** Nivel de líquido entre 0 (vacío) y 1 (lleno). */
  readonly fraccionLlenado: number;
  /**
   * Multiplicador del aislamiento. 1 es el acero de doble pared al vacío del
   * SmartSip; un termo dañado tendría un valor mayor.
   */
  readonly factorAislamiento?: number;
}

const MS_POR_HORA = 3_600_000;

function acotar(x: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, x));
}

/** Coeficiente k, por hora, para las condiciones dadas. */
export function coeficienteEnfriamiento(
  c: CondicionTermica,
  reglas: ReglasTermicas = REGLAS_TERMICAS,
): number {
  const fraccion = Math.max(acotar(c.fraccionLlenado, 0, 1), reglas.fraccionMinima);
  const tapa = c.tapaCerrada ? 1 : reglas.factorTapaAbierta;
  const aislamiento = c.factorAislamiento ?? 1;
  return (reglas.kCerradoLlenoPorHora * aislamiento * tapa) / fraccion;
}

/** Temperatura tras `dtMs` milisegundos con k constante. Vale para enfriar y para calentar. */
export function temperaturaTras(
  temperaturaC: number,
  ambienteC: number,
  kPorHora: number,
  dtMs: number,
): number {
  return ambienteC + (temperaturaC - ambienteC) * Math.exp((-kPorHora * dtMs) / MS_POR_HORA);
}

/** Tiempo, en ms, para pasar de `desdeC` a `hastaC` con k constante. Infinity si nunca llega. */
export function tiempoHasta(
  desdeC: number,
  hastaC: number,
  ambienteC: number,
  kPorHora: number,
): number {
  const inicial = desdeC - ambienteC;
  const final = hastaC - ambienteC;
  if (inicial === final) return 0;
  // Debe estar del mismo lado del ambiente y más cerca de él.
  if (inicial * final <= 0 || Math.abs(final) > Math.abs(inicial)) return Number.POSITIVE_INFINITY;
  return (Math.log(inicial / final) / kPorHora) * MS_POR_HORA;
}

/** Temperatura de equilibrio al mezclar dos volúmenes de agua. */
export function mezclar(volumen1Ml: number, t1C: number, volumen2Ml: number, t2C: number): number {
  const total = volumen1Ml + volumen2Ml;
  if (total <= 0) return t2C;
  return (volumen1Ml * t1C + volumen2Ml * t2C) / total;
}

export function celsiusAFahrenheit(c: number): number {
  return (c * 9) / 5 + 32;
}

export function fahrenheitACelsius(f: number): number {
  return ((f - 32) * 5) / 9;
}
