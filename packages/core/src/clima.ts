/**
 * Clima local: la temperatura ambiente del termo y el clima del día para la
 * meta no se escriben a mano, se toman del clima real del lugar.
 *
 * Fuente: Open-Meteo (gratuita, sin cuenta ni clave). Aquí solo se arma la
 * consulta y se lee la respuesta; quien llama hace la petición con `fetch`,
 * igual en la web que en React Native.
 */

export interface Coordenadas {
  readonly lat: number;
  readonly lng: number;
}

export interface Clima {
  /** Temperatura ahora, en °C. */
  readonly temperaturaC: number;
  /** Máxima prevista para hoy, en °C: la que usa la meta del día. */
  readonly maximaHoyC: number | null;
  readonly lugar: Coordenadas;
  /** Hora de la medición, en ms. */
  readonly medidoEnMs: number;
  readonly fuente: 'open-meteo';
}

/** Lugar por defecto: Barranquilla, donde nace SmartSip. */
export const BARRANQUILLA: Coordenadas & { readonly nombre: string } = {
  nombre: 'Barranquilla',
  lat: 10.96,
  lng: -74.8,
};

/** Cada cuánto se vuelve a consultar el clima. */
export const REFRESCO_CLIMA_MS = 15 * 60_000;

/**
 * Redondea a dos decimales (~1 km): suficiente para el clima y no revela la
 * posición exacta a un servicio externo.
 */
export function redondearLugar(c: Coordenadas): Coordenadas {
  return { lat: Math.round(c.lat * 100) / 100, lng: Math.round(c.lng * 100) / 100 };
}

export function urlOpenMeteo(c: Coordenadas): string {
  const { lat, lng } = redondearLugar(c);
  // Armado a mano: URLSearchParams no está completo en React Native.
  const parametros: ReadonlyArray<[string, string]> = [
    ['latitude', String(lat)],
    ['longitude', String(lng)],
    ['current', 'temperature_2m'],
    ['daily', 'temperature_2m_max'],
    ['timezone', 'auto'],
    ['forecast_days', '1'],
  ];
  const q = parametros.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return `https://api.open-meteo.com/v1/forecast?${q}`;
}

export class ErrorClima extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorClima';
  }
}

const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Lee la respuesta de Open-Meteo y la valida. Lanza `ErrorClima` si no sirve. */
export function leerOpenMeteo(json: unknown, lugar: Coordenadas): Clima {
  const r = json as {
    current?: { time?: unknown; temperature_2m?: unknown };
    daily?: { temperature_2m_max?: unknown };
    utc_offset_seconds?: unknown;
  } | null;
  const temp = r?.current?.temperature_2m;
  if (!numero(temp) || temp < -60 || temp > 60) {
    throw new ErrorClima('La respuesta del clima no trae una temperatura válida.');
  }
  const maximas = r?.daily?.temperature_2m_max;
  const maxima = Array.isArray(maximas) && numero(maximas[0]) ? maximas[0] : null;
  // Open-Meteo da la hora local sin zona ("2026-11-09T21:30"); con el desfase se pasa a UTC.
  const hora = r?.current?.time;
  const desfase = numero(r?.utc_offset_seconds) ? r.utc_offset_seconds : 0;
  const local = typeof hora === 'string' ? Date.parse(`${hora}:00Z`) : Number.NaN;
  return {
    temperaturaC: temp,
    maximaHoyC: maxima,
    lugar: redondearLugar(lugar),
    medidoEnMs: Number.isNaN(local) ? 0 : local - desfase * 1000,
    fuente: 'open-meteo',
  };
}
