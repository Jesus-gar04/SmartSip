/**
 * Tu semana (U3): siete termos llenos hasta donde llegaste cada día, no una
 * gráfica de barras (manual, "Otras pantallas"). Debajo, cómo bebes: el ritmo
 * del día y lo que dicen tus últimas cuatro semanas, en frases.
 */
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import {
  calcularHabitos,
  calcularMeta,
  claveDia,
  cumplio,
  rellenarDias,
  sumarDias,
  type ResumenDia,
} from 'smartsip-core';
import { transicion, useMovimientoReducido } from '../util/movimiento.ts';
import { DetalleDia } from './DetalleDia.tsx';
import { app, useApp } from './estado.ts';

const SEMANAS = 4;
const INICIALES = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const NOMBRES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const fechaUTC = (f: string) => new Date(`${f}T12:00:00Z`);
const diaSemana = (f: string) => fechaUTC(f).getUTCDay();
const esFinde = (f: string) => [0, 6].includes(diaSemana(f));
const corta = (ml: number) => (ml <= 0 ? '—' : ml < 1000 ? `${Math.round(ml)} ml` : `${(ml / 1000).toFixed(1).replace('.', ',')} L`);

function rango(desde: string, hasta: string): string {
  const a = fechaUTC(desde);
  const b = fechaUTC(hasta);
  const mesA = MESES[a.getUTCMonth()];
  const mesB = MESES[b.getUTCMonth()];
  return mesA === mesB
    ? `Del ${a.getUTCDate()} al ${b.getUTCDate()} de ${mesB}`
    : `Del ${a.getUTCDate()} de ${mesA} al ${b.getUTCDate()} de ${mesB}`;
}

const OLA_TERMO = 'M0 4 Q 7 0 14 4 T 28 4 V 120 H 0 Z';

function TermoDelDia({ d, meta, esHoy, indice, alTocar }: { d: ResumenDia; meta: number; esHoy: boolean; indice: number; alTocar: () => void }) {
  const reducido = useMovimientoReducido();
  const metaDia = d.metaMl ?? meta;
  const fraccion = Math.min(1, d.totalMl / metaDia);
  const alto = 92; // alto útil del cuerpo en el dibujo
  const lleno = cumplio(d, meta);
  const nombre = NOMBRES[diaSemana(d.fecha)] ?? '';
  return (
    <button type="button" className="termo-dia-boton" onClick={alTocar}>
    <figure
      className={`termo-dia ${esHoy ? 'termo-dia-hoy' : ''}`}
      aria-label={`${nombre} ${fechaUTC(d.fecha).getUTCDate()}: ${corta(d.totalMl)} de ${corta(metaDia)}${lleno ? ', meta cumplida' : ''}.`}
    >
      <svg viewBox="0 0 40 124" className="termo-dia-dibujo" aria-hidden>
        <defs>
          <clipPath id={`cuerpo-${d.fecha}`}>
            <path d="M6 26 h28 v88 q0 6 -6 6 h-16 q-6 0 -6 -6 z" />
          </clipPath>
        </defs>
        <rect x="8" y="6" width="24" height="16" rx="3" className="termo-dia-tapa" />
        <g clipPath={`url(#cuerpo-${d.fecha})`}>
          <motion.g
            initial={reducido ? false : { y: 120 }}
            animate={{ y: 26 + alto * (1 - fraccion) }}
            transition={{ ...transicion('sorbo', reducido), delay: reducido ? 0 : indice * 0.05 }}
          >
            <path d={OLA_TERMO} transform="translate(6 -4)" className="termo-dia-agua" />
          </motion.g>
        </g>
        <path d="M6 26 h28 v88 q0 6 -6 6 h-16 q-6 0 -6 -6 z" className="termo-dia-contorno" />
      </svg>
      <figcaption>
        <span className="termo-dia-letra">{INICIALES[diaSemana(d.fecha)]}</span>
        <span className="termo-dia-ml cifras">{corta(d.totalMl)}</span>
      </figcaption>
    </figure>
    </button>
  );
}

function RitmoDelDia({ porHora }: { porHora: readonly number[] }) {
  const max = Math.max(...porHora, 1);
  // Cinco niveles netos de agua, sin degradados.
  const nivel = (ml: number) => (ml <= 0 ? 0 : Math.ceil((ml / max) * 4) / 4);
  return (
    <div className="ritmo" role="img" aria-label="Cuánto bebes en cada hora del día, de medianoche a medianoche.">
      <div className="ritmo-horas">
        {porHora.map((ml, h) => (
          <span key={h} className="ritmo-hora" style={{ opacity: 0.12 + nivel(ml) * 0.88 }} />
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
  );
}

export function Semana() {
  const perfil = useApp((s) => s.perfil);
  const hoyMl = useApp((s) => s.hoyMl);
  const desfase = perfil?.desfaseMin ?? -300;
  const hoy = claveDia(Date.now(), desfase);
  const meta = perfil ? calcularMeta(perfil, { temperaturaC: 25 }).totalMl : 2400;
  const [dias, setDias] = useState<readonly ResumenDia[] | null>(null);
  const [atras, setAtras] = useState(0);
  const [detalle, setDetalle] = useState<ResumenDia | null>(null);

  useEffect(() => {
    const desde = sumarDias(hoy, -(SEMANAS * 7 - 1));
    void app.cargarDias(desde, hoy).then((d) => setDias(rellenarDias(desde, hoy, d)));
  }, [hoy, hoyMl]);

  if (!dias) {
    return (
      <section className="seccion">
        <h1 className="titulo-pantalla">Tu semana</h1>
        <p className="texto-suave">Buscando tus últimos días…</p>
      </section>
    );
  }

  const fin = dias.length - atras * 7;
  const semana = dias.slice(fin - 7, fin);
  const habitos = calcularHabitos(dias, meta, esFinde);
  const primero = semana[0]?.fecha ?? hoy;
  const ultimo = semana.at(-1)?.fecha ?? hoy;

  return (
    <section className="seccion seccion-semana" aria-labelledby="titulo-semana">
      <header className="semana-cabecera">
        <div>
          <h1 id="titulo-semana" className="titulo-pantalla">
            {atras === 0 ? 'Tu semana' : `Hace ${atras} ${atras === 1 ? 'semana' : 'semanas'}`}
          </h1>
          <p className="texto-suave">{rango(primero, ultimo)}</p>
        </div>
        <div className="semana-nav">
          <button type="button" className="semana-flecha" aria-label="Semana anterior" disabled={atras >= SEMANAS - 1} onClick={() => setAtras(atras + 1)}>
            ‹
          </button>
          <button type="button" className="semana-flecha" aria-label="Semana siguiente" disabled={atras === 0} onClick={() => setAtras(atras - 1)}>
            ›
          </button>
        </div>
      </header>

      <div className="siete-termos">
        {semana.map((d, i) => (
          <TermoDelDia key={`${atras}-${d.fecha}`} d={d} meta={meta} esHoy={d.fecha === hoy} indice={i} alTocar={() => setDetalle(d)} />
        ))}
      </div>

      <p className="texto-suave semana-pista">Toca un día para ver su detalle.</p>
      {detalle && <DetalleDia dia={detalle} meta={meta} alCerrar={() => setDetalle(null)} />}

      <article className="tarjeta-info">
        <h2>Cómo bebes</h2>
        <p className="texto-suave">Tus últimas cuatro semanas, hora por hora.</p>
        <RitmoDelDia porHora={habitos.porHora} />
        <ul className="habitos">
          {habitos.frases.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </article>
    </section>
  );
}
