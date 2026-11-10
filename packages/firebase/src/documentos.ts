/**
 * Forma de los documentos en Firestore y su traducción al modelo del núcleo.
 *
 *   users/{uid}                    perfil
 *   users/{uid}/termos/{termoId}   último lugar visto y telemetría esencial
 *   users/{uid}/eventos/{clave}    cada sorbo, llenado o descenso
 *   users/{uid}/dias/{AAAA-MM-DD}  resumen del día, sumado al escribir
 *
 * Las horas se guardan como `Timestamp` (legibles en la consola y comparables
 * en consultas); en el núcleo son milisegundos.
 */
import { increment, serverTimestamp, Timestamp, type DocumentData, type FieldValue } from 'firebase/firestore';
import {
  RECORDATORIO_POR_DEFECTO,
  resumenVacio,
  type AjustesRecordatorio,
  type AporteDia,
  type CambiosTermo,
  type DatosTermo,
  type Lugar,
  type Perfil,
  type RegistroEvento,
  type ResumenDia,
} from 'smartsip-core';

export const COLECCION = {
  usuarios: 'users',
  termos: 'termos',
  eventos: 'eventos',
  dias: 'dias',
} as const;

const dos = (h: number) => String(h).padStart(2, '0');
const numero = (v: unknown, otro: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : otro);
const numeroONulo = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const textoONulo = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const msDe = (v: unknown): number => (v instanceof Timestamp ? v.toMillis() : 0);

// ─── Perfil ─────────────────────────────────────────────────────────────────

export function aDocPerfil(p: Perfil): DocumentData {
  return { ...p, actualizadoEn: serverTimestamp() };
}

export function dePerfil(d: DocumentData): Perfil {
  return {
    nombre: textoONulo(d['nombre']),
    pesoKg: numero(d['pesoKg'], 0),
    actividad: d['actividad'],
    unidad: d['unidad'],
    brillo: d['brillo'],
    desfaseMin: numero(d['desfaseMin'], 0),
    termoId: textoONulo(d['termoId']),
    ...(d['recordatorio'] ? { recordatorio: deRecordatorio(d['recordatorio']) } : {}),
  };
}

function deRecordatorio(v: unknown): AjustesRecordatorio {
  const r = (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>;
  const p = RECORDATORIO_POR_DEFECTO;
  const hora = (x: unknown, otra: number) => (Number.isInteger(x) && (x as number) >= 0 && (x as number) <= 23 ? (x as number) : otra);
  return {
    activos: typeof r['activos'] === 'boolean' ? r['activos'] : p.activos,
    silencioDesde: hora(r['silencioDesde'], p.silencioDesde),
    silencioHasta: hora(r['silencioHasta'], p.silencioHasta),
    tono: r['tono'] === 'directo' ? 'directo' : 'sereno',
  };
}

// ─── Termo ──────────────────────────────────────────────────────────────────

/** Solo los campos presentes; `merge` en Firestore conserva el resto. */
export function aDocTermo(cambios: CambiosTermo): DocumentData {
  const { termoId: _id, ultimoVisto, ...resto } = cambios;
  const doc: DocumentData = { ...resto, actualizadoEn: serverTimestamp() };
  if (ultimoVisto !== undefined) {
    doc['ultimoVisto'] =
      ultimoVisto === null ? null : { en: Timestamp.fromMillis(ultimoVisto.enMs), lugar: ultimoVisto.lugar };
  }
  return doc;
}

export function deTermo(termoId: string, d: DocumentData): DatosTermo {
  const visto = d['ultimoVisto'] as { en?: unknown; lugar?: Lugar | null } | null | undefined;
  return {
    termoId,
    nombre: textoONulo(d['nombre']),
    capacidadMl: numeroONulo(d['capacidadMl']),
    firmware: textoONulo(d['firmware']),
    bateria: numeroONulo(d['bateria']),
    temperaturaC: numeroONulo(d['temperaturaC']),
    ultimoVisto: visto ? { enMs: msDe(visto.en), lugar: visto.lugar ?? null } : null,
  };
}

// ─── Eventos ────────────────────────────────────────────────────────────────

export function aDocEvento(r: RegistroEvento): DocumentData {
  return {
    termoId: r.termoId,
    id: r.id,
    tipo: r.tipo,
    ml: r.ml,
    nivelMl: r.nivelMl,
    en: Timestamp.fromMillis(r.enMs),
    dia: r.dia,
    hora: r.hora,
    temperaturaC: r.temperaturaC,
    estado: r.estado,
  };
}

export function deEvento(clave: string, d: DocumentData): RegistroEvento {
  return {
    clave,
    termoId: d['termoId'],
    id: numero(d['id'], 0),
    tipo: d['tipo'],
    ml: numero(d['ml'], 0),
    nivelMl: numero(d['nivelMl'], 0),
    enMs: msDe(d['en']),
    dia: d['dia'],
    hora: numero(d['hora'], 0),
    temperaturaC: numeroONulo(d['temperaturaC']),
    estado: d['estado'],
  };
}

// ─── Días ───────────────────────────────────────────────────────────────────

/**
 * Lo que un evento suma a su día, como incrementos atómicos: dos dispositivos
 * pueden escribir el mismo día sin pisarse.
 */
export function incrementosDia(a: AporteDia): Record<string, FieldValue | string | Record<string, FieldValue>> {
  const doc: Record<string, FieldValue | string | Record<string, FieldValue>> = {
    fecha: a.fecha,
    totalMl: increment(a.totalMl),
    sorbos: increment(a.sorbos),
    llenados: increment(a.llenados),
    llenadoMl: increment(a.llenadoMl),
    tempSumaC: increment(a.tempSumaC),
    tempMuestras: increment(a.tempMuestras),
    actualizadoEn: serverTimestamp(),
  };
  if (a.totalMl > 0) doc['porHora'] = { [dos(a.hora)]: increment(a.totalMl) };
  return doc;
}

/** Un día completo, ya sumado. Solo para cargas iniciales (usuarios de prueba). */
export function aDocDia(r: ResumenDia): DocumentData {
  const porHora: Record<string, number> = {};
  r.porHora.forEach((ml, h) => {
    if (ml > 0) porHora[dos(h)] = ml;
  });
  return {
    fecha: r.fecha,
    totalMl: r.totalMl,
    sorbos: r.sorbos,
    porHora,
    llenados: r.llenados,
    llenadoMl: r.llenadoMl,
    tempSumaC: Math.round(r.tempSumaC * 10) / 10,
    tempMuestras: r.tempMuestras,
    metaMl: r.metaMl,
    climaC: r.climaC,
    actualizadoEn: serverTimestamp(),
  };
}

export function deDia(fecha: string, d: DocumentData): ResumenDia {
  const vacio = resumenVacio(fecha);
  const porHora = (d['porHora'] ?? {}) as Record<string, unknown>;
  return {
    fecha,
    totalMl: numero(d['totalMl'], 0),
    sorbos: numero(d['sorbos'], 0),
    porHora: vacio.porHora.map((_, h) => numero(porHora[dos(h)], 0)),
    llenados: numero(d['llenados'], 0),
    llenadoMl: numero(d['llenadoMl'], 0),
    tempSumaC: numero(d['tempSumaC'], 0),
    tempMuestras: numero(d['tempMuestras'], 0),
    metaMl: numeroONulo(d['metaMl']),
    climaC: numeroONulo(d['climaC']),
  };
}
