/**
 * Estado de la interfaz (Zustand). Guarda solo lo que se dibuja; la
 * simulación vive en `Simulacion` y se refleja aquí unas diez veces por
 * segundo, no en cada cuadro.
 */
import { create } from 'zustand';
import type { Direccion, RegistroEvento, UltimoVisto } from 'smartsip-core';
import type { ClimaLocal } from '../clima/clima-local.ts';
import type { Instantanea } from '../simulacion/simulacion.ts';

export type ModoDatos = 'memoria' | 'firebase';
export type Fase = 'cargando' | 'lista' | 'error';
export type Pestana = 'termo' | 'app';

export interface MensajeLinea {
  readonly n: number;
  readonly direccion: Direccion;
  readonly enMs: number;
  readonly tipo: string;
  readonly texto: string;
}

export interface TemperaturaAgua {
  readonly nombre: 'fria' | 'ambiente' | 'caliente';
  readonly celsius: number | null; // null: la del ambiente
}

export interface Tienda {
  fase: Fase;
  modo: ModoDatos;
  error: string | null;
  uid: string | null;
  inst: Instantanea | null;
  linea: readonly MensajeLinea[];
  /** Cuenta los mensajes de estado; la línea muestra un pulso sin texto. */
  pulsosEstado: number;
  hoyMl: number;
  hoySorbos: number;
  pendientes: readonly RegistroEvento[];
  ultimoVisto: UltimoVisto | null;
  bateriaBaja: boolean;
  /** Clima real del lugar: da la temperatura ambiente del termo. */
  clima: ClimaLocal | null;
  climaEstado: 'cargando' | 'listo' | 'error';
  /** Preferencias del panel. */
  sorboMl: number;
  agua: TemperaturaAgua['nombre'];
  pestana: Pestana;
  /** El termo está unido a una app en otro dispositivo. */
  remoto: boolean;
  /** Avisos al celular que decide el termo (solo emparejado). */
  avisos: EstadoAvisosTermo;
}

export interface EstadoAvisosTermo {
  /** La app ya le contó la meta y el ritmo. */
  readonly listo: boolean;
  readonly llevasMl: number;
  readonly esperadoMl: number | null;
  readonly metaMl: number | null;
  /** Qué decidió en la última revisión, dicho en una frase. */
  readonly decision: string;
  readonly ultimo: { readonly texto: string; readonly ok: boolean; readonly enMs: number } | null;
}

export const LIMITE_LINEA = 14;

export const useTienda = create<Tienda>(() => ({
  fase: 'cargando',
  modo: 'memoria',
  error: null,
  uid: null,
  inst: null,
  linea: [],
  pulsosEstado: 0,
  hoyMl: 0,
  hoySorbos: 0,
  pendientes: [],
  ultimoVisto: null,
  bateriaBaja: false,
  clima: null,
  climaEstado: 'cargando',
  sorboMl: 40,
  agua: 'fria',
  pestana: 'termo',
  remoto: false,
  avisos: { listo: false, llevasMl: 0, esperadoMl: null, metaMl: null, decision: '', ultimo: null },
}));

export const AGUAS: readonly TemperaturaAgua[] = [
  { nombre: 'fria', celsius: 6 },
  { nombre: 'ambiente', celsius: null },
  { nombre: 'caliente', celsius: 85 },
];
