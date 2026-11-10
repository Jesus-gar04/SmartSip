/**
 * La app ya emparejada: menú (barra lateral en escritorio, barra inferior en
 * el celular) y sus secciones. Hoy es la pantalla que se reconoce a tres
 * metros: el agua sube por la pantalla con cada sorbo (manual, "La app").
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { calcularMeta, cantidad, fraseDelDia, saludo, type RegistroEvento } from 'smartsip-core';
import { Boton } from '../ui/controles.tsx';
import { IconoGota, IconoTermo, IconoTermometro } from '../ui/iconos.tsx';
import { hora } from '../util/formato.ts';
import { transicion, useMovimientoReducido } from '../util/movimiento.ts';
import { app, useApp, useGrados, type Seccion } from './estado.ts';
import { useClimaHoy } from './PrimerUso.tsx';
import { Semana } from './Semana.tsx';
import { Ajustes } from './Ajustes.tsx';
import { AvisoEnApp } from './AvisoEnApp.tsx';
import { DatoBreve, IconoSol, Termo } from './Secciones.tsx';

const OLA = 'M0 18 C 60 6, 140 6, 200 18 S 340 30, 400 18 S 540 6, 600 18 S 740 30, 800 18 V 60 H 0 Z';

const trazo = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const IconoSemana = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden {...trazo}>
    <rect x="3.5" y="9" width="4" height="11.5" rx="1.5" />
    <rect x="10" y="4" width="4" height="16.5" rx="1.5" />
    <rect x="16.5" y="12" width="4" height="8.5" rx="1.5" />
  </svg>
);
const IconoAjustes = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden {...trazo}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </svg>
);

const SECCIONES: ReadonlyArray<{ id: Seccion; nombre: string; icono: ReactNode }> = [
  { id: 'hoy', nombre: 'Hoy', icono: <IconoGota /> },
  { id: 'semana', nombre: 'Semana', icono: <IconoSemana /> },
  { id: 'termo', nombre: 'Termo', icono: <IconoTermo /> },
  { id: 'ajustes', nombre: 'Ajustes', icono: <IconoAjustes /> },
];

function Menu() {
  const seccion = useApp((s) => s.seccion);
  const perfil = useApp((s) => s.perfil);
  const usuario = useApp((s) => s.usuario);
  return (
    <nav className="menu" aria-label="Secciones de SmartSip">
      <div className="menu-logo">
        <img className="logo logo-dia" src="/marca/smartsip-logo-horizontal-tinta.svg" alt="SmartSip" />
        <img className="logo logo-noche" src="/marca/smartsip-logo-horizontal-blanco.svg" alt="SmartSip" />
      </div>
      <ul className="menu-lista">
        {SECCIONES.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              className="menu-item"
              aria-current={seccion === s.id ? 'page' : undefined}
              onClick={() => app.irA_seccion(s.id)}
            >
              <span className="menu-icono">{s.icono}</span>
              <span className="menu-nombre">{s.nombre}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="menu-persona">
        {perfil?.nombre ?? 'Tu cuenta'}
        <span>{usuario?.anonimo ? 'Sin cuenta por ahora' : usuario?.email}</span>
      </p>
    </nav>
  );
}

// ─── Hoy ────────────────────────────────────────────────────────────────────

function useBurbujasAlBeber(sorbos: number): number {
  const [clave, setClave] = useState(0);
  const antes = useRef(sorbos);
  useEffect(() => {
    if (sorbos > antes.current) setClave((c) => c + 1);
    antes.current = sorbos;
  }, [sorbos]);
  return clave;
}

function PreguntaDescenso({ registro }: { registro: RegistroEvento }) {
  const [enviando, setEnviando] = useState(false);
  const responder = async (d: 'bebido' | 'vaciado') => {
    setEnviando(true);
    await app.resolver(registro, d).catch(() => undefined);
    setEnviando(false);
  };
  return (
    <section className="tarjeta-pregunta" aria-labelledby={`p-${registro.clave}`}>
      <h2 id={`p-${registro.clave}`}>¿Lo bebiste o lo vaciaste?</h2>
      <p>
        A las {hora(registro.enMs)} el termo bajó {cantidad(registro.ml)} de una vez. Si te lo tomaste, lo sumamos a tu día.
      </p>
      <div className="fila">
        <Boton principal disabled={enviando} onClick={() => void responder('bebido')}>
          Me lo tomé
        </Boton>
        <Boton disabled={enviando} onClick={() => void responder('vaciado')}>
          Lo vacié
        </Boton>
      </div>
    </section>
  );
}

function Hoy() {
  const perfil = useApp((s) => s.perfil);
  const hoyMl = useApp((s) => s.hoyMl);
  const hoySorbos = useApp((s) => s.hoySorbos);
  const enlace = useApp((s) => s.enlace);
  const temperaturaC = useApp((s) => s.temperaturaC);
  const pendiente = useApp((s) => s.pendientes[0]);
  const reducido = useMovimientoReducido();
  const clima = useClimaHoy();
  const metaMl = perfil ? calcularMeta(perfil, { temperaturaC: clima ?? 25 }).totalMl : 2400;
  const ahora = new Date();
  const frase = fraseDelDia(hoyMl, metaMl, ahora.getHours() + ahora.getMinutes() / 60);
  const fraccion = Math.min(1, hoyMl / metaMl);
  const burbujas = useBurbujasAlBeber(hoySorbos);
  const cifraArriba = fraccion < 0.22; // si el agua aún no la alcanza, flota encima en tinta
  const grados = useGrados();
  const recordatorio = perfil?.recordatorio;
  const hoyListo = useApp((s) => s.hoyListo);
  const primeraVez = useRef(true);

  // El termo decide los recordatorios con esto, aunque la app se cierre.
  // La primera vez, enseguida; después, con una pausa para no escribir con cada sorbo.
  useEffect(() => {
    if (!hoyListo) return;
    app.publicarRitmo(metaMl, primeraVez.current);
    primeraVez.current = false;
  }, [metaMl, hoyMl, recordatorio, hoyListo]);

  return (
    <section className="hoy" style={{ ['--llenado' as string]: fraccion }} aria-label="Hoy">
      <header className="hoy-cabecera">
        <span className="sello">
          {enlace === 'conectado' ? 'Termo cerca' : 'Termo lejos'}
          {enlace === 'conectado' && temperaturaC !== null && ` · ${grados(temperaturaC)}`}
        </span>
      </header>
      <div className="hoy-papel">
        <p className="saludo">{saludo(ahora.getHours(), perfil?.nombre ?? null)}.</p>
        <h1 className="pregunta">
          {frase.antes}
          <span className="palabra-azul">{frase.azul}</span>
          {frase.despues}
        </h1>
        <div className="hoy-datos">
          <DatoBreve icono={<IconoGota />} valor={String(hoySorbos)} nombre={hoySorbos === 1 ? 'sorbo hoy' : 'sorbos hoy'} />
          <DatoBreve icono={<IconoTermometro />} valor={temperaturaC !== null ? grados(temperaturaC) : '—'} nombre="tu agua ahora" />
          <DatoBreve icono={<IconoSol />} valor={clima !== null ? grados(clima) : '—'} nombre="máxima afuera" />
        </div>
        {pendiente && <PreguntaDescenso key={pendiente.clave} registro={pendiente} />}
      </div>

      <div className={`hoy-agua ${reducido ? 'agua-quieta' : ''}`}>
        <svg className="ola ola-atras" viewBox="0 0 800 60" preserveAspectRatio="none" aria-hidden>
          <path d={OLA} />
        </svg>
        <svg className="ola ola-frente" viewBox="0 0 800 60" preserveAspectRatio="none" aria-hidden>
          <path d={OLA} />
        </svg>
        <div className={`hoy-cifra ${cifraArriba ? 'hoy-cifra-arriba' : ''}`} aria-live="polite">
          <motion.span
            key={hoyMl}
            className="meta-cifra cifras"
            initial={reducido ? false : { y: -10, opacity: 0.4 }}
            animate={{ y: [null, 2, 0], opacity: 1 }}
            transition={transicion('sorbo', reducido)}
          >
            {cantidad(hoyMl)}
          </motion.span>
          <span className="hoy-de cifras">de {cantidad(metaMl)}</span>
          <span className="meta-explica">{frase.consejo}</span>
          {frase.cumplida && <span className="firma firma-sobre-agua">Hidrataste lo de hoy.</span>}
        </div>
        <AnimatePresence>
          {!reducido &&
            burbujas > 0 &&
            [0, 1, 2].map((i) => (
              <motion.span
                key={`${burbujas}-${i}`}
                className="burbuja"
                style={{ left: `${30 + i * 18}%`, width: 8 + i * 4, height: 8 + i * 4 }}
                initial={{ y: 0, opacity: 0 }}
                animate={{ y: -160, opacity: [0, 1, 1, 0] }}
                transition={{ duration: 1.2, delay: i * 0.12 }}
              />
            ))}
        </AnimatePresence>
      </div>
    </section>
  );
}

export function Principal() {
  const seccion = useApp((s) => s.seccion);
  const reducido = useMovimientoReducido();
  return (
    <div className="principal">
      <Menu />
      <AvisoEnApp />
      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={seccion}
          className="principal-contenido"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transicion('transicion', reducido)}
        >
          {seccion === 'hoy' && <Hoy />}
          {seccion === 'semana' && <Semana />}
          {seccion === 'termo' && <Termo />}
          {seccion === 'ajustes' && <Ajustes />}
        </motion.main>
      </AnimatePresence>
    </div>
  );
}
