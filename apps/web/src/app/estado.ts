/**
 * Estado de la app y su primer uso (U1): bienvenida → perfil → emparejar el
 * termo → hoy. Quien ya tiene cuenta entra con su correo y sigue donde iba.
 */
import { create } from 'zustand';
import {
  ActualizadorFirmware,
  avisoPrueba,
  claveDia,
  curvaDeRitmo,
  curvaPareja,
  ErrorCuenta,
  formatoTemperatura,
  idCanal,
  RECORDATORIO_POR_DEFECTO,
  relojDelSistema,
  Sincronizador,
  sumarDias,
  type AjustesRecordatorio,
  type Aviso,
  type Brillo,
  type Curva,
  type Transporte,
  type Unidad,
  type DatosTermo,
  type EstadoActualizacion,
  type DecisionResolucion,
  type EstadoEnlace,
  type RegistroEvento,
  type ResumenDia,
  type Actividad,
  type Emparejamiento,
  type Perfil,
  type ServicioCuenta,
  type Usuario,
} from 'smartsip-core';
import type { EmparejamientoFirebase, RepositorioFirestore } from 'smartsip-firebase';
import { enviarAviso, escucharAvisosEnApp, revisarAvisos, type ResultadoEnvio } from '../pwa/avisos.ts';
import { servicios } from './servicios.ts';

export type FaseApp = 'cargando' | 'bienvenida' | 'entrar' | 'perfil' | 'emparejar' | 'hoy' | 'error';
export type Seccion = 'hoy' | 'semana' | 'termo' | 'ajustes';

interface EstadoApp {
  fase: FaseApp;
  usuario: Usuario | null;
  perfil: Perfil | null;
  error: string | null;
  /** Si el termo emparejado está al alcance. */
  enlace: EstadoEnlace;
  hoyMl: number;
  hoySorbos: number;
  /** Ya llegó el resumen de hoy (antes, `hoyMl` vale 0 sin significar nada). */
  hoyListo: boolean;
  seccion: Seccion;
  /** Lo último que dijo el termo. */
  temperaturaC: number | null;
  bateria: number | null;
  /** Cuánta agua hay ahora en el termo. */
  nivelMl: number | null;
  /** Descensos grandes que esperan "¿Lo bebiste o lo vaciaste?". */
  pendientes: readonly RegistroEvento[];
  termo: DatosTermo | null;
  /** Aviso que llegó con la app a la vista: se muestra dentro de ella. */
  avisoEnApp: Aviso | null;
  /** Versión de firmware que dijo tener el termo al saludar. */
  firmwareTermo: string | null;
  /** A4: la actualización en curso, si hay una. */
  actualizacion: EstadoActualizacion | null;
}

export const useApp = create<EstadoApp>(() => ({
  fase: 'cargando',
  usuario: null,
  perfil: null,
  error: null,
  enlace: 'desconectado',
  hoyMl: 0,
  hoySorbos: 0,
  hoyListo: false,
  seccion: 'hoy',
  temperaturaC: null,
  bateria: null,
  nivelMl: null,
  pendientes: [],
  termo: null,
  avisoEnApp: null,
  firmwareTermo: null,
  actualizacion: null,
}));

escucharAvisosEnApp((avisoEnApp) => useApp.setState({ avisoEnApp }));

/** Temperatura en la unidad del perfil: "63 °C" o "145 °F". */
export function useGrados(): (celsius: number) => string {
  const unidad = useApp((s) => s.perfil?.unidad ?? 'C');
  return (c) => formatoTemperatura(c, unidad);
}

let cuenta: ServicioCuenta | null = null;
let repo: RepositorioFirestore | null = null;
let emparejamiento: EmparejamientoFirebase | null = null;
let conexion: {
  cerrar(): void;
  resolver(r: RegistroEvento, d: DecisionResolucion): Promise<void>;
  transporte: Transporte;
  actualizador: ActualizadorFirmware;
} | null = null;

/** Lo que el termo muestra en su pantalla, según el perfil (A3). */
function enviarPreferencias(perfil: Perfil): void {
  conexion?.transporte.enviar({ tipo: 'preferencias', unidad: perfil.unidad, brillo: perfil.brillo });
}

// ─── Ritmo para el termo ─────────────────────────────────────────────────────
// El termo decide los recordatorios aunque la app esté cerrada: para eso
// necesita la meta, tu ritmo de los últimos días y tus ajustes.

