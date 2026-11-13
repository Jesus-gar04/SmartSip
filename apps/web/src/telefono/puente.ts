/**
 * Puente entre el simulador y la app que corre dentro del teléfono dibujado.
 *
 * El teléfono es un iframe de la misma web (`/?telefono`) con su propio ancho
 * de celular: la app se ve y se comporta como en un teléfono de verdad (menú
 * abajo, alturas de pantalla, primer plano). En vez de Firebase, la app usa
 * el repositorio y el canal del simulador, que le deja aquí la página padre.
 * El simulador ya sincroniza los sorbos; la app solo escucha y responde,
 * igual que con un termo real.
 */
import type { DecisionResolucion, RegistroEvento, Repositorio, Transporte } from 'smartsip-core';

export interface PuenteTelefono {
  readonly repositorio: Repositorio;
  /** El canal app ↔ termo del simulador (el bus en memoria). */
  readonly transporte: Transporte;
  readonly termoId: string;
  readonly desfaseMin: number;
  /** La hora del simulador, que puede ir acelerada. */
  ahora(): number;
  /** "¿Lo bebiste o lo vaciaste?": lo resuelve el sincronizador del simulador. */
  resolver(registro: RegistroEvento, decision: DecisionResolucion): Promise<void>;
  /** Lo último que dijo el termo, para no esperar al próximo mensaje de estado. */
  estado(): { temperaturaC: number; bateria: number; nivelMl: number; firmware: string };
}

const CLAVE = '__smartsipTelefono';

/** Simulador: deja el puente para el iframe. */
export function exponerPuente(puente: PuenteTelefono): void {
  (window as unknown as Record<string, unknown>)[CLAVE] = puente;
}

/** App: el puente del simulador, si esta página es el teléfono dibujado. */
export function puenteDelSimulador(): PuenteTelefono | null {
  if (!new URLSearchParams(location.search).has('telefono') || window.parent === window) return null;
  try {
    return ((window.parent as unknown as Record<string, unknown>)[CLAVE] as PuenteTelefono | undefined) ?? null;
  } catch {
    return null; // otro origen: no es el simulador
  }
}
