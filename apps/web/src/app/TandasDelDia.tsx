/**
 * El día termo a termo: cada llenado abre una tanda, y en ella se ve cuánto
 * bajó el agua (un termo pequeño), cuándo tomaste (gotas sobre una pista,
 * más grandes cuanto más tomaste) y, si quieres, sorbo por sorbo.
 */
import { motion } from 'framer-motion';
import { agruparEnTandas, cantidad, duracionCorta, formatoTemperatura, type Franja, type RegistroEvento, type Tanda } from 'smartsip-core';
import { hora } from '../util/formato.ts';
import { useMovimientoReducido } from '../util/movimiento.ts';
import { useApp } from './estado.ts';

const CAPACIDAD = 393;
const FRANJAS: ReadonlyArray<{ id: Franja; nombre: string }> = [
  { id: 'madrugada', nombre: 'Madrugada' },
  { id: 'mañana', nombre: 'Mañana' },
  { id: 'tarde', nombre: 'Tarde' },
  { id: 'noche', nombre: 'Noche' },
];

/** En la unidad del perfil. Se lee al pintar: cambiar la unidad vuelve a pintar la sección. */
const grados = (c: number) => formatoTemperatura(c, useApp.getState().perfil?.unidad ?? 'C');
const cifraGrados = (c: number) => grados(c).replace(/\s.*/, '');

function MiniTermo({ inicial, final }: { inicial: number; final: number }) {
  const cap = Math.max(CAPACIDAD, inicial);
  const alto = 44; // de y=10 a y=54
  const yDe = (ml: number) => 54 - (Math.max(0, ml) / cap) * alto;
  return (
    <svg viewBox="0 0 28 58" className="mini-termo" aria-hidden>
      <defs>
        <clipPath id={`mt-${inicial}-${final}`}>
          <rect x="4" y="10" width="20" height="46" rx="5" />
        </clipPath>
      </defs>
      <rect x="7" y="2" width="14" height="6" rx="2" className="mini-termo-tapa" />
      <g clipPath={`url(#mt-${inicial}-${final})`}>
        <rect x="4" y={yDe(inicial)} width="20" height={yDe(final) - yDe(inicial)} className="mini-termo-tomado" />
        <rect x="4" y={yDe(final)} width="20" height={60} className="mini-termo-agua" />
      </g>
      <rect x="4" y="10" width="20" height="46" rx="5" className="mini-termo-borde" />
    </svg>
  );
}

function radioGota(e: RegistroEvento): number {
  if (e.tipo === 'descensoGrande') return 9;
  return 3.5 + Math.min(1, e.ml / 150) * 4.5;
}

function Pista({ t }: { t: Tanda }) {
  const reducido = useMovimientoReducido();
  const largo = Math.max(1, t.finMs - t.inicioMs);
  const unico = t.movimientos.length === 1 && !t.llenado;
  return (
    <div className="pista">
      <div className="pista-linea" aria-hidden>
        {t.llenado && <span className="pista-llenado" style={{ left: '0%' }} />}
        {t.movimientos.map((m, i) => {
          // Con llenado, la marca ocupa el inicio y las gotas arrancan un poco después.
          const desde = t.llenado ? 7 : 0;
          const pos = unico ? 50 : desde + ((m.enMs - t.inicioMs) / largo) * (100 - desde);
          const r = radioGota(m);
          const clase =
            m.tipo === 'sorbo' ? 'pista-gota' : m.estado === 'vaciado' ? 'pista-gota pista-vaciado' : 'pista-gota pista-trago';
          return (
            <motion.span
              key={m.clave}
              className={clase}
              style={{ left: `${pos}%`, width: r * 2, height: r * 2 }}
              initial={reducido ? false : { scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: reducido ? 0 : 0.15 + i * 0.03, type: 'spring', duration: 0.4, bounce: 0.2 }}
            />
          );
        })}
      </div>
      <div className="pista-horas cifras" aria-hidden>
        <span>{hora(t.inicioMs)}</span>
        {t.finMs > t.inicioMs && <span>{hora(t.finMs)}</span>}
      </div>
    </div>
  );
}

