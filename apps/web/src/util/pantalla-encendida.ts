/**
 * Mantiene la pantalla encendida mientras el simulador está abierto: el
 * celular que hace de termo no debe bloquearse, o dejaría de mandar mensajes.
 * Usa la Screen Wake Lock API (Safari 16.4+, Chrome). El navegador suelta el
 * bloqueo al ocultar la pestaña, así que se vuelve a pedir al regresar.
 */
import { useEffect } from 'react';

export function useMantenerPantalla(): void {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return undefined;
    let bloqueo: WakeLockSentinel | null = null;
    let activo = true;
    const pedir = async () => {
      if (!activo || document.visibilityState !== 'visible') return;
      try {
        bloqueo = await navigator.wakeLock.request('screen');
      } catch {
        bloqueo = null; // sin permiso o batería baja: el simulador sigue igual
      }
    };
    const alCambiarVisibilidad = () => void pedir();
    void pedir();
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    return () => {
      activo = false;
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
      void bloqueo?.release().catch(() => undefined);
    };
  }, []);
}
