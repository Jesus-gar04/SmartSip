/**
 * /preventa: el formulario de la preventa, al que lleva el QR del flyer.
 *
 * Misma pieza que el flyer: papel arriba con la pregunta, agua abajo con el
 * precio y los cupos. Quien llega no tiene cuenta: entra como anónimo en una
 * instancia de Firebase propia (no toca la sesión de la app). Los cupos se
 * ven bajar en vivo y la reserva queda guardada en este navegador para
 * mostrarla al volver.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  BORRADOR_VACIO,
  CUPOS_PREVENTA,
  cuposRestantes,
  ENTREGAS,
  ErrorReserva,
  formatoCelular,
  formatoPesos,
  MAX_POR_RESERVA,
  PRECIO_ANTES,
  PRECIO_PREVENTA,
  textoCupos,
  validarReserva,
  type BorradorReserva,
  type CampoReserva,
  type ErroresReserva,
  type Reserva,
} from 'smartsip-core';
import type { ReservasFirebase } from 'smartsip-firebase';
import { servicios } from '../app/servicios.ts';
import { TermoDibujo } from '../ui/TermoDibujo.tsx';
import { Boton } from '../ui/controles.tsx';
import { IconoCheck, IconoCorreo, IconoPersona, IconoTelefono, IconoUbicacion } from '../ui/iconos.tsx';
import { transicion, useMovimientoReducido } from '../util/movimiento.ts';
import '../estilos-reservar.css';

const OLA = 'M0 18 C 60 6, 140 6, 200 18 S 340 30, 400 18 S 540 6, 600 18 S 740 30, 800 18 V 60 H 0 Z';
const CLAVE_GUARDADA = 'smartsip:reserva';

// ─── Datos ──────────────────────────────────────────────────────────────────

let promesaReservas: Promise<ReservasFirebase> | null = null;
function reservas(): Promise<ReservasFirebase> {
  promesaReservas ??= servicios('reservas').then(({ fb, servicios: s }) => new fb.ReservasFirebase(s));
  return promesaReservas;
}

function numeroGuardado(): number | null {
  try {
    const n = Number(localStorage.getItem(CLAVE_GUARDADA));
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function guardarNumero(n: number | null): void {
  try {
    if (n === null) localStorage.removeItem(CLAVE_GUARDADA);
    else localStorage.setItem(CLAVE_GUARDADA, String(n));
  } catch {
    // Sin almacenamiento (navegación privada): la reserva igual quedó guardada en Firestore.
  }
}

/** Cuántos van apartados, en vivo. null mientras carga; 'error' si no hay conexión. */
function useReservados(): number | null | 'error' {
  const [reservados, setReservados] = useState<number | null | 'error'>(null);
  useEffect(() => {
    let salir: (() => void) | undefined;
    let vivo = true;
    reservas()
      .then((r) => {
        if (vivo) salir = r.escucharCupos(setReservados, () => setReservados('error'));
      })
      .catch(() => vivo && setReservados('error'));
    return () => {
      vivo = false;
      salir?.();
    };
  }, []);
  return reservados;
}

// ─── Página ─────────────────────────────────────────────────────────────────

