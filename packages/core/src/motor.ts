import type { RelojSimulado } from './reloj.ts';

/** Aceleraciones del panel del simulador (SPEC.md §7). */
export type Aceleracion = 1 | 10 | 60;
export const ACELERACIONES: readonly Aceleracion[] = [1, 10, 60];

/** Algo que evoluciona con el tiempo simulado: el termo, más adelante la app. */
export interface Simulable {
  /** Avanza `dtMs` milisegundos; `ahoraMs` es la hora al final del paso. */
  paso(dtMs: number, ahoraMs: number): void;
}

interface Programada {
  readonly enMs: number;
  readonly orden: number;
  readonly accion: () => void;
}

/**
 * Hace avanzar el tiempo simulado en pasos cortos y ejecuta acciones
 * programadas a su hora exacta. No usa temporizadores: quien lo usa decide
 * cuándo llamar a `tic` (con `setInterval`, `requestAnimationFrame` o un bucle).
 */
export class Motor {
  readonly reloj: RelojSimulado;
  readonly pasoMaxMs: number;
  #simulables: Simulable[] = [];
  #agenda: Programada[] = [];
  #contador = 0;
  #aceleracion: Aceleracion = 1;

  constructor(reloj: RelojSimulado, pasoMaxMs = 1000) {
    if (!(pasoMaxMs > 0)) throw new RangeError('El paso máximo debe ser positivo.');
    this.reloj = reloj;
    this.pasoMaxMs = pasoMaxMs;
  }

  get aceleracion(): Aceleracion {
    return this.#aceleracion;
  }

  fijarAceleracion(a: Aceleracion): void {
    this.#aceleracion = a;
  }

  agregar(s: Simulable): void {
    this.#simulables.push(s);
  }

  /** Programa una acción a una hora simulada absoluta. */
  programar(enMs: number, accion: () => void): void {
    this.#agenda.push({ enMs, orden: this.#contador++, accion });
    this.#agenda.sort((a, b) => a.enMs - b.enMs || a.orden - b.orden);
  }

  /** Avanza según el tiempo real transcurrido y la aceleración elegida. */
  tic(msReales: number): void {
    this.avanzar(msReales * this.#aceleracion);
  }

  /** Avanza una cantidad de tiempo simulado. */
  avanzar(msSimulados: number): void {
    if (!Number.isFinite(msSimulados) || msSimulados < 0) {
      throw new RangeError(`El tiempo solo avanza hacia adelante (recibí ${msSimulados} ms).`);
    }
    const objetivo = this.reloj.ahora() + msSimulados;
    this.#ejecutarVencidas();
    while (this.reloj.ahora() < objetivo) {
      const ahora = this.reloj.ahora();
      let paso = Math.min(this.pasoMaxMs, objetivo - ahora);
      const proxima = this.#agenda[0];
      if (proxima && proxima.enMs > ahora) paso = Math.min(paso, proxima.enMs - ahora);
      this.reloj.avanzar(paso);
      const t = this.reloj.ahora();
      for (const s of this.#simulables) s.paso(paso, t);
      this.#ejecutarVencidas();
    }
  }

  #ejecutarVencidas(): void {
    const ahora = this.reloj.ahora();
    while (this.#agenda[0] && this.#agenda[0].enMs <= ahora) {
      const siguiente = this.#agenda.shift();
      siguiente?.accion();
    }
  }
}
