/**
 * Recordatorio que lee el ritmo (SPEC §5.6, A1 y U4). No avisa a hora fija:
 * compara lo que llevas con lo que sueles llevar a esta hora y solo avisa si
 * vas atrasado de verdad. Sereno: como mucho uno cada 90 minutos, unos pocos
 * al día y nunca en el horario de silencio (manual, Notificacion).
 *
 * Funciones puras: las usa el termo (que es quien sabe cuánto bebiste aunque
 * la app esté cerrada) y las pruebas. Los textos siguen docs/voz.md.
 */
import { claveDia } from './consumo.ts';
import type { ResumenDia } from './registros.ts';
import { cantidad, esperadoA } from './voz.ts';

export type Tono = 'sereno' | 'directo';

export interface AjustesRecordatorio {
  readonly activos: boolean;
  /** Hora local en que empieza el silencio (0 a 23). */
  readonly silencioDesde: number;
  /** Hora local en que termina el silencio (0 a 23). Igual a `silencioDesde`: sin silencio. */
  readonly silencioHasta: number;
  readonly tono: Tono;
}

export const RECORDATORIO_POR_DEFECTO: AjustesRecordatorio = {
  activos: true,
  silencioDesde: 22,
  silencioHasta: 7,
  tono: 'sereno',
};

export interface ReglasRecordatorio {
  /** Días con datos que hacen falta para hablar de "tu ritmo". */
  readonly minimoDias: number;
  /** Cuántos días hacia atrás se miran. */
  readonly diasRitmo: number;
  readonly separacionMs: number;
  readonly maximoPorDia: number;
  /** El atraso tiene que pasar de esto y de una fracción de la meta. */
  readonly atrasoMinimoMl: number;
  readonly atrasoMinimoFraccion: number;
}

export const REGLAS_RECORDATORIO: ReglasRecordatorio = {
  minimoDias: 3,
  diasRitmo: 14,
  separacionMs: 90 * 60_000,
  maximoPorDia: 4,
  atrasoMinimoMl: 250,
  atrasoMinimoFraccion: 0.15,
};

// ─── El ritmo ───────────────────────────────────────────────────────────────

/**
 * Curva acumulada de 25 valores: `curva[h]` es la parte del día que sueles
 * haber bebido antes de la hora `h`. Empieza en 0 y termina en 1.
 */
export type Curva = readonly number[];

/** Sin historial: la meta repartida de forma pareja entre las 7:00 y las 22:00. */
export function curvaPareja(): Curva {
  return Array.from({ length: 25 }, (_, h) => esperadoA(h, 1));
}

/** Tu ritmo de los últimos días, o `null` si aún no hay días suficientes. */
export function curvaDeRitmo(dias: readonly ResumenDia[], reglas: ReglasRecordatorio = REGLAS_RECORDATORIO): Curva | null {
  const conDatos = dias.filter((d) => d.totalMl > 0).slice(-reglas.diasRitmo);
  if (conDatos.length < reglas.minimoDias) return null;
  // Cada día pesa lo mismo, beba mucho o poco.
  const porHora = Array.from({ length: 24 }, (_, h) =>
    conDatos.reduce((s, d) => s + (d.porHora[h] ?? 0) / d.totalMl, 0) / conDatos.length,
  );
  const curva = [0];
  for (let h = 0; h < 24; h++) curva.push((curva[h] ?? 0) + (porHora[h] ?? 0));
  const total = curva[24] ?? 1;
  return curva.map((v) => Math.round((v / total) * 1000) / 1000);
}

/** Parte del día que se espera llevar a una hora local con minutos (9,5 = 9:30). */
export function fraccionEsperada(curva: Curva, horaDecimal: number): number {
  const h = Math.min(24, Math.max(0, horaDecimal));
  const base = Math.floor(h);
  const a = curva[base] ?? 1;
  const b = curva[Math.min(24, base + 1)] ?? 1;
  return a + (b - a) * (h - base);
}

/** 9:30 hora local → 9,5. */
export function horaDecimalLocal(enMs: number, desfaseMin: number): number {
  const d = new Date(enMs + desfaseMin * 60_000);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}

/** Si una hora local cae en el silencio; el silencio puede cruzar la medianoche. */
export function enSilencio(horaDecimal: number, a: AjustesRecordatorio): boolean {
  const { silencioDesde: desde, silencioHasta: hasta } = a;
  if (desde === hasta) return false;
  return desde < hasta ? horaDecimal >= desde && horaDecimal < hasta : horaDecimal >= desde || horaDecimal < hasta;
}

