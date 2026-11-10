/**
 * El termo decide los avisos al celular (A1, T5).
 *
 * Con la app cerrada, los sorbos esperan en el canal: el único que sabe
 * cuánto llevas hoy es el termo. Cada minuto compara lo que contó con el
 * ritmo que la app le dejó (meta, curva, silencio, tono) usando
 * `decidirAviso` del núcleo, y si toca, pide a `/api/avisar` que lo entregue.
 * Recuerda en el dispositivo lo que contó y los avisos que mandó hoy.
 */
import {
  anotarEnvio,
  autonomiaDias,
  avisoBateriaBaja,
  avisoDesconectado,
  avisoMetaCumplida,
  avisoRitmo,
  claveDia,
  decidirAviso,
  fraccionEsperada,
  horaDecimalLocal,
  llevasHoy,
  memoriaDeHoy,
  type Aviso,
  type Decision,
  type MemoriaAvisos,
  type Ritmo,
} from 'smartsip-core';
import { servicios } from '../app/servicios.ts';
import { useTienda } from '../estado/tienda.ts';
import { enviarAviso } from '../pwa/avisos.ts';
import { hora } from '../util/formato.ts';
import type { EmparejamientoTermo } from './emparejar.ts';
import type { Simulacion } from './simulacion.ts';

const CLAVE_CONTEO = 'smartsip:termo:conteo';
const CLAVE_MEMORIA = 'smartsip:termo:avisos';
const CADA_MS = 60_000;

interface Conteo {
  readonly fecha: string;
  readonly ml: number;
  /** Último id de sorbo contado: un lote al reconectar no suma dos veces. */
  readonly ultimoId: number;
}

