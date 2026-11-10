/** Texto corto de cada mensaje, para la línea de mensajes. */
import { textoVersion, type MensajeApp, type MensajeTermo, type Trafico } from 'smartsip-core';

export interface Descripcion {
  readonly tipo: string;
  readonly texto: string;
}

function deTermo(m: MensajeTermo): Descripcion {
  switch (m.tipo) {
    case 'hola':
      return { tipo: m.tipo, texto: `hola · ${m.termoId}` };
    case 'estado':
      return { tipo: m.tipo, texto: `estado · ${Math.round(m.temperaturaC)} °C · ${m.nivelMl} ml` };
    case 'sorbo':
      return { tipo: m.tipo, texto: `sorbo #${m.id} · ${m.ml} ml` };
    case 'llenado':
      return { tipo: m.tipo, texto: `llenado #${m.id} · ${m.ml} ml` };
    case 'descensoGrande':
      return { tipo: m.tipo, texto: `descenso #${m.id} · ${m.ml} ml` };
    case 'lote':
      return { tipo: m.tipo, texto: `lote · ${m.eventos.length} guardados` };
    case 'bateriaBaja':
      return { tipo: m.tipo, texto: `batería baja · ${Math.round(m.bateria * 100)} %` };
    case 'firmwareProgreso':
      return { tipo: 'firmware', texto: `firmware ${textoVersion(m.version)} · tiene ${m.recibidos} de ${m.bloques} bloques` };
    case 'firmwareListo':
      return { tipo: m.tipo, texto: `firmware ${textoVersion(m.version)} completo · se reinicia` };
    case 'firmwareError':
      return { tipo: m.tipo, texto: `firmware ${textoVersion(m.version)} · no se instaló (${m.motivo})` };
  }
}

function deApp(m: MensajeApp): Descripcion {
  switch (m.tipo) {
    case 'confirmar':
      return { tipo: m.tipo, texto: `confirma hasta #${m.hastaId}` };
    case 'preferencias':
      return { tipo: m.tipo, texto: 'preferencias' };
    case 'firmwareInicio':
      return { tipo: m.tipo, texto: `firmware ${textoVersion(m.version)} · empieza (${m.bloques} bloques)` };
    case 'firmwareBloque':
      return { tipo: 'firmware', texto: `firmware ${textoVersion(m.version)} · bloque ${m.n + 1}` };
  }
}

export function describir(t: Trafico): Descripcion {
  return t.direccion === 'termoAApp' ? deTermo(t.mensaje) : deApp(t.mensaje);
}
