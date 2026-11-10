/**
 * Respaldo 2.5D del termo para equipos sin WebGL o con poca memoria, y
 * mientras carga el 3D. Mismas proporciones, misma pantalla espejo y la
 * misma vista de nivel al tocarlo. Formas planas: sin degradados ni sombras.
 */
import type { PantallaTermo } from 'smartsip-core';
import { colorCorrea, colorTermo, paleta } from 'smartsip-tokens';

export interface PropsTermoIlustrado {
  readonly nivelMl: number;
  readonly capacidadMl: number;
  readonly pantalla: PantallaTermo;
  readonly viendoNivel: boolean;
  readonly tapaCerrada: boolean;
}

// 1 cm = 12 unidades: 5 cm de ancho, 20 cm de alto.
const X = 30;
const ANCHO = 60;
const ARRIBA_CUERPO = 40;
const ABAJO = 280;
const ALTO_UTIL = 222;

const ALFA = { bajo: 0.55, medio: 0.8, alto: 1 } as const;

export function TermoIlustrado({ nivelMl, capacidadMl, pantalla, viendoNivel, tapaCerrada }: PropsTermoIlustrado) {
  const fraccion = Math.max(0, Math.min(1, nivelMl / capacidadMl));
  const altoAgua = ALTO_UTIL * fraccion;
  const alfa = pantalla.encendida ? ALFA[pantalla.brillo] : 0;
  return (
    <svg className="termo-2d" viewBox="0 0 140 300" role="presentation">
      {/* Boca del termo, visible con la tapa arriba */}
      <rect x={X + 10} y={35} width={ANCHO - 20} height={3} rx={1} fill={paleta.tinta} />
      {/* Tapa de rosca y correa: abierta, sube. */}
      <g className="termo-2d-tapa" style={{ transform: tapaCerrada ? undefined : 'translateY(-8px)' }}>
        <path d="M86 18 q22 2 22 18 q0 16 -22 16" fill="none" stroke={colorCorrea} strokeWidth="4" strokeLinecap="round" />
        <rect x={X + 1} y={10} width={ANCHO - 2} height={28} rx={4} fill={colorTermo} />
      </g>
      {/* Junta */}
      <rect x={X + 1} y={37} width={ANCHO - 2} height={2} fill={paleta.tinta} />
      {/* Cuerpo */}
      <g className="termo-2d-cuerpo" style={{ opacity: viendoNivel ? 0.2 : 1 }}>
        <path d={`M${X} ${ARRIBA_CUERPO} h${ANCHO} v${ABAJO - ARRIBA_CUERPO - 6} q0 6 -6 6 h${-ANCHO + 12} q-6 0 -6 -6 z`} fill={colorTermo} />
        {/* Bandas planas que sugieren el volumen del cilindro */}
        <rect x={X + 6} y={ARRIBA_CUERPO + 4} width={5} height={ABAJO - ARRIBA_CUERPO - 14} fill={paleta.papel} opacity={0.35} />
        <rect x={X + ANCHO - 9} y={ARRIBA_CUERPO + 4} width={6} height={ABAJO - ARRIBA_CUERPO - 14} fill={paleta.tinta} opacity={0.12} />
        {/* El logo grabado en el acero: la gota con la S y la palabra, en un solo color. */}
        <image href="/marca/smartsip-logo-vertical-tinta.svg" x={X + 14} y={206} width={ANCHO - 28} height={28} opacity={0.8} />

      </g>
      {/* Agua: solo en la vista de nivel */}
      <rect
        className="termo-2d-agua"
        x={X + 4}
        y={ABAJO - 6 - altoAgua}
        width={ANCHO - 8}
        height={altoAgua}
        fill={paleta.azul}
        style={{ opacity: viendoNivel ? 0.92 : 0 }}
      />
      {/* Contorno fino, para que el termo se lea aun translúcido */}
      <path
        d={`M${X} ${ARRIBA_CUERPO} h${ANCHO} v${ABAJO - ARRIBA_CUERPO - 6} q0 6 -6 6 h${-ANCHO + 12} q-6 0 -6 -6 z`}
        fill="none"
        stroke={paleta.tinta}
        strokeOpacity={viendoNivel ? 0.6 : 0}
        strokeWidth="1"
      />
      {/* Pantalla espejo */}
      <rect x={X + 8} y={92} width={ANCHO - 16} height={22} rx={2} fill={pantalla.encendida ? paleta.tinta : '#141514'} />
      <g fill={paleta.papel} opacity={alfa} className="cifras">
        {pantalla.actualizacion ? (
          <>
            {/* A4: la barra de la actualización en lugar de la temperatura. */}
            <rect x={X + 12} y={100} width={30} height={6} fill="none" stroke={paleta.papel} strokeWidth="0.8" />
            <rect x={X + 13.5} y={101.5} width={27 * pantalla.actualizacion.fraccion} height={3} />
          </>
        ) : (
          <text x={X + 12} y={108} fontSize="13" fontWeight="700">
            {pantalla.temperatura}
            <tspan fontSize="6" fontWeight="400">
              °{pantalla.unidad}
            </tspan>
          </text>
        )}
        <text x={X + ANCHO - 11} y={102} fontSize="5.5" textAnchor="end">
          {pantalla.bateriaPct}%
        </text>
      </g>
      <path
        d={`M${X + ANCHO - 17} 105 l4 3 l-2 2 v-8 l2 2 l-4 3`}
        fill="none"
        stroke={paleta.papel}
        strokeWidth="0.8"
        strokeLinejoin="round"
        opacity={alfa * (pantalla.bluetooth ? 1 : 0.25)}
      />
    </svg>
  );
}
