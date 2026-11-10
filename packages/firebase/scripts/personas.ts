/**
 * Usuarios de prueba de SmartSip. Cada uno tiene un hábito distinto para que
 * el historial y las estadísticas se vean diferentes en la demo.
 *
 * Las estaturas son las aproximadas del equipo. Los pesos se simulan a partir
 * de la estatura (IMC 22, el centro del rango saludable) y los hábitos son
 * ficticios: no describen a las personas reales. Edítalos aquí si hace falta.
 */
import type { Perfil } from 'smartsip-core';

export interface Habito {
  /** Hora local a la que empieza y termina de beber. */
  readonly despierta: number;
  readonly duerme: number;
  /** Momentos del día en que más bebe y cuánto pesa cada uno. */
  readonly picos: ReadonlyArray<{ readonly hora: number; readonly peso: number }>;
  /** Fracción de la meta que suele cumplir (1 = la cumple justo). */
  readonly cumplimiento: number;
  /** Cuánto varía de un día a otro. */
  readonly variacion: number;
  /** Multiplicador de sábados y domingos. */
  readonly finDeSemana: number;
  /** Cuánto mejora su cumplimiento cada semana. */
  readonly mejoraSemanal: number;
  /** Tamaño de sus sorbos, en ml. */
  readonly mlSorbo: readonly [number, number];
  /** Temperatura del agua que lleva, en °C. */
  readonly temperaturaAgua: readonly [number, number];
}

export interface Persona {
  readonly nombre: string;
  readonly correo: string;
  readonly termoId: string;
  /** Estatura en metros; de ella sale el peso simulado. */
  readonly estaturaM: number;
  readonly perfil: Omit<Perfil, 'nombre' | 'termoId'>;
  readonly habito: Habito;
  /** Para qué sirve en la demo. */
  readonly historia: string;
}

const base = { unidad: 'C', brillo: 'medio', desfaseMin: -300 } as const;

/** IMC que se usa para simular el peso: el centro del rango saludable (18,5–24,9). */
export const IMC_SIMULADO = 22;

/** Peso simulado, en kg enteros, para una estatura en metros. */
export function pesoSimulado(estaturaM: number): number {
  return Math.round(IMC_SIMULADO * estaturaM * estaturaM);
}

export const PERSONAS: readonly Persona[] = [
  {
    nombre: 'Carolina Torres',
    correo: 'carolina.torres@smartsip.com',
    termoId: 'SS-0001',
    estaturaM: 1.56,
    perfil: { ...base, pesoKg: pesoSimulado(1.56), actividad: 'media' },
    historia: 'Constante y madrugadora: cumple casi todos los días, repartido desde temprano.',
    habito: {
      despierta: 5,
      duerme: 21,
      picos: [
        { hora: 6, peso: 3 },
        { hora: 10, peso: 2 },
        { hora: 14, peso: 2 },
        { hora: 18, peso: 1 },
      ],
      cumplimiento: 1.02,
      variacion: 0.07,
      finDeSemana: 0.95,
      mejoraSemanal: 0,
      mlSorbo: [50, 95],
      temperaturaAgua: [8, 16],
    },
  },
  {
    nombre: 'Briany Lindo',
    correo: 'briany.lindo@smartsip.com',
    termoId: 'SS-0002',
    estaturaM: 1.7,
    perfil: { ...base, pesoKg: pesoSimulado(1.7), actividad: 'alta' },
    historia: 'Deportista de la tarde: bebe poco en la mañana y mucho después de entrenar; agua muy fría.',
    habito: {
      despierta: 7,
      duerme: 23,
      picos: [
        { hora: 9, peso: 1 },
        { hora: 13, peso: 1 },
        { hora: 18, peso: 4 },
        { hora: 20, peso: 2 },
      ],
      cumplimiento: 1.1,
      variacion: 0.12,
      finDeSemana: 1.15,
      mejoraSemanal: 0,
      mlSorbo: [70, 130],
      temperaturaAgua: [4, 10],
    },
  },
  {
    nombre: 'Luisa Fontalvo',
    correo: 'luisa.fontalvo@smartsip.com',
    termoId: 'SS-0003',
    estaturaM: 1.64,
    perfil: { ...base, pesoKg: pesoSimulado(1.64), actividad: 'baja' },
    historia: 'Bebe bien en la mañana y se le olvida en la tarde: el caso de los recordatorios por ritmo.',
    habito: {
      despierta: 6,
      duerme: 22,
      picos: [
        { hora: 8, peso: 4 },
        { hora: 11, peso: 2 },
        { hora: 15, peso: 0.5 },
        { hora: 20, peso: 1 },
      ],
      cumplimiento: 0.68,
      variacion: 0.14,
      finDeSemana: 0.8,
      mejoraSemanal: 0,
      mlSorbo: [45, 80],
      temperaturaAgua: [10, 20],
    },
  },
  {
    nombre: 'Juan Ospino',
    correo: 'juan.ospino@smartsip.com',
    termoId: 'SS-0004',
    estaturaM: 1.65,
    perfil: { ...base, pesoKg: pesoSimulado(1.65), actividad: 'media' },
    historia: 'Usa el termo para el tinto de la mañana: bebe caliente y baja mucho los fines de semana.',
    habito: {
      despierta: 6,
      duerme: 22,
      picos: [
        { hora: 7, peso: 3 },
        { hora: 10, peso: 2 },
        { hora: 16, peso: 1 },
      ],
      cumplimiento: 0.85,
      variacion: 0.1,
      finDeSemana: 0.6,
      mejoraSemanal: 0,
      mlSorbo: [45, 85],
      temperaturaAgua: [55, 75],
    },
  },
  {
    nombre: 'Vanessa Ramirez',
    correo: 'vanessa.ramirez@smartsip.com',
    termoId: 'SS-0005',
    estaturaM: 1.6,
    perfil: { ...base, pesoKg: pesoSimulado(1.6), actividad: 'baja' },
    historia: 'Nocturna que va mejorando: empezó lejos de la meta y sube cada semana.',
    habito: {
      despierta: 9,
      duerme: 23.9,
      picos: [
        { hora: 11, peso: 1 },
        { hora: 16, peso: 1 },
        { hora: 21, peso: 3 },
        { hora: 23, peso: 2 },
      ],
      cumplimiento: 0.5,
      variacion: 0.15,
      finDeSemana: 1,
      mejoraSemanal: 0.14,
      mlSorbo: [40, 90],
      temperaturaAgua: [12, 25],
    },
  },
];