// ─── Lo que la app le cuenta al termo ───────────────────────────────────────

/** Lo que el termo necesita para decidir solo, aunque la app esté cerrada. */
export interface Ritmo {
  /** Día local al que corresponden `metaMl` y `totalMlApp`. */
  readonly fecha: string;
  readonly desfaseMin: number;
  readonly metaMl: number;
  readonly curva: Curva;
  /** La curva sale de tus días (y no de repartir la meta parejo). */
  readonly deHabito: boolean;
  readonly ajustes: AjustesRecordatorio;
  /** Lo que la app tenía sumado ese día (incluye descensos que respondiste "lo bebí"). */
  readonly totalMlApp: number;
}

// ─── La decisión ────────────────────────────────────────────────────────────

/** Lo que el termo recuerda de los avisos de hoy. */
export interface MemoriaAvisos {
  readonly fecha: string;
  readonly enviados: number;
  readonly ultimoMs: number | null;
  readonly metaAvisada: boolean;
}

export const memoriaVacia = (fecha: string): MemoriaAvisos => ({ fecha, enviados: 0, ultimoMs: null, metaAvisada: false });

export type MotivoSilencio = 'apagados' | 'silencio' | 'al-dia' | 'cumplida' | 'muy-pronto' | 'suficientes';

export type Decision =
  | { readonly tipo: 'nada'; readonly motivo: MotivoSilencio }
  | { readonly tipo: 'ritmo'; readonly llevasMl: number; readonly esperadoMl: number; readonly faltaMl: number }
  | { readonly tipo: 'metaCumplida'; readonly llevasMl: number };

export interface EntradaDecision {
  readonly ritmo: Ritmo;
  /** Lo que el termo contó hoy. */
  readonly totalMlTermo: number;
  readonly ahoraMs: number;
  readonly memoria: MemoriaAvisos;
  readonly reglas?: ReglasRecordatorio;
}

/** La memoria de hoy: la de ayer no cuenta. */
export function memoriaDeHoy(m: MemoriaAvisos | null, ahoraMs: number, desfaseMin: number): MemoriaAvisos {
  const hoy = claveDia(ahoraMs, desfaseMin);
  return m && m.fecha === hoy ? m : memoriaVacia(hoy);
}

/** Lo que llevas hoy: lo que contó el termo o lo que sumó la app, lo que sea mayor. */
export function llevasHoy(ritmo: Ritmo, totalMlTermo: number, ahoraMs: number): number {
  const app = ritmo.fecha === claveDia(ahoraMs, ritmo.desfaseMin) ? ritmo.totalMlApp : 0;
  return Math.max(app, totalMlTermo);
}

export function decidirAviso(e: EntradaDecision): Decision {
  const reglas = e.reglas ?? REGLAS_RECORDATORIO;
  const { ritmo, ahoraMs } = e;
  const memoria = memoriaDeHoy(e.memoria, ahoraMs, ritmo.desfaseMin);
  const hora = horaDecimalLocal(ahoraMs, ritmo.desfaseMin);
  const llevasMl = llevasHoy(ritmo, e.totalMlTermo, ahoraMs);

  if (!ritmo.ajustes.activos) return { tipo: 'nada', motivo: 'apagados' };
  if (enSilencio(hora, ritmo.ajustes)) return { tipo: 'nada', motivo: 'silencio' };
  if (llevasMl >= ritmo.metaMl) {
    return memoria.metaAvisada ? { tipo: 'nada', motivo: 'cumplida' } : { tipo: 'metaCumplida', llevasMl };
  }
  if (memoria.enviados >= reglas.maximoPorDia) return { tipo: 'nada', motivo: 'suficientes' };
  if (memoria.ultimoMs !== null && ahoraMs - memoria.ultimoMs < reglas.separacionMs) return { tipo: 'nada', motivo: 'muy-pronto' };

  const esperadoMl = Math.round(ritmo.metaMl * fraccionEsperada(ritmo.curva, hora));
  const faltaMl = esperadoMl - llevasMl;
  const umbral = Math.max(reglas.atrasoMinimoMl, ritmo.metaMl * reglas.atrasoMinimoFraccion);
  if (faltaMl < umbral) return { tipo: 'nada', motivo: 'al-dia' };
  return { tipo: 'ritmo', llevasMl, esperadoMl, faltaMl };
}

