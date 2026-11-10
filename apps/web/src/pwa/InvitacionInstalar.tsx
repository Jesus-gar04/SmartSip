/**
 * La invitación a llevar SmartSip a la pantalla de inicio. Sale una vez y se
 * puede cerrar; con `obligatoria` (al activar avisos en iPhone) no se cierra,
 * porque iOS solo envía notificaciones a la app instalada.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { Boton } from '../ui/controles.tsx';
import { transicion, useMovimientoReducido } from '../util/movimiento.ts';
import { descartarInvitacion, instalar, invitacionDescartada, usePlataforma } from './instalacion.ts';

const IconoCompartir = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 3v12M8 7l4-4 4 4" />
    <path d="M7 10H5.5A1.5 1.5 0 0 0 4 11.5v8A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-8a1.5 1.5 0 0 0-1.5-1.5H17" />
  </svg>
);

const IconoAnadir = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);

export function InvitacionInstalar({ obligatoria = false }: { obligatoria?: boolean }) {
  const plataforma = usePlataforma();
  const reducido = useMovimientoReducido();
  const [cerrada, setCerrada] = useState(() => !obligatoria && invitacionDescartada());
  const [copiado, setCopiado] = useState(false);

  const visible = !cerrada && plataforma !== 'instalada' && plataforma !== 'otra';
  const cerrar = () => {
    descartarInvitacion();
    setCerrada(true);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.section
          className="invitacion"
          aria-labelledby="invitacion-titulo"
          initial={{ opacity: 0, y: reducido ? 0 : 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={transicion('transicion', reducido)}
        >
          <img className="invitacion-icono" src="/marca/smartsip-icono-app.svg" alt="" width="56" height="56" />
          <div className="invitacion-texto">
            <h2 id="invitacion-titulo">Ten SmartSip a un toque</h2>
            {plataforma === 'nativa' && <p>Instálala en tu pantalla de inicio: abre al instante y funciona sin conexión.</p>}
            {plataforma === 'ios' && (
              <>
                <p>En iPhone se agrega desde Safari, en dos pasos:</p>
                <ol className="invitacion-pasos">
                  <li>
                    <span className="invitacion-paso-icono">
                      <IconoCompartir />
                    </span>
                    Toca <strong>Compartir</strong> en la barra de Safari.
                  </li>
                  <li>
                    <span className="invitacion-paso-icono">
                      <IconoAnadir />
                    </span>
                    Elige <strong>Añadir a pantalla de inicio</strong>.
                  </li>
                </ol>
                {obligatoria && <p className="invitacion-nota">El iPhone solo envía avisos a la app instalada.</p>}
              </>
            )}
            {plataforma === 'app-interna' && (
              <p>Estás dentro de otra app. Abre este enlace en Safari o Chrome para poder instalar SmartSip.</p>
            )}
          </div>
          <div className="invitacion-acciones">
            {plataforma === 'nativa' && (
              <Boton principal onClick={() => void instalar()}>
                Instalar SmartSip
              </Boton>
            )}
            {plataforma === 'app-interna' && (
              <Boton
                principal
                onClick={() =>
                  void navigator.clipboard?.writeText(location.href).then(
                    () => setCopiado(true),
                    () => setCopiado(false),
                  )
                }
              >
                {copiado ? 'Enlace copiado' : 'Copiar el enlace'}
              </Boton>
            )}
            {!obligatoria && (
              <button type="button" className="enlace" onClick={cerrar}>
                Ahora no
              </button>
            )}
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
