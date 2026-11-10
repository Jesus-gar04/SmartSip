/** Formatos de hora y lugar para la interfaz (hora de Barranquilla, UTC−5). */
const DESFASE_MS = -5 * 3_600_000;

export function hora(ms: number, segundos = false): string {
  return new Date(ms + DESFASE_MS).toISOString().slice(11, segundos ? 19 : 16);
}

export function fechaLarga(ms: number): string {
  const d = new Date(ms + DESFASE_MS);
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${dias[d.getUTCDay()]} ${d.getUTCDate()} de ${meses[d.getUTCMonth()]}`;
}

/** 10.98123 → "10,981" */
export function coordenada(v: number): string {
  return v.toFixed(3).replace('.', ',').replace('-', '−');
}