function leer<T>(clave: string): T | null {
  try {
    const v = localStorage.getItem(clave);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

function guardar(clave: string, v: unknown): void {
  try {
    localStorage.setItem(clave, JSON.stringify(v));
  } catch {
    /* sin almacenamiento: dura mientras la pestaña esté abierta */
  }
}

let sim: Simulacion | null = null;
let canal: EmparejamientoTermo | null = null;
let ritmo: Ritmo | null = null;
let conteo: Conteo = leer<Conteo>(CLAVE_CONTEO) ?? { fecha: '', ml: 0, ultimoId: 0 };
let memoria: MemoriaAvisos | null = leer<MemoriaAvisos>(CLAVE_MEMORIA);

const desfase = () => ritmo?.desfaseMin ?? -300;
const ahora = () => sim?.reloj.ahora() ?? Date.now();

/** Lo que el termo contó hoy. */
function contadoHoy(): number {
  return conteo.fecha === claveDia(ahora(), desfase()) ? conteo.ml : 0;
}

function contarSorbo(id: number, ml: number, enMs: number): void {
  if (id <= conteo.ultimoId) return;
  const fecha = claveDia(enMs, desfase());
  conteo = { fecha, ml: (conteo.fecha === fecha ? conteo.ml : 0) + ml, ultimoId: id };
  guardar(CLAVE_CONTEO, conteo);
}

const MOTIVOS: Record<Extract<Decision, { tipo: 'nada' }>['motivo'], string> = {
  apagados: 'La persona apagó los recordatorios.',
  silencio: 'Horario de silencio: no se avisa.',
  'al-dia': 'Va al día con su ritmo: no hace falta avisar.',
  cumplida: 'Ya cumplió la meta de hoy.',
  'muy-pronto': 'Ya avisó hace poco: espera hora y media entre avisos.',
  suficientes: 'Ya mandó los avisos de hoy.',
};

/** Lo que muestra la tarjeta del simulador. */
function reflejar(d: Decision | null): void {
  const llevas = ritmo ? llevasHoy(ritmo, contadoHoy(), ahora()) : contadoHoy();
  const esperado = ritmo ? Math.round(ritmo.metaMl * fraccionEsperada(ritmo.curva, horaDecimalLocal(ahora(), ritmo.desfaseMin))) : null;
  useTienda.setState({
    avisos: {
      listo: ritmo !== null,
      llevasMl: llevas,
      esperadoMl: esperado,
      metaMl: ritmo?.metaMl ?? null,
      decision:
        d === null
          ? 'Esperando a que la app le cuente tu meta y tu ritmo.'
          : d.tipo === 'nada'
            ? MOTIVOS[d.motivo]
            : d.tipo === 'ritmo'
              ? 'Va atrasado: aviso enviado.'
              : 'Cumplió la meta: aviso enviado.',
      ultimo: useTienda.getState().avisos.ultimo,
    },
  });
}

async function entregar(aviso: Aviso): Promise<boolean> {
  if (!canal) return false;
  const { servicios: s } = await servicios('termo');
  const token = await s.auth.currentUser?.getIdToken();
  const r = token ? await enviarAviso(token, canal.canalId, aviso) : { ok: false as const, mensaje: 'El termo no tiene sesión.' };
  const texto = r.ok
    ? r.enviados > 0
      ? `«${aviso.titulo}» llegó a ${r.enviados === 1 ? 'un celular' : `${r.enviados} celulares`}.`
      : `«${aviso.titulo}» salió, pero la app no tiene avisos activos en ningún celular.`
    : r.mensaje;
  useTienda.setState((t) => ({ avisos: { ...t.avisos, ultimo: { texto, ok: r.ok && r.enviados > 0, enMs: ahora() } } }));
  return r.ok;
}

/** Cada minuto: ¿toca avisar? */
async function revisar(): Promise<void> {
  if (!ritmo) {
    reflejar(null);
    return;
  }
  const m = memoriaDeHoy(memoria, ahora(), ritmo.desfaseMin);
  const d = decidirAviso({ ritmo, totalMlTermo: contadoHoy(), ahoraMs: ahora(), memoria: m });
  if (d.tipo === 'nada') {
    reflejar(d);
    return;
  }
  const aviso =
    d.tipo === 'ritmo'
      ? avisoRitmo(d.llevasMl, d.esperadoMl, ritmo.metaMl, ritmo.ajustes.tono, ritmo.deHabito)
      : avisoMetaCumplida(d.llevasMl, ritmo.metaMl);
  // Se anota aunque falle: mejor un aviso de menos que uno repetido cada minuto.
  memoria = anotarEnvio(m, d, ahora());
  guardar(CLAVE_MEMORIA, memoria);
  reflejar(d);
  await entregar(aviso);
}

function avisoBateria(): Aviso {
  const t = sim?.instantanea().termo;
  return avisoBateriaBaja(t ? autonomiaDias(t.bateria, t.brillo) : 0.5);
}

/** Termo emparejado: escucha el ritmo, cuenta sorbos y revisa cada minuto. */
export async function iniciarAvisosTermo(s: Simulacion, e: EmparejamientoTermo): Promise<void> {
  sim = s;
  canal = e;
  s.alTrafico((t) => {
    if (t.direccion !== 'termoAApp') return;
    const m = t.mensaje;
    if (m.tipo === 'sorbo') {
      contarSorbo(m.id, m.ml, m.enMs);
    } else if (m.tipo === 'lote') {
      for (const ev of m.eventos) if (ev.tipo === 'sorbo') contarSorbo(ev.id, ev.ml, ev.enMs);
    } else if (m.tipo === 'bateriaBaja') {
      void entregar(avisoBateria());
    }
  });
  const { fb, servicios: sv } = await servicios('termo');
  const avisos = new fb.AvisosFirebase(sv.db, e.canalId);
  // Justo al emparejar, el canal puede no existir aún: Firestore corta el
  // oyente con un error y aquí se vuelve a intentar.
  const escuchar = (): void => {
    avisos.escucharRitmo(
      (r) => {
        ritmo = r;
        void revisar();
      },
      () => setTimeout(escuchar, 5_000),
    );
  };
  escuchar();
  setInterval(() => void revisar(), CADA_MS);
  reflejar(null);
}

export type AvisoManual = 'ritmo' | 'bateriaBaja' | 'desconectado' | 'metaCumplida';

/** Botones del simulador: mandan el aviso ya, con los datos reales del momento. */
export function avisarAhora(tipo: AvisoManual): Promise<boolean> {
  const meta = ritmo?.metaMl ?? 2400;
  const llevas = ritmo ? llevasHoy(ritmo, contadoHoy(), ahora()) : contadoHoy();
  const esperado = ritmo ? Math.round(meta * fraccionEsperada(ritmo.curva, horaDecimalLocal(ahora(), ritmo.desfaseMin))) : meta / 2;
  switch (tipo) {
    case 'ritmo':
      // Para la demo: si va al día, se muestra el aviso como si le faltara un cuarto de la meta.
      return entregar(
        avisoRitmo(
          Math.min(llevas, Math.max(0, esperado - meta / 4)),
          Math.max(esperado, llevas + meta / 4),
          meta,
          ritmo?.ajustes.tono ?? 'sereno',
          ritmo?.deHabito ?? false,
        ),
      );
    case 'bateriaBaja':
      return entregar(avisoBateria());
    case 'desconectado':
      return entregar(avisoDesconectado(hora(ahora())));
    case 'metaCumplida':
      return entregar(avisoMetaCumplida(Math.max(llevas, meta), meta));
  }
}
