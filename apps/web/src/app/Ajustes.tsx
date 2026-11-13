/**
 * Ajustes (U4, U5 y A3): sobre papel, sin agua; aquí no se celebra nada.
 *
 * - Tú: tus datos y tu termo.
 * - Recordatorios: avisos en este celular, según tu ritmo, silencio y tono
 *   (con el aviso de ejemplo tal como se verá).
 * - Pantalla del termo: °C o °F y brillo; van al termo en el acto.
 * - Apariencia: tema, solo en este dispositivo.
 */
import { useEffect, useState, type ReactNode } from 'react';
import {
  autonomiaDias,
  avisoRitmo,
  calcularMeta,
  cantidad,
  RECORDATORIO_POR_DEFECTO,
  textoAutonomia,
  type AjustesRecordatorio,
  type Brillo,
  type Tono,
  type Unidad,
} from 'smartsip-core';
import { activarAvisos, apagarAvisos, revisarAvisos, useEstadoAvisos, type EstadoAvisos } from '../pwa/avisos.ts';
import { InvitacionInstalar } from '../pwa/InvitacionInstalar.tsx';
import { fijarTema, temaGuardado, type PreferenciaTema } from '../tema.ts';
import { Boton, Segmentado } from '../ui/controles.tsx';
import { IconoTermo, IconoTermometro } from '../ui/iconos.tsx';
import { TarjetaAviso } from './AvisoEnApp.tsx';
import { app, useApp } from './estado.ts';
import { useClimaHoy } from './PrimerUso.tsx';
import { IconoSol } from './Secciones.tsx';

const trazo = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const Icono = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden {...trazo}>
    {children}
  </svg>
);
const IconoFlechaDerecha = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden {...trazo}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);
const IconoPersona = () => (
  <Icono>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5" />
  </Icono>
);
const IconoSalir = () => (
  <Icono>
    <path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14M10 16l-4-4 4-4M6 12h9" />
  </Icono>
);
const IconoCampana = () => (
  <Icono>
    <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" />
  </Icono>
);
const IconoLuna = () => (
  <Icono>
    <path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z" />
  </Icono>
);
const IconoMensaje = () => (
  <Icono>
    <path d="M4.5 5.5h15v10h-9l-4 3.5v-3.5h-2z" />
  </Icono>
);
const IconoRitmo = () => (
  <Icono>
    <path d="M3 12h3.5l2.5-6 4 12 2.5-6H21" />
  </Icono>
);
const IconoContraste = () => (
  <Icono>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor" />
  </Icono>
);

// ─── Piezas ─────────────────────────────────────────────────────────────────

function Fila({
  icono,
  titulo,
  detalle,
  alTocar,
  salida = false,
}: {
  icono: ReactNode;
  titulo: string;
  detalle?: string | undefined;
  alTocar: () => void;
  salida?: boolean;
}) {
  return (
    <button type="button" className={`fila-ajuste ${salida ? 'fila-ajuste-salir' : ''}`} onClick={alTocar}>
      <span className="fila-ajuste-icono">{icono}</span>
      <span className="fila-ajuste-texto">
        <span className="fila-ajuste-titulo">{titulo}</span>
        {detalle && <span className="fila-ajuste-detalle">{detalle}</span>}
      </span>
      {!salida && <IconoFlechaDerecha />}
    </button>
  );
}

/** Fila con un control: ícono y texto; el control a la derecha o, si es ancho, debajo. */
function FilaControl({
  icono,
  titulo,
  detalle,
  children,
  debajo = false,
}: {
  icono: ReactNode;
  titulo: string;
  detalle?: ReactNode;
  children?: ReactNode;
  debajo?: boolean;
}) {
  return (
    <div className={`fila-ajuste fila-control ${debajo ? 'fila-control-debajo' : ''}`}>
      <span className="fila-ajuste-icono">{icono}</span>
      <span className="fila-ajuste-texto">
        <span className="fila-ajuste-titulo">{titulo}</span>
        {detalle && <span className="fila-ajuste-detalle fila-ajuste-detalle-largo">{detalle}</span>}
      </span>
      {children && <div className="fila-control-control">{children}</div>}
    </div>
  );
}

/** Interruptor de encendido; el pulgar se desliza con la curva de la marca. */
function Interruptor({ encendido, alCambiar, etiqueta, deshabilitado = false }: {
  encendido: boolean;
  alCambiar: (v: boolean) => void;
  etiqueta: string;
  deshabilitado?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={encendido}
      aria-label={etiqueta}
      disabled={deshabilitado}
      className="interruptor"
      onClick={() => alCambiar(!encendido)}
    >
      <span className="interruptor-pulgar" />
    </button>
  );
}

const HORAS = Array.from({ length: 24 }, (_, h) => h);
const textoHora = (h: number) => `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? 'a. m.' : 'p. m.'}`;

function SelectorHora({ valor, alCambiar, etiqueta }: { valor: number; alCambiar: (h: number) => void; etiqueta: string }) {
  return (
    <label className="selector-hora">
      <span className="visualmente-oculto">{etiqueta}</span>
      <select value={valor} onChange={(e) => alCambiar(Number(e.target.value))}>
        {HORAS.map((h) => (
          <option key={h} value={h}>
            {textoHora(h)}
          </option>
        ))}
      </select>
    </label>
  );
}

