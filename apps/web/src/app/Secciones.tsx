/**
 * Termo (el termo como protagonista) y las piezas breves que comparten las
 * secciones. Ajustes vive en Ajustes.tsx.
 */
import type { ReactNode } from 'react';
import {
  autonomiaDias,
  FIRMWARE_DISPONIBLE,
  fraccionActualizacion,
  hayActualizacion,
  MENSAJES_ERROR_FIRMWARE,
  textoAutonomia,
  textoVersion,
} from 'smartsip-core';
import { Boton } from '../ui/controles.tsx';
import { IconoBateria, IconoBluetooth, IconoTermometro, IconoUbicacion } from '../ui/iconos.tsx';
import { TermoDibujo } from '../ui/TermoDibujo.tsx';
import { coordenada, hora } from '../util/formato.ts';
import { app, useApp, useGrados } from './estado.ts';

const trazo = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const IconoSol = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden {...trazo}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </svg>
);

export function DatoBreve({ icono, valor, nombre }: { icono: ReactNode; valor: string; nombre: string }) {
  return (
    <div className="dato">
      <span className="dato-icono">{icono}</span>
      <span className="dato-valor cifras">{valor}</span>
      <span className="dato-nombre">{nombre}</span>
    </div>
  );
}

// ─── Termo ──────────────────────────────────────────────────────────────────

export function Termo() {
  const enlace = useApp((s) => s.enlace);
  const temperaturaC = useApp((s) => s.temperaturaC);
  const bateria = useApp((s) => s.bateria);
  const nivelMl = useApp((s) => s.nivelMl);
  const termo = useApp((s) => s.termo);
  const cerca = enlace === 'conectado';
  const lugar = termo?.ultimoVisto?.lugar;
  const capacidad = termo?.capacidadMl ?? 393;
  const brillo = useApp((s) => s.perfil?.brillo ?? 'medio');
  const grados = useGrados();
  const temp = temperaturaC !== null ? grados(temperaturaC) : '—';

  return (
    <section className="seccion seccion-termo" aria-labelledby="titulo-termo">
      <h1 id="titulo-termo" className="titulo-pantalla">
        Tu termo
      </h1>

      <div className="termo-protagonista">
        <div className="termo-protagonista-dibujo">
          <TermoDibujo
            nivel={nivelMl !== null ? nivelMl / capacidad : 0}
            pantalla={temperaturaC !== null ? `${grados(temperaturaC).replace(/\s.*/, '')}°` : '—'}
            etiqueta={nivelMl !== null ? `Tu termo tiene ${Math.round(nivelMl)} ml` : 'Tu termo'}
          />
        </div>
        <div className="termo-protagonista-texto">
          <span className={`sello ${cerca ? '' : 'sello-suelto'}`}>{cerca ? 'Cerca de ti' : 'No está cerca'}</span>
          <p className="termo-protagonista-cifra cifras">{nivelMl !== null ? `${Math.round(nivelMl)} ml` : '—'}</p>
          <p className="texto-suave">
            {nivelMl !== null ? `de agua dentro, de los ${capacidad} ml que le caben.` : 'Cuando se conecte, verás cuánta agua tiene.'}
          </p>
        </div>
      </div>

      <div className="datos">
        <DatoBreve icono={<IconoTermometro />} valor={temp} nombre="temperatura del agua" />
        <DatoBreve icono={<IconoBateria />} valor={bateria !== null ? `${Math.round(bateria * 100)} %` : '—'} nombre="batería" />
        <DatoBreve icono={<IconoBluetooth />} valor={cerca ? 'Sí' : 'No'} nombre="conectado ahora" />
      </div>

      <div className="tarjetas">
        <article className="tarjeta-info tarjeta-con-icono">
          <span className="funcion-circulo">
            <IconoBateria />
          </span>
          <div>
            <h2>Batería</h2>
            <p>{bateria === null ? 'Aparecerá cuando el termo se conecte.' : textoAutonomia(autonomiaDias(bateria, brillo))}</p>
          </div>
        </article>
        <article className="tarjeta-info tarjeta-con-icono">
          <span className="funcion-circulo">
            <IconoUbicacion />
          </span>
          <div>
            <h2>La última vez que lo viste</h2>
            {cerca ? (
              <p>Ahora mismo está contigo.</p>
            ) : termo?.ultimoVisto ? (
              <p>
                Fue a las {hora(termo.ultimoVisto.enMs)}
                {lugar ? (
                  <>
                    , cerca de{' '}
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${lugar.lat}&mlon=${lugar.lng}#map=17/${lugar.lat}/${lugar.lng}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {coordenada(lugar.lat)}, {coordenada(lugar.lng)}
                    </a>
                    .
                  </>
                ) : (
                  '. El teléfono no compartió su ubicación en ese momento.'
                )}
              </p>
            ) : (
              <p>Todavía no se ha alejado de ti.</p>
            )}
          </div>
        </article>
      </div>
      <SoftwareDelTermo />
      <Boton onClick={app.emparejarOtro}>Conectar otro termo</Boton>
    </section>
  );
}

