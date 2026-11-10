/**
 * Primer uso (U1). Un recorrido con principio y fin, contado por el termo:
 * en la bienvenida está a medias, al calcular tu meta se llena hasta ella, al
 * conectarlo su pantalla muestra el código y al terminar queda lleno.
 *
 * Cada pantalla es una "escena": papel con una sola intención y una sola
 * acción principal; el agua con el termo (abajo en el celular, a la derecha en
 * el escritorio). Voz: docs/voz.md.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';
import {
  calcularMeta,
  formatoCodigo,
  formatoLitros,
  type Actividad,
  type Emparejamiento,
} from 'smartsip-core';
import { obtenerClima } from '../clima/clima-local.ts';
import { InvitacionInstalar } from '../pwa/InvitacionInstalar.tsx';
import { Boton, Deslizador } from '../ui/controles.tsx';
import { IconoGota, IconoReloj } from '../ui/iconos.tsx';
import { Funcion, Pasos, TermoDibujo } from '../ui/TermoDibujo.tsx';
import { transicion, useMovimientoReducido } from '../util/movimiento.ts';
import { app, useApp } from './estado.ts';

const OLA = 'M0 18 C 60 6, 140 6, 200 18 S 340 30, 400 18 S 540 6, 600 18 S 740 30, 800 18 V 60 H 0 Z';
const PASOS = ['Tus datos', 'Tu termo', 'Listo'] as const;

const trazo = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const Icono = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden {...trazo}>
    {children}
  </svg>
);
const IconoCampana = () => (
  <Icono>
    <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </Icono>
);
const IconoBarras = () => (
  <Icono>
    <path d="M5 20V12M10 20V6M15 20v-9M20 20V9" />
  </Icono>
);
const IconoCorreo = () => (
  <Icono>
    <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
    <path d="m4 7 8 6 8-6" />
  </Icono>
);
const IconoCandado = () => (
  <Icono>
    <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
    <path d="M8 10.5V8a4 4 0 1 1 8 0v2.5" />
  </Icono>
);
const IconoSilla = () => (
  <Icono>
    <path d="M7 3v9h10M7 12v9M17 12v9M7 16h10" />
  </Icono>
);
const IconoCaminar = () => (
  <Icono>
    <circle cx="13" cy="4.5" r="1.8" />
    <path d="m9 21 3-6 2 3v3M10 9l3-2 3 4 3 1M13 7l-1 6" />
  </Icono>
);
const IconoCorrer = () => (
  <Icono>
    <circle cx="15" cy="4.5" r="1.8" />
    <path d="m6 20 4-4 3 2 1-5 4 2M8 10l4-3 3 1-2 5M18 13l2-1" />
  </Icono>
);

// ─── La escena ──────────────────────────────────────────────────────────────

function Escena({
  children,
  termo,
  agua,
  notificaciones = false,
}: {
  children: ReactNode;
  termo: { nivel: number; pantalla?: ReactNode; etiqueta?: string };
  agua?: ReactNode;
  /** En escritorio, dos avisos reales de la app flotan sobre el agua (como en el flyer). */
  notificaciones?: boolean;
}) {
  const reducido = useMovimientoReducido();
  return (
    <div className="escena">
      <motion.main
        className="escena-papel"
        initial={{ opacity: 0, y: reducido ? 0 : 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transicion('transicion', reducido)}
      >
        <div className="escena-logo">
          <img className="logo logo-dia" src="/marca/smartsip-logo-horizontal-tinta.svg" alt="SmartSip" />
          <img className="logo logo-noche" src="/marca/smartsip-logo-horizontal-blanco.svg" alt="SmartSip" />
        </div>
        {children}
      </motion.main>
      <aside className={`escena-agua ${reducido ? 'agua-quieta' : ''}`}>
        <svg className="ola ola-atras" viewBox="0 0 800 60" preserveAspectRatio="none" aria-hidden>
          <path d={OLA} />
        </svg>
        <svg className="ola ola-frente" viewBox="0 0 800 60" preserveAspectRatio="none" aria-hidden>
          <path d={OLA} />
        </svg>
        {notificaciones && (
          <div className="notificaciones" aria-hidden>
            <div className="notificacion">
              <span className="notificacion-icono">
                <IconoGota />
              </span>
              <div>
                <p className="notificacion-titulo">Llevas 2 horas sin tomar agua</p>
                <p className="notificacion-texto">Un sorbo ahora y llegas a tu meta.</p>
              </div>
            </div>
            <div className="notificacion">
              <span className="notificacion-icono">
                <IconoGota />
              </span>
              <div>
                <p className="notificacion-titulo">Vas a buen ritmo</p>
                <p className="notificacion-texto">Llevas 1,4 L de 2,6 L a media tarde.</p>
              </div>
            </div>
          </div>
        )}
        <div className="escena-termo">
          <TermoDibujo nivel={termo.nivel} pantalla={termo.pantalla} sobreAgua {...(termo.etiqueta ? { etiqueta: termo.etiqueta } : {})} />
        </div>
        {agua && <div className="escena-agua-texto">{agua}</div>}
      </aside>
    </div>
  );
}

/** Marco simple (carga y errores): reutiliza la escena con el termo a medias. */
export function Marco({ children }: { children: ReactNode }) {
  return <Escena termo={{ nivel: 0.4 }}>{children}</Escena>;
}

function ErrorApp() {
  const error = useApp((s) => s.error);
  return (
    <AnimatePresence>
      {error && (
        <motion.p className="aviso-app" role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          {error}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

// ─── Bienvenida ─────────────────────────────────────────────────────────────

export function Bienvenida() {
  const [empezando, setEmpezando] = useState(false);
  return (
    <Escena
      termo={{ nivel: 0.45, etiqueta: 'Un termo SmartSip a medio llenar' }}
      notificaciones
      agua={<p className="escena-promesa">Mide lo que tomas y te avisa antes de que llegue la sed.</p>}
    >
      <h1 className="pregunta">
        ¿Cuánta <span className="palabra-azul">agua</span> tomaste hoy?
      </h1>
      <p className="firma">SmartSip sí lo sabe.</p>
      <div className="funciones">
        <Funcion icono={<IconoGota />} nombre="Cuenta cada sorbo" texto="El termo registra lo que tomas, sin que anotes nada." />
        <Funcion icono={<IconoCampana />} nombre="Te avisa a tiempo" texto="Solo cuando vas atrasado frente a tu propio ritmo." />
        <Funcion icono={<IconoBarras />} nombre="Conoce tu ritmo" texto="Tu semana y tus hábitos, explicados en palabras." />
      </div>
      <ErrorApp />
      <div className="escena-acciones">
        <Boton
          principal
          disabled={empezando}
          onClick={async () => {
            setEmpezando(true);
            await app.empezar();
            setEmpezando(false);
          }}
        >
          {empezando ? 'Preparando todo…' : 'Empezar'}
        </Boton>
        <button type="button" className="enlace" onClick={() => app.irA('entrar')}>
          Ya tengo cuenta
        </button>
      </div>
      <InvitacionInstalar />
    </Escena>
  );
}

// ─── Entrar con correo ──────────────────────────────────────────────────────

function Campo({
  etiqueta,
  icono,
  tipo,
  valor,
  alCambiar,
  autocompletar,
  extra,
}: {
  etiqueta: string;
  icono: ReactNode;
  tipo: string;
  valor: string;
  alCambiar: (v: string) => void;
  autocompletar: string;
  extra?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      <div className="campo-caja">
        <span className="campo-icono">{icono}</span>
        <input id={id} type={tipo} value={valor} autoComplete={autocompletar} onChange={(e) => alCambiar(e.target.value)} required />
        {extra}
      </div>
    </div>
  );
}

export function Entrar() {
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const reducido = useMovimientoReducido();
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    await app.entrar(correo, clave);
    setEnviando(false);
  };
  // El formulario es el centro; detrás, detalles tenues que no compiten.
  return (
    <div className={`acceso ${reducido ? 'agua-quieta' : ''}`}>
      <div className="acceso-fondo" aria-hidden>
        <div className="acceso-termo acceso-termo-izq">
          <TermoDibujo nivel={0.55} />
        </div>
        <div className="acceso-termo acceso-termo-der">
          <TermoDibujo nivel={0.8} />
        </div>
        <div className="acceso-aviso acceso-aviso-izq">
          <span className="notificacion-icono">
            <IconoGota />
          </span>
          <div>
            <p className="notificacion-titulo">Vas a buen ritmo</p>
            <p className="notificacion-texto">Llevas 1,4 L de 2,6 L.</p>
          </div>
        </div>
        <div className="acceso-aviso acceso-aviso-der">
          <span className="notificacion-icono">
            <IconoGota />
          </span>
          <div>
            <p className="notificacion-titulo">Llevas 2 horas sin tomar agua</p>
            <p className="notificacion-texto">Un sorbo ahora y llegas a tu meta.</p>
          </div>
        </div>
        <div className="acceso-agua">
          <svg className="ola ola-atras" viewBox="0 0 800 60" preserveAspectRatio="none">
            <path d={OLA} />
          </svg>
          <svg className="ola ola-frente" viewBox="0 0 800 60" preserveAspectRatio="none">
            <path d={OLA} />
          </svg>
        </div>
      </div>

      <motion.main
        className="acceso-tarjeta"
        initial={{ opacity: 0, y: reducido ? 0 : 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transicion('transicion', reducido)}
      >
        <img className="logo logo-dia acceso-logo" src="/marca/smartsip-logo-vertical-tinta.svg" alt="SmartSip" />
        <img className="logo logo-noche acceso-logo" src="/marca/smartsip-logo-vertical-blanco.svg" alt="SmartSip" />
        <h1 className="pregunta pregunta-media">
          Qué bueno verte de <span className="palabra-azul">nuevo</span>.
        </h1>
        <p className="firma">Tu agua te estaba esperando.</p>
        <form className="formulario" onSubmit={(e) => void enviar(e)}>
          <Campo etiqueta="Correo" icono={<IconoCorreo />} tipo="email" valor={correo} alCambiar={setCorreo} autocompletar="email" />
          <Campo
            etiqueta="Contraseña"
            icono={<IconoCandado />}
            tipo={verClave ? 'text' : 'password'}
            valor={clave}
            alCambiar={setClave}
            autocompletar="current-password"
            extra={
              <button type="button" className="campo-ver" onClick={() => setVerClave(!verClave)} aria-pressed={verClave}>
                {verClave ? 'Ocultar' : 'Mostrar'}
              </button>
            }
          />
          <ErrorApp />
          <Boton principal type="submit" disabled={enviando || !correo || !clave}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </Boton>
        </form>
        <button type="button" className="enlace" onClick={() => app.irA('bienvenida')}>
          Volver al inicio
        </button>
      </motion.main>
    </div>
  );
}

// ─── Perfil ─────────────────────────────────────────────────────────────────

const ACTIVIDADES: ReadonlyArray<{ id: Actividad; nombre: string; texto: string; icono: ReactNode }> = [
  { id: 'baja', nombre: 'Tranquila', texto: 'Casi todo el día frente a un escritorio.', icono: <IconoSilla /> },
  { id: 'media', nombre: 'Movida', texto: 'Caminas o te mueves buena parte del día.', icono: <IconoCaminar /> },
  { id: 'alta', nombre: 'Intensa', texto: 'Entrenas o haces trabajo físico casi a diario.', icono: <IconoCorrer /> },
];

export function useClimaHoy(): number | null {
  const [c, setC] = useState<number | null>(null);
  useEffect(() => {
    obtenerClima('predeterminado').then(
      (r) => setC(r.clima.maximaHoyC ?? r.clima.temperaturaC),
      () => setC(null),
    );
  }, []);
  return c;
}

export function PerfilInicial() {
  const actual = useApp((s) => s.perfil);
  const editando = Boolean(actual?.termoId);
  const [nombre, setNombre] = useState(actual?.nombre ?? '');
  const [pesoKg, setPeso] = useState(actual?.pesoKg ?? 65);
  const [actividad, setActividad] = useState<Actividad>(actual?.actividad ?? 'media');
  const [guardando, setGuardando] = useState(false);
  const clima = useClimaHoy();
  const meta = calcularMeta({ pesoKg, actividad }, { temperaturaC: clima ?? 25 });
  // El termo se llena hasta tu meta: 1,5 L se ve a un tercio, 4 L lleno.
  const nivel = 0.2 + ((meta.totalMl - 1500) / 2500) * 0.8;

  return (
    <Escena
      termo={{ nivel, pantalla: formatoLitros(meta.totalMl), etiqueta: `Tu meta de hoy: ${formatoLitros(meta.totalMl)}` }}
      agua={
        <div className="escena-meta" aria-live="polite">
          <span className="sello sello-suelto sello-sobre-agua">Hoy te conviene tomar</span>
          <span className="meta-cifra cifras">{formatoLitros(meta.totalMl)}</span>
          <span className="meta-explica">
            {clima !== null
              ? `Lo calculamos con tu peso, tu rutina y los ${Math.round(clima)} °C que se esperan hoy.`
              : 'Lo calculamos con tu peso y tu rutina.'}
          </span>
        </div>
      }
    >
      {!editando && <Pasos actual={1} total={3} nombres={PASOS} />}
      <h1 className="titulo-pantalla">{editando ? 'Tus datos' : 'Antes de empezar, cuéntanos un poco de ti'}</h1>
      <p className="texto-suave">Con tu peso y tu rutina calculamos cuánta agua te conviene tomar cada día.</p>
      <form
        className="formulario"
        onSubmit={async (e) => {
          e.preventDefault();
          setGuardando(true);
          await app.guardarPerfil({ nombre, pesoKg, actividad });
          setGuardando(false);
        }}
      >
        <div className="campo">
          <label htmlFor="nombre">¿Cómo te llamamos?</label>
          <div className="campo-caja">
            <input id="nombre" value={nombre} maxLength={60} placeholder="Tu nombre (opcional)" autoComplete="given-name" onChange={(e) => setNombre(e.target.value)} />
          </div>
        </div>
        <div className="campo-peso">
          <Deslizador etiqueta="Tu peso" valor={pesoKg} min={35} max={150} unidad="kg" alCambiar={setPeso} />
        </div>
        <fieldset className="actividades">
          <legend className="campo-etiqueta">¿Cómo es tu día?</legend>
          {ACTIVIDADES.map((a) => (
            <label key={a.id} className={`actividad ${actividad === a.id ? 'actividad-elegida' : ''}`}>
              <input type="radio" name="actividad" value={a.id} checked={actividad === a.id} onChange={() => setActividad(a.id)} />
              <span className="actividad-icono">{a.icono}</span>
              <span className="actividad-nombre">{a.nombre}</span>
              <span className="actividad-texto">{a.texto}</span>
            </label>
          ))}
        </fieldset>
        <ErrorApp />
        <Boton principal type="submit" disabled={guardando}>
          {guardando ? 'Guardando…' : editando ? 'Guardar' : 'Continuar'}
        </Boton>
        {editando && (
          <button type="button" className="enlace" onClick={() => useApp.setState({ fase: 'hoy' })}>
            Volver sin cambios
          </button>
        )}
      </form>
    </Escena>
  );
}

// ─── Conecta tu termo ───────────────────────────────────────────────────────

function useCuentaAtras(hastaMs: number | null): number {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (hastaMs === null) return undefined;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [hastaMs]);
  return hastaMs === null ? 0 : Math.max(0, hastaMs - ahora);
}

export function Emparejar() {
  const [e, setE] = useState<Emparejamiento | null>(null);
  const [listo, setListo] = useState(false);
  const restante = useCuentaAtras(e?.expiraEnMs ?? null);
  const vencido = e !== null && restante === 0 && !listo;

  const pedir = async () => {
    setE(await app.pedirCodigo());
  };

  useEffect(() => {
    void pedir();
  }, []);

  useEffect(() => {
    if (!e || e.estado !== 'esperando') return undefined;
    return app.escucharCodigo(e.codigo, (x) => {
      if (x?.estado === 'emparejado') {
        setListo(true);
        // Un momento para ver el termo lleno antes de pasar a Hoy.
        setTimeout(() => void app.completarEmparejamiento(x), 1600);
      }
    });
  }, [e]);

  const minutos = Math.floor(restante / 60_000);
  const segundos = String(Math.floor((restante % 60_000) / 1000)).padStart(2, '0');
  const digitos = e?.codigo.split('') ?? [];

  return (
    <Escena
      termo={{
        nivel: listo ? 1 : 0.2,
        pantalla: listo ? '✓' : e ? formatoCodigo(e.codigo) : '···',
        etiqueta: listo ? 'Tu termo, conectado' : 'Tu termo, esperando el código',
      }}
      agua={
        <p className="escena-promesa">
          {listo ? 'Tu termo ya está conectado. Cada sorbo llegará a tu teléfono.' : 'El código es la única forma de unir el termo a tu cuenta.'}
        </p>
      }
    >
      <Pasos actual={listo ? 3 : 2} total={3} nombres={PASOS} />
      <h1 className="titulo-pantalla">{listo ? 'Listo, ya están conectados' : 'Conecta tu termo'}</h1>
      {!listo && (
        <>
          <p className="texto-suave">Enciende tu SmartSip, tenlo a la mano y escribe en él este código.</p>
          <div className={`codigo-cajas ${vencido ? 'codigo-cajas-vencido' : ''}`} aria-label={e ? `Código ${digitos.join(' ')}` : 'Preparando tu código'}>
            {(digitos.length ? digitos : Array.from({ length: 6 }, () => '')).map((d, i) => (
              <motion.span
                key={`${e?.codigo ?? 'x'}-${i}`}
                className={`codigo-caja cifras ${i === 3 ? 'codigo-caja-separada' : ''}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                {d}
              </motion.span>
            ))}
          </div>
          <p className="codigo-tiempo cifras">
            <IconoReloj />
            {vencido ? 'Este código ya no sirve. Pide otro y seguimos.' : e ? `El código vence en ${minutos}:${segundos}.` : 'Preparando tu código…'}
          </p>
          {vencido && (
            <Boton principal onClick={() => void pedir()}>
              Pedir otro código
            </Boton>
          )}
          <ErrorApp />
        </>
      )}
      {listo && <p className="texto-suave">Te llevamos a tu día en un momento.</p>}
    </Escena>
  );
}
