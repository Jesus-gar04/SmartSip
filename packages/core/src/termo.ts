/**
 * El termo SmartSip simulado. Se comporta como el hardware real: sensor de
 * nivel, sensor de temperatura en la tapa, pantalla frontal, batería y
 * Bluetooth. No calienta, no vibra y no suena.
 *
 * Lo que sale del termo son mensajes del protocolo (`MensajeTermo`); lo que
 * entra, `MensajeApp`. Los controles físicos (llenar, beber, vaciar, tapa,
 * ambiente, cargador, Bluetooth) son los del panel del simulador.
 */
import {
  cargaTras,
  REGLAS_BATERIA,
  type Brillo,
  type ReglasBateria,
} from './bateria.ts';
import { ColaSinConexion } from './cola.ts';
import { ESPECIFICACIONES } from './especificaciones.ts';
import { REGLAS_FIRMWARE, sumaHex, sumarTexto, type ReglasFirmware } from './firmware.ts';
import type { Simulable } from './motor.ts';
import { DetectorNivel, REGLAS_NIVEL, type CambioNivel, type ReglasNivel } from './nivel.ts';
import {
  VERSION_PROTOCOLO,
  type EventoNivel,
  type MensajeApp,
  type MensajeEstado,
  type MensajeTermo,
  type Unidad,
} from './protocolo.ts';
import type { Reloj } from './reloj.ts';
import {
  celsiusAFahrenheit,
  coeficienteEnfriamiento,
  mezclar,
  REGLAS_TERMICAS,
  temperaturaTras,
  type ReglasTermicas,
} from './termica.ts';

export interface OpcionesTermo {
  readonly reloj: Reloj;
  /** Número de serie. Letras, números y guiones. */
  readonly termoId?: string;
  readonly firmware?: string;
  /** Último id de evento que asignó, guardado en su memoria no volátil. */
  readonly ultimoId?: number;
  readonly capacidadMl?: number;
  readonly nivelMl?: number;
  readonly temperaturaC?: number;
  readonly ambienteC?: number;
  /** Carga entre 0 y 1. */
  readonly bateria?: number;
  readonly brillo?: Brillo;
  readonly unidad?: Unidad;
  /** Si el teléfono está al alcance del Bluetooth. */
  readonly bluetooth?: boolean;
  /** Cada cuánto manda la lectura de estado mientras hay conexión. */
  readonly periodoEstadoMs?: number;
  readonly capacidadCola?: number;
  readonly reglasNivel?: ReglasNivel;
  readonly reglasTermicas?: ReglasTermicas;
  readonly reglasBateria?: ReglasBateria;
  readonly reglasFirmware?: ReglasFirmware;
}

/** A4: lo que muestra el termo mientras se actualiza. */
export type ActualizacionEnPantalla =
  | { readonly fase: 'recibiendo'; readonly fraccion: number }
  | { readonly fase: 'instalando'; readonly fraccion: 1 };

export interface EstadoTermo {
  readonly capacidadMl: number;
  readonly nivelMl: number;
  readonly temperaturaC: number;
  readonly ambienteC: number;
  readonly tapaCerrada: boolean;
  readonly bateria: number;
  readonly cargando: boolean;
  readonly encendido: boolean;
  readonly conectado: boolean;
  readonly brillo: Brillo;
  readonly unidad: Unidad;
  /** Eventos guardados que la app aún no confirmó. */
  readonly pendientes: number;
  readonly firmware: string;
  readonly actualizacion: ActualizacionEnPantalla | null;
}

/** Lo que muestra la pantalla frontal: temperatura, batería y Bluetooth. */
export interface PantallaTermo {
  readonly encendida: boolean;
  /** Entero, en la unidad elegida. */
  readonly temperatura: number;
  readonly unidad: Unidad;
  readonly bateriaPct: number;
  readonly bluetooth: boolean;
  readonly brillo: Brillo;
  readonly actualizacion: ActualizacionEnPantalla | null;
}

export type OyenteTermo = (mensaje: MensajeTermo) => void;
export type OyenteConexion = (conectado: boolean) => void;

export const TERMO_ID_SIMULADO = 'SS-SIM-0001';
export const FIRMWARE_SIMULADO = 'sim-1.0.0';

