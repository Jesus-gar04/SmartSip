/**
 * Detección de llenado, sorbo y descenso grande a partir del sensor de nivel.
 *
 * El sensor solo sabe cuánta agua hay. Mientras se bebe, el termo está
 * inclinado y la lectura salta; por eso solo cuenta una lectura que se
 * mantiene estable cierto tiempo, y se compara con la última lectura estable.
 *
 * Reglas acordadas (caso T4):
 * - Cambios menores que el ruido: se ignoran.
 * - Baja hasta `maxSorboMl` (150 ml): sorbo, suma al consumo.
 * - Baja más que eso: descenso grande; no suma hasta que la persona responda
 *   "¿Lo bebiste o lo vaciaste?".
 * - Sube `minLlenadoMl` (30 ml) o más: llenado.
 * - Sube menos que eso: se toma como nueva referencia sin avisar.
 */

export interface ReglasNivel {
  /** Tiempo que la lectura debe mantenerse para contar como estable. */
  readonly estableMs: number;
  /** Variación máxima entre lecturas para seguir considerándolas la misma. */
  readonly toleranciaEstabilidadMl: number;
  /** Cambios por debajo de esto son ruido del sensor. */
  readonly ruidoMl: number;
  /** Mayor bajada que se acepta como sorbo sin preguntar. */
  readonly maxSorboMl: number;
  /** Menor subida que se avisa como llenado. */
  readonly minLlenadoMl: number;
}

export const REGLAS_NIVEL: ReglasNivel = {
  estableMs: 2000,
  toleranciaEstabilidadMl: 2,
  ruidoMl: 5,
  maxSorboMl: 150,
  minLlenadoMl: 30,
};

export type TipoCambioNivel = 'llenado' | 'sorbo' | 'descensoGrande';

export type Clasificacion = TipoCambioNivel | 'ruido' | 'ajuste';

export interface CambioNivel {
  readonly tipo: TipoCambioNivel;
  /** Mililitros que cambiaron, redondeados y siempre positivos. */
  readonly ml: number;
  /** Nivel estable después del cambio. */
  readonly nivelMl: number;
  /** Hora en que la lectura se volvió estable. */
  readonly enMs: number;
}

/** Clasifica una diferencia entre dos lecturas estables. Positiva si el nivel subió. */
export function clasificarCambio(deltaMl: number, reglas: ReglasNivel = REGLAS_NIVEL): Clasificacion {
  if (Math.abs(deltaMl) < reglas.ruidoMl) return 'ruido';
  if (deltaMl > 0) return deltaMl >= reglas.minLlenadoMl ? 'llenado' : 'ajuste';
  return -deltaMl <= reglas.maxSorboMl ? 'sorbo' : 'descensoGrande';
}

export class DetectorNivel {
  readonly reglas: ReglasNivel;
  #referenciaMl: number;
  #candidatoMl: number | null = null;
  #candidatoDesdeMs = 0;
  #evaluado = false;

  constructor(nivelInicialMl: number, reglas: ReglasNivel = REGLAS_NIVEL) {
    this.#referenciaMl = nivelInicialMl;
    this.reglas = reglas;
  }

  /** Última lectura estable que sirve de referencia. */
  get referenciaMl(): number {
    return this.#referenciaMl;
  }

  /**
   * Entrega una lectura del sensor. Devuelve un cambio cuando una lectura nueva
   * se estabiliza y no es ruido; si no, `null`.
   */
  lectura(nivelMl: number, enMs: number): CambioNivel | null {
    const r = this.reglas;
    if (this.#candidatoMl === null || Math.abs(nivelMl - this.#candidatoMl) > r.toleranciaEstabilidadMl) {
      this.#candidatoMl = nivelMl;
      this.#candidatoDesdeMs = enMs;
      this.#evaluado = false;
      return null;
    }
    if (this.#evaluado || enMs - this.#candidatoDesdeMs < r.estableMs) return null;

    this.#evaluado = true;
    const delta = nivelMl - this.#referenciaMl;
    const tipo = clasificarCambio(delta, r);
    if (tipo === 'ruido') return null;
    this.#referenciaMl = nivelMl;
    if (tipo === 'ajuste') return null;
    return { tipo, ml: Math.round(Math.abs(delta)), nivelMl: Math.round(nivelMl), enMs };
  }
}
