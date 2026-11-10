/**
 * Lo que la app recibe del termo, en su forma mínima (la app completa llega
 * en la fase 2): el agua de hoy, la pregunta del descenso grande, la batería
 * y el último lugar visto.
 */
import { useState } from 'react';
import { autonomiaDias, formatoLitros, textoAutonomia, type RegistroEvento } from 'smartsip-core';
import { useTienda } from '../estado/tienda.ts';
import { acciones } from '../simulacion/arranque.ts';
import { Boton } from '../ui/controles.tsx';
import { coordenada, hora } from '../util/formato.ts';

function Vacio() {
  return (
    <div className="app-vacio">
      <svg viewBox="0 0 60 150" className="silueta" aria-hidden>
        <path d="M14 22 h32 v118 q0 4 -4 4 h-24 q-4 0 -4 -4 z" />
        <rect x="15" y="6" width="30" height="15" rx="2" />
        <path d="M45 10 q10 1 10 7 q0 6 -10 6" />
      </svg>
      <p>Esperando el primer sorbo</p>
    </div>
  );
}

function Litros({ ml, sorbos }: { ml: number; sorbos: number }) {
  const [cifra, unidad] = formatoLitros(ml, 2).split(' ');
  return (
    <div className="app-litros">
      <p className="litros cifras" aria-label={`${formatoLitros(ml, 2)} hoy`}>
        {cifra}
        <span className="litros-unidad">{unidad}</span>
      </p>
      <p className="app-detalle cifras">
        {sorbos === 1 ? '1 sorbo' : `${sorbos} sorbos`} hoy
      </p>
    </div>
  );
}

function Pregunta({ registro }: { registro: RegistroEvento }) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const responder = async (d: 'bebido' | 'vaciado') => {
    setEnviando(true);
    setError(null);
    try {
      await acciones.resolver(registro, d);
    } catch {
      setError('No se pudo guardar. Inténtalo de nuevo.');
      setEnviando(false);
    }
  };
  return (
    <section className="tarjeta" aria-labelledby={`p-${registro.clave}`}>
      <h3 id={`p-${registro.clave}`}>¿Lo bebiste o lo vaciaste?</h3>
      <p className="cifras">
        Bajaron {registro.ml} ml de golpe a las {hora(registro.enMs)}.
      </p>
      <div className="fila">
        <Boton principal disabled={enviando} onClick={() => void responder('bebido')}>
          Lo bebí
        </Boton>
        <Boton disabled={enviando} onClick={() => void responder('vaciado')}>
          Lo vacié
        </Boton>
      </div>
      {error && <p className="nota" role="alert">{error}</p>}
    </section>
  );
}

export function PantallaApp({ marco }: { marco: boolean }) {
  const enMs = useTienda((s) => s.inst?.enMs ?? 0);
  const conectado = useTienda((s) => s.inst?.enlace === 'conectado');
  const encendido = useTienda((s) => s.inst?.termo.encendido ?? true);
  const bateria = useTienda((s) => s.inst?.termo.bateria ?? 1);
  const brillo = useTienda((s) => s.inst?.termo.brillo ?? 'medio');
  const hoyMl = useTienda((s) => s.hoyMl);
  const hoySorbos = useTienda((s) => s.hoySorbos);
  const pendientes = useTienda((s) => s.pendientes);
  const ultimoVisto = useTienda((s) => s.ultimoVisto);
  const bateriaBaja = useTienda((s) => s.bateriaBaja);
  const modo = useTienda((s) => s.modo);
  const pendiente = pendientes[0];

  return (
    <div className="app-pantalla">
      {marco && (
        <div className="app-barra cifras" aria-hidden>
          <span>{hora(enMs)}</span>
          <span className="app-barra-camara" />
          <span>SmartSip</span>
        </div>
      )}
      <header className="app-cabecera">
        <h2>Hoy</h2>
        <p className={`app-conexion ${conectado ? '' : 'app-conexion-sin'}`}>
          {conectado ? 'Termo conectado' : 'Sin conexión con el termo'}
        </p>
      </header>

      {hoySorbos === 0 && hoyMl === 0 ? <Vacio /> : <Litros ml={hoyMl} sorbos={hoySorbos} />}

      {pendiente && <Pregunta key={pendiente.clave} registro={pendiente} />}

      {!conectado && (
        <section className="tarjeta">
          <h3>Tu termo</h3>
          <p className="cifras">
            {ultimoVisto ? `Lo viste por última vez a las ${hora(ultimoVisto.enMs)}` : 'Todavía no se ha conectado'}
            {ultimoVisto?.lugar
              ? `, cerca de ${coordenada(ultimoVisto.lugar.lat)}, ${coordenada(ultimoVisto.lugar.lng)}.`
              : ultimoVisto
                ? '.'
                : ''}
          </p>
          <p className="nota">El termo guarda tus sorbos y los envía al reconectar.</p>
        </section>
      )}

      {(bateriaBaja || !encendido) && (
        <section className="tarjeta">
          <h3>Batería</h3>
          <p>{encendido ? textoAutonomia(autonomiaDias(bateria, brillo)) : textoAutonomia(0)}</p>
        </section>
      )}

      <footer className="app-pie">{modo === 'firebase' ? 'Guardando en Firebase' : 'Datos de prueba en esta pestaña'}</footer>
    </div>
  );
}
