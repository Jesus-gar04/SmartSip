/**
 * El escenario del termo, con la regla de los dos mundos del manual: papel
 * arriba y agua abajo, separados por la ola de dos capas (bruma detrás, azul
 * delante). El agua del escenario sube y baja con el nivel del termo, y con
 * cada sorbo suben de una a tres burbujas.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { duracion } from 'smartsip-tokens';
import { useTienda } from '../estado/tienda.ts';
import { useMovimientoReducido } from '../util/movimiento.ts';
import { PantallaAmpliada } from './PantallaAmpliada.tsx';
import { VisorTermo } from './VisorTermo.tsx';

/** Una cresta suave y larga; el trazo se repite para poder deslizarlo sin cortes. */
const OLA = 'M0 18 C 60 6, 140 6, 200 18 S 340 30, 400 18 S 540 6, 600 18 S 740 30, 800 18 V 60 H 0 Z';

interface Burbuja {
  readonly id: number;
  readonly x: number;
  readonly r: number;
  readonly retraso: number;
}

function useBurbujas(): readonly Burbuja[] {
  const ultimo = useTienda((s) => s.linea[0]);
  const [burbujas, setBurbujas] = useState<readonly Burbuja[]>([]);
  const visto = useRef(0);
  useEffect(() => {
    if (!ultimo || ultimo.n === visto.current) return;
    visto.current = ultimo.n;
    if (ultimo.tipo !== 'sorbo' || ultimo.direccion !== 'termoAApp') return;
    const cuantas = 1 + Math.floor(Math.random() * 3); // de una a tres
    const nuevas = Array.from({ length: cuantas }, (_, i) => ({
      id: ultimo.n * 10 + i,
      x: 30 + Math.random() * 40,
      r: [4, 6, 9][i % 3] ?? 6,
      retraso: i * 0.12,
    }));
    setBurbujas(nuevas);
    const t = setTimeout(() => setBurbujas([]), 1600);
    return () => clearTimeout(t);
  }, [ultimo]);
  return burbujas;
}

export function Escenario() {
  const fraccion = useTienda((s) => {
    const t = s.inst?.termo;
    return t ? Math.round((t.nivelMl / t.capacidadMl) * 100) / 100 : 0;
  });
  const reducido = useMovimientoReducido();
  const burbujas = useBurbujas();

  return (
    <div className="escenario-termo" style={{ ['--nivel' as string]: fraccion }}>
      <div className={`agua ${reducido ? 'agua-quieta' : ''}`} aria-hidden>
        <svg className="ola ola-atras" viewBox="0 0 800 60" preserveAspectRatio="none">
          <path d={OLA} />
        </svg>
        <svg className="ola ola-frente" viewBox="0 0 800 60" preserveAspectRatio="none">
          <path d={OLA} />
        </svg>
        <div className="agua-cuerpo" />
        <AnimatePresence>
          {!reducido &&
            burbujas.map((b) => (
              <motion.span
                key={b.id}
                className="burbuja"
                style={{ left: `${b.x}%`, width: b.r * 2, height: b.r * 2 }}
                initial={{ y: 0, opacity: 0 }}
                animate={{ y: -140, opacity: [0, 1, 1, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: (duracion.sorbo * 2) / 1000, delay: b.retraso, ease: [0.2, 0.7, 0.3, 1] }}
              />
            ))}
        </AnimatePresence>
      </div>
      <VisorTermo />
      <PantallaAmpliada />
    </div>
  );
}
