/**
 * Avisos al celular: el termo decide solo cuándo avisar según tu ritmo, y
 * estos botones disparan cada aviso ya, para la demo. Llegan a la app aunque
 * esté cerrada (Web Push). Solo con el termo emparejado.
 */
import { useState } from 'react';
import { cantidad } from 'smartsip-core';
import { useTienda } from '../estado/tienda.ts';
import { avisarAhora, type AvisoManual } from '../simulacion/avisos-termo.ts';
import { Boton, Tarjeta } from '../ui/controles.tsx';
import { IconoCampana } from '../ui/iconos.tsx';
import { hora } from '../util/formato.ts';

const BOTONES: ReadonlyArray<{ tipo: AvisoManual; texto: string }> = [
  { tipo: 'ritmo', texto: 'Vas atrasado' },
  { tipo: 'bateriaBaja', texto: 'Batería baja' },
  { tipo: 'desconectado', texto: 'Termo lejos' },
  { tipo: 'metaCumplida', texto: 'Meta cumplida' },
];

export function TarjetaAvisos() {
  const remoto = useTienda((s) => s.remoto);
  const a = useTienda((s) => s.avisos);
  const [enviando, setEnviando] = useState<AvisoManual | null>(null);

  const disparar = async (tipo: AvisoManual) => {
    setEnviando(tipo);
    await avisarAhora(tipo);
    setEnviando(null);
  };

  return (
    <Tarjeta
      icono={<IconoCampana />}
      titulo="Avisos al celular"
      explica="El termo compara lo que llevas con tu ritmo y, si vas atrasado, avisa al celular aunque la app esté cerrada."
      lectura={
        remoto && a.listo ? (
          <>
            <span className="lectura-grande">{cantidad(a.llevasMl)}</span>
            <span className="lectura-unidad">
              {a.esperadoMl !== null ? `a esta hora, ${cantidad(a.esperadoMl)}` : ''}
            </span>
          </>
        ) : (
          <span className="lectura-estado">{remoto ? 'Esperando' : 'Sin app'}</span>
        )
      }
    >
      {remoto ? (
        <>
          <p className="consola-nota" aria-live="polite">
            {a.decision}
          </p>
          <div className="avisos-botones">
            {BOTONES.map((b) => (
              <Boton key={b.tipo} disabled={enviando !== null} onClick={() => void disparar(b.tipo)}>
                {enviando === b.tipo ? 'Enviando…' : b.texto}
              </Boton>
            ))}
          </div>
          {a.ultimo && (
            <p className={`consola-nota ${a.ultimo.ok ? '' : 'consola-nota-aviso'}`} role="status">
              {hora(a.ultimo.enMs)} · {a.ultimo.texto}
            </p>
          )}
        </>
      ) : (
        <p className="consola-nota">Empareja el termo con la app para mandar avisos a su celular.</p>
      )}
    </Tarjeta>
  );
}