// ─── Avisos en este celular ─────────────────────────────────────────────────

const DETALLE_AVISOS: Record<EstadoAvisos, string> = {
  activos: 'Llegan a este celular, aunque SmartSip esté cerrada.',
  apagados: 'Actívalos para que el termo te avise cuando te falte un poco de agua.',
  'instalar-primero': 'En iPhone, los avisos llegan solo a SmartSip agregada a la pantalla de inicio.',
  bloqueados: 'El navegador tiene los avisos bloqueados. Puedes permitirlos desde la configuración del celular.',
  'no-soportado': 'Este navegador no recibe avisos. Prueba con Safari en iPhone o con Chrome.',
};

function AvisosDelCelular() {
  const enTelefono = useApp((s) => s.enTelefono);
  if (enTelefono) {
    return (
      <FilaControl
        icono={<IconoCampana />}
        titulo="Avisos en este celular"
        detalle="En el simulador, los avisos llegan a la app emparejada en otro celular."
      />
    );
  }
  return <AvisosDeVerdad />;
}

function AvisosDeVerdad() {
  const estado = useEstadoAvisos();
  const [ocupado, setOcupado] = useState(false);
  const [nota, setNota] = useState<string | null>(null);
  const canalId = app.canalId();

  useEffect(() => {
    void revisarAvisos();
  }, []);

  const hacer = async (accion: () => Promise<unknown>) => {
    setOcupado(true);
    setNota(null);
    try {
      await accion();
    } catch (e) {
      console.warn('Avisos:', e);
      setNota('No se pudo cambiar. Revisa la conexión e inténtalo otra vez.');
    } finally {
      setOcupado(false);
    }
  };

  const cambiar = (encender: boolean) => {
    if (!canalId) {
      setNota('Primero conecta tu termo.');
      return;
    }
    void hacer(async () => {
      const final = encender ? await activarAvisos(canalId) : await apagarAvisos(canalId);
      if (encender && final === 'apagados') setNota('Sin tu permiso no podemos avisarte. Puedes intentarlo cuando quieras.');
    });
  };

  const probar = () =>
    void hacer(async () => {
      const r = await app.probarAviso();
      setNota(
        r.ok
          ? r.enviados > 0
            ? 'Listo: el aviso de prueba va en camino.'
            : 'El aviso salió, pero no encontró este celular. Apaga y vuelve a activar los avisos.'
          : r.mensaje,
      );
    });

  const conInterruptor = estado === 'activos' || estado === 'apagados';
  return (
    <>
      <FilaControl icono={<IconoCampana />} titulo="Avisos en este celular" detalle={DETALLE_AVISOS[estado]}>
        {conInterruptor && (
          <Interruptor encendido={estado === 'activos'} deshabilitado={ocupado} etiqueta="Avisos en este celular" alCambiar={cambiar} />
        )}
      </FilaControl>
      {estado === 'instalar-primero' && (
        <div className="fila-extra">
          <InvitacionInstalar obligatoria />
        </div>
      )}
      {estado === 'activos' && (
        <div className="fila-extra">
          <Boton disabled={ocupado} onClick={probar}>
            Probar un aviso
          </Boton>
        </div>
      )}
      {nota && (
        <p className="fila-extra fila-nota" role="status">
          {nota}
        </p>
      )}
    </>
  );
}

// ─── La pantalla ────────────────────────────────────────────────────────────

const RUTINA = { baja: 'tranquila', media: 'movida', alta: 'intensa' } as const;

