/**
 * Dónde se guardan los datos de la persona. La app solo conoce esta interfaz;
 * hay una implementación en memoria (pruebas y simulador sin red) y otra con
 * Firestore (`smartsip-firebase`). Una misma batería de pruebas de contrato
 * corre contra las dos.
 *
 * Reglas que toda implementación cumple:
 * - `registrar` es atómico (el evento y su aporte al día se guardan juntos) e
 *   idempotente (registrar dos veces el mismo evento no suma dos veces).
 * - Un descenso grande se resuelve una sola vez.
 * - Ninguna consulta lee una colección entera: todas tienen límite.
 */
import type { Brillo } from './bateria.ts';
import type { Actividad } from './meta.ts';
import type { Unidad } from './protocolo.ts';
import type { AjustesRecordatorio } from './recordatorios.ts';
import {
  aporte,
  resumenVacio,
  sumarAporte,
  type EstadoRegistro,
  type RegistroEvento,
  type ResumenDia,
} from './registros.ts';

export interface Perfil {
  readonly nombre: string | null;
  readonly pesoKg: number;
  readonly actividad: Actividad;
  readonly unidad: Unidad;
  readonly brillo: Brillo;
  /** Desfase respecto a UTC en minutos; −300 en Colombia. */
  readonly desfaseMin: number;
  /** El termo emparejado;  hasta que se empareja uno. */
  readonly termoId: string | null;
  /** U4: ritmo, horario de silencio y tono. Sin el campo, los de siempre. */
  readonly recordatorio?: AjustesRecordatorio;
}

export interface Lugar {
  readonly lat: number;
  readonly lng: number;
  readonly precisionM: number;
}

/** Último lugar y hora en que el termo estuvo cerca (caso T6 y A2). */
export interface UltimoVisto {
  readonly enMs: number;
  readonly lugar: Lugar | null;
}

export interface DatosTermo {
  readonly termoId: string;
  readonly nombre: string | null;
  readonly capacidadMl: number | null;
  readonly firmware: string | null;
  readonly bateria: number | null;
  readonly temperaturaC: number | null;
  readonly ultimoVisto: UltimoVisto | null;
}

/** Cambios parciales: solo se escriben los campos presentes. */
export type CambiosTermo = { readonly termoId: string } & Partial<Omit<DatosTermo, 'termoId'>>;

export type DecisionResolucion = 'bebido' | 'vaciado';

export type CodigoErrorRepositorio = 'ya-resuelto' | 'no-existe' | 'no-pendiente';

export class ErrorRepositorio extends Error {
  readonly codigo: CodigoErrorRepositorio;
  constructor(codigo: CodigoErrorRepositorio, mensaje: string) {
    super(mensaje);
    this.name = 'ErrorRepositorio';
    this.codigo = codigo;
  }
}

/** Límites de las consultas. */
export const LIMITES = {
  pendientes: 50,
  eventosDelDia: 500,
  dias: 400,
} as const;

export interface Repositorio {
  leerPerfil(): Promise<Perfil | null>;
  guardarPerfil(perfil: Perfil): Promise<void>;

  leerTermo(termoId: string): Promise<DatosTermo | null>;
  guardarTermo(cambios: CambiosTermo): Promise<void>;
  /** Último id de evento guardado de ese termo; 0 si no hay ninguno. */
  ultimoIdDeTermo(termoId: string): Promise<number>;

  /** Guarda un evento y lo que suma a su día. Atómico e idempotente. */
  registrar(registro: RegistroEvento): Promise<void>;
  /** Responde "¿Lo bebiste o lo vaciaste?". Si se bebió, suma al día. */
  resolverDescenso(registro: RegistroEvento, decision: DecisionResolucion): Promise<void>;

  /** Descensos grandes sin responder, del más antiguo al más reciente. */
  pendientes(): Promise<readonly RegistroEvento[]>;
  /** Eventos de un día local, en orden. */
  eventosDelDia(fecha: string): Promise<readonly RegistroEvento[]>;
  /** Resúmenes de los días con datos entre dos fechas, ambas incluidas, en orden. */
  dias(desde: string, hasta: string): Promise<readonly ResumenDia[]>;
  fijarMetaDelDia(fecha: string, metaMl: number, climaC: number | null): Promise<void>;

  /** Resumen de un día en vivo. Devuelve cómo dejar de escuchar. */
  escucharDia(fecha: string, oyente: (resumen: ResumenDia) => void, alError?: (error: unknown) => void): () => void;
  escucharPendientes(
    oyente: (pendientes: readonly RegistroEvento[]) => void,
    alError?: (error: unknown) => void,
  ): () => void;
}

// ─── Implementación en memoria ──────────────────────────────────────────────

const ESTADO_FINAL: readonly EstadoRegistro[] = ['bebido', 'vaciado'];

