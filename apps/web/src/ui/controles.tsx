/**
 * Controles con la forma del manual: Bricolage negrita, esquinas de 14 px,
 * una sola acción principal por pantalla y el verbo de lo que pasa
 * ("Conectar cargador", nunca "Aceptar"). Se hunden con un resorte al tocarlos.
 */
import { motion } from 'framer-motion';
import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { transicion, useMovimientoReducido } from '../util/movimiento.ts';

type PropsBoton = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onAnimationStart' | 'onDrag' | 'onDragStart' | 'onDragEnd' | 'style'> & {
  readonly principal?: boolean;
  readonly icono?: ReactNode;
  /** Botón que alterna un estado: se ve hundido mientras está activo. */
  readonly activo?: boolean;
};

export function Boton({ principal = false, icono, activo, className = '', children, ...props }: PropsBoton) {
  const reducido = useMovimientoReducido();
  return (
    <motion.button
      type="button"
      className={`boton ${principal ? 'boton-principal' : ''} ${activo ? 'boton-activo' : ''} ${className}`}
      aria-pressed={activo}
      {...(reducido || props.disabled ? {} : { whileTap: { scale: 0.97 } })}
      transition={transicion('micro', reducido)}
      {...props}
    >
      {icono && <span className="boton-icono">{icono}</span>}
      <span className="boton-texto">{children}</span>
    </motion.button>
  );
}

export interface Opcion<T extends string | number> {
  readonly valor: T;
  readonly etiqueta: ReactNode;
  readonly deshabilitada?: boolean;
}

/** Opciones excluyentes. La marca de la opción elegida se desliza con un resorte. */
export function Segmentado<T extends string | number>({
  etiqueta,
  opciones,
  valor,
  alCambiar,
}: {
  etiqueta: string;
  opciones: readonly Opcion<T>[];
  valor: T;
  alCambiar: (v: T) => void;
}) {
  const id = useId();
  const reducido = useMovimientoReducido();
  return (
    <div className="segmentado" role="radiogroup" aria-label={etiqueta}>
      {opciones.map((o) => {
        const elegida = o.valor === valor;
        return (
          <button
            key={String(o.valor)}
            type="button"
            role="radio"
            aria-checked={elegida}
            disabled={o.deshabilitada}
            className="segmentado-opcion"
            onClick={() => alCambiar(o.valor)}
          >
            {elegida && (
              <motion.span
                {...(reducido ? {} : { layoutId: `marca-${id}` })}
                className="segmentado-marca"
                transition={transicion('transicion', reducido)}
              />
            )}
            <span className="segmentado-texto">{o.etiqueta}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Deslizador({
  etiqueta,
  valor,
  min,
  max,
  paso = 1,
  unidad,
  alCambiar,
}: {
  etiqueta: string;
  valor: number;
  min: number;
  max: number;
  paso?: number;
  unidad: string;
  alCambiar: (v: number) => void;
}) {
  const id = useId();
  const porcentaje = ((valor - min) / (max - min)) * 100;
  return (
    <div className="deslizador">
      <div className="deslizador-cabecera">
        <label htmlFor={id}>{etiqueta}</label>
        <output htmlFor={id} className="cifras">
          {valor}
          {' '}
          {unidad}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={paso}
        value={valor}
        style={{ ['--relleno' as string]: `${porcentaje}%` }}
        onChange={(e) => alCambiar(Number(e.target.value))}
      />
    </div>
  );
}

/**
 * Una tarjeta del panel: el círculo de función del manual con su ícono, el
 * nombre, una línea que explica qué simula y, a la derecha, la lectura en vivo.
 */
export function Tarjeta({
  icono,
  titulo,
  explica,
  lectura,
  children,
}: {
  icono: ReactNode;
  titulo: string;
  explica: ReactNode;
  lectura?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className="consola-tarjeta" aria-labelledby={id}>
      <header className="consola-cabecera">
        <span className="funcion-circulo">{icono}</span>
        <div className="consola-titulos">
          <h3 id={id} className="funcion-nombre">
            {titulo}
          </h3>
          <p className="consola-explica">{explica}</p>
        </div>
        {lectura && <div className="consola-lectura cifras">{lectura}</div>}
      </header>
      <div className="consola-cuerpo">{children}</div>
    </section>
  );
}
