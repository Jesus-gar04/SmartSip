/**
 * Arranque del simulador y acciones de la interfaz.
 *
 * Dos modos de datos:
 * - `memoria` (por defecto): todo vive en la pestaña; el tiempo se puede
 *   acelerar ×10 o ×60 para la demo.
 * - `firebase`: la app entra como anónima y guarda en tu Firestore real. El
 *   tiempo va a ×1 para que las fechas de los sorbos sean las de verdad.
 */
import {
  claveDia,
  REFRESCO_CLIMA_MS,
  RepositorioEnMemoria,
  type Aceleracion,
  type DecisionResolucion,
  type Lugar,
  type RegistroEvento,
  type Repositorio,
} from 'smartsip-core';
import { obtenerClima, origenPreferido, recordarOrigen, type ClimaLocal, type OrigenLugar } from '../clima/clima-local.ts';
import { AGUAS, LIMITE_LINEA, useTienda, type MensajeLinea, type ModoDatos } from '../estado/tienda.ts';
import { describir } from './describir.ts';
import { Simulacion } from './simulacion.ts';

import { iniciarAvisosTermo } from './avisos-termo.ts';
import { leerEmparejamiento, TERMO_ID, type EmparejamientoTermo } from './emparejar.ts';
import { servicios } from '../app/servicios.ts';
import { exponerPuente } from '../telefono/puente.ts';
import { perfilDePrueba, sembrarHistorial } from './historial.ts';
const DESFASE_MIN = -300; // Barranquilla
const CLAVE_FIRMWARE = `smartsip:termo:${TERMO_ID}:firmware`;

/**
 * Agrega un mensaje a la línea. Los bloques del firmware van y vienen por
 * decenas: se muestran en una sola fila que se actualiza.
 */
function alLinea(m: MensajeLinea): void {
  useTienda.setState((e) => {
    const resto = m.tipo === 'firmware' && e.linea[0]?.tipo === 'firmware' ? e.linea.slice(1) : e.linea;
    return { linea: [m, ...resto].slice(0, LIMITE_LINEA) };
  });
}
const CLAVE_MODO = 'smartsip:modo';
const claveUltimoId = (modo: ModoDatos) => `smartsip:${modo}:${TERMO_ID}:ultimoId`;

let sim: Simulacion | null = null;
let contador = 0;

// ─── Utilidades del navegador ───────────────────────────────────────────────

function leerLocal(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function guardarLocal(clave: string, valor: string): void {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    /* modo privado: no pasa nada */
  }
}

export function modoInicial(): ModoDatos {
  const param = new URLSearchParams(location.search).get('datos');
  if (param === 'firebase' || param === 'memoria') return param;
  return leerLocal(CLAVE_MODO) === 'firebase' ? 'firebase' : 'memoria';
}

/** Cambia de modo recargando la página: cada modo arranca limpio. */
export function cambiarModo(modo: ModoDatos): void {
  guardarLocal(CLAVE_MODO, modo);
  const url = new URL(location.href);
  url.searchParams.set('datos', modo);
  location.assign(url);
}

function ubicacionDelNavegador(): Promise<Lugar | null> {
  if (!('geolocation' in navigator)) return Promise.resolve(null);
  return new Promise((resolver) => {
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolver({
          lat: Math.round(p.coords.latitude * 1e5) / 1e5,
          lng: Math.round(p.coords.longitude * 1e5) / 1e5,
          precisionM: Math.round(p.coords.accuracy),
        }),
      () => resolver(null),
      { timeout: 5000, maximumAge: 10 * 60_000 },
    );
  });
}

// ─── Arranque ───────────────────────────────────────────────────────────────

interface Datos {
  readonly repositorio: Repositorio;
  readonly ultimoId: number;
  readonly uid: string | null;
}

/** Con tres semanas de historial de prueba, para que la app del teléfono no empiece vacía. */
async function datosEnMemoria(): Promise<Datos> {
  const repositorio = new RepositorioEnMemoria();
  const perfil = perfilDePrueba(TERMO_ID, DESFASE_MIN);
  await repositorio.guardarPerfil(perfil);
  const ultimoId = await sembrarHistorial(repositorio, { termoId: TERMO_ID, desfaseMin: DESFASE_MIN, ahoraMs: Date.now(), perfil });
  return { repositorio, ultimoId, uid: null };
}

