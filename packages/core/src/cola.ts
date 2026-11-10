/**
 * Cola sin conexión (caso T6).
 *
 * El termo guarda cada evento de nivel hasta que la app confirma que lo
 * recibió. Al reconectar manda todo lo pendiente en un lote. La app descarta lo
 * que ya tenía por id, así que reenviar nunca duplica un sorbo.
 */

export const CAPACIDAD_COLA = 500;

export interface ConId {
  readonly id: number;
}

/** Lado del termo: guarda hasta que la app confirma. */
export class ColaSinConexion<E extends ConId> {
  readonly capacidad: number;
  #items: E[] = [];
  #descartados = 0;

  constructor(capacidad: number = CAPACIDAD_COLA) {
    if (!Number.isInteger(capacidad) || capacidad < 1) {
      throw new RangeError('La capacidad de la cola debe ser un entero positivo.');
    }
    this.capacidad = capacidad;
  }

  /** Guarda un evento. Si la cola está llena, se pierde el más antiguo: valen más los recientes. */
  encolar(evento: E): void {
    this.#items.push(evento);
    if (this.#items.length > this.capacidad) {
      this.#items.shift();
      this.#descartados++;
    }
  }

  /** Copia de lo pendiente, del más antiguo al más reciente. */
  pendientes(): readonly E[] {
    return [...this.#items];
  }

  /** Borra todo lo que tenga id menor o igual. Devuelve cuántos borró. */
  confirmarHasta(id: number): number {
    const antes = this.#items.length;
    this.#items = this.#items.filter((e) => e.id > id);
    return antes - this.#items.length;
  }

  get tamano(): number {
    return this.#items.length;
  }

  /** Eventos perdidos por falta de espacio desde que se creó la cola. */
  get descartados(): number {
    return this.#descartados;
  }
}

/** Lado de la app: deja pasar cada id una sola vez. */
export class RegistroRecibidos {
  #ultimoId: number;

  /** `ultimoId`: lo último que ya está guardado, por ejemplo al reabrir la app. */
  constructor(ultimoId = 0) {
    this.#ultimoId = ultimoId;
  }

  /** `true` si el evento es nuevo y hay que aplicarlo. */
  aceptar(id: number): boolean {
    if (id <= this.#ultimoId) return false;
    this.#ultimoId = id;
    return true;
  }

  get ultimoId(): number {
    return this.#ultimoId;
  }
}
