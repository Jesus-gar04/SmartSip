/**
 * Formato de cifras para la voz de SmartSip: coma decimal y espacio fino
 * irrompible antes de la unidad, para que "2,6 L" nunca se parta en dos líneas.
 */
import type { Unidad } from './protocolo.ts';
import { celsiusAFahrenheit } from './termica.ts';

export const ESPACIO_UNIDAD = ' ';

/** 2415 → "2,4 L". */
export function formatoLitros(ml: number, decimales = 1): string {
  return `${(ml / 1000).toFixed(decimales).replace('.', ',')}${ESPACIO_UNIDAD}L`;
}

/** Temperatura entera en la unidad elegida: "63 °C" o "145 °F". */
export function formatoTemperatura(celsius: number, unidad: Unidad = 'C'): string {
  const valor = unidad === 'C' ? celsius : celsiusAFahrenheit(celsius);
  return `${Math.round(valor)}${ESPACIO_UNIDAD}°${unidad}`;
}
