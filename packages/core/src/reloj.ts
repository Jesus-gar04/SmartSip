/**
 * Fuente de tiempo del núcleo. Fuera de `relojDelSistema`, nada en el núcleo lee
 * `Date.now()`: así las pruebas son deterministas y el simulador puede acelerar
 * el tiempo.
 */
export interface Reloj {
  /** Milisegundos desde la época Unix, en tiempo simulado. */
  ahora(): number;
}

export class RelojSimulado implements Reloj {
  #ahora: number;

  constructor(inicioMs: number) {
    this.#ahora = inicioMs;
  }

  ahora(): number {
    return this.#ahora;
  }

  avanzar(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) {
      throw new RangeError(`El tiempo solo avanza hacia adelante (recibí ${ms} ms).`);
    }
    this.#ahora += ms;
  }
}

/** Reloj que sigue a la hora real del dispositivo. Para la app, no para el simulador. */
export const relojDelSistema: Reloj = { ahora: () => Date.now() };