/** Lo que el termo anota después de enviar un aviso. */
export function anotarEnvio(m: MemoriaAvisos, d: Decision, ahoraMs: number): MemoriaAvisos {
  if (d.tipo === 'ritmo') return { ...m, enviados: m.enviados + 1, ultimoMs: ahoraMs };
  if (d.tipo === 'metaCumplida') return { ...m, metaAvisada: true };
  return m;
}

// ─── Los avisos y lo que dicen ──────────────────────────────────────────────

export type TipoAviso = 'ritmo' | 'bateriaBaja' | 'desconectado' | 'metaCumplida' | 'prueba';

/** Lo que viaja en el push y se muestra en el celular. */
export interface Aviso {
  readonly tipo: TipoAviso;
  /** Un hecho, de una línea. */
  readonly titulo: string;
  /** Una salida fácil. */
  readonly cuerpo: string;
}

export const LIMITE_TITULO = 80;
export const LIMITE_CUERPO = 200;

export function avisoRitmo(llevasMl: number, esperadoMl: number, metaMl: number, tono: Tono, deHabito: boolean): Aviso {
  const falta = Math.max(0, esperadoMl - llevasMl);
  const comparacion = deHabito ? 'a esta hora sueles llevar' : 'a esta hora convendría llevar';
  if (tono === 'directo') {
    return {
      tipo: 'ritmo',
      titulo: `Te faltan ${cantidad(falta)} para ir al día`,
      cuerpo: `Llevas ${cantidad(llevasMl)} de ${cantidad(metaMl)}. Un vaso ahora y te pones al día.`,
    };
  }
  return {
    tipo: 'ritmo',
    titulo: 'Te falta un poco de agua para ir al día',
    cuerpo: `Llevas ${cantidad(llevasMl)}; ${comparacion} ${cantidad(esperadoMl)}. Un par de sorbos y te pones al día.`,
  };
}

export function avisoMetaCumplida(llevasMl: number, metaMl: number): Aviso {
  return {
    tipo: 'metaCumplida',
    titulo: 'Hidrataste lo de hoy.',
    cuerpo: `Llevas ${cantidad(llevasMl)} de ${cantidad(metaMl)}. Lo que tomes desde ahora es extra.`,
  };
}

/** `dias`: autonomía de la batería con el brillo actual. */
export function avisoBateriaBaja(dias: number): Aviso {
  const horas = Math.round(dias * 24);
  const cuanto =
    horas < 2
      ? 'A la batería del termo le queda muy poco.'
      : dias < 1
        ? `A la batería del termo le quedan unas ${horas} horas.`
        : Math.round(dias) <= 1
          ? 'La batería del termo te alcanza para un día más.'
          : `La batería del termo te alcanza para unos ${Math.round(dias)} días.`;
  return { tipo: 'bateriaBaja', titulo: 'La batería del termo está baja', cuerpo: `${cuanto} Cárgalo cuando puedas.` };
}

/** `horaTexto`: "15:40", la última vez que estuvo cerca. */
export function avisoDesconectado(horaTexto: string): Aviso {
  return {
    tipo: 'desconectado',
    titulo: 'Tu termo no está cerca',
    cuerpo: `Estuvo cerca por última vez a las ${horaTexto}. En la app puedes ver dónde.`,
  };
}

export function avisoPrueba(): Aviso {
  return { tipo: 'prueba', titulo: 'Los avisos de SmartSip ya llegan', cuerpo: 'Así se verán cuando te falte un poco de agua.' };
}

/** Recorta y valida un aviso que llega de afuera (por ejemplo, a la función que envía el push). */
export function avisoValido(x: unknown): Aviso | null {
  if (typeof x !== 'object' || x === null) return null;
  const { tipo, titulo, cuerpo } = x as Record<string, unknown>;
  const tipos: readonly TipoAviso[] = ['ritmo', 'bateriaBaja', 'desconectado', 'metaCumplida', 'prueba'];
  if (typeof tipo !== 'string' || !tipos.includes(tipo as TipoAviso)) return null;
  if (typeof titulo !== 'string' || typeof cuerpo !== 'string' || !titulo.trim() || !cuerpo.trim()) return null;
  return { tipo: tipo as TipoAviso, titulo: titulo.slice(0, LIMITE_TITULO), cuerpo: cuerpo.slice(0, LIMITE_CUERPO) };
}