let curvaDelDia: { fecha: string; curva: Curva; deHabito: boolean } | null = null;
let ritmoPendiente: ReturnType<typeof setTimeout> | null = null;
let ultimaMeta = 0;
let ultimoPublicado = '';

async function curvaDeHoy(fecha: string): Promise<{ curva: Curva; deHabito: boolean }> {
  if (curvaDelDia?.fecha === fecha) return curvaDelDia;
  const dias = repo ? await repo.dias(sumarDias(fecha, -14), sumarDias(fecha, -1)).catch(() => []) : [];
  const propia = curvaDeRitmo(dias);
  curvaDelDia = { fecha, curva: propia ?? curvaPareja(), deHabito: propia !== null };
  return curvaDelDia;
}

async function publicarRitmoAhora(): Promise<void> {
  const { usuario, perfil, hoyMl, hoyListo } = useApp.getState();
  // Sin el resumen de hoy, el termo creería que no has bebido nada.
  if (!usuario || !perfil?.termoId || ultimaMeta <= 0 || !hoyListo) return;
  const fecha = claveDia(Date.now(), perfil.desfaseMin);
  const { curva, deHabito } = await curvaDeHoy(fecha);
  const ritmo = {
    fecha,
    desfaseMin: perfil.desfaseMin,
    metaMl: ultimaMeta,
    curva,
    deHabito,
    ajustes: perfil.recordatorio ?? RECORDATORIO_POR_DEFECTO,
    totalMlApp: hoyMl,
  };
  const huella = JSON.stringify(ritmo);
  if (huella === ultimoPublicado) return;
  const { fb, servicios: s } = await servicios('app');
  await new fb.AvisosFirebase(s.db, idCanal(usuario.uid, perfil.termoId)).publicarRitmo(ritmo);
  ultimoPublicado = huella;
}

/**
 * Con el termo emparejado: escucha su canal, guarda cada sorbo en la cuenta y
 * mantiene al día lo de hoy. Es lo mismo que haría con Bluetooth.
 */
async function conectarTermo(usuario: Usuario, perfil: Perfil): Promise<void> {
  conexion?.cerrar();
  conexion = null;
  if (!perfil.termoId || !repo) return;
  const { fb, servicios: s } = await servicios('app');
  const transporte = new fb.TransporteFirestore(s.db, idCanal(usuario.uid, perfil.termoId));
  const sinc = new Sincronizador({ transporte, repositorio: repo, reloj: relojDelSistema, desfaseMin: perfil.desfaseMin });
  transporte.alCambiarEnlace((enlace) => {
    useApp.setState({ enlace });
    if (enlace === 'conectado') {
      const p = useApp.getState().perfil;
      if (p) enviarPreferencias(p);
    }
    // Al perder el termo, el sincronizador guarda el último lugar: se relee.
    if (enlace === 'desconectado') void sinc.esperar().then(() => app.leerTermo());
  });
  transporte.alRecibir((m) => {
    if (m.tipo === 'estado') useApp.setState({ temperaturaC: m.temperaturaC, bateria: m.bateria, nivelMl: m.nivelMl });
    if (m.tipo === 'hola') useApp.setState({ firmwareTermo: m.firmware });
  });
  const actualizador = new ActualizadorFirmware(transporte);
  actualizador.alCambiar((actualizacion) => {
    useApp.setState({ actualizacion });
    if (actualizacion.fase === 'lista') void sinc.esperar().then(() => app.leerTermo());
  });
  const salirPendientes = repo.escucharPendientes((pendientes) => useApp.setState({ pendientes }));
  sinc.alAviso((a) => a.tipo === 'error' && console.warn('SmartSip:', a.error));
  sinc.iniciar();
  transporte.abrir((e) => console.warn('Canal:', e));
  const salirDia = repo.escucharDia(claveDia(Date.now(), perfil.desfaseMin), (r) =>
    useApp.setState({ hoyMl: r.totalMl, hoySorbos: r.sorbos, hoyListo: true }),
  );
  conexion = {
    cerrar: () => {
      actualizador.detener();
      sinc.detener();
      transporte.cerrar();
      salirDia();
      salirPendientes();
    },
    resolver: (registro, decision) => sinc.resolverDescenso(registro, decision),
    transporte,
    actualizador,
  };
  void app.leerTermo();
  void revisarAvisos();
}