export class RepositorioEnMemoria implements Repositorio {
  #perfil: Perfil | null = null;
  #termos = new Map<string, DatosTermo>();
  #eventos = new Map<string, RegistroEvento>();
  #dias = new Map<string, ResumenDia>();
  #oyentesDia = new Map<string, Set<(r: ResumenDia) => void>>();
  #oyentesPendientes = new Set<(p: readonly RegistroEvento[]) => void>();

  async leerPerfil(): Promise<Perfil | null> {
    return this.#perfil;
  }

  async guardarPerfil(perfil: Perfil): Promise<void> {
    this.#perfil = { ...perfil };
  }

  async leerTermo(termoId: string): Promise<DatosTermo | null> {
    return this.#termos.get(termoId) ?? null;
  }

  async guardarTermo(cambios: CambiosTermo): Promise<void> {
    const actual: DatosTermo = this.#termos.get(cambios.termoId) ?? {
      termoId: cambios.termoId,
      nombre: null,
      capacidadMl: null,
      firmware: null,
      bateria: null,
      temperaturaC: null,
      ultimoVisto: null,
    };
    const definidos = Object.fromEntries(Object.entries(cambios).filter(([, v]) => v !== undefined));
    this.#termos.set(cambios.termoId, { ...actual, ...definidos });
  }

  async ultimoIdDeTermo(termoId: string): Promise<number> {
    let ultimo = 0;
    for (const e of this.#eventos.values()) if (e.termoId === termoId && e.id > ultimo) ultimo = e.id;
    return ultimo;
  }

  async registrar(registro: RegistroEvento): Promise<void> {
    if (this.#eventos.has(registro.clave)) return; // idempotente
    this.#eventos.set(registro.clave, registro);
    const a = aporte(registro);
    if (a) this.#sumar(a.fecha, (r) => sumarAporte(r, a));
    if (registro.estado === 'pendiente') this.#avisarPendientes();
  }

  async resolverDescenso(registro: RegistroEvento, decision: DecisionResolucion): Promise<void> {
    const actual = this.#eventos.get(registro.clave);
    if (!actual) throw new ErrorRepositorio('no-existe', `No existe el evento ${registro.clave}.`);
    if (actual.tipo !== 'descensoGrande') {
      throw new ErrorRepositorio('no-pendiente', `El evento ${registro.clave} no es un descenso grande.`);
    }
    if (ESTADO_FINAL.includes(actual.estado)) {
      throw new ErrorRepositorio('ya-resuelto', `El descenso ${registro.clave} ya se respondió.`);
    }
    const resuelto: RegistroEvento = { ...actual, estado: decision };
    this.#eventos.set(registro.clave, resuelto);
    const a = aporte(resuelto);
    if (a) this.#sumar(a.fecha, (r) => sumarAporte(r, a));
    this.#avisarPendientes();
  }

  async pendientes(): Promise<readonly RegistroEvento[]> {
    return this.#listaPendientes();
  }

  async eventosDelDia(fecha: string): Promise<readonly RegistroEvento[]> {
    return [...this.#eventos.values()]
      .filter((e) => e.dia === fecha)
      .sort((a, b) => a.enMs - b.enMs || a.clave.localeCompare(b.clave))
      .slice(0, LIMITES.eventosDelDia);
  }

  async dias(desde: string, hasta: string): Promise<readonly ResumenDia[]> {
    return [...this.#dias.values()]
      .filter((d) => d.fecha >= desde && d.fecha <= hasta)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .slice(0, LIMITES.dias);
  }

  async fijarMetaDelDia(fecha: string, metaMl: number, climaC: number | null): Promise<void> {
    this.#sumar(fecha, (r) => ({ ...r, metaMl, climaC }));
  }

  escucharDia(fecha: string, oyente: (resumen: ResumenDia) => void): () => void {
    const oyentes = this.#oyentesDia.get(fecha) ?? new Set();
    oyentes.add(oyente);
    this.#oyentesDia.set(fecha, oyentes);
    oyente(this.#dias.get(fecha) ?? resumenVacio(fecha));
    return () => oyentes.delete(oyente);
  }

  escucharPendientes(oyente: (pendientes: readonly RegistroEvento[]) => void): () => void {
    this.#oyentesPendientes.add(oyente);
    oyente(this.#listaPendientes());
    return () => this.#oyentesPendientes.delete(oyente);
  }

  #listaPendientes(): RegistroEvento[] {
    return [...this.#eventos.values()]
      .filter((e) => e.estado === 'pendiente')
      .sort((a, b) => a.enMs - b.enMs)
      .slice(0, LIMITES.pendientes);
  }

  #sumar(fecha: string, cambio: (r: ResumenDia) => ResumenDia): void {
    const nuevo = cambio(this.#dias.get(fecha) ?? resumenVacio(fecha));
    this.#dias.set(fecha, nuevo);
    for (const oyente of this.#oyentesDia.get(fecha) ?? []) oyente(nuevo);
  }

  #avisarPendientes(): void {
    const lista = this.#listaPendientes();
    for (const oyente of this.#oyentesPendientes) oyente(lista);
  }
}
