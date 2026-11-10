/** Batería del termo y su aviso honesto en días (casos T5 y A3). */

export type Brillo = 'bajo' | 'medio' | 'alto';

export interface ReglasBateria {
  /** Días que dura una carga completa con brillo medio. */
  readonly autonomiaDiasBrilloMedio: number;
  /** Cuánto más (o menos) gasta la pantalla según el brillo. */
  readonly factorBrillo: Readonly<Record<Brillo, number>>;
  /** Horas para cargar de 0 a 100 %. */
  readonly horasCargaCompleta: number;
  /** Por debajo de esta carga se avisa (15 %). */
  readonly umbralBaja: number;
  /** Para volver a avisar, la carga tiene que subir este margen por encima del umbral. */
  readonly histeresis: number;
}

export const REGLAS_BATERIA: ReglasBateria = {
  autonomiaDiasBrilloMedio: 7,
  factorBrillo: { bajo: 0.8, medio: 1, alto: 1.4 },
  horasCargaCompleta: 2,
  umbralBaja: 0.15,
  histeresis: 0.05,
};

const MS_POR_HORA = 3_600_000;

/** Fracción de carga que se gasta por hora con un brillo dado. */
export function consumoPorHora(brillo: Brillo, reglas: ReglasBateria = REGLAS_BATERIA): number {
  return reglas.factorBrillo[brillo] / (reglas.autonomiaDiasBrilloMedio * 24);
}

/** Carga tras `dtMs`, entre 0 y 1. */
export function cargaTras(
  carga: number,
  brillo: Brillo,
  cargando: boolean,
  dtMs: number,
  reglas: ReglasBateria = REGLAS_BATERIA,
): number {
  const horas = dtMs / MS_POR_HORA;
  const delta = cargando ? horas / reglas.horasCargaCompleta : -horas * consumoPorHora(brillo, reglas);
  return Math.min(1, Math.max(0, carga + delta));
}

/** Días que quedan con la carga actual, si se mantiene el brillo. */
export function autonomiaDias(
  carga: number,
  brillo: Brillo,
  reglas: ReglasBateria = REGLAS_BATERIA,
): number {
  return carga / (consumoPorHora(brillo, reglas) * 24);
}

/** La batería, dicha en tiempo y diciendo de qué se habla (docs/voz.md). */
export function textoAutonomia(dias: number): string {
  if (dias <= 0) return 'El termo se quedó sin batería. Conéctalo para seguir contando tus sorbos.';
  const horas = Math.round(dias * 24);
  if (horas < 2) return 'A la batería del termo le queda muy poco. Conviene cargarlo ya.';
  if (dias < 1) return `A la batería del termo le quedan unas ${horas} horas.`;
  const redondeo = Math.round(dias);
  if (redondeo === 1) return 'La batería del termo te alcanza para un día más.';
  return `La batería del termo te alcanza para unos ${redondeo} días.`;
}
