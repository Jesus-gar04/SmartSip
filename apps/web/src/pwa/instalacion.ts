/**
 * Cómo se puede instalar SmartSip en este dispositivo.
 *
 * - Android y Chromium de escritorio: el navegador ofrece `beforeinstallprompt`
 *   y la app abre el cuadro nativo con su propio botón.
 * - iPhone y iPad: Apple no deja abrir ese cuadro desde una página; solo se
 *   puede guiar (Compartir → Añadir a pantalla de inicio).
 * - Navegadores dentro de otras apps (Instagram, Facebook, TikTok…): no
 *   instalan; hay que abrir el enlace en el navegador del sistema.
 */
import { useSyncExternalStore } from 'react';

export type Plataforma = 'instalada' | 'nativa' | 'ios' | 'app-interna' | 'otra';

interface EventoInstalacion extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let eventoGuardado: EventoInstalacion | null = null;
let instaladaAhora = false;
const oyentes = new Set<() => void>();
const avisar = () => {
  for (const o of oyentes) o();
};

/** Se llama al arrancar, antes de React: el evento llega muy temprano. */
export function escucharInstalacion(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // la app muestra su propia invitación
    eventoGuardado = e as EventoInstalacion;
    avisar();
  });
  window.addEventListener('appinstalled', () => {
    instaladaAhora = true;
    eventoGuardado = null;
    avisar();
  });
}

export function estaInstalada(): boolean {
  return (
    instaladaAhora ||
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

const APPS_INTERNAS = /FBAN|FBAV|FB_IAB|Instagram|Line\/|TikTok|musical_ly|BytedanceWebview|Snapchat|LinkedInApp|Twitter/i;

export function esIos(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

function plataforma(): Plataforma {
  if (estaInstalada()) return 'instalada';
  if (APPS_INTERNAS.test(navigator.userAgent)) return 'app-interna';
  if (eventoGuardado) return 'nativa';
  if (esIos()) return 'ios';
  return 'otra';
}

export function usePlataforma(): Plataforma {
  return useSyncExternalStore(
    (o) => {
      oyentes.add(o);
      return () => oyentes.delete(o);
    },
    plataforma,
  );
}

/** Abre el cuadro nativo de instalación. Devuelve si la persona aceptó. */
export async function instalar(): Promise<boolean> {
  const e = eventoGuardado;
  if (!e) return false;
  await e.prompt();
  const { outcome } = await e.userChoice;
  eventoGuardado = null;
  avisar();
  return outcome === 'accepted';
}

const CLAVE_DESCARTE = 'smartsip:instalar:descartado';

export function invitacionDescartada(): boolean {
  try {
    return localStorage.getItem(CLAVE_DESCARTE) === '1';
  } catch {
    return false;
  }
}

export function descartarInvitacion(): void {
  try {
    localStorage.setItem(CLAVE_DESCARTE, '1');
  } catch {
    /* sin almacenamiento: volverá a salir, no pasa nada */
  }
}
