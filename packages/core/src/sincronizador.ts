/**
 * Lado de la app: escucha al termo por el `Transporte` y guarda en el
 * `Repositorio`. No sabe si el canal es un bus en memoria o Bluetooth, ni si
 * el repositorio es Firestore.
 *
 * Garantías:
 * - Cada evento se guarda una sola vez, aunque el termo lo reenvíe.
 * - Confirma al termo en cuanto el evento quedó en el repositorio local
 *   (Firestore lo guarda en el dispositivo y lo sube cuando hay red), así el
 *   termo puede liberar su cola aunque el teléfono esté sin internet.
 * - La telemetría se escribe con mesura: lo esencial, no cada lectura.
 */
import { RegistroRecibidos } from './cola.ts';
import type { EventoNivel, MensajeHola, MensajeTermo } from './protocolo.ts';
import { aRegistro, type RegistroEvento } from './registros.ts';
import type { Reloj } from './reloj.ts';
import type { DecisionResolucion, Lugar, Repositorio } from './repositorio.ts';
import type { EstadoEnlace, Transporte } from './transporte.ts';

export type AvisoSincronizador =
  | { readonly tipo: 'enlace'; readonly enlace: EstadoEnlace }
  | { readonly tipo: 'termo'; readonly termoId: string; readonly firmware: string }
  | { readonly tipo: 'registro'; readonly registro: RegistroEvento }
  | { readonly tipo: 'bateriaBaja'; readonly bateria: number }
  | { readonly tipo: 'error'; readonly error: unknown };

export interface OpcionesSincronizador {
  readonly transporte: Transporte;
  readonly repositorio: Repositorio;
  readonly reloj: Reloj;
  /** Desfase local respecto a UTC, en minutos. */
  readonly desfaseMin: number;
  /** Dónde está el teléfono ahora, para "Encontrar mi termo". */
  readonly ubicacion?: () => Promise<Lugar | null>;
  /** Cada cuánto, como máximo, se guarda la batería y la temperatura del termo. */
  readonly intervaloTelemetriaMs?: number;
}

export class ErrorSincronizador extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorSincronizador';
  }
}

export class Sincronizador {
  readonly #o: OpcionesSincronizador;
  readonly #intervaloTelemetriaMs: number;
  readonly #oyentes = new Set<(a: AvisoSincronizador) => void>();
  readonly #enCurso = new Set<Promise<unknown>>();
  #desuscribir: Array<() => void> = [];

  #termoId: string | null = null;
  /** Firmware que dijo tener en el último saludo. */
  #firmware: string | null = null;
  #recibidos: RegistroRecibidos | null = null;
  /** Ya se sabe dónde quedamos con este termo y se puede procesar en el acto. */
  #listo = false;
  #generacion = 0;
  #espera: Array<Exclude<MensajeTermo, MensajeHola>> = [];
  #temperaturaC: number | null = null;
  #ultimaTelemetriaMs = Number.NEGATIVE_INFINITY;

  constructor(opciones: OpcionesSincronizador) {
    this.#o = opciones;
    this.#intervaloTelemetriaMs = opciones.intervaloTelemetriaMs ?? 15 * 60_000;
  }

  get termoId(): string | null {
    return this.#termoId;
  }

  iniciar(): void {
    if (this.#desuscribir.length > 0) return;
    this.#desuscribir = [
      this.#o.transporte.alRecibir((m) => this.#recibir(m)),
      this.#o.transporte.alCambiarEnlace((e) => this.#cambioEnlace(e)),
    ];
  }