// ─── Software del termo (A4) ────────────────────────────────────────────────

const IconoActualizar = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden {...trazo}>
    <path d="M12 4v10M7.5 9.5 12 14l4.5-4.5M5 19.5h14" />
  </svg>
);

function SoftwareDelTermo() {
  const firmware = useApp((s) => s.firmwareTermo ?? s.termo?.firmware ?? null);
  const a = useApp((s) => s.actualizacion);
  const cerca = useApp((s) => s.enlace === 'conectado');
  const nueva = textoVersion(FIRMWARE_DISPONIBLE.version);
  const fase = a?.fase ?? 'libre';
  const pct = a ? Math.round(fraccionActualizacion(a) * 100) : 0;
  const pendiente = hayActualizacion(firmware);
  const conBarra = fase === 'enviando' || fase === 'en-pausa' || fase === 'instalando';

  let texto: string;
  if (fase === 'enviando') texto = 'Mantén el termo cerca mientras se actualiza.';
  else if (fase === 'en-pausa') texto = 'El termo se alejó a mitad de camino. Acércalo y seguimos donde íbamos.';
  else if (fase === 'instalando') texto = `El termo se está reiniciando para instalar la versión ${nueva}. Tarda unos segundos.`;
  else if (fase === 'lista') texto = `Tu termo quedó al día con la versión ${nueva}.`;
  else if (fase === 'error' && a?.error) texto = MENSAJES_ERROR_FIRMWARE[a.error];
  else if (firmware === null) texto = 'Cuando el termo se conecte, verás qué versión tiene.';
  else if (pendiente) texto = `Hay una versión nueva para tu termo, la ${nueva}. ${FIRMWARE_DISPONIBLE.notas}`;
  else texto = `Tu termo tiene la versión más reciente, la ${textoVersion(firmware)}.`;

  const puedeEmpezar = pendiente && (fase === 'libre' || fase === 'error');
  return (
    <article className="tarjeta-info tarjeta-con-icono software" aria-labelledby="titulo-software">
      <span className="funcion-circulo">
        <IconoActualizar />
      </span>
      <div className="software-cuerpo">
        <h2 id="titulo-software">Software del termo</h2>
        <p className="texto-suave cifras">{firmware ? `Versión ${textoVersion(firmware)}` : 'Versión desconocida'}</p>
        <p aria-live="polite">{texto}</p>
        {conBarra && (
          <div
            className={`software-barra ${fase === 'en-pausa' ? 'software-barra-pausa' : ''} ${fase === 'instalando' ? 'software-barra-instalando' : ''}`}
            role="progressbar"
            aria-label="Avance de la actualización"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <span style={{ width: `${pct}%` }} />
            <em className="cifras">{fase === 'instalando' ? 'Instalando' : `${pct} %`}</em>
          </div>
        )}
        {puedeEmpezar && (
          <Boton principal disabled={!cerca} onClick={() => app.actualizarTermo()}>
            {fase === 'error' ? 'Intentar otra vez' : 'Actualizar'}
          </Boton>
        )}
        {puedeEmpezar && !cerca && <p className="texto-suave">Acerca el termo para actualizarlo.</p>}
      </div>
    </article>
  );
}
