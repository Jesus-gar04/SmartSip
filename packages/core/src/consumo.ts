/**
 * Registro de consumo del lado de la app (casos T2, T4 y T6).
 *
 * Recibe los eventos de nivel del termo, descarta los repetidos, suma los
 * sorbos al día y guarda los descensos grandes hasta que la persona responda
 * "¿Lo bebiste o lo vaciaste?".
 */
import { RegistroRecibidos } from './cola.ts';
import type { EventoDescensoGrande, EventoNivel, MensajeConfirmar, MensajeTermo } from './protocolo.ts';

export type DecisionDescenso = 'bebido' | 'vaciado';

/** Agua que cuenta como bebida. */
export interface Toma {
  readonly id: number;
  readonly enMs: number;
  readonly ml: number;
  /** `true` si vino de un descenso grande que la persona confirmó como bebido. */
  readonly confirmadaPorPersona: boolean;
}

/** Barranquilla: UTC−5, sin horario de verano. */
export const DESFASE_COLOMBIA_MIN = -300;

/** Día local "AAAA-MM-DD" de una hora, según el desfase respecto a UTC. */
export function claveDia(enMs: number, desfaseMin: number = DESFASE_COLOMBIA_MIN): string {
  return new Date(enMs + desfaseMin * 60_000).toISOString().slice(0, 10);
}

export class RegistroConsumo {
  readonly desfaseMin: number;
  #recibidos = new RegistroRecibidos();
  #tomas: Toma[] = [];
  #dudosos = new Map<number, EventoDescensoGrande>();

  constructor(desfaseMin: number = DESFASE_COLOMBIA_MIN) {
    this.desfaseMin = desfaseMin;
  }

  /** Aplica un evento. Devuelve `false` si ya lo tenía. */
  aplicar(evento: EventoNivel): boolean {
    if (!this.#recibidos.aceptar(evento.id)) return false;
    switch (evento.tipo) {
      case 'sorbo':
        this.#tomas.push({ id: evento.id, enMs: evento.enMs, ml: evento.ml, confirmadaPorPersona: false });
        break;
      case 'descensoGrande':
        this.#dudosos.set(evento.id, evento);
        break;
      case 'llenado':
        // Llenar no suma al consumo.
        break;
    }
    return true;
  }

  /** Aplica un lote. Devuelve cuántos eventos eran nuevos. */
  aplicarLote(eventos: readonly EventoNivel[]): number {
    let nuevos = 0;
    for (const e of eventos) if (this.aplicar(e)) nuevos++;
    return nuevos;
  }

  /**
   * Procesa un mensaje del termo. Si trae eventos de nivel, devuelve la
   * confirmación que hay que mandarle de vuelta; si no, `null`.
   */
  procesar(mensaje: MensajeTermo): MensajeConfirmar | null {
    switch (mensaje.tipo) {
      case 'llenado':
      case 'sorbo':
      case 'descensoGrande':
        this.aplicar(mensaje);
        return this.confirmacion();
      case 'lote':
        this.aplicarLote(mensaje.eventos);
        return this.confirmacion();
      case 'hola':
      case 'estado':
      case 'bateriaBaja':
      case 'firmwareProgreso':
      case 'firmwareListo':
      case 'firmwareError':
        return null;
    }
  }

  confirmacion(): MensajeConfirmar {
    return { tipo: 'confirmar', hastaId: this.#recibidos.ultimoId };
  }

  /** Descensos grandes que esperan respuesta, del más antiguo al más reciente. */
  dudosos(): readonly EventoDescensoGrande[] {
    return [...this.#dudosos.values()];
  }

  /** La persona respondió "¿Lo bebiste o lo vaciaste?". */
  resolver(id: number, decision: DecisionDescenso): void {
    const evento = this.#dudosos.get(id);
    if (!evento) throw new Error(`No hay un descenso pendiente con id ${id}.`);
    this.#dudosos.delete(id);
    if (decision === 'bebido') {
      this.#tomas.push({ id: evento.id, enMs: evento.enMs, ml: evento.ml, confirmadaPorPersona: true });
    }
  }

  tomas(): readonly Toma[] {
    return [...this.#tomas];
  }

  /** Mililitros bebidos en el día local que contiene `enMs`. */
  totalDelDia(enMs: number): number {
    const clave = claveDia(enMs, this.desfaseMin);
    let total = 0;
    for (const t of this.#tomas) if (claveDia(t.enMs, this.desfaseMin) === clave) total += t.ml;
    return total;
  }
}
