/**
 * Cómo habla SmartSip del día (docs/voz.md): el saludo según la hora y una
 * frase que dice cómo vas, con una sola palabra en azul (manual §4).
 * Primero el dato, después lo que conviene hacer. Nunca culpa.
 */
import { formatoLitros } from './formato.ts';

/** Horas del día en que se espera ir bebiendo; fuera de ellas no se exige ritmo. */
const DESPIERTA = 7;
const DUERME = 22;

export function saludo(horaLocal: number, nombre: string | null): string {
  const base = horaLocal >= 5 && horaLocal < 12 ? 'Buenos días' : horaLocal >= 12 && horaLocal < 19 ? 'Buenas tardes' : 'Buenas noches';
  const primerNombre = nombre?.trim().split(/\s+/)[0];
  return primerNombre ? `${base}, ${primerNombre}` : base;
}

/** "40 ml" por debajo de un litro; "1,2 L" desde ahí. */
export function cantidad(ml: number): string {
  return ml < 1000 ? `${Math.round(ml)} ml` : formatoLitros(ml);
}

export interface FraseDelDia {
  /** Titular partido en tres para pintar de azul solo la palabra clave. */
  readonly antes: string;
  readonly azul: string;
  readonly despues: string;
  readonly detalle: string;
  /** Solo lo que conviene hacer, sin repetir las cifras (para cuando ya se ven). */
  readonly consejo: string;
  readonly cumplida: boolean;
}

/** Lo que se esperaría llevar a esta hora para cumplir la meta sin apuros. */
export function esperadoA(horaLocal: number, metaMl: number): number {
  const avance = (horaLocal - DESPIERTA) / (DUERME - DESPIERTA);
  return metaMl * Math.min(1, Math.max(0, avance));
}

export function fraseDelDia(totalMl: number, metaMl: number, horaLocal: number): FraseDelDia {
  const llevas = `Llevas ${cantidad(totalMl)} de ${cantidad(metaMl)}`;
  if (totalMl >= metaMl) {
    return {
      antes: 'Hidrataste lo de ',
      azul: 'hoy',
      despues: '.',
      detalle: `${llevas}. Lo que tomes desde ahora es extra.`,
      consejo: 'Lo que tomes desde ahora es extra.',
      cumplida: true,
    };
  }
  if (totalMl === 0) {
    return {
      antes: '¿Empezamos con un ',
      azul: 'sorbo',
      despues: '?',
      detalle: horaLocal < 12 ? `Tu meta de hoy es ${cantidad(metaMl)}.` : `Aún no hay agua registrada hoy. Tu meta es ${cantidad(metaMl)}.`,
      consejo: horaLocal < 12 ? 'El primer sorbo del día cuenta.' : 'Aún no hay agua registrada hoy.',
      cumplida: false,
    };
  }
  if (totalMl >= esperadoA(horaLocal, metaMl) * 0.9) {
    return { antes: 'Vas a buen ', azul: 'ritmo', despues: '.', detalle: `${llevas}.`, consejo: 'Sigue así.', cumplida: false };
  }
  return {
    antes: 'Te falta un poco de ',
    azul: 'agua',
    despues: '.',
    detalle: `${llevas}. Un par de sorbos y te pones al día.`,
    consejo: 'Un par de sorbos y te pones al día.',
    cumplida: false,
  };
}