async function datosEnFirebase(): Promise<Datos> {
  const fb = await import('smartsip-firebase');
  const servicios = fb.iniciarFirebase(fb.configDesdeEntorno(import.meta.env as Record<string, string | undefined>));
  const cuenta = new fb.CuentaFirebase(servicios.auth);
  const usuario = await cuenta.entrarAnonimo();
  const repositorio = new fb.RepositorioFirestore(servicios.db, usuario.uid);
  // El contador del termo vive en su memoria; aquí, en el navegador. Por si
  // se borró, se toma también el último guardado en Firestore.
  const local = Number(leerLocal(claveUltimoId('firebase')) ?? 0) || 0;
  const remoto = await repositorio.ultimoIdDeTermo(TERMO_ID).catch(() => 0);
  // La app del teléfono necesita un perfil: si esta cuenta anónima no tiene, uno de prueba.
  if (!(await repositorio.leerPerfil().catch(() => null))) {
    await repositorio.guardarPerfil(perfilDePrueba(TERMO_ID, DESFASE_MIN)).catch((e) => console.warn('Perfil:', e));
  }
  return { repositorio, ultimoId: Math.max(local, remoto), uid: usuario.uid };
}

export async function iniciarSimulador(modo: ModoDatos): Promise<void> {
  const set = useTienda.setState;
  set({ fase: 'cargando', modo, error: null });
  // El clima se pide en paralelo; se espera poco para que el termo arranque a la temperatura real.
  const climaPedido = obtenerClima(origenPreferido());
  climaPedido.catch(() => undefined);

  let datos: Datos;
  try {
    datos = modo === 'firebase' ? await datosEnFirebase() : await datosEnMemoria();
  } catch (error) {
    console.error(error);
    set({
      error: `No se pudo conectar con Firebase: ${error instanceof Error ? error.message : String(error)}. Sigo en memoria.`,
      modo: 'memoria',
    });
    datos = await datosEnMemoria();
    modo = 'memoria';
  }

  const climaInicial = await Promise.race([
    climaPedido.catch(() => null),
    new Promise<null>((r) => setTimeout(() => r(null), 3000)),
  ]);

  const emparejado = leerEmparejamiento();
  const s = new Simulacion({
    repositorio: datos.repositorio,
    inicioMs: Date.now(),
    termoId: TERMO_ID,
    ultimoId: datos.ultimoId,
    desfaseMin: DESFASE_MIN,
    ambienteC: climaInicial?.clima.temperaturaC ?? AMBIENTE_SIN_CLIMA_C,
    ubicacion: ubicacionDelNavegador,
    // Lo que instaló una actualización (A4) sigue instalado al recargar.
    firmware: leerLocal(CLAVE_FIRMWARE) ?? undefined,
    // Emparejado con una app en otro dispositivo: ella sincroniza y confirma.
    sincronizar: !emparejado,
  });
  sim = s;
  set({ uid: datos.uid });
  // Solo en desarrollo: para inspeccionar la simulación desde la consola.
  if (import.meta.env.DEV) (globalThis as { __simulacion?: Simulacion }).__simulacion = s;

  // Línea de mensajes y memoria del contador del termo.
  s.alTrafico((t) => {
    if (t.direccion === 'termoAApp' && t.mensaje.tipo === 'hola') guardarLocal(CLAVE_FIRMWARE, t.mensaje.firmware);
    if (t.direccion === 'termoAApp' && t.mensaje.tipo === 'estado') {
      useTienda.setState((e) => ({ pulsosEstado: e.pulsosEstado + 1 }));
      return;
    }
    if (modo === 'firebase' && t.direccion === 'termoAApp') {
      const m = t.mensaje;
      const id = m.tipo === 'sorbo' || m.tipo === 'llenado' || m.tipo === 'descensoGrande' ? m.id : null;
      if (id !== null) guardarLocal(claveUltimoId('firebase'), String(id));
    }
    const d = describir(t);
    const mensaje = { n: ++contador, direccion: t.direccion, enMs: t.enMs, ...d };
    alLinea(mensaje);
  });

  // Lo que la app saca de los mensajes.
  s.alAviso((a) => {
    switch (a.tipo) {
      case 'bateriaBaja':
        set({ bateriaBaja: true });
        break;
      case 'enlace':
        if (a.enlace === 'desconectado') {
          set({ ultimoVisto: { enMs: s.reloj.ahora(), lugar: null } });
          // Cuando el sincronizador termina de guardar, ya se sabe el lugar.
          void s.sincronizador
            .esperar()
            .then(() => s.repositorio.leerTermo(TERMO_ID))
            .then((t) => t?.ultimoVisto && set({ ultimoVisto: t.ultimoVisto }));
        }
        break;
      case 'error':
        console.warn('SmartSip:', a.error);
        break;
      default:
        break;
    }
  });

  escucharDia(s, claveDia(s.reloj.ahora(), DESFASE_MIN));
  s.repositorio.escucharPendientes(
    (p) => set({ pendientes: p }),
    (e) => console.warn(e),
  );

  s.iniciar();
  // La app del teléfono dibujado (iframe) usa este repositorio y este canal.
  if (!emparejado) {
    exponerPuente({
      repositorio: s.repositorio,
      transporte: s.bus,
      termoId: TERMO_ID,
      desfaseMin: DESFASE_MIN,
      ahora: () => s.reloj.ahora(),
      resolver: (r, d) => s.sincronizador.resolverDescenso(r, d),
      estado: () => {
        const t = s.termo.estado();
        return { temperaturaC: t.temperaturaC, bateria: t.bateria, nivelMl: t.nivelMl, firmware: t.firmware };
      },
    });
  }
  set({ fase: 'lista', modo, inst: s.instantanea(), remoto: emparejado !== null });
  if (emparejado) void conectarConApp(s, emparejado);
  bucle(s);

  if (climaInicial) aplicarClima(climaInicial);
  else void actualizarClima(origenPreferido());
  setInterval(() => void actualizarClima(origenPreferido()), REFRESCO_CLIMA_MS);
}

