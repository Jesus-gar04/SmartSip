/**
 * Actualización de firmware simulada (A4): la app le pasa al termo un paquete
 * por bloques, por el mismo canal de siempre, y los dos muestran el avance.
 *
 * Como con Bluetooth de verdad:
 * - Cada bloque se confirma antes de mandar el siguiente: la barra avanza con
 *   lo que llegó, no con un temporizador.
 * - Si el termo se aleja a mitad, guarda lo recibido y, al volver, se sigue
 *   desde ahí.
 * - Al final el termo comprueba la suma del paquete y se reinicia unos
 *   segundos; vuelve saludando con la versión nueva.
 * - No empieza con poca batería, salvo que esté cargando.
 */
import type { MensajeApp, MensajeTermo } from './protocolo.ts';
import type { EstadoEnlace, Transporte } from './transporte.ts';

export interface PaqueteFirmware {
  readonly version: string;
  /** Lo que cambia, en una línea y con la voz de SmartSip. */
  readonly notas: string;
  readonly tamanoBytes: number;
  readonly tamanoBloque: number;
  readonly bloques: number;
  /** Suma de verificación de todo el paquete (FNV-1a de 32 bits, en hex). */
  readonly suma: string;
}

export interface ReglasFirmware {
  /** Carga mínima para empezar si no está cargando. */
  readonly bateriaMinima: number;
  /** Lo que tarda el termo en escribir un bloque en su memoria. */
  readonly escrituraBloqueMs: number;
  /** Lo que dura el reinicio para instalar. */
  readonly reinicioMs: number;
}

export const REGLAS_FIRMWARE: ReglasFirmware = {
  bateriaMinima: 0.3,
  escrituraBloqueMs: 150,
  reinicioMs: 4000,
};

export type MotivoErrorFirmware = 'bateria' | 'suma';

export const MENSAJES_ERROR_FIRMWARE: Readonly<Record<MotivoErrorFirmware, string>> = {
  bateria: 'La batería del termo está baja para actualizar. Conéctalo al cargador y vuelve a intentarlo.',
  suma: 'El paquete llegó dañado y el termo no lo instaló. Vuelve a intentarlo.',
};

// ─── El paquete ─────────────────────────────────────────────────────────────

/** "sim-1.1.0" → "1.1.0". */
export function textoVersion(version: string): string {
  return version.replace(/^sim-/, '');
}

