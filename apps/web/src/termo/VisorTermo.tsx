/**
 * El termo en pantalla: 3D si el equipo puede, 2.5D si no. Los gestos y la
 * vista de nivel son los mismos en los dos.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PantallaTermo } from 'smartsip-core';
import { useTienda } from '../estado/tienda.ts';
import { useMovimientoReducido } from '../util/movimiento.ts';
import { crearControl, engancharGestos, VISTA_NIVEL_MS } from './control.ts';
import { TermoIlustrado } from './TermoIlustrado.tsx';

const Termo3D = lazy(() => import('./Termo3D.tsx'));

/** ¿Vale la pena el 3D? Sin WebGL o con muy poca memoria, mejor el 2.5D. */
function puede3D(): boolean {
  const param = new URLSearchParams(location.search).get('termo');
  if (param === '2d') return false;
  if (param === '3d') return true;
  const memoria = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (memoria !== undefined && memoria <= 2) return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export function VisorTermo() {
  const nivelMl = useTienda((s) => Math.round(s.inst?.termo.nivelMl ?? 0));
  const capacidadMl = useTienda((s) => s.inst?.termo.capacidadMl ?? 393);
  const encendida = useTienda((s) => s.inst?.pantalla.encendida ?? true);
  const temperatura = useTienda((s) => s.inst?.pantalla.temperatura ?? 0);
  const unidad = useTienda((s) => s.inst?.pantalla.unidad ?? 'C');
  const bateriaPct = useTienda((s) => s.inst?.pantalla.bateriaPct ?? 0);
  const bluetooth = useTienda((s) => s.inst?.pantalla.bluetooth ?? false);
  const brillo = useTienda((s) => s.inst?.pantalla.brillo ?? 'medio');
  const tapaCerrada = useTienda((s) => s.inst?.termo.tapaCerrada ?? true);
  // A4: mientras se actualiza, la pantalla muestra la barra (en pasos de 1 %, para no redibujar de más).
  const faseAct = useTienda((s) => s.inst?.pantalla.actualizacion?.fase ?? null);
  const pctAct = useTienda((s) => Math.round((s.inst?.pantalla.actualizacion?.fraccion ?? 0) * 100));
  const pantalla = useMemo<PantallaTermo>(
    () => ({
      encendida,
      temperatura,
      unidad,
      bateriaPct,
      bluetooth,
      brillo,
      actualizacion:
        faseAct === 'instalando'
          ? { fase: 'instalando', fraccion: 1 }
          : faseAct === 'recibiendo'
            ? { fase: 'recibiendo', fraccion: pctAct / 100 }
            : null,
    }),
    [encendida, temperatura, unidad, bateriaPct, bluetooth, brillo, faseAct, pctAct],
  );

  const reducido = useMovimientoReducido();
  const usar3D = useMemo(puede3D, []);
  const control = useRef(crearControl()).current;
  const invalidar = useRef<() => void>(() => undefined);
  const contenedor = useRef<HTMLDivElement>(null);
  const [viendoNivel, setViendoNivel] = useState(false);
  const temporizador = useRef<number | undefined>(undefined);

  const alCambiar = useCallback(() => {
    invalidar.current();
    const viendo = performance.now() < control.nivelHastaMs;
    setViendoNivel(viendo);
    if (viendo) {
      window.clearTimeout(temporizador.current);
      temporizador.current = window.setTimeout(() => setViendoNivel(false), VISTA_NIVEL_MS);
    }
  }, [control]);

  useEffect(() => {
    const el = contenedor.current;
    if (!el) return undefined;
    const soltar = engancharGestos(el, control, alCambiar);
    return () => {
      soltar();
      window.clearTimeout(temporizador.current);
    };
  }, [control, alCambiar]);

  const ilustrado = (
    <TermoIlustrado nivelMl={nivelMl} capacidadMl={capacidadMl} pantalla={pantalla} viendoNivel={viendoNivel} tapaCerrada={tapaCerrada} />
  );

  return (
    <figure className="visor">
      <div
        ref={contenedor}
        className="visor-lienzo"
        tabIndex={0}
        role="button"
        aria-label={`Termo SmartSip con ${nivelMl} ml a ${temperatura} °${unidad}. Toca para ver el nivel de agua.`}
        aria-describedby="visor-ayuda"
      >
        {usar3D ? (
          <Suspense fallback={ilustrado}>
            <Termo3D
              control={control}
              nivelMl={nivelMl}
              capacidadMl={capacidadMl}
              pantalla={pantalla}
              reducido={reducido}
              tapaCerrada={tapaCerrada}
              alListo={(f) => {
                invalidar.current = f;
              }}
            />
          </Suspense>
        ) : (
          ilustrado
        )}
      </div>
      <figcaption id="visor-ayuda" className="visor-ayuda">
        {viendoNivel ? (
          <span className="cifras">
            Quedan {nivelMl} ml de {capacidadMl}
          </span>
        ) : usar3D ? (
          'Arrastra para girarlo. Toca para ver el agua.'
        ) : (
          'Toca para ver el agua.'
        )}
      </figcaption>
    </figure>
  );
}