function desconectarTermo(): void {
  conexion?.cerrar();
  conexion = null;
  curvaDelDia = null;
  ultimoPublicado = '';
  useApp.setState({ enlace: 'desconectado', hoyMl: 0, hoySorbos: 0, hoyListo: false, firmwareTermo: null, actualizacion: null, pendientes: [], temperaturaC: null, bateria: null, termo: null });
}

const mensaje = (e: unknown) =>
  e instanceof ErrorCuenta ? e.message : e instanceof Error ? e.message : 'Algo no salió bien. Inténtalo de nuevo.';

/** Desfase del dispositivo respecto a UTC, en minutos (−300 en Colombia). */
const desfaseLocal = () => -new Date().getTimezoneOffset();

async function seguirCon(usuario: Usuario): Promise<void> {
  const { fb, servicios: s } = await servicios('app');
  repo = new fb.RepositorioFirestore(s.db, usuario.uid);
  emparejamiento = new fb.EmparejamientoFirebase(s.db);
  const perfil = await repo.leerPerfil();
  useApp.setState({
    usuario,
    perfil,
    error: null,
    fase: !perfil ? 'perfil' : !perfil.termoId ? 'emparejar' : 'hoy',
  });
  if (perfil?.termoId) void conectarTermo(usuario, perfil);
}

