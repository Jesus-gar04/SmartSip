/**
 * El recordatorio dentro de la app, como en el flyer (manual, Notificacion):
 * tarjeta de superficie, ícono cuadrado de tinta con la gota viva, un hecho
 * de título y una salida fácil. Llega cuando el push encuentra la app abierta.
 * Se va solo a los 9 segundos, o al tocarlo.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { transicion, useMovimientoReducido } from '../util/movimiento.ts';
import { app, useApp } from './estado.ts';

const DURACION_MS = 9_000;

export function GotaViva() {
  return (
    <svg width="18" height="22" viewBox="0 0 18 22" aria-hidden>
      <path d="M9 1 C9 1 1 10 1 14.5 A8 8 0 0 0 17 14.5 C17 10 9 1 9 1Z" fill="var(--gota)" />
    </svg>
  );
}

export function TarjetaAviso({ titulo, cuerpo, cuando = 'ahora' }: { titulo: string; cuerpo: string; cuando?: string }) {
  return (
    <div className="notif">
      <span className="notif-icono">
        <GotaViva />
      </span>
      <span className="notif-texto">
        <span className="notif-app">
          SMARTSIP <span>{cuando}</span>
        </span>
        <span className="notif-titulo">{titulo}</span>
        <span className="notif-cuerpo">{cuerpo}</span>
      </span>
    </div>
  );
}

export function AvisoEnApp() {
  const aviso = useApp((s) => s.avisoEnApp);
  const reducido = useMovimientoReducido();

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => app.cerrarAviso(), DURACION_MS);
    return () => clearTimeout(t);
  }, [aviso]);

  return (
    <div className="notif-capa" aria-live="polite">
      <AnimatePresence>
        {aviso && (
          <motion.button
            key={`${aviso.tipo}-${aviso.titulo}`}
            type="button"
            className="notif-boton"
            aria-label={`${aviso.titulo}. ${aviso.cuerpo} Toca para cerrar.`}
            onClick={() => app.cerrarAviso()}
            initial={reducido ? { opacity: 0 } : { opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducido ? { opacity: 0 } : { opacity: 0, y: -16 }}
            transition={transicion('transicion', reducido)}
          >
            <TarjetaAviso titulo={aviso.titulo} cuerpo={aviso.cuerpo} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