function lineaMovimiento(m: RegistroEvento): { que: string; temp: string } {
  const temp = m.temperaturaC !== null ? grados(m.temperaturaC) : '';
  if (m.tipo === 'sorbo') return { que: `Sorbo de ${cantidad(m.ml)}`, temp };
  if (m.estado === 'vaciado') return { que: `Vaciaste ${cantidad(m.ml)}`, temp: '' };
  if (m.estado === 'bebido') return { que: `${cantidad(m.ml)} de una vez`, temp };
  return { que: `Bajaron ${cantidad(m.ml)}, sin responder`, temp: '' };
}

function TarjetaTanda({ t }: { t: Tanda }) {
  const temp =
    t.tempMinC === null || t.tempMaxC === null
      ? null
      : Math.round(t.tempMinC) === Math.round(t.tempMaxC)
        ? `Agua a ${grados(t.tempMinC)}`
        : `Agua entre ${cifraGrados(t.tempMinC)} y ${grados(t.tempMaxC)}`;
  const duracion = t.finMs > t.inicioMs ? `, en ${duracionCorta(t.finMs - t.inicioMs)}` : '';
  const vecesTomaste = t.sorbos === 1 ? '1 sorbo' : `${t.sorbos} sorbos`;
  const pendientes = t.movimientos.filter((m) => m.tipo === 'descensoGrande' && m.estado !== 'bebido' && m.estado !== 'vaciado');

  return (
    <li className="tanda">
      <MiniTermo inicial={t.nivelInicialMl} final={t.nivelFinalMl} />
      <div className="tanda-cuerpo">
        <p className="tanda-titulo">
          <time className="cifras">{hora(t.inicioMs)}</time>
          <span>{t.llenado ? `Llenaste el termo con ${cantidad(t.llenado.ml)}` : `Seguiste con el agua de antes`}</span>
        </p>
        <p className="tanda-resumen">
          {t.bebidoMl > 0 ? (
            <>
              Tomaste <strong className="cifras">{cantidad(t.bebidoMl)}</strong>
              {t.sorbos > 0 && ` en ${vecesTomaste}`}
              {duracion}.
            </>
          ) : (
            'De esta agua no tomaste.'
          )}
          {t.vaciadoMl > 0 && ` Vaciaste ${cantidad(t.vaciadoMl)}.`}
          {pendientes.length > 0 && ` ${pendientes.length === 1 ? 'Queda una bajada' : `Quedan ${pendientes.length} bajadas`} por responder.`}
        </p>
        {temp && <span className="tanda-temp">{temp}</span>}
        {t.movimientos.length > 0 && <Pista t={t} />}
        {t.movimientos.length > 1 && (
          <details className="tanda-detalle">
            <summary>Ver sorbo por sorbo</summary>
            <ul className="tanda-sorbos">
              {t.movimientos.map((m) => {
                const l = lineaMovimiento(m);
                return (
                  <li key={m.clave}>
                    <time className="cifras">{hora(m.enMs)}</time>
                    <span>{l.que}</span>
                    <span className="cifras">{l.temp}</span>
                  </li>
                );
              })}
            </ul>
          </details>
        )}
      </div>
    </li>
  );
}

export function TandasDelDia({ eventos }: { eventos: readonly RegistroEvento[] }) {
  const tandas = agruparEnTandas(eventos);
  return (
    <div className="dia-franjas">
      {FRANJAS.map((f) => {
        const deFranja = tandas.filter((t) => t.franja === f.id);
        if (deFranja.length === 0) return null;
        const total = deFranja.reduce((s, t) => s + t.bebidoMl, 0);
        return (
          <section key={f.id} className="dia-franja" aria-label={`${f.nombre}: tomaste ${cantidad(total)}`}>
            <header className="dia-franja-cabecera">
              <span className="dia-franja-nombre">{f.nombre}</span>
              <span className="dia-franja-total cifras">{total > 0 ? cantidad(total) : '—'}</span>
            </header>
            <ol className="tandas">
              {deFranja.map((t) => (
                <TarjetaTanda key={t.llenado?.clave ?? t.movimientos[0]?.clave ?? t.inicioMs} t={t} />
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
