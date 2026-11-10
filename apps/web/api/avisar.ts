/**
 * POST /api/avisar — entrega un aviso de SmartSip a los celulares de una
 * persona por Web Push (función serverless de Vercel, plan gratis).
 *
 * Quién decide el aviso: el termo (o la app, para "Probar aviso"). Esta
 * función solo lo entrega, y solo a quien es parte del canal:
 *
 * 1. Quien llama manda su token de Firebase (`Authorization: Bearer …`).
 * 2. Con ese mismo token se lee `canales/{canalId}` por la API REST de
 *    Firestore: las reglas solo lo dejan leer a la persona y a su termo.
 *    Así no hace falta una cuenta de servicio ni verificar el token aquí.
 * 3. Se leen las suscripciones del canal y se envía el push firmado con VAPID.
 *    Las que el servicio de push da por muertas (404/410) se borran.
 *
 * Archivo autocontenido a propósito (sin importar el monorepo): Vercel lo
 * compila solo, sin pasos de construcción extra.
 *
 * Variables: VAPID_PUBLIC_KEY (o VITE_VAPID_PUBLIC_KEY), VAPID_PRIVATE_KEY,
 * VAPID_SUBJECT (mailto: o https:), VITE_FIREBASE_PROJECT_ID y, solo en
 * desarrollo, FIRESTORE_EMULATOR_HOST.
 */
import webpush from 'web-push';

// ─── Tipos ──────────────────────────────────────────────────────────────────

const TIPOS = ['ritmo', 'bateriaBaja', 'desconectado', 'metaCumplida', 'prueba'] as const;
type TipoAviso = (typeof TIPOS)[number];

interface Aviso {
  readonly tipo: TipoAviso;
  readonly titulo: string;
  readonly cuerpo: string;
}

export interface Entorno {
  readonly projectId: string;
  /** "127.0.0.1:8080" con la Emulator Suite. */
  readonly emuladorFirestore?: string | undefined;
  readonly vapidPublica: string;
  readonly vapidPrivada: string;
  readonly vapidSujeto: string;
}

export interface Suscripcion {
  readonly endpoint: string;
  readonly keys: { readonly p256dh: string; readonly auth: string };
}

export interface OpcionesEnvio {
  readonly TTL: number;
  readonly urgency: 'normal' | 'high';
  readonly topic: string;
  readonly vapidDetails: { subject: string; publicKey: string; privateKey: string };
}

export interface Dependencias {
  readonly fetch: typeof fetch;
  readonly enviar: (s: Suscripcion, carga: string, o: OpcionesEnvio) => Promise<unknown>;
  readonly ahora: () => number;
}

// ─── Validación ─────────────────────────────────────────────────────────────

const LIMITE_CUERPO_HTTP = 4096;
const CANAL = /^[A-Za-z0-9]{6,128}_[A-Za-z0-9-]{1,40}$/;

function avisoValido(x: unknown): Aviso | null {
  if (typeof x !== 'object' || x === null) return null;
  const { tipo, titulo, cuerpo } = x as Record<string, unknown>;
  if (typeof tipo !== 'string' || !(TIPOS as readonly string[]).includes(tipo)) return null;
  if (typeof titulo !== 'string' || typeof cuerpo !== 'string' || !titulo.trim() || !cuerpo.trim()) return null;
  return { tipo: tipo as TipoAviso, titulo: titulo.slice(0, 80), cuerpo: cuerpo.slice(0, 200) };
}

