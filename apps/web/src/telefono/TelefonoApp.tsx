/**
 * La app SmartSip de verdad, dentro del simulador. Es la misma web en un
 * iframe (`/?telefono`): con su propio ancho de celular, la app se ve igual
 * que en un teléfono (Hoy con la ola, el menú abajo, Semana, Termo, Ajustes).
 * Los datos le llegan por el puente del simulador (telefono/puente.ts).
 *
 * En el iPhone dibujado, la app corre a tamaño real (390 px de ancho, como
 * un iPhone 14) y se reduce para caber en el marco: mismas proporciones que
 * en un celular de verdad, no una pantalla más baja que cualquiera.
 */
import { useEffect, useRef, useState, type RefObject } from 'react';
import { useTienda } from '../estado/tienda.ts';
import { hora } from '../util/formato.ts';

const ANCHO_IPHONE = 390;

function useTamano(ref: RefObject<HTMLElement | null>): { ancho: number; alto: number } | null {
  const [tamano, setTamano] = useState<{ ancho: number; alto: number } | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (e) setTamano({ ancho: e.contentRect.width, alto: e.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return tamano;
}

export function TelefonoApp({ marco }: { marco: boolean }) {
  const lista = useTienda((s) => s.fase === 'lista');
  const enMs = useTienda((s) => s.inst?.enMs ?? null);
  const caja = useRef<HTMLDivElement>(null);
  const tamano = useTamano(caja);

  // Solo se reduce dentro del marco y si el marco es más angosto que un iPhone.
  const escala = marco && tamano && tamano.ancho < ANCHO_IPHONE ? tamano.ancho / ANCHO_IPHONE : 1;
  const estilo =
    escala < 1 && tamano
      ? { width: ANCHO_IPHONE, height: tamano.alto / escala, transform: `scale(${escala})`, transformOrigin: '0 0' }
      : undefined;

  return (
    <div className="app-pantalla app-pantalla-real">
      {marco && (
        <div className="app-barra cifras" aria-hidden>
          <span>{enMs !== null ? hora(enMs) : ''}</span>
          <span className="app-barra-camara" />
          <span className="app-barra-estado">
            <span className="app-barra-pila" />
          </span>
        </div>
      )}
      <div ref={caja} className="app-iframe-caja">
        {lista ? (
          <iframe className="app-iframe" src="/?telefono" title="La app SmartSip en el celular" style={estilo} />
        ) : (
          <p className="app-abriendo">Abriendo la app…</p>
        )}
      </div>
    </div>
  );
}
