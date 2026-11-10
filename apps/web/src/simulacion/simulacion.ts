/**
 * El simulador sin pantalla: une el termo simulado, el bus en memoria y el
 * sincronizador de la app. La interfaz solo llama a estos métodos y lee
 * instantáneas; no conoce el núcleo por dentro.
 */
import {
  BusEnMemoria,
  Motor,
  RelojSimulado,
  Sincronizador,
  TermoSimulado,
  type Aceleracion,
  type AvisoSincronizador,
  type EstadoEnlace,
  type EstadoTermo,
  type Lugar,
  type PantallaTermo,
  type Repositorio,
  type Trafico,
} from 'smartsip-core';

export interface Instantanea {
  readonly enMs: number;
  readonly termo: EstadoTermo;
  readonly pantalla: PantallaTermo;
  readonly aceleracion: Aceleracion;
  readonly enlace: EstadoEnlace;
}

export interface OpcionesSimulacion {
  readonly repositorio: Repositorio;
  readonly inicioMs: number;
  readonly termoId: string;
  /** Último id que el termo había asignado (su memoria no volátil). */
  readonly ultimoId: number;
  readonly desfaseMin: number;
  /** Temperatura ambiente inicial: la del clima local. */
  readonly ambienteC: number;
  readonly ubicacion?: () => Promise<Lugar | null>;
  /** Falso cuando el termo está emparejado con una app remota: ella sincroniza. */
  readonly sincronizar?: boolean;
  /** Versión instalada, si una actualización la cambió. */
  readonly firmware?: string | undefined;
}

/** Si la pestaña estuvo oculta, no se simula más de un día de golpe. */
const MAXIMO_POR_TIC_MS = 24 * 3_600_000;

export class Simulacion {
  readonly reloj: RelojSimulado;
  readonly motor: Motor;
  readonly termo: TermoSimulado;
  readonly bus: BusEnMemoria;
  readonly sincronizador: Sincronizador;
  readonly repositorio: Repositorio;
  readonly #sincronizar: boolean;

  constructor(o: OpcionesSimulacion) {
    this.#sincronizar = o.sincronizar ?? true;
    this.repositorio = o.repositorio;
    this.reloj = new RelojSimulado(o.inicioMs);
    this.motor = new Motor(this.reloj);
    this.termo = new TermoSimulado({
      reloj: this.reloj,
      termoId: o.termoId,
      ultimoId: o.ultimoId,
      ...(o.firmware ? { firmware: o.firmware } : {}),
      nivelMl: 0,
      ambienteC: o.ambienteC,
      temperaturaC: o.ambienteC,
      bateria: 0.82,
    });
    this.motor.agregar(this.termo);
    this.bus = new BusEnMemoria(this.termo, this.reloj);
    this.sincronizador = new Sincronizador({
      transporte: this.bus,
      repositorio: o.repositorio,
      reloj: this.reloj,
      desfaseMin: o.desfaseMin,
      ...(o.ubicacion ? { ubicacion: o.ubicacion } : {}),
    });
  }

  /** Arranca: la app escucha primero y luego se abre el canal, así recibe el saludo. */
  iniciar(): void {
    if (this.#sincronizar) this.sincronizador.iniciar();
    this.bus.abrir();
  }

  detener(): void {
    this.bus.cerrar();
    this.sincronizador.detener();
  }

  /** Avanza según el tiempo real transcurrido y la aceleración. */
  tic(msReales: number): void {
    if (!(msReales > 0)) return;
    const simulados = Math.min(msReales * this.motor.aceleracion, MAXIMO_POR_TIC_MS);
    this.motor.avanzar(simulados);
  }

  instantanea(): Instantanea {
    return {
      enMs: this.reloj.ahora(),
      termo: this.termo.estado(),
      pantalla: this.termo.pantalla(),
      aceleracion: this.motor.aceleracion,
      enlace: this.bus.enlace,
    };
  }

  alTrafico(oyente: (t: Trafico) => void): () => void {
    return this.bus.alPasar(oyente);
  }

  alAviso(oyente: (a: AvisoSincronizador) => void): () => void {
    return this.sincronizador.alAviso(oyente);
  }

  // ─── Controles físicos ────────────────────────────────────────────────────

  llenar(temperaturaAguaC: number): number {
    return this.termo.llenar(this.termo.capacidadMl, temperaturaAguaC);
  }
  beber(ml: number): number {
    return this.termo.beber(ml);
  }
  vaciar(): number {
    return this.termo.vaciar();
  }
  tapa(abierta: boolean): void {
    if (abierta) this.termo.abrirTapa();
    else this.termo.cerrarTapa();
  }
  ambiente(celsius: number): void {
    this.termo.fijarAmbiente(celsius);
  }
  cargador(conectado: boolean): void {
    if (conectado) this.termo.conectarCargador();
    else this.termo.desconectarCargador();
  }
  temperaturaAgua(celsius: number): void {
    this.termo.fijarTemperaturaAgua(celsius);
  }
  bateria(carga: number): void {
    this.termo.fijarBateria(carga);
  }
  bluetooth(cerca: boolean): void {
    if (cerca) this.termo.restablecerBluetooth();
    else this.termo.cortarBluetooth();
  }
  aceleracion(a: Aceleracion): void {
    this.motor.fijarAceleracion(a);
  }
}