export function PaginaReservar() {
  const reservados = useReservados();
  const [hecha, setHecha] = useState<Reserva | null>(null);
  const [revisando, setRevisando] = useState(() => numeroGuardado() !== null);
  const reducido = useMovimientoReducido();

  // Si ya reservó desde este navegador, se le muestra su reserva.
  useEffect(() => {
    const n = numeroGuardado();
    if (n === null) return;
    void reservas()
      .then((r) => r.leer(n))
      .then((r) => {
        if (r) setHecha(r);
        else guardarNumero(null);
      })
      .catch(() => undefined)
      .finally(() => setRevisando(false));
  }, []);

  const restantes = typeof reservados === 'number' ? cuposRestantes(reservados) : null;

  return (
    <div className="reserva">
      <section className="reserva-papel">
        <header className="reserva-cabecera">
          <img className="logo logo-dia" src="/marca/smartsip-logo-horizontal-tinta.svg" alt="SmartSip" />
          <img className="logo logo-noche" src="/marca/smartsip-logo-horizontal-blanco.svg" alt="SmartSip" />
          <span className="sello">Preventa · Unidades limitadas</span>
        </header>
        <div className="reserva-intro">
          <div>
            <h1 className="pregunta">
              ¿Cuánta <span className="palabra-azul">agua</span> tomaste hoy?
            </h1>
            <p className="firma">SmartSip sí lo sabe.</p>
            <p className="reserva-lema">El termo que mide lo que tomas y te avisa antes de que llegue la sed.</p>
          </div>
          <TermoDibujo nivel={0.72} pantalla="25°" className="reserva-termo" />
        </div>
      </section>

      <section className="reserva-agua">
        <svg className="ola ola-atras" viewBox="0 0 800 60" preserveAspectRatio="none" aria-hidden>
          <path d={OLA} />
        </svg>
        <svg className="ola ola-frente" viewBox="0 0 800 60" preserveAspectRatio="none" aria-hidden>
          <path d={OLA} />
        </svg>

        <div className="reserva-columnas">
          <div className="reserva-oferta">
            <p className="reserva-rotulo">Precio de preventa</p>
            <p className="reserva-precio cifras">{formatoPesos(PRECIO_PREVENTA)}</p>
            <p className="reserva-antes">
              Antes <s>{formatoPesos(PRECIO_ANTES)}</s> · envío gratis
            </p>
            <Cupos reservados={reservados} />
            <ul className="reserva-incluye">
              <li>
                <IconoCheck /> Frío o caliente, todo el día
              </li>
              <li>
                <IconoCheck /> App incluida, sin suscripción
              </li>
              <li>
                <IconoCheck /> Cuenta cada sorbo y te recuerda tomar
              </li>
            </ul>
          </div>

          <div className="reserva-tarjeta">
            <AnimatePresence mode="wait" initial={false}>
              {revisando ? (
                <p key="revisando" className="reserva-nota" role="status">
                  Buscando tu reserva…
                </p>
              ) : hecha ? (
                <motion.div
                  key="hecha"
                  initial={reducido ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={transicion('transicion', reducido)}
                >
                  <Confirmacion
                    reserva={hecha}
                    alOtra={() => {
                      guardarNumero(null);
                      setHecha(null);
                    }}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="formulario"
                  initial={reducido ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={transicion('transicion', reducido)}
                >
                  <Formulario
                    restantes={restantes}
                    alReservar={(r) => {
                      guardarNumero(r.numero);
                      setHecha(r);
                      window.scrollTo({ top: 0, behavior: reducido ? 'auto' : 'smooth' });
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <footer className="reserva-pie">
          <p>Pruébalo antes en universidades y gimnasios.</p>
          <p className="firma reserva-firma">Be smart. Sip better.</p>
        </footer>
      </section>
    </div>
  );
}

// ─── Cupos: cincuenta termos, los apartados se vacían ───────────────────────

function Cupos({ reservados }: { reservados: number | null | 'error' }) {
  const reducido = useMovimientoReducido();
  if (reservados === 'error') {
    return <p className="reserva-cupos-texto">No pudimos consultar los cupos. Revisa la conexión.</p>;
  }
  const apartados = reservados ?? 0;
  const restantes = cuposRestantes(apartados);
  return (
    <div className="reserva-cupos">
      <p className="reserva-cupos-texto" aria-live="polite">
        {reservados === null ? 'Consultando los cupos…' : textoCupos(restantes)}
      </p>
      <div className="reserva-cupos-fila" aria-hidden>
        {Array.from({ length: CUPOS_PREVENTA }, (_, i) => {
          const libre = reservados !== null && i >= apartados;
          return (
            <motion.span
              key={i}
              className={`reserva-cupo ${libre ? 'reserva-cupo-libre' : ''}`}
              initial={false}
              animate={{ scaleY: libre ? 1 : 0.86 }}
              transition={reducido ? { duration: 0 } : { delay: (i % 10) * 0.02, ...transicion('micro', false) }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Formulario ─────────────────────────────────────────────────────────────

const ORDEN: readonly CampoReserva[] = ['nombre', 'celular', 'correo', 'cantidad', 'entrega', 'lugar', 'acepta'];

function Formulario({ restantes, alReservar }: { restantes: number | null; alReservar: (r: Reserva) => void }) {
  const [b, setB] = useState<BorradorReserva>(BORRADOR_VACIO);
  const [errores, setErrores] = useState<ErroresReserva>({});
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const formulario = useRef<HTMLFormElement>(null);
  const idLugar = useId();

  const cambiar = <K extends keyof BorradorReserva>(campo: K, valor: BorradorReserva[K]) => {
    setB((x) => ({ ...x, [campo]: valor }));
    if (errores[campo]) setErrores(({ [campo]: _, ...resto }) => resto);
    setFallo(null);
  };

  const agotado = restantes === 0;
  const maximo = Math.max(1, Math.min(MAX_POR_RESERVA, restantes ?? MAX_POR_RESERVA));
  const entrega = ENTREGAS.find((e) => e.valor === b.entrega);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    const v = validarReserva(b);
    if (!v.ok) {
      setErrores(v.errores);
      const primero = ORDEN.find((c) => v.errores[c]);
      requestAnimationFrame(() => formulario.current?.querySelector<HTMLElement>(`[data-campo="${primero}"]`)?.focus());
      return;
    }
    setEnviando(true);
    try {
      const r = await (await reservas()).reservar(v.datos);
      alReservar(r);
    } catch (error) {
      setFallo(error instanceof ErrorReserva ? error.message : 'No pudimos guardar la reserva. Inténtalo otra vez.');
      setEnviando(false);
    }
  };

  if (agotado) {
    return (
      <div className="reserva-agotado">
        <TermoDibujo nivel={0} className="reserva-termo-chico" />
        <h2 className="reserva-titulo">Se apartaron todos los termos</h2>
        <p className="reserva-nota">
          Los {CUPOS_PREVENTA} termos de la preventa ya tienen dueño. Gracias por querer uno: pronto abriremos más.
        </p>
      </div>
    );
  }

  const total = PRECIO_PREVENTA * b.cantidad;

  return (
    <form ref={formulario} className="formulario reserva-formulario" onSubmit={enviar} noValidate>
      <div>
        <h2 className="reserva-titulo">Reserva el tuyo</h2>
        {/* En el celular el formulario va primero: el precio y los cupos, aquí en corto. */}
        <p className="reserva-resumen">
          <strong className="cifras">{formatoPesos(PRECIO_PREVENTA)}</strong> <s>{formatoPesos(PRECIO_ANTES)}</s> · envío
          gratis
          {restantes !== null && <span className="reserva-resumen-cupos">{textoCupos(restantes)}</span>}
        </p>
        <p className="reserva-nota">Déjanos tus datos y te escribimos para coordinar la entrega.</p>
      </div>

      <Campo
        campo="nombre"
        etiqueta="Nombre"
        icono={<IconoPersona />}
        error={errores.nombre}
        input={{ type: 'text', autoComplete: 'name', value: b.nombre, onChange: (v) => cambiar('nombre', v) }}
      />
      <Campo
        campo="celular"
        etiqueta="Celular (WhatsApp)"
        icono={<IconoTelefono />}
        error={errores.celular}
        input={{
          type: 'tel',
          inputMode: 'tel',
          autoComplete: 'tel-national',
          placeholder: '300 123 4567',
          value: b.celular,
          onChange: (v) => cambiar('celular', v),
        }}
      />
      <Campo
        campo="correo"
        etiqueta="Correo"
        icono={<IconoCorreo />}
        error={errores.correo}
        input={{
          type: 'email',
          inputMode: 'email',
          autoComplete: 'email',
          placeholder: 'nombre@correo.com',
          value: b.correo,
          onChange: (v) => cambiar('correo', v),
        }}
      />

      <div className="campo">
        <span className="campo-etiqueta" id={`${idLugar}-cantidad`}>
          ¿Cuántos termos?
        </span>
        <div className="reserva-cantidad" role="group" aria-labelledby={`${idLugar}-cantidad`}>
          <button
            type="button"
            className="reserva-paso"
            data-campo="cantidad"
            onClick={() => cambiar('cantidad', b.cantidad - 1)}
            disabled={b.cantidad <= 1}
            aria-label="Uno menos"
          >
            −
          </button>
          <output className="reserva-cantidad-valor cifras" aria-live="polite">
            {b.cantidad}
          </output>
          <button
            type="button"
            className="reserva-paso"
            onClick={() => cambiar('cantidad', b.cantidad + 1)}
            disabled={b.cantidad >= maximo}
            aria-label="Uno más"
          >
            +
          </button>
          <span className="reserva-total">
            <span className="reserva-total-rotulo">Total</span>
            <span className="cifras">{formatoPesos(total)}</span>
          </span>
        </div>
        {errores.cantidad && <p className="campo-error">{errores.cantidad}</p>}
      </div>

      <fieldset className="campo reserva-entrega" aria-invalid={Boolean(errores.entrega)}>
        <legend className="campo-etiqueta">¿Dónde lo recibes?</legend>
        <div className="reserva-opciones">
          {ENTREGAS.map((op, i) => (
            <label key={op.valor} className="reserva-opcion">
              <input
                type="radio"
                name="entrega"
                value={op.valor}
                checked={b.entrega === op.valor}
                onChange={() => cambiar('entrega', op.valor)}
                {...(i === 0 ? { 'data-campo': 'entrega' } : {})}
              />
              <span>{op.etiqueta}</span>
            </label>
          ))}
        </div>
        {errores.entrega && <p className="campo-error">{errores.entrega}</p>}
      </fieldset>

      <AnimatePresence initial={false}>
        {entrega && (
          <motion.div
            key="lugar"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={transicion('micro', false)}
            className="reserva-lugar"
          >
            <Campo
              campo="lugar"
              etiqueta={entrega.pista}
              icono={<IconoUbicacion />}
              error={errores.lugar}
              input={{
                type: 'text',
                autoComplete: entrega.valor === 'domicilio' ? 'address-level2' : 'off',
                value: b.lugar,
                onChange: (v) => cambiar('lugar', v),
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="campo">
        <label className="reserva-acepta">
          <input
            type="checkbox"
            data-campo="acepta"
            checked={b.acepta}
            onChange={(e) => cambiar('acepta', e.target.checked)}
            aria-invalid={Boolean(errores.acepta)}
          />
          <span>Acepto que SmartSip me escriba por WhatsApp o correo sobre esta reserva.</span>
        </label>
        {errores.acepta && <p className="campo-error">{errores.acepta}</p>}
      </div>

      {fallo && (
        <p className="reserva-fallo" role="alert">
          {fallo}
        </p>
      )}

      <Boton principal type="submit" disabled={enviando || restantes === null}>
        {enviando ? 'Apartando…' : b.cantidad > 1 ? `Apartar mis ${b.cantidad} termos` : 'Apartar mi termo'}
      </Boton>
    </form>
  );
}

function Campo({
  campo,
  etiqueta,
  icono,
  error,
  input,
}: {
  campo: CampoReserva;
  etiqueta: string;
  icono: ReactNode;
  error: string | undefined;
  input: {
    type: string;
    inputMode?: 'tel' | 'email' | 'text';
    autoComplete: string;
    placeholder?: string;
    value: string;
    onChange: (v: string) => void;
  };
}) {
  const id = useId();
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      <div className="campo-caja" data-error={Boolean(error)}>
        <span className="campo-icono">{icono}</span>
        <input
          id={id}
          data-campo={campo}
          type={input.type}
          inputMode={input.inputMode}
          autoComplete={input.autoComplete}
          placeholder={input.placeholder}
          value={input.value}
          onChange={(e) => input.onChange(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      </div>
      {error && (
        <p id={`${id}-error`} className="campo-error">
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Confirmación ───────────────────────────────────────────────────────────

function Confirmacion({ reserva, alOtra }: { reserva: Reserva; alOtra: () => void }) {
  const entrega = ENTREGAS.find((e) => e.valor === reserva.entrega);
  const nombre = reserva.nombre.split(' ')[0];
  return (
    <div className="reserva-hecha" role="status">
      <TermoDibujo nivel={1} pantalla={String(reserva.numero).padStart(2, '0')} className="reserva-termo-chico" />
      <span className="sello">Apartado</span>
      <h2 className="reserva-titulo">
        {reserva.cantidad > 1
          ? `${nombre}, tus ${reserva.cantidad} termos están apartados.`
          : `${nombre}, tu termo está apartado.`}
      </h2>
      <p className="reserva-codigo cifras">{reserva.codigo}</p>
      <dl className="reserva-datos">
        <div>
          <dt>Termos</dt>
          <dd>
            {reserva.cantidad} · {formatoPesos(PRECIO_PREVENTA * reserva.cantidad)}
          </dd>
        </div>
        <div>
          <dt>Entrega</dt>
          <dd>
            {entrega?.etiqueta}: {reserva.lugar}
          </dd>
        </div>
        <div>
          <dt>Te escribimos al</dt>
          <dd className="cifras">{formatoCelular(reserva.celular)}</dd>
        </div>
      </dl>
      <p className="reserva-nota">
        Guarda el código {reserva.codigo}. Te escribimos por WhatsApp cuando{' '}
        {reserva.cantidad > 1 ? 'tus termos estén listos' : 'tu termo esté listo'} para entregar.
      </p>
      <Boton onClick={alOtra}>Hacer otra reserva</Boton>
    </div>
  );
}