  detener(): void {
    for (const salir of this.#desuscribir) salir();
    this.#desuscribir = [];
  }

  alAviso(oyente: (aviso: AvisoSincronizador) => void): () => void {
    this.#oyentes.add(oyente);
    return () => this.#oyentes.delete(oyente);
  }

  resolverDescenso(registro: RegistroEvento, decision: DecisionResolucion): Promise<void> {
    return this.#seguir(this.#o.repositorio.resolverDescenso(registro, decision), false);
  }

  /** Espera a que terminen las escrituras en curso. Útil en pruebas y al cerrar la app. */
  async esperar(): Promise<void> {
    while (this.#enCurso.size > 0) await Promise.allSettled([...this.#enCurso]);
  }

  // ─── Interno ──────────────────────────────────────────────────────────────

  #recibir(m: MensajeTermo): void {
    if (m.tipo === 'hola') {
      this.#saludo(m);
      return;
    }
    if (!this.#listo) {
      this.#espera.push(m); // aún se está leyendo dónde quedamos: se procesa en orden después
      return;
    }
    this.#procesar(m);
  }

  #saludo(hola: MensajeHola): void {
    this.#avisar({ tipo: 'termo', termoId: hola.termoId, firmware: hola.firmware });
    const firmwareNuevo = hola.firmware !== this.#firmware;
    this.#firmware = hola.firmware;
    if (hola.termoId === this.#termoId && this.#listo) {
      // Mismo termo: ya sabemos dónde quedamos. Si volvió de actualizarse, se guarda su versión.
      if (firmwareNuevo) void this.#seguir(this.#o.repositorio.guardarTermo({ termoId: hola.termoId, firmware: hola.firmware }));
      return;
    }

    if (hola.termoId !== this.#termoId) this.#espera = []; // lo que esperaba era de otro termo
    this.#termoId = hola.termoId;
    this.#listo = false;
    this.#recibidos = null;
    const generacion = ++this.#generacion;
    const repo = this.#o.repositorio;
    void this.#seguir(
      repo.guardarTermo({ termoId: hola.termoId, firmware: hola.firmware, capacidadMl: hola.capacidadMl }),
    );

    const preparar = async () => {
      let guardado = 0;
      try {
        guardado = await repo.ultimoIdDeTermo(hola.termoId);
      } catch (error) {
        this.#avisar({ tipo: 'error', error }); // se sigue desde cero; el repositorio descarta repetidos
      }
      if (generacion !== this.#generacion) return; // llegó otro saludo mientras tanto
      if (hola.ultimoId < guardado) {
        this.#avisar({
          tipo: 'error',
          error: new ErrorSincronizador(
            `El termo ${hola.termoId} dice ir en el evento ${hola.ultimoId}, pero ya hay guardados hasta el ${guardado}.`,
          ),
        });
      }
      this.#recibidos = new RegistroRecibidos(guardado);
      this.#listo = true;
      const espera = this.#espera;
      this.#espera = [];
      for (const m of espera) this.#procesar(m);
    };
    void this.#seguir(preparar());
  }

  #procesar(m: Exclude<MensajeTermo, MensajeHola>): void {
    switch (m.tipo) {
      case 'estado':
        this.#temperaturaC = m.temperaturaC;
        this.#telemetria(m.enMs, m.bateria, m.temperaturaC);
        break;
      case 'bateriaBaja':
        this.#avisar({ tipo: 'bateriaBaja', bateria: m.bateria });
        break;
      case 'lote':
        // De lo guardado sin conexión no se conoce la temperatura de cada momento.
        this.#registrar(m.eventos, null);
        break;
      case 'llenado':
      case 'sorbo':
      case 'descensoGrande':
        this.#registrar([m], this.#temperaturaC);
        break;
    }
  }

  #registrar(eventos: readonly EventoNivel[], temperaturaC: number | null): void {
    const recibidos = this.#recibidos;
    const termoId = this.#termoId;
    if (!recibidos || !termoId) return;
    for (const e of eventos) {
      if (!recibidos.aceptar(e.id)) continue;
      const registro = aRegistro(termoId, e, temperaturaC, this.#o.desfaseMin);
      void this.#seguir(this.#o.repositorio.registrar(registro));
      this.#avisar({ tipo: 'registro', registro });
    }
    // Se confirma aunque todo fuera repetido: así el termo vacía su cola.
    this.#o.transporte.enviar({ tipo: 'confirmar', hastaId: recibidos.ultimoId });
  }

  #telemetria(enMs: number, bateria: number, temperaturaC: number): void {
    if (!this.#termoId || enMs - this.#ultimaTelemetriaMs < this.#intervaloTelemetriaMs) return;
    this.#ultimaTelemetriaMs = enMs;
    void this.#seguir(this.#o.repositorio.guardarTermo({ termoId: this.#termoId, bateria, temperaturaC }));
  }

  #cambioEnlace(enlace: EstadoEnlace): void {
    this.#avisar({ tipo: 'enlace', enlace });
    const termoId = this.#termoId;
    if (enlace !== 'desconectado' || !termoId) return;
    // T6: anotar el último lugar y la hora en que estuvo cerca.
    const enMs = this.#o.reloj.ahora();
    const guardar = (async () => {
      let lugar: Lugar | null = null;
      try {
        lugar = (await this.#o.ubicacion?.()) ?? null;
      } catch {
        lugar = null; // sin permiso o sin señal: se guarda solo la hora
      }
      await this.#o.repositorio.guardarTermo({ termoId, ultimoVisto: { enMs, lugar } });
    })();
    void this.#seguir(guardar);
  }

  /**
   * Sigue una escritura: la cuenta como en curso hasta que termina y, si
   * `tragarError`, convierte su fallo en un aviso. `esperar()` aguarda también
   * a que ese aviso salga.
   */
  #seguir<T>(promesa: Promise<T>, tragarError = true): Promise<T> {
    const manejada = tragarError
      ? promesa.catch((error: unknown) => {
          this.#avisar({ tipo: 'error', error });
          return undefined as T;
        })
      : promesa;
    const seguida: Promise<T> = manejada.finally(() => this.#enCurso.delete(seguida));
    this.#enCurso.add(seguida);
    return seguida;
  }

  #avisar(aviso: AvisoSincronizador): void {
    for (const oyente of this.#oyentes) oyente(aviso);
  }
}
