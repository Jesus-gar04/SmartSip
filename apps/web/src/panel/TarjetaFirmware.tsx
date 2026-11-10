/**
 * Firmware del termo (A4): qué versión tiene y, mientras la app manda una
 * nueva, cuántos bloques lleva. La actualización la empieza la app; el termo
 * la recibe por el canal y se reinicia para instalarla.
 */
import { hayActualizacion, textoVersion } from 'smartsip-core';
import { useTienda } from '../estado/tienda.ts';
import { Tarjeta } from '../ui/controles.tsx';
import { IconoRayo } from '../ui/iconos.tsx';

export function TarjetaFirmware() {
  const firmware = useTienda((s) => s.inst?.termo.firmware ?? null);
  const fase = useTienda((s) => s.inst?.termo.actualizacion?.fase ?? null);
  const pct = useTienda((s) => Math.round((s.inst?.termo.actualizacion?.fraccion ?? 0) * 100));
  const bateria = useTienda((s) => s.inst?.termo.bateria ?? 1);
  const cargando = useTienda((s) => s.inst?.termo.cargando ?? false);

  return (
    <Tarjeta
      icono={<IconoRayo />}
      titulo="Firmware"
      explica="La app manda las versiones nuevas por el canal, bloque a bloque. Para instalar, el termo se reinicia unos segundos."
      lectura={<span className="lectura-estado cifras">{firmware ? textoVersion(firmware) : '—'}</span>}
    >
      {fase ? (
        <>
          <div className="firmware-barra" aria-hidden>
            <span style={{ width: `${pct}%` }} />
          </div>
          <p className="consola-nota" aria-live="polite">
            {fase === 'instalando' ? 'Reiniciando para instalar: el Bluetooth vuelve en unos segundos.' : `Recibiendo la versión nueva: ${pct} %.`}
          </p>
        </>
      ) : (
        <p className="consola-nota">
          {!hayActualizacion(firmware)
            ? 'Tiene la versión más reciente.'
            : bateria < 0.3 && !cargando
              ? 'Con menos del 30 % de batería el termo no acepta actualizaciones, salvo que esté cargando.'
              : 'Hay una versión nueva: se instala desde la sección Termo de la app.'}
        </p>
      )}
    </Tarjeta>
  );
}
