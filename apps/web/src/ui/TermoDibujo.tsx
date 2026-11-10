/**
 * El termo SmartSip dibujado en línea (como en la Semana): el hilo conductor
 * de la app. Se llena de agua hasta `nivel` (0 a 1) con un resorte, y su
 * pantalla frontal puede mostrar un texto (la temperatura, un código…).
 * Sin degradados: tinta para el trazo, azul para el agua.
 */
import { motion } from 'framer-motion';
import { useId, type ReactNode } from 'react';
import { transicion, useMovimientoReducido } from '../util/movimiento.ts';

const CUERPO = 'M14 46 h52 v156 q0 12 -12 12 h-28 q-12 0 -12 -12 z';
const OLA = 'M0 6 Q 13 0 26 6 T 52 6 T 78 6 T 104 6 V 200 H 0 Z';

export function TermoDibujo({
  nivel,
  pantalla,
  sobreAgua = false,
  className = '',
  etiqueta,
}: {
  /** De 0 (vacío) a 1 (lleno). */
  nivel: number;
  /** Texto de la pantalla frontal; sin texto, la pantalla va apagada. */
  pantalla?: ReactNode;
  /** Dibujado sobre el agua: trazo blanco y agua en bruma. */
  sobreAgua?: boolean;
  className?: string;
  /** Texto para lectores de pantalla; sin él, el dibujo es decorativo. */
  etiqueta?: string;
}) {
  const id = useId();
  const reducido = useMovimientoReducido();
  const n = Math.max(0, Math.min(1, nivel));
  const alto = 156;
  return (
    <svg
      viewBox="0 0 80 222"
      className={`termo-dibujo ${sobreAgua ? 'termo-dibujo-agua' : ''} ${className}`}
      role={etiqueta ? 'img' : undefined}
      aria-label={etiqueta}
      aria-hidden={etiqueta ? undefined : true}
    >
      <defs>
        <clipPath id={`c-${id}`}>
          <path d={CUERPO} />
        </clipPath>
      </defs>
      {/* Correa y tapa */}
      <path d="M62 14 q14 1 14 12 q0 11 -14 11" className="termo-dibujo-correa" />
      <rect x="16" y="8" width="48" height="32" rx="6" className="termo-dibujo-trazo" />
      <path d="M18 43 h44" className="termo-dibujo-trazo" />
      {/* Cuerpo beige, como el termo real */}
      <path d={CUERPO} className="termo-dibujo-cuerpo" />
      {/* Agua */}
      <g clipPath={`url(#c-${id})`}>
        <motion.g
          initial={reducido ? false : { y: 214 }}
          animate={{ y: 46 + alto * (1 - n) - 6 }}
          transition={transicion('meta', reducido)}
        >
          <motion.path
            d={OLA}
            className="termo-dibujo-agua-relleno"
            {...(reducido ? {} : { animate: { x: [-26, 0] }, transition: { duration: 3, ease: 'linear', repeat: Infinity } })}
          />
        </motion.g>
      </g>
      <path d={CUERPO} className="termo-dibujo-trazo" />
      {/* Pantalla frontal */}
      <rect x="22" y="78" width="36" height="22" rx="4" className="termo-dibujo-pantalla" />
      {pantalla !== undefined && (
        <text x="40" y="93.5" textAnchor="middle" className="termo-dibujo-texto">
          {pantalla}
        </text>
      )}
    </svg>
  );
}

/** Los pasos del primer uso: dónde estás y cuánto falta. */
export function Pasos({ actual, total, nombres }: { actual: number; total: number; nombres: readonly string[] }) {
  return (
    <ol className="pasos-progreso" aria-label={`Paso ${actual} de ${total}`}>
      {nombres.map((n, i) => {
        const paso = i + 1;
        const estado = paso < actual ? 'hecho' : paso === actual ? 'actual' : 'pendiente';
        return (
          <li key={n} className={`paso paso-${estado}`} aria-current={estado === 'actual' ? 'step' : undefined}>
            <span className="paso-marca">{estado === 'hecho' ? '✓' : paso}</span>
            <span className="paso-nombre">{n}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Círculo de función del manual: ícono de línea y su nombre. */
export function Funcion({ icono, nombre, texto }: { icono: ReactNode; nombre: string; texto: string }) {
  return (
    <div className="funcion">
      <span className="funcion-circulo">{icono}</span>
      <div>
        <p className="funcion-titulo">{nombre}</p>
        <p className="funcion-texto">{texto}</p>
      </div>
    </div>
  );
}
