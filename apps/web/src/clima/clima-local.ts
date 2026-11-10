/**
 * Clima local para el simulador: consulta Open-Meteo, lo guarda 15 minutos
 * en el navegador y lo aplica como temperatura ambiente del termo.
 *
 * Lugar: Barranquilla por defecto. Si la persona ya dio permiso de ubicación
 * (o lo da con "Usar mi ubicación"), se usa la suya, redondeada a ~1 km.
 */
import {
  BARRANQUILLA,
  ErrorClima,
  leerOpenMeteo,
  REFRESCO_CLIMA_MS,
  urlOpenMeteo,
  type Clima,
  type Coordenadas,
} from 'smartsip-core';

export type OrigenLugar = 'predeterminado' | 'dispositivo';

export interface ClimaLocal {
  readonly clima: Clima;
  readonly origen: OrigenLugar;
  readonly nombre: string;
}

const claveCache = (origen: OrigenLugar) => `smartsip:clima:${origen}`;
const CLAVE_ORIGEN = 'smartsip:clima:origen';

function leerCache(origen: OrigenLugar): ClimaLocal | null {
  try {
    const crudo = localStorage.getItem(claveCache(origen));
    if (!crudo) return null;
    const c = JSON.parse(crudo) as ClimaLocal & { guardadoMs: number };
    if (Date.now() - c.guardadoMs > REFRESCO_CLIMA_MS) return null;
    return { clima: c.clima, origen: c.origen, nombre: c.nombre };
  } catch {
    return null;
  }
}

function guardarCache(pedido: OrigenLugar, c: ClimaLocal): void {
  try {
    localStorage.setItem(claveCache(pedido), JSON.stringify({ ...c, guardadoMs: Date.now() }));
  } catch {
    /* sin almacenamiento: se consulta cada vez */
  }
}

export function origenPreferido(): OrigenLugar {
  try {
    return localStorage.getItem(CLAVE_ORIGEN) === 'dispositivo' ? 'dispositivo' : 'predeterminado';
  } catch {
    return 'predeterminado';
  }
}

export function recordarOrigen(origen: OrigenLugar): void {
  try {
    localStorage.setItem(CLAVE_ORIGEN, origen);
  } catch {
    /* nada */
  }
}

/** Posición del dispositivo, o `null` si no hay permiso o tarda demasiado. */
export function posicion(pedirPermiso: boolean): Promise<Coordenadas | null> {
  if (!('geolocation' in navigator)) return Promise.resolve(null);
  const pedir = () =>
    new Promise<Coordenadas | null>((resolver) =>
      navigator.geolocation.getCurrentPosition(
        (p) => resolver({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolver(null),
        { timeout: 8000, maximumAge: 30 * 60_000 },
      ),
    );
  if (pedirPermiso) return pedir();
  // Sin preguntar: solo si el permiso ya estaba concedido.
  return navigator.permissions
    ?.query({ name: 'geolocation' })
    .then((p) => (p.state === 'granted' ? pedir() : null))
    .catch(() => null) ?? Promise.resolve(null);
}

async function consultar(lugar: Coordenadas): Promise<Clima> {
  const control = new AbortController();
  const limite = setTimeout(() => control.abort(), 8000);
  try {
    const r = await fetch(urlOpenMeteo(lugar), { signal: control.signal });
    if (!r.ok) throw new ErrorClima(`El servicio del clima respondió ${r.status}.`);
    return leerOpenMeteo(await r.json(), lugar);
  } finally {
    clearTimeout(limite);
  }
}

/** Clima del lugar elegido, del caché si es reciente. */
export async function obtenerClima(origen: OrigenLugar, pedirPermiso = false): Promise<ClimaLocal> {
  const enCache = pedirPermiso ? null : leerCache(origen);
  if (enCache) return enCache;
  let lugar: Coordenadas = BARRANQUILLA;
  let nombre = BARRANQUILLA.nombre;
  let origenReal: OrigenLugar = 'predeterminado';
  if (origen === 'dispositivo') {
    const p = await posicion(pedirPermiso);
    if (p) {
      lugar = p;
      nombre = 'tu ubicación';
      origenReal = 'dispositivo';
    }
  }
  const resultado: ClimaLocal = { clima: await consultar(lugar), origen: origenReal, nombre };
  guardarCache(origen, resultado);
  return resultado;
}