// ─── Clima local ────────────────────────────────────────────────────────────

/** Si nunca se pudo leer el clima: un día típico de Barranquilla. */
const AMBIENTE_SIN_CLIMA_C = 30;

function aplicarClima(c: ClimaLocal): void {
  useTienda.setState({ clima: c, climaEstado: 'listo' });
  if (sim) {
    sim.ambiente(c.clima.temperaturaC);
    refrescar(sim);
  }
}

async function actualizarClima(origen: OrigenLugar, pedirPermiso = false): Promise<void> {
  if (!useTienda.getState().clima) useTienda.setState({ climaEstado: 'cargando' });
  try {
    aplicarClima(await obtenerClima(origen, pedirPermiso));
  } catch (error) {
    console.warn('Clima:', error);
    // Se conserva el último dato; si no había, el termo sigue a la temperatura de respaldo.
    useTienda.setState({ climaEstado: 'error' });
  }
}

// ─── Termo unido a una app en otro dispositivo ──────────────────────────────

async function conectarConApp(s: Simulacion, e: EmparejamientoTermo): Promise<void> {
  try {
    const { fb, servicios: sv } = await servicios('termo');
    await new fb.CuentaFirebase(sv.auth).entrarAnonimo();
    const puente = new fb.PuenteTermoFirestore(sv.db, e.canalId, s.termo, s.reloj);
    puente.abrir(
      (error) => console.warn('Puente:', error),
      (mensaje) => {
        const t = { direccion: 'appATermo' as const, enMs: s.reloj.ahora(), mensaje };
        const linea = { n: ++contador, direccion: t.direccion, enMs: t.enMs, ...describir(t) };
        alLinea(linea);
      },
    );
    await iniciarAvisosTermo(s, e);
  } catch (error) {
    useTienda.setState({ error: 'No se pudo conectar con la app emparejada. Revisa la conexión.' });
    console.warn(error);
  }
}

// ─── Resumen del día en vivo ────────────────────────────────────────────────

let diaEscuchado = '';
let dejarDia: (() => void) | null = null;