/** Compara versiones "sim-1.2.3": negativo si `a` es anterior. */
export function compararVersiones(a: string, b: string): number {
  const partes = (v: string) => textoVersion(v).split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pa = partes(a);
  const pb = partes(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

const FNV_INICIO = 0x811c9dc5;

/** Suma FNV-1a de 32 bits, acumulable bloque a bloque. */
export function sumarTexto(texto: string, previa: number = FNV_INICIO): number {
  let h = previa;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export const sumaHex = (h: number) => h.toString(16).padStart(8, '0');

/**
 * El contenido del bloque `n`: bytes pseudoaleatorios en hex, siempre los
 * mismos para la misma versión (así la suma se puede comprobar).
 */
export function bloqueFirmware(version: string, n: number, tamanoBloque: number): string {
  let x = sumarTexto(`${version}#${n}`) || 1;
  let hex = '';
  for (let i = 0; i < tamanoBloque; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    hex += ((x >>> 0) & 0xff).toString(16).padStart(2, '0');
  }
  return hex;
}

export function crearPaquete(version: string, notas: string, tamanoBytes: number, tamanoBloque = 1024): PaqueteFirmware {
  const bloques = Math.ceil(tamanoBytes / tamanoBloque);
  let h = FNV_INICIO;
  for (let n = 0; n < bloques; n++) h = sumarTexto(bloqueFirmware(version, n, tamanoBloque), h);
  return { version, notas, tamanoBytes, tamanoBloque, bloques, suma: sumaHex(h) };
}

/** La versión que la app tiene para ofrecer. */
export const FIRMWARE_DISPONIBLE: PaqueteFirmware = crearPaquete(
  'sim-1.1.0',
  'La pantalla del termo avisa antes cuando la batería está baja y el sensor de nivel distingue mejor un sorbo pequeño.',
  24 * 1024,
);

export function hayActualizacion(actual: string | null, disponible: PaqueteFirmware = FIRMWARE_DISPONIBLE): boolean {
  return actual !== null && compararVersiones(actual, disponible.version) < 0;
}

// ─── Lado de la app ─────────────────────────────────────────────────────────

export type FaseActualizacion =
  /** Nada en curso. */
  | 'libre'
  /** Mandando bloques. */
  | 'enviando'
  /** El termo se alejó a mitad: se sigue al volver. */
  | 'en-pausa'
  /** Todo llegó; el termo se está reiniciando. */
  | 'instalando'
  /** El termo volvió con la versión nueva. */
  | 'lista'
  | 'error';

export interface EstadoActualizacion {
  readonly fase: FaseActualizacion;
  readonly version: string;
  readonly recibidos: number;
  readonly bloques: number;
  readonly error: MotivoErrorFirmware | null;
}

export const fraccionActualizacion = (e: EstadoActualizacion) => (e.bloques > 0 ? e.recibidos / e.bloques : 0);

/**
 * Manda el paquete al termo bloque a bloque, a su ritmo: el siguiente bloque
 * sale cuando el termo confirma el anterior.
 */
export class ActualizadorFirmware {
  readonly #transporte: Transporte;
  readonly #paquete: PaqueteFirmware;
  readonly #oyentes = new Set<(e: EstadoActualizacion) => void>();
  #estado: EstadoActualizacion;
  #soltar: Array<() => void> = [];

  constructor(transporte: Transporte, paquete: PaqueteFirmware = FIRMWARE_DISPONIBLE) {
    this.#transporte = transporte;
    this.#paquete = paquete;
    this.#estado = { fase: 'libre', version: paquete.version, recibidos: 0, bloques: paquete.bloques, error: null };
    this.#soltar = [
      transporte.alRecibir((m) => this.#recibir(m)),
      transporte.alCambiarEnlace((e) => this.#enlace(e)),
    ];
  }

  get estado(): EstadoActualizacion {
    return this.#estado;
  }

  alCambiar(oyente: (e: EstadoActualizacion) => void): () => void {
    this.#oyentes.add(oyente);
    return () => this.#oyentes.delete(oyente);
  }

  /** Empieza o retoma. Devuelve `false` si no hay termo cerca. */
  iniciar(): boolean {
    const p = this.#paquete;
    // Antes de enviar: el termo puede responder en el acto.
    this.#fijar({ fase: 'enviando', error: null });
    const salio = this.#enviar({ tipo: 'firmwareInicio', version: p.version, tamanoBytes: p.tamanoBytes, bloques: p.bloques, suma: p.suma });
    if (!salio) this.#fijar({ fase: 'en-pausa' });
    return salio;
  }

  detener(): void {
    for (const s of this.#soltar) s();
    this.#soltar = [];
  }

  #recibir(m: MensajeTermo): void {
    const p = this.#paquete;
    switch (m.tipo) {
      case 'firmwareProgreso':
        if (m.version !== p.version || this.#estado.fase === 'libre') return;
        this.#fijar({ fase: 'enviando', recibidos: m.recibidos });
        if (m.recibidos < p.bloques) {
          this.#enviar({
            tipo: 'firmwareBloque',
            version: p.version,
            n: m.recibidos,
            datos: bloqueFirmware(p.version, m.recibidos, p.tamanoBloque),
          });
        }
        break;
      case 'firmwareListo':
        if (m.version === p.version) this.#fijar({ fase: 'instalando', recibidos: p.bloques });
        break;
      case 'firmwareError':
        if (m.version === p.version) this.#fijar({ fase: 'error', error: m.motivo });
        break;
      case 'hola':
        if (m.firmware === p.version && this.#estado.fase !== 'libre') {
          this.#fijar({ fase: 'lista', recibidos: p.bloques });
        } else if (m.firmware !== p.version && this.#estado.fase === 'lista') {
          this.#fijar({ fase: 'libre', recibidos: 0 }); // volvió con otra versión (otro termo, o lo restauraron)
        } else if (this.#estado.fase === 'en-pausa') {
          this.iniciar(); // volvió a mitad de camino: el termo dice desde dónde seguir
        }
        break;
      default:
        break;
    }
  }

  #enlace(e: EstadoEnlace): void {
    if (e === 'desconectado' && this.#estado.fase === 'enviando') this.#fijar({ fase: 'en-pausa' });
  }

  #enviar(m: MensajeApp): boolean {
    return this.#transporte.enviar(m);
  }

  #fijar(cambios: Partial<EstadoActualizacion>): void {
    this.#estado = { ...this.#estado, ...cambios };
    for (const o of this.#oyentes) o(this.#estado);
  }
}