const json = (estado: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

// ─── Firestore por REST, con el token de quien llama ────────────────────────

function baseFirestore(e: Entorno): string {
  const origen = e.emuladorFirestore ? `http://${e.emuladorFirestore}` : 'https://firestore.googleapis.com';
  return `${origen}/v1/projects/${e.projectId}/databases/(default)/documents`;
}

interface DocRest {
  readonly name: string;
  readonly fields?: Record<string, { stringValue?: string }>;
}

function suscripcionDe(d: DocRest): Suscripcion | null {
  const f = d.fields ?? {};
  const endpoint = f['endpoint']?.stringValue;
  const p256dh = f['p256dh']?.stringValue;
  const auth = f['auth']?.stringValue;
  return endpoint && p256dh && auth ? { endpoint, keys: { p256dh, auth } } : null;
}

// ─── El manejador ───────────────────────────────────────────────────────────

export async function manejarAvisar(request: Request, entorno: Entorno, deps: Dependencias): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'Solo POST.' });
  if (!entorno.vapidPrivada || !entorno.vapidPublica || !entorno.projectId) {
    return json(503, { error: 'Los avisos aún no están configurados en el servidor.' });
  }
  const token = /^Bearer (.+)$/.exec(request.headers.get('authorization') ?? '')?.[1];
  if (!token) return json(401, { error: 'Falta el token.' });

  const texto = await request.text();
  if (texto.length > LIMITE_CUERPO_HTTP) return json(413, { error: 'Demasiado grande.' });
  let datos: { canalId?: unknown; aviso?: unknown };
  try {
    datos = JSON.parse(texto) as typeof datos;
  } catch {
    return json(400, { error: 'JSON inválido.' });
  }
  const canalId = typeof datos.canalId === 'string' && CANAL.test(datos.canalId) ? datos.canalId : null;
  const aviso = avisoValido(datos.aviso);
  if (!canalId || !aviso) return json(400, { error: 'Falta el canal o el aviso no es válido.' });

  const base = baseFirestore(entorno);
  const cabeceras = { authorization: `Bearer ${token}` };

  // 1. ¿Es parte del canal? Las reglas de Firestore responden por nosotros.
  const canal = await deps.fetch(`${base}/canales/${canalId}`, { headers: cabeceras });
  if (canal.status === 401) return json(401, { error: 'El token no es válido.' });
  if (!canal.ok) return json(403, { error: 'No eres parte de este canal.' });

  // 2. Las suscripciones de sus celulares.
  const lista = await deps.fetch(`${base}/canales/${canalId}/dispositivos?pageSize=10`, { headers: cabeceras });
  if (!lista.ok) return json(502, { error: 'No se pudieron leer los dispositivos.' });
  const docs = ((await lista.json()) as { documents?: DocRest[] }).documents ?? [];
  if (docs.length === 0) return json(200, { enviados: 0, quitados: 0, motivo: 'sin-dispositivos' });

  // 3. El push. `topic` hace que un recordatorio nuevo reemplace al que aún no llegó.
  const carga = JSON.stringify({ ...aviso, enMs: deps.ahora() });
  const opciones: OpcionesEnvio = {
    TTL: aviso.tipo === 'ritmo' ? 45 * 60 : 6 * 3600,
    urgency: aviso.tipo === 'bateriaBaja' || aviso.tipo === 'desconectado' ? 'high' : 'normal',
    topic: aviso.tipo,
    vapidDetails: { subject: entorno.vapidSujeto, publicKey: entorno.vapidPublica, privateKey: entorno.vapidPrivada },
  };
  let enviados = 0;
  let quitados = 0;
  await Promise.all(
    docs.map(async (d) => {
      const s = suscripcionDe(d);
      if (!s) return;
      try {
        await deps.enviar(s, carga, opciones);
        enviados++;
      } catch (error) {
        const estado = (error as { statusCode?: number }).statusCode;
        if (estado === 404 || estado === 410) {
          // La suscripción ya no existe (desinstalaron la app o quitaron el permiso).
          const id = d.name.split('/').pop() ?? '';
          await deps.fetch(`${base}/canales/${canalId}/dispositivos/${id}`, { method: 'DELETE', headers: cabeceras }).catch(() => null);
          quitados++;
        } else {
          console.warn('Push:', estado, (error as Error).message);
        }
      }
    }),
  );
  return json(200, { enviados, quitados });
}

export function entornoDelProceso(env: Readonly<Record<string, string | undefined>> = process.env): Entorno {
  return {
    projectId: env['FIREBASE_PROJECT_ID'] ?? env['VITE_FIREBASE_PROJECT_ID'] ?? '',
    emuladorFirestore: env['FIRESTORE_EMULATOR_HOST'] || undefined,
    vapidPublica: env['VAPID_PUBLIC_KEY'] ?? env['VITE_VAPID_PUBLIC_KEY'] ?? '',
    vapidPrivada: env['VAPID_PRIVATE_KEY'] ?? '',
    vapidSujeto: env['VAPID_SUBJECT'] ?? 'mailto:avisos@smartsip.app',
  };
}

/** Lo que Vercel llama. */
export function POST(request: Request): Promise<Response> {
  return manejarAvisar(request, entornoDelProceso(), {
    fetch,
    enviar: (s, carga, o) => webpush.sendNotification(s, carga, o),
    ahora: Date.now,
  });
}