export const app = {
  async iniciar(): Promise<void> {
    try {
      const { fb, servicios: s } = await servicios('app');
      const c = new fb.CuentaFirebase(s.auth);
      cuenta = c;
      const usuario = await c.listo();
      if (usuario) await seguirCon(usuario);
      else useApp.setState({ fase: 'bienvenida' });
    } catch (e) {
      useApp.setState({ fase: 'error', error: mensaje(e) });
    }
  },

  async empezar(): Promise<void> {
    if (!cuenta) return;
    try {
      await seguirCon(await cuenta.entrarAnonimo());
    } catch (e) {
      useApp.setState({ error: mensaje(e) });
    }
  },

  irA(fase: 'bienvenida' | 'entrar'): void {
    useApp.setState({ fase, error: null });
  },

  async entrar(correo: string, clave: string): Promise<boolean> {
    if (!cuenta) return false;
    try {
      await seguirCon(await cuenta.entrar(correo, clave));
      return true;
    } catch (e) {
      useApp.setState({ error: mensaje(e) });
      return false;
    }
  },

  async guardarPerfil(datos: { nombre: string; pesoKg: number; actividad: Actividad }): Promise<void> {
    if (!repo) return;
    const actual = useApp.getState().perfil;
    const perfil: Perfil = {
      nombre: datos.nombre.trim() || null,
      pesoKg: datos.pesoKg,
      actividad: datos.actividad,
      unidad: actual?.unidad ?? 'C',
      brillo: actual?.brillo ?? 'medio',
      desfaseMin: actual?.desfaseMin ?? desfaseLocal(),
      termoId: actual?.termoId ?? null,
      ...(actual?.recordatorio ? { recordatorio: actual.recordatorio } : {}),
    };
    try {
      await repo.guardarPerfil(perfil);
      useApp.setState({ perfil, fase: perfil.termoId ? 'hoy' : 'emparejar', error: null });
    } catch (e) {
      useApp.setState({ error: mensaje(e) });
    }
  },

  async pedirCodigo(): Promise<Emparejamiento | null> {
    const usuario = useApp.getState().usuario;
    if (!emparejamiento || !usuario) return null;
    try {
      return await emparejamiento.crearCodigo(usuario.uid);
    } catch (e) {
      useApp.setState({ error: mensaje(e) });
      return null;
    }
  },

  escucharCodigo(codigo: string, oyente: (e: Emparejamiento | null) => void): () => void {
    return emparejamiento?.escuchar(codigo, oyente, (e) => useApp.setState({ error: mensaje(e) })) ?? (() => undefined);
  },

  cancelarCodigo(codigo: string): void {
    void emparejamiento?.cancelar(codigo);
  },

  /** El termo escribió el código: se abre el canal y el termo queda en el perfil. */
  async completarEmparejamiento(e: Emparejamiento): Promise<void> {
    const perfil = useApp.getState().perfil;
    if (!emparejamiento || !repo || !perfil || !e.termoId) return;
    try {
      await emparejamiento.abrirCanal(e);
      await repo.guardarTermo({ termoId: e.termoId, nombre: 'Mi termo' });
      const conTermo: Perfil = { ...perfil, termoId: e.termoId };
      await repo.guardarPerfil(conTermo);
      useApp.setState({ perfil: conTermo, fase: 'hoy', error: null });
      const usuario = useApp.getState().usuario;
      if (usuario) void conectarTermo(usuario, conTermo);
    } catch (err) {
      useApp.setState({ error: mensaje(err) });
    }
  },

  irA_seccion(seccion: Seccion): void {
    useApp.setState({ seccion });
  },

  async resolver(registro: RegistroEvento, decision: DecisionResolucion): Promise<void> {
    await conexion?.resolver(registro, decision);
  },

  /** Días guardados entre dos fechas (los que no tienen datos no vienen). */
  async cargarDias(desde: string, hasta: string): Promise<readonly ResumenDia[]> {
    return repo ? repo.dias(desde, hasta) : [];
  },

  /** Todo lo que pasó un día, en orden: sorbos, llenados y descensos. */
  async eventosDelDia(fecha: string): Promise<readonly RegistroEvento[]> {
    return repo ? repo.eventosDelDia(fecha) : [];
  },

  async leerTermo(): Promise<void> {
    const termoId = useApp.getState().perfil?.termoId;
    if (!repo || !termoId) return;
    const termo = await repo.leerTermo(termoId).catch(() => null);
    useApp.setState({ termo });
  },

  /**
   * Salir de "Conecta tu termo" sin emparejar: si ya había un termo, se
   * vuelve a la app con ese mismo; si no, a "Tus datos".
   */
  volverDeEmparejar(): void {
    const { usuario, perfil } = useApp.getState();
    if (usuario && perfil?.termoId) {
      useApp.setState({ fase: 'hoy', error: null });
      void conectarTermo(usuario, perfil);
    } else {
      useApp.setState({ fase: 'perfil', error: null });
    }
  },

  /** Volver a emparejar: por ejemplo, el día de la demo con otro simulador. */
  emparejarOtro(): void {
    desconectarTermo();
    useApp.setState({ fase: 'emparejar', error: null });
  },

  /** El canal con el termo emparejado, o `null` sin termo. */
  canalId(): string | null {
    const { usuario, perfil } = useApp.getState();
    return usuario && perfil?.termoId ? idCanal(usuario.uid, perfil.termoId) : null;
  },

  /**
   * Deja al termo la meta, el ritmo y los ajustes (con una pausa, para no
   * escribir con cada sorbo). Solo se escribe si algo cambió.
   */
  publicarRitmo(metaMl: number, enseguida = false): void {
    ultimaMeta = Math.round(metaMl);
    if (ritmoPendiente) clearTimeout(ritmoPendiente);
    ritmoPendiente = setTimeout(
      () => void publicarRitmoAhora().catch((e) => console.warn('Ritmo:', e)),
      enseguida ? 0 : 20_000,
    );
  },

  /** Unidad, brillo (A3) y recordatorios (U4): se guardan en el perfil y van al termo. */
  async guardarAjustes(cambios: { unidad?: Unidad; brillo?: Brillo; recordatorio?: AjustesRecordatorio }): Promise<void> {
    const actual = useApp.getState().perfil;
    if (!repo || !actual) return;
    const perfil: Perfil = { ...actual, ...cambios };
    useApp.setState({ perfil });
    try {
      await repo.guardarPerfil(perfil);
    } catch (e) {
      useApp.setState({ perfil: actual, error: mensaje(e) });
      return;
    }
    if (cambios.unidad || cambios.brillo) enviarPreferencias(perfil);
    if (cambios.recordatorio && ultimaMeta > 0) app.publicarRitmo(ultimaMeta, true);
  },

  /** Manda un aviso de prueba a los celulares de la persona. */
  async probarAviso(): Promise<ResultadoEnvio> {
    const canalId = app.canalId();
    const { servicios: s } = await servicios('app');
    const token = await s.auth.currentUser?.getIdToken();
    if (!canalId || !token) return { ok: false, mensaje: 'Primero conecta tu termo.' };
    return enviarAviso(token, canalId, avisoPrueba());
  },

  /** A4: manda la versión nueva al termo (o retoma la que quedó a mitad). */
  actualizarTermo(): boolean {
    return conexion?.actualizador.iniciar() ?? false;
  },

  cerrarAviso(): void {
    useApp.setState({ avisoEnApp: null });
  },

  async salir(): Promise<void> {
    desconectarTermo();
    await cuenta?.salir();
    repo = null;
    useApp.setState({ fase: 'bienvenida', usuario: null, perfil: null, error: null });
  },
};