/** Un número de serie que sirve como id de documento: letras, números y guiones. */
export function esTermoIdValido(termoId: string): boolean {
  return /^[A-Za-z0-9-]{1,40}$/.test(termoId);
}

export class TermoSimulado implements Simulable {
  readonly capacidadMl: number;
  readonly termoId: string;

  readonly #reloj: Reloj;
  readonly #reglasFirmware: ReglasFirmware;
  readonly #reglasTermicas: ReglasTermicas;
  readonly #reglasBateria: ReglasBateria;
  readonly #periodoEstadoMs: number;
  readonly #detector: DetectorNivel;
  readonly #cola: ColaSinConexion<EventoNivel>;
  readonly #oyentes = new Set<OyenteTermo>();
  readonly #oyentesConexion = new Set<OyenteConexion>();

  #nivelMl: number;
  #temperaturaC: number;
  #ambienteC: number;
  #tapaCerrada = true;
  #bateria: number;
  #cargando = false;
  #brillo: Brillo;
  #unidad: Unidad;
  #bluetooth: boolean;

  #ultimoId: number;
  #desdeUltimoEstadoMs = 0;
  #conectadoAntes: boolean;
  #avisoBajaHecho = false;
  #avisoBajaPendiente = false;

  #firmware: string;
  /** A4: el paquete que se está recibiendo; sobrevive a una desconexión. */
  #actualizacion: {
    readonly version: string;
    readonly bloques: number;
    readonly suma: string;
    recibidos: number;
    sumaParcial: number | undefined;
    /** Tiempo que falta para terminar de escribir el bloque recibido; 0 si no hay ninguno. */
    escribiendoMs: number;
  } | null = null;
  /** Mientras se reinicia para instalar: sin Bluetooth. */
  #reinicioMs = 0;
  #versionNueva: string | null = null;

  constructor(opciones: OpcionesTermo) {
    this.#reloj = opciones.reloj;
    this.termoId = opciones.termoId ?? TERMO_ID_SIMULADO;
    if (!esTermoIdValido(this.termoId)) {
      throw new RangeError(`Número de serie inválido: "${this.termoId}".`);
    }
    this.#firmware = opciones.firmware ?? FIRMWARE_SIMULADO;
    this.#reglasFirmware = opciones.reglasFirmware ?? REGLAS_FIRMWARE;
    this.#ultimoId = opciones.ultimoId ?? 0;
    this.capacidadMl = opciones.capacidadMl ?? ESPECIFICACIONES.capacidadMl;
    this.#nivelMl = Math.min(this.capacidadMl, Math.max(0, opciones.nivelMl ?? 0));
    this.#ambienteC = opciones.ambienteC ?? 25;
    this.#temperaturaC = opciones.temperaturaC ?? this.#ambienteC;
    this.#bateria = Math.min(1, Math.max(0, opciones.bateria ?? 1));
    this.#brillo = opciones.brillo ?? 'medio';
    this.#unidad = opciones.unidad ?? 'C';
    this.#bluetooth = opciones.bluetooth ?? true;
    this.#periodoEstadoMs = opciones.periodoEstadoMs ?? 10_000;
    this.#reglasTermicas = opciones.reglasTermicas ?? REGLAS_TERMICAS;
    this.#reglasBateria = opciones.reglasBateria ?? REGLAS_BATERIA;
    this.#detector = new DetectorNivel(this.#nivelMl, opciones.reglasNivel ?? REGLAS_NIVEL);
    this.#cola = new ColaSinConexion<EventoNivel>(opciones.capacidadCola);
    this.#conectadoAntes = this.conectado;
  }

  /** Sin batería el termo se apaga: ni sensores, ni pantalla, ni Bluetooth. */
  get encendido(): boolean {
    return this.#bateria > 0;
  }

  get conectado(): boolean {
    return this.#bluetooth && this.encendido && this.#reinicioMs <= 0;
  }

  get firmware(): string {
    return this.#firmware;
  }

  // ─── Controles físicos ────────────────────────────────────────────────────

  /** T1. Añade agua a cierta temperatura; se mezcla con la que había. Devuelve los ml que cupieron. */
  llenar(ml: number, temperaturaAguaC: number): number {
    const anadido = Math.min(Math.max(0, ml), this.capacidadMl - this.#nivelMl);
    if (anadido > 0) {
      this.#temperaturaC = mezclar(this.#nivelMl, this.#temperaturaC, anadido, temperaturaAguaC);
      this.#nivelMl += anadido;
    }
    return anadido;
  }

  /** T2. Quita agua como al beber. Devuelve los ml que realmente había. */
  beber(ml: number): number {
    const quitado = Math.min(Math.max(0, ml), this.#nivelMl);
    this.#nivelMl -= quitado;
    return quitado;
  }

  /** T4. Vacía el termo de golpe. Para el sensor es igual que beberse todo. */
  vaciar(): number {
    return this.beber(this.#nivelMl);
  }

  abrirTapa(): void {
    this.#tapaCerrada = false;
  }

  cerrarTapa(): void {
    this.#tapaCerrada = true;
  }

  fijarAmbiente(celsius: number): void {
    this.#ambienteC = celsius;
  }

  conectarCargador(): void {
    this.#cargando = true;
  }

  desconectarCargador(): void {
    this.#cargando = false;
  }

  /** Solo para el simulador: cambia la temperatura del agua que hay dentro, sin tocar el nivel. */
  fijarTemperaturaAgua(celsius: number): void {
    this.#temperaturaC = celsius;
  }

  /**
   * Solo para el simulador: fija la carga de golpe (por ejemplo, al 14 % para
   * ver el aviso de batería baja sin esperar días).
   */
  fijarBateria(carga: number): void {
    this.#bateria = Math.min(1, Math.max(0, carga));
    this.#revisarBateria(this.#reloj.ahora());
    this.#revisarConexion();
  }

  /** T6. El teléfono se aleja o se apaga su Bluetooth. */
  cortarBluetooth(): void {
    this.#bluetooth = false;
    this.#revisarConexion();
  }

  restablecerBluetooth(): void {
    this.#bluetooth = true;
    this.#revisarConexion();
  }

  // ─── Tiempo ───────────────────────────────────────────────────────────────

  paso(dtMs: number, ahoraMs: number): void {
    // T3. La física no necesita batería: el agua se enfría igual.
    const k = coeficienteEnfriamiento(
      { tapaCerrada: this.#tapaCerrada, fraccionLlenado: this.#nivelMl / this.capacidadMl },
      this.#reglasTermicas,
    );
    this.#temperaturaC = temperaturaTras(this.#temperaturaC, this.#ambienteC, k, dtMs);

    this.#bateria = cargaTras(this.#bateria, this.#brillo, this.#cargando, dtMs, this.#reglasBateria);
    this.#revisarBateria(ahoraMs);
    if (this.#reinicioMs > 0) {
      this.#reinicioMs -= dtMs;
      if (this.#reinicioMs <= 0 && this.#versionNueva) {
        this.#firmware = this.#versionNueva; // instalado: vuelve con la versión nueva
        this.#versionNueva = null;
      }
    }
    this.#revisarConexion();
    if (!this.encendido) return;

    // Escribe bloques mientras haya tiempo en este paso: si el siguiente llega
    // en el acto (bus en memoria), también entra.
    let resto = dtMs;
    for (let a = this.#actualizacion; a && a.escribiendoMs > 0 && resto > 0; a = this.#actualizacion) {
      const usar = Math.min(resto, a.escribiendoMs);
      a.escribiendoMs -= usar;
      resto -= usar;
      if (a.escribiendoMs <= 0) this.#bloqueEscrito();
    }

    const cambio = this.#detector.lectura(this.#nivelMl, ahoraMs);
    if (cambio) this.#registrar(cambio);

    this.#desdeUltimoEstadoMs += dtMs;
    if (this.#desdeUltimoEstadoMs >= this.#periodoEstadoMs) {
      this.#desdeUltimoEstadoMs = 0;
      if (this.conectado) this.#enviar(this.mensajeEstado());
    }
  }

  // ─── Canal con la app ─────────────────────────────────────────────────────

  /** Se suscribe a los mensajes que el termo manda. Devuelve cómo desuscribirse. */
  alEnviar(oyente: OyenteTermo): () => void {
    this.#oyentes.add(oyente);
    return () => this.#oyentes.delete(oyente);
  }

  /** Avisa cuando se conecta o se desconecta, antes de mandar nada. */
  alCambiarConexion(oyente: OyenteConexion): () => void {
    this.#oyentesConexion.add(oyente);
    return () => this.#oyentesConexion.delete(oyente);
  }

  /**
   * Lo que el termo hace al conectarse: se presenta, manda lo que guardó sin
   * conexión, su estado y el aviso de batería si quedó pendiente. Se llama
   * solo al reconectar; el transporte lo llama al abrir el canal.
   */
  saludar(): void {
    if (!this.conectado) return;
    const ahora = this.#reloj.ahora();
    this.#enviar({
      tipo: 'hola',
      enMs: ahora,
      version: VERSION_PROTOCOLO,
      termoId: this.termoId,
      firmware: this.firmware,
      capacidadMl: this.capacidadMl,
      ultimoId: this.#ultimoId,
    });
    const pendientes = this.#cola.pendientes();
    if (pendientes.length > 0) {
      this.#enviar({ tipo: 'lote', enMs: ahora, eventos: pendientes, descartados: this.#cola.descartados });
    }
    this.#enviar(this.mensajeEstado());
    this.#desdeUltimoEstadoMs = 0;
    if (this.#avisoBajaPendiente && this.#bateria < this.#reglasBateria.umbralBaja) {
      this.#avisoBajaPendiente = false;
      this.#enviar({ tipo: 'bateriaBaja', enMs: ahora, bateria: this.#bateria });
    }
  }

  /** Mensaje de la app. Sin conexión no llega nada. */
  recibir(mensaje: MensajeApp): void {
    if (!this.conectado) return;
    switch (mensaje.tipo) {
      case 'confirmar':
        this.#cola.confirmarHasta(mensaje.hastaId);
        break;
      case 'preferencias':
        if (mensaje.unidad) this.#unidad = mensaje.unidad;
        if (mensaje.brillo) this.#brillo = mensaje.brillo;
        break;
      case 'firmwareInicio': {
        if (this.#bateria < this.#reglasFirmware.bateriaMinima && !this.#cargando) {
          this.#enviar({ tipo: 'firmwareError', version: mensaje.version, motivo: 'bateria' });
          return;
        }
        const a = this.#actualizacion;
        // El mismo paquete que se cortó a mitad: se sigue desde lo que ya tiene.
        if (!a || a.version !== mensaje.version || a.suma !== mensaje.suma) {
          this.#actualizacion = {
            version: mensaje.version,
            bloques: mensaje.bloques,
            suma: mensaje.suma,
            recibidos: 0,
            sumaParcial: undefined,
            escribiendoMs: 0,
          };
        }
        if ((this.#actualizacion?.escribiendoMs ?? 0) <= 0) this.#enviarProgreso();
        break;
      }
      case 'firmwareBloque': {
        const a = this.#actualizacion;
        if (!a || a.version !== mensaje.version || a.escribiendoMs > 0) return;
        if (mensaje.n !== a.recibidos) {
          this.#enviarProgreso(); // llegó fuera de orden o repetido: le dice desde dónde seguir
          return;
        }
        a.sumaParcial = sumarTexto(mensaje.datos, a.sumaParcial);
        a.escribiendoMs = this.#reglasFirmware.escrituraBloqueMs;
        if (a.escribiendoMs <= 0) this.#bloqueEscrito();
        break;
      }
    }
  }

  // ─── Lecturas ─────────────────────────────────────────────────────────────

  estado(): EstadoTermo {
    return {
      capacidadMl: this.capacidadMl,
      nivelMl: this.#nivelMl,
      temperaturaC: this.#temperaturaC,
      ambienteC: this.#ambienteC,
      tapaCerrada: this.#tapaCerrada,
      bateria: this.#bateria,
      cargando: this.#cargando,
      encendido: this.encendido,
      conectado: this.conectado,
      brillo: this.#brillo,
      unidad: this.#unidad,
      pendientes: this.#cola.tamano,
      firmware: this.#firmware,
      actualizacion: this.#actualizacionEnPantalla(),
    };
  }

  pantalla(): PantallaTermo {
    const t = this.#unidad === 'C' ? this.#temperaturaC : celsiusAFahrenheit(this.#temperaturaC);
    return {
      encendida: this.encendido,
      temperatura: Math.round(t),
      unidad: this.#unidad,
      bateriaPct: Math.round(this.#bateria * 100),
      bluetooth: this.conectado,
      brillo: this.#brillo,
      actualizacion: this.#actualizacionEnPantalla(),
    };
  }

  mensajeEstado(): MensajeEstado {
    return {
      tipo: 'estado',
      enMs: this.#reloj.ahora(),
      temperaturaC: Math.round(this.#temperaturaC * 10) / 10,
      nivelMl: Math.round(this.#nivelMl),
      bateria: Math.round(this.#bateria * 1000) / 1000,
      cargando: this.#cargando,
      tapaCerrada: this.#tapaCerrada,
      brillo: this.#brillo,
    };
  }

  // ─── Interno ──────────────────────────────────────────────────────────────

  #actualizacionEnPantalla(): ActualizacionEnPantalla | null {
    if (this.#reinicioMs > 0) return { fase: 'instalando', fraccion: 1 };
    const a = this.#actualizacion;
    return a ? { fase: 'recibiendo', fraccion: a.recibidos / a.bloques } : null;
  }

  #enviarProgreso(): void {
    const a = this.#actualizacion;
    if (a && this.conectado) {
      this.#enviar({ tipo: 'firmwareProgreso', version: a.version, recibidos: a.recibidos, bloques: a.bloques });
    }
  }

  /** El bloque quedó en la memoria: avisa, o si era el último, comprueba e instala. */
  #bloqueEscrito(): void {
    const a = this.#actualizacion;
    if (!a) return;
    a.escribiendoMs = 0;
    a.recibidos++;
    if (a.recibidos < a.bloques) {
      this.#enviarProgreso();
      return;
    }
    this.#actualizacion = null;
    if (sumaHex(a.sumaParcial ?? 0) !== a.suma) {
      if (this.conectado) this.#enviar({ tipo: 'firmwareError', version: a.version, motivo: 'suma' });
      return;
    }
    if (this.conectado) {
      this.#enviar({ tipo: 'firmwareProgreso', version: a.version, recibidos: a.bloques, bloques: a.bloques });
      this.#enviar({ tipo: 'firmwareListo', version: a.version });
    }
    // Se reinicia para instalar: se pierde el Bluetooth unos segundos.
    this.#versionNueva = a.version;
    this.#reinicioMs = this.#reglasFirmware.reinicioMs;
    this.#revisarConexion();
  }

  #registrar(cambio: CambioNivel): void {
    const evento: EventoNivel = {
      tipo: cambio.tipo,
      id: ++this.#ultimoId,
      enMs: cambio.enMs,
      ml: cambio.ml,
      nivelMl: cambio.nivelMl,
    };
    // Todo pasa por la cola: si la app no confirma, se reenvía al reconectar.
    this.#cola.encolar(evento);
    if (this.conectado) this.#enviar(evento);
  }

  #revisarBateria(ahoraMs: number): void {
    const r = this.#reglasBateria;
    if (this.#bateria < r.umbralBaja && !this.#avisoBajaHecho) {
      this.#avisoBajaHecho = true;
      if (this.conectado) this.#enviar({ tipo: 'bateriaBaja', enMs: ahoraMs, bateria: this.#bateria });
      else this.#avisoBajaPendiente = true;
    } else if (this.#bateria >= r.umbralBaja + r.histeresis) {
      this.#avisoBajaHecho = false;
      this.#avisoBajaPendiente = false;
    }
  }

  #revisarConexion(): void {
    const conectado = this.conectado;
    if (conectado === this.#conectadoAntes) return;
    this.#conectadoAntes = conectado;
    for (const oyente of this.#oyentesConexion) oyente(conectado);
    if (conectado) this.saludar();
  }

  #enviar(mensaje: MensajeTermo): void {
    for (const oyente of this.#oyentes) oyente(mensaje);
  }
}
