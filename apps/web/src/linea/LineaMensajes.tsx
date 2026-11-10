/**
 * La línea fina entre el termo y el teléfono: cada mensaje viaja con un
 * pulso en Tierra en su dirección. Las lecturas de estado (cada 10 s) solo
 * dejan un pulso tenue, como mucho uno por segundo, para no hacer ruido.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useTienda, type MensajeLinea } from '../estado/tienda.ts';
import { hora } from '../util/formato.ts';
import { transicion, useMovimientoReducido } from '../util/movimiento.ts';

function Pulso({ direccion, reducido, tenue = false }: { direccion: MensajeLinea['direccion']; reducido: boolean; tenue?: boolean }) {
  const haciaApp = direccion === 'termoAApp';
  if (reducido) {
    return (
      <motion.span
        className={`pulso ${tenue ? 'pulso-tenue' : ''}`}
        style={{ left: haciaApp ? '100%' : '0%' }}
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={transicion('transicion', true)}
      />
    );
  }
  return (
    <motion.span
      className={`pulso ${tenue ? 'pulso-tenue' : ''}`}
      initial={{ left: haciaApp ? '0%' : '100%', opacity: 1 }}
      animate={{ left: haciaApp ? '100%' : '0%', opacity: 0 }}
      transition={{ left: transicion('transicion'), opacity: { delay: 0.2, duration: 0.16 } }}
    />
  );
}

function usePulsoEstado(): number {
  const pulsos = useTienda((s) => s.pulsosEstado);
  const [clave, setClave] = useState(0);
  const ultimo = useRef(0);
  useEffect(() => {
    const ahora = performance.now();
    if (pulsos > 0 && ahora - ultimo.current > 1000) {
      ultimo.current = ahora;
      setClave(pulsos);
    }
  }, [pulsos]);
  return clave;
}

export function LineaMensajes() {
  const linea = useTienda((s) => s.linea);
  const reducido = useMovimientoReducido();
  const pulsoEstado = usePulsoEstado();

  return (
    <aside className="linea" aria-label="Mensajes entre el termo y la app">
      <div className="linea-cabecera">
        <span>Termo</span>
        <span>App</span>
      </div>
      <div className="linea-pista linea-pista-estado" aria-hidden>
        {pulsoEstado > 0 && <Pulso key={pulsoEstado} direccion="termoAApp" reducido={reducido} tenue />}
        <span className="linea-estado">estado</span>
      </div>
      <ol className="linea-lista" aria-live="polite" aria-relevant="additions">
        <AnimatePresence initial={false}>
          {linea.map((m) => (
            <motion.li
              key={m.n}
              className={`linea-mensaje linea-${m.direccion}`}
              layout={!reducido}
              initial={{ opacity: 0, y: reducido ? 0 : -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={transicion('micro', reducido)}
            >
              <div className="linea-pista" aria-hidden>
                <Pulso direccion={m.direccion} reducido={reducido} />
              </div>
              <span className="linea-texto">
                <span className="visualmente-oculto">{m.direccion === 'termoAApp' ? 'Del termo a la app: ' : 'De la app al termo: '}</span>
                <span aria-hidden>{m.direccion === 'termoAApp' ? '→ ' : '← '}</span>
                {m.texto}
              </span>
              <time className="linea-hora cifras">{hora(m.enMs, true)}</time>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </aside>
  );
}

/** Versión de una sola fila para el celular. */
export function FranjaMensajes() {
  const ultimo = useTienda((s) => s.linea[0]);
  const reducido = useMovimientoReducido();
  return (
    <div className="franja" aria-live="polite">
      <div className="linea-pista" aria-hidden>
        {ultimo && <Pulso key={ultimo.n} direccion={ultimo.direccion} reducido={reducido} />}
      </div>
      <span className="franja-texto">
        {ultimo ? `${ultimo.direccion === 'termoAApp' ? 'Termo → app' : 'App → termo'}: ${ultimo.texto}` : 'Sin mensajes todavía'}
      </span>
    </div>
  );
}
