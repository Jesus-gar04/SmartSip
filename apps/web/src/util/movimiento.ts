/** Movimiento a partir de los tokens: resortes de Framer Motion y "Reducir movimiento". */
import { useEffect, useState } from 'react';
import { fundido, resorte, type NombreResorte } from 'smartsip-tokens';
import type { Transition } from 'framer-motion';

/** Resorte de los tokens en el formato de Framer Motion. */
export function transicion(nombre: NombreResorte, reducido = false): Transition {
  if (reducido) return { duration: fundido.duracionMs / 1000, ease: [...fundido.curva] };
  const r = resorte[nombre];
  return { type: 'spring', duration: r.duracionMs / 1000, bounce: Math.max(0, 1 - r.amortiguamiento) };
}

const CONSULTA = '(prefers-reduced-motion: reduce)';

export function useMovimientoReducido(): boolean {
  const [reducido, setReducido] = useState(() => matchMedia(CONSULTA).matches);
  useEffect(() => {
    const mq = matchMedia(CONSULTA);
    const alCambiar = () => setReducido(mq.matches);
    mq.addEventListener('change', alCambiar);
    return () => mq.removeEventListener('change', alCambiar);
  }, []);
  return reducido;
}
