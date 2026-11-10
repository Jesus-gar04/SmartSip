/**
 * Canal entre el termo y la app (SPEC.md §7).
 *
 * La app solo conoce esta interfaz. En el simulador la implementa un bus en
 * memoria; con el termo real, Bluetooth de baja energía. La app no nota la
 * diferencia.
 */
import type { Direccion, MensajeApp, MensajeTermo } from './protocolo.ts';
import type { Reloj } from './reloj.ts';
import type { TermoSimulado } from './termo.ts';

export type EstadoEnlace = 'conectado' | 'desconectado';

/** Lado de la app. */
export interface Transporte {
  readonly enlace: EstadoEnlace;
  /** Manda un mensaje al termo. Devuelve `false` si no hay enlace y el mensaje no salió. */
  enviar(mensaje: MensajeApp): boolean;
  alRecibir(oyente: (mensaje: MensajeTermo) => void): () => void;
  alCambiarEnlace(oyente: (enlace: EstadoEnlace) => void): () => void;
}

/** Un mensaje que pasó por el canal, para la línea de mensajes del simulador. */
export type Trafico =
  | { readonly direccion: Extract<Direccion, 'termoAApp'>; readonly enMs: number; readonly mensaje: MensajeTermo }
  | { readonly direccion: Extract<Direccion, 'appATermo'>; readonly enMs: number; readonly mensaje: MensajeApp };

/**
 * Bus en memoria para el simulador. Entrega los mensajes en el acto y en
 * orden, así las pruebas son deterministas.
 */
export class BusEnMemoria implements Transporte {
  readonly #termo: TermoSimulado;
  readonly #reloj: Reloj;
  readonly #alRecibir = new Set<(m: MensajeTermo) => void>();
  readonly #alCambiarEnlace = new Set<(e: EstadoEnlace) => void>();
  readonly #alPasar = new Set<(t: Trafico) => void>();
  #desuscribir: Array<() => void> = [];
  #abierto = false;

  constructor(termo: TermoSimulado, reloj: Reloj) {
    this.#termo = termo;
    this.#reloj = reloj;
  }

  get enlace(): EstadoEnlace {
    return this.#abierto && this.#termo.conectado ? 'conectado' : 'desconectado';
  }

  /** Abre el canal. Si el termo ya está conectado, se presenta. */
  abrir(): void {
    if (this.#abierto) return;
    this.#abierto = true;
    this.#desuscribir = [
      this.#termo.alEnviar((mensaje) => {
        this.#emitirTrafico({ direccion: 'termoAApp', enMs: this.#reloj.ahora(), mensaje });
        for (const oyente of this.#alRecibir) oyente(mensaje);
      }),
      this.#termo.alCambiarConexion((conectado) => {
        const enlace: EstadoEnlace = conectado ? 'conectado' : 'desconectado';
        for (const oyente of this.#alCambiarEnlace) oyente(enlace);
      }),
    ];
    if (this.#termo.conectado) {
      for (const oyente of this.#alCambiarEnlace) oyente('conectado');
      this.#termo.saludar();
    }
  }

  /** Cierra el canal y suelta las suscripciones al termo. */
  cerrar(): void {
    if (!this.#abierto) return;
    const estabaConectado = this.enlace === 'conectado';
    for (const salir of this.#desuscribir) salir();
    this.#desuscribir = [];
    this.#abierto = false;
    if (estabaConectado) for (const oyente of this.#alCambiarEnlace) oyente('desconectado');
  }

  enviar(mensaje: MensajeApp): boolean {
    if (this.enlace !== 'conectado') return false;
    this.#emitirTrafico({ direccion: 'appATermo', enMs: this.#reloj.ahora(), mensaje });
    this.#termo.recibir(mensaje);
    return true;
  }

  alRecibir(oyente: (mensaje: MensajeTermo) => void): () => void {
    this.#alRecibir.add(oyente);
    return () => this.#alRecibir.delete(oyente);
  }

  alCambiarEnlace(oyente: (enlace: EstadoEnlace) => void): () => void {
    this.#alCambiarEnlace.add(oyente);
    return () => this.#alCambiarEnlace.delete(oyente);
  }

  /** Todo lo que pasa por el canal, en ambas direcciones. */
  alPasar(oyente: (trafico: Trafico) => void): () => void {
    this.#alPasar.add(oyente);
    return () => this.#alPasar.delete(oyente);
  }

  #emitirTrafico(trafico: Trafico): void {
    for (const oyente of this.#alPasar) oyente(trafico);
  }
}
