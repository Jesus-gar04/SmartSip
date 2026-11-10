/**
 * El detalle de un día, al tocar su termo en la Semana: cuánto tomaste frente
 * a la meta, cuántos sorbos, a qué temperatura bebiste, qué clima hizo y,
 * hora por hora, cuándo tomaste agua.
 *
 * Es un <dialog> nativo: atrapa el foco, se cierra con Esc y lo anuncian los
 * lectores de pantalla. En el celular sube desde abajo; en escritorio, al centro.
 */
import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { cantidad, type RegistroEvento, type ResumenDia } from 'smartsip-core';
import { IconoGota, IconoTermometro, IconoTermo } from '../ui/iconos.tsx';
import { TermoDibujo } from '../ui/TermoDibujo.tsx';
import { transicion, useMovimientoReducido } from '../util/movimiento.ts';
import { app, useGrados } from './estado.ts';
import { TandasDelDia } from './TandasDelDia.tsx';

const NOMBRES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function fechaLarga(f: string): string {
  const d = new Date(`${f}T12:00:00Z`);
  return `${NOMBRES[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}

const IconoSol = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </svg>
);

function Dato({ icono, valor, nombre }: { icono: React.ReactNode; valor: string; nombre: string }) {
  return (
    <div className="dato">
      <span className="dato-icono">{icono}</span>
      <span className="dato-valor cifras">{valor}</span>
      <span className="dato-nombre">{nombre}</span>
    </div>
  );
}

export function DetalleDia({ dia, meta, alCerrar }: { dia: ResumenDia; meta: number; alCerrar: () => void }) {
  const grados = useGrados();
  const ref = useRef<HTMLDialogElement>(null);
  const reducido = useMovimientoReducido();
  const [eventos, setEventos] = useState<readonly RegistroEvento[] | null>(null);
  const metaDia = dia.metaMl ?? meta;
  const fraccion = Math.min(1, dia.totalMl / metaDia);
  const cumplida = dia.totalMl >= metaDia && dia.totalMl > 0;
  const tempAgua = dia.tempMuestras > 0 ? Math.round(dia.tempSumaC / dia.tempMuestras) : null;
  const max = Math.max(...dia.porHora, 1);

  useEffect(() => {
    ref.current?.showModal();
    void app.eventosDelDia(dia.fecha).then(setEventos);
  }, [dia.fecha]);

  return (
    <dialog
      ref={ref}
      className="detalle-dia"
      aria-labelledby="detalle-titulo"
      onClose={alCerrar}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
    >
      <motion.div
        className="detalle-hoja"
        initial={{ y: reducido ? 0 : 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={transicion('transicion', reducido)}
      >
        <header className="detalle-cabecera">
          <h2 id="detalle-titulo" className="titulo-pantalla">
            {fechaLarga(dia.fecha)}
          </h2>
          <button type="button" className="detalle-cerrar" onClick={() => ref.current?.close()} aria-label="Cerrar">
            ×
          </button>
        </header>

        <div className="detalle-resumen">
          <div className="detalle-termo">
            <TermoDibujo nivel={fraccion} etiqueta={`${Math.round(fraccion * 100)} % de la meta`} />
          </div>
          <div className="detalle-cifras">
            <span className="meta-cifra cifras">{cantidad(dia.totalMl)}</span>
            <span className="hoy-de cifras">de {cantidad(metaDia)}</span>
            <span className={`sello ${cumplida ? '' : 'sello-suelto'}`}>
              {cumplida ? 'Meta cumplida' : dia.totalMl === 0 ? 'Sin datos' : `Faltaron ${cantidad(metaDia - dia.totalMl)}`}
            </span>
          </div>
        </div>

        <div className="datos">
          <Dato icono={<IconoGota />} valor={String(dia.sorbos)} nombre={dia.sorbos === 1 ? 'sorbo' : 'sorbos'} />
          <Dato icono={<IconoTermometro />} valor={tempAgua !== null ? grados(tempAgua) : '—'} nombre="tu agua, en promedio" />
          <Dato icono={<IconoSol />} valor={dia.climaC !== null ? grados(dia.climaC) : '—'} nombre="máxima afuera" />
          <Dato icono={<IconoTermo />} valor={String(dia.llenados)} nombre={dia.llenados === 1 ? 'vez llenaste' : 'veces llenaste'} />
        </div>

        <section className="detalle-seccion" aria-labelledby="detalle-horas">
          <h3 id="detalle-horas">A lo largo del día</h3>
          <div className="ritmo" role="img" aria-label="Cuánto tomaste en cada hora de ese día.">
            <div className="ritmo-horas">
              {dia.porHora.map((ml, h) => (
                <span key={h} className="ritmo-hora" style={{ opacity: ml <= 0 ? 0.1 : 0.25 + (ml / max) * 0.75 }} title={`${h}:00 · ${cantidad(ml)}`} />
              ))}
            </div>
            <div className="ritmo-etiquetas" aria-hidden>
              <span>0 h</span>
              <span>6 h</span>
              <span>12 h</span>
              <span>18 h</span>
              <span>24 h</span>
            </div>
          </div>
        </section>

        <section className="detalle-seccion" aria-labelledby="detalle-momentos">
          <h3 id="detalle-momentos">Tu día, termo a termo</h3>
          {eventos === null ? (
            <p className="texto-suave">Buscando tus sorbos de ese día…</p>
          ) : eventos.length === 0 ? (
            <p className="texto-suave">Ese día el termo no registró movimientos.</p>
          ) : (
            <>
              <p className="texto-suave">Cada vez que llenaste el termo empieza una tanda. Las gotas son tus sorbos: más grandes, más agua.</p>
              <TandasDelDia eventos={eventos} />
            </>
          )}
        </section>
      </motion.div>
    </dialog>
  );
}