function escucharDia(s: Simulacion, fecha: string): void {
  if (fecha === diaEscuchado) return;
  dejarDia?.();
  diaEscuchado = fecha;
  dejarDia = s.repositorio.escucharDia(
    fecha,
    (r) => useTienda.setState({ hoyMl: r.totalMl, hoySorbos: r.sorbos }),
    (e) => console.warn(e),
  );
}

// ─── Bucle ──────────────────────────────────────────────────────────────────

const REFRESCO_MS = 100;

/** Último instante real hasta el que se simuló. */
let simuladoHasta = performance.now();

/**
 * Lleva la simulación hasta la hora real. La llaman el bucle y cada acción:
 * si el navegador frenó los cuadros (pestaña ocupada, ahorro de batería), lo
 * que pasó entre dos acciones se simula antes de aplicar la siguiente, y el
 * sensor de nivel ve cada cambio por separado.
 */
function ponerAlDia(s: Simulacion): void {
  const ahora = performance.now();
  s.tic(ahora - simuladoHasta);
  simuladoHasta = ahora;
}

function bucle(s: Simulacion): void {
  simuladoHasta = performance.now();
  let ultimoRefresco = 0;
  const cuadro = (ahora: number) => {
    ponerAlDia(s);
    if (ahora - ultimoRefresco >= REFRESCO_MS) {
      ultimoRefresco = ahora;
      refrescar(s);
    }
    requestAnimationFrame(cuadro);
  };
  requestAnimationFrame(cuadro);
  // Respaldo: si no hay cuadros (pestaña en segundo plano), el tiempo sigue avanzando.
  setInterval(() => ponerAlDia(s), 1000);
}

function refrescar(s: Simulacion): void {
  const inst = s.instantanea();
  const e = useTienda.getState();
  if (e.bateriaBaja && inst.termo.bateria >= 0.2) useTienda.setState({ bateriaBaja: false });
  useTienda.setState({ inst });
  escucharDia(s, claveDia(inst.enMs, DESFASE_MIN));
}

// ─── Acciones ───────────────────────────────────────────────────────────────

/** Ejecuta una acción del panel y refleja el resultado en el acto. */
function hacer(accion: (s: Simulacion) => void): void {
  if (!sim) return;
  ponerAlDia(sim);
  accion(sim);
  refrescar(sim);
}

export const acciones = {
  llenar(): void {
    const agua = AGUAS.find((a) => a.nombre === useTienda.getState().agua);
    hacer((s) => s.llenar(agua?.celsius ?? s.termo.estado().ambienteC));
  },
  beber(): void {
    hacer((s) => s.beber(useTienda.getState().sorboMl));
  },
  vaciar(): void {
    hacer((s) => s.vaciar());
  },
  tapa(abierta: boolean): void {
    hacer((s) => s.tapa(abierta));
  },
  usarMiUbicacion(): Promise<void> {
    recordarOrigen('dispositivo');
    return actualizarClima('dispositivo', true);
  },
  usarLugarPredeterminado(): Promise<void> {
    recordarOrigen('predeterminado');
    return actualizarClima('predeterminado');
  },
  cargador(conectado: boolean): void {
    hacer((s) => s.cargador(conectado));
  },
  bateriaBaja(): void {
    hacer((s) => s.bateria(0.14));
  },
  bluetooth(cerca: boolean): void {
    hacer((s) => s.bluetooth(cerca));
  },
  aceleracion(a: Aceleracion): void {
    const { modo, remoto } = useTienda.getState();
    if ((modo === 'firebase' || remoto) && a !== 1) return;
    hacer((s) => s.aceleracion(a));
  },
  resolver(registro: RegistroEvento, decision: DecisionResolucion): Promise<void> {
    return sim ? sim.sincronizador.resolverDescenso(registro, decision) : Promise.resolve();
  },
  sorbo(ml: number): void {
    useTienda.setState({ sorboMl: ml });
  },
  /** El tipo de agua cambia en el acto la temperatura de la que hay dentro y la del próximo llenado. */
  agua(nombre: 'fria' | 'ambiente' | 'caliente'): void {
    useTienda.setState({ agua: nombre });
    const celsius = AGUAS.find((a) => a.nombre === nombre)?.celsius;
    hacer((s) => {
      if (s.termo.estado().nivelMl > 0) s.temperaturaAgua(celsius ?? s.termo.estado().ambienteC);
    });
  },
};
