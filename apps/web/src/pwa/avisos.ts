/**
 * Avisos al celular (Web Push), del lado de la app.
 *
 * - El permiso se pide con un toque de la persona: iOS no deja pedirlo solo.
 * - En iPhone, Safari solo entrega avisos a la app instalada en la pantalla
 *   de inicio (iOS 16.4 o más reciente).
 * - La suscripción se guarda en el canal con el termo: es el termo quien
 *   decide cuándo avisar, y `/api/avisar` quien entrega.
 */
import { useSyncExternalStore } from 'react';
import type { Aviso } from 'smartsip-core';
import { servicios } from '../app/servicios.ts';
import { esIos, estaInstalada } from './instalacion.ts';

export type EstadoAvisos = 'no-soportado' | 'instalar-primero' | 'bloqueados' | 'apagados' | 'activos';

const CLAVE_PUBLICA = (import.meta.env['VITE_VAPID_PUBLIC_KEY'] as string | undefined) ?? '';

function soportaPush(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** "BPx…" (base64url) → bytes, como lo pide `pushManager.subscribe`. */
function bytesDeClave(base64url: string): Uint8Array<ArrayBuffer> {
  const relleno = '='.repeat((4 - (base64url.length % 4)) % 4);
  const binario = atob((base64url + relleno).replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(new ArrayBuffer(binario.length));
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

async function suscripcionActual(): Promise<PushSubscription | null> {
  if (!soportaPush()) return null;
  const registro = await navigator.serviceWorker.getRegistration();
  return (await registro?.pushManager.getSubscription()) ?? null;
}

// ─── Estado observable ──────────────────────────────────────────────────────

let estado: EstadoAvisos = 'apagados';
const oyentes = new Set<() => void>();
const fijar = (e: EstadoAvisos) => {
  estado = e;
  for (const o of oyentes) o();
};

export async function revisarAvisos(): Promise<EstadoAvisos> {
  if (esIos() && !estaInstalada()) fijar('instalar-primero');
  else if (!soportaPush() || !CLAVE_PUBLICA) fijar('no-soportado');
  else if (Notification.permission === 'denied') fijar('bloqueados');
  else fijar(Notification.permission === 'granted' && (await suscripcionActual()) ? 'activos' : 'apagados');
  return estado;
}

export function useEstadoAvisos(): EstadoAvisos {
  return useSyncExternalStore(
    (o) => {
      oyentes.add(o);
      return () => oyentes.delete(o);
    },
    () => estado,
  );
}

// ─── Activar y apagar ───────────────────────────────────────────────────────

/** Se llama desde un toque. Devuelve el estado final. */
export async function activarAvisos(canalId: string): Promise<EstadoAvisos> {
  if ((await revisarAvisos()) === 'no-soportado' || estado === 'instalar-primero') return estado;
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') return revisarAvisos();
  const registro = await navigator.serviceWorker.ready;
  const s =
    (await registro.pushManager.getSubscription()) ??
    (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytesDeClave(CLAVE_PUBLICA) }));
  const json = s.toJSON();
  const { fb, servicios: sv } = await servicios('app');
  await new fb.AvisosFirebase(sv.db, canalId).guardarDispositivo({
    endpoint: s.endpoint,
    keys: { p256dh: json.keys?.['p256dh'] ?? '', auth: json.keys?.['auth'] ?? '' },
  });
  return revisarAvisos();
}

export async function apagarAvisos(canalId: string): Promise<EstadoAvisos> {
  const s = await suscripcionActual();
  if (s) {
    const { fb, servicios: sv } = await servicios('app');
    await new fb.AvisosFirebase(sv.db, canalId).quitarDispositivo(s.endpoint);
    await s.unsubscribe().catch(() => false);
  }
  return revisarAvisos();
}

// ─── Enviar ─────────────────────────────────────────────────────────────────

export type ResultadoEnvio = { ok: true; enviados: number } | { ok: false; mensaje: string };

/** Pide a `/api/avisar` que entregue un aviso. Lo usan el termo y "Probar aviso". */
export async function enviarAviso(token: string, canalId: string, aviso: Aviso): Promise<ResultadoEnvio> {
  try {
    const r = await fetch('/api/avisar', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ canalId, aviso }),
    });
    const datos = (await r.json().catch(() => ({}))) as { enviados?: number; error?: string };
    if (!r.ok) return { ok: false, mensaje: datos.error ?? `El servidor respondió ${r.status}.` };
    return { ok: true, enviados: datos.enviados ?? 0 };
  } catch {
    return { ok: false, mensaje: 'Sin conexión: el aviso no salió.' };
  }
}

// ─── Avisos dentro de la app ────────────────────────────────────────────────

/** Con la app a la vista, el service worker le pasa el aviso en lugar de mostrar uno del sistema. */
export function escucharAvisosEnApp(oyente: (a: Aviso) => void): () => void {
  if (!('serviceWorker' in navigator)) return () => undefined;
  const alMensaje = (e: MessageEvent) => {
    const d = e.data as { tipo?: string; aviso?: Aviso } | null;
    if (d?.tipo === 'smartsip:aviso' && d.aviso) oyente(d.aviso);
  };
  navigator.serviceWorker.addEventListener('message', alMensaje);
  return () => navigator.serviceWorker.removeEventListener('message', alMensaje);
}