export function Ajustes() {
  const perfil = useApp((s) => s.perfil);
  const usuario = useApp((s) => s.usuario);
  const enTelefono = useApp((s) => s.enTelefono);
  const clima = useClimaHoy();
  const [tema, setTema] = useState<PreferenciaTema>(temaGuardado);
  const meta = perfil ? calcularMeta(perfil, { temperaturaC: clima ?? 25 }).totalMl : null;
  const r = perfil?.recordatorio ?? RECORDATORIO_POR_DEFECTO;
  const cambiarRecordatorio = (c: Partial<AjustesRecordatorio>) => void app.guardarAjustes({ recordatorio: { ...r, ...c } });
  const ejemploMeta = meta ?? 2400;
  const ejemplo = avisoRitmo(Math.round(ejemploMeta * 0.25), Math.round(ejemploMeta * 0.45), ejemploMeta, r.tono, true);
  const brillo = perfil?.brillo ?? 'medio';
  const autonomia = textoAutonomia(autonomiaDias(1, brillo)).replace(/^La batería/, 'la batería');
  const iniciales =
    (perfil?.nombre ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'S';

  return (
    <section className="seccion" aria-labelledby="titulo-ajustes">
      <h1 id="titulo-ajustes" className="titulo-pantalla">
        Ajustes
      </h1>
      <div className="perfil-cabecera">
        <span className="avatar" aria-hidden>
          {iniciales}
        </span>
        <div>
          <p className="perfil-nombre">{perfil?.nombre ?? 'Tu perfil'}</p>
          <p className="texto-suave">{enTelefono ? 'Perfil de prueba del simulador' : usuario?.anonimo ? 'Usas SmartSip sin cuenta por ahora' : usuario?.email}</p>
        </div>
      </div>

      <div className="grupo-ajustes">
        <p className="sello sello-suelto">Tú</p>
        <Fila
          icono={<IconoPersona />}
          titulo="Tus datos"
          detalle={perfil ? `${perfil.pesoKg} kg · rutina ${RUTINA[perfil.actividad]}${meta ? ` · meta de ${cantidad(meta)}` : ''}` : undefined}
          alTocar={() => useApp.setState({ fase: 'perfil' })}
        />
        <Fila icono={<IconoTermo />} titulo="Tu termo" detalle={perfil?.termoId ?? 'Sin termo'} alTocar={() => app.irA_seccion('termo')} />
      </div>

      <div className="grupo-ajustes">
        <p className="sello sello-suelto">Recordatorios</p>
        <AvisosDelCelular />
        <FilaControl
          icono={<IconoRitmo />}
          titulo="Según tu ritmo"
          detalle="El termo te avisa solo si vas atrasado frente a lo que sueles llevar a esa hora. Como mucho, uno cada hora y media."
        >
          <Interruptor encendido={r.activos} etiqueta="Recordatorios según tu ritmo" alCambiar={(activos) => cambiarRecordatorio({ activos })} />
        </FilaControl>
        <FilaControl icono={<IconoLuna />} titulo="Horario de silencio" detalle="En estas horas no llega ningún aviso." debajo>
          <div className="silencio">
            <SelectorHora etiqueta="Desde" valor={r.silencioDesde} alCambiar={(silencioDesde) => cambiarRecordatorio({ silencioDesde })} />
            <span className="texto-suave">hasta</span>
            <SelectorHora etiqueta="Hasta" valor={r.silencioHasta} alCambiar={(silencioHasta) => cambiarRecordatorio({ silencioHasta })} />
          </div>
        </FilaControl>
        <FilaControl icono={<IconoMensaje />} titulo="Tono de los mensajes" detalle="Así se verá un recordatorio:" debajo>
          <Segmentado<Tono>
            etiqueta="Tono de los mensajes"
            valor={r.tono}
            opciones={[
              { valor: 'sereno', etiqueta: 'Sereno' },
              { valor: 'directo', etiqueta: 'Directo' },
            ]}
            alCambiar={(tono) => cambiarRecordatorio({ tono })}
          />
          <div className="tono-ejemplo">
            <TarjetaAviso titulo={ejemplo.titulo} cuerpo={ejemplo.cuerpo} />
          </div>
        </FilaControl>
      </div>

      <div className="grupo-ajustes">
        <p className="sello sello-suelto">Pantalla del termo</p>
        <FilaControl icono={<IconoTermometro />} titulo="Temperatura" detalle="En el termo y en la app." debajo>
          <Segmentado<Unidad>
            etiqueta="Unidad de temperatura"
            valor={perfil?.unidad ?? 'C'}
            opciones={[
              { valor: 'C', etiqueta: '°C' },
              { valor: 'F', etiqueta: '°F' },
            ]}
            alCambiar={(unidad) => void app.guardarAjustes({ unidad })}
          />
        </FilaControl>
        <FilaControl icono={<IconoSol />} titulo="Brillo de la pantalla" detalle={`Con la carga completa, ${autonomia}`} debajo>
          <Segmentado<Brillo>
            etiqueta="Brillo de la pantalla del termo"
            valor={brillo}
            opciones={[
              { valor: 'bajo', etiqueta: 'Bajo' },
              { valor: 'medio', etiqueta: 'Medio' },
              { valor: 'alto', etiqueta: 'Alto' },
            ]}
            alCambiar={(b) => void app.guardarAjustes({ brillo: b })}
          />
        </FilaControl>
      </div>

      <div className="grupo-ajustes">
        <p className="sello sello-suelto">Apariencia</p>
        <FilaControl icono={<IconoContraste />} titulo="Tema" detalle="Solo en este dispositivo." debajo>
          <Segmentado<PreferenciaTema>
            etiqueta="Tema"
            valor={tema}
            opciones={[
              { valor: 'sistema', etiqueta: 'Automático' },
              { valor: 'dia', etiqueta: 'Día' },
              { valor: 'noche', etiqueta: 'Noche' },
            ]}
            alCambiar={(t) => {
              fijarTema(t);
              setTema(t);
            }}
          />
        </FilaControl>
      </div>

      {!enTelefono && (
        <div className="grupo-ajustes">
          <p className="sello sello-suelto">Cuenta</p>
          <Fila icono={<IconoSalir />} titulo="Cerrar sesión" alTocar={() => void app.salir()} salida />
        </div>
      )}

      <p className="texto-suave ajustes-pie">SmartSip · Hidrata hoy, vive mejor.</p>
    </section>
  );
}
