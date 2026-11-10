/**
 * La pantalla frontal del termo, ampliada junto al modelo, para leer en vivo
 * lo mismo que muestra el termo: temperatura, batería y Bluetooth.
 */
import { useTienda } from '../estado/tienda.ts';
import { IconoBluetooth } from '../ui/iconos.tsx';

export function PantallaAmpliada() {
  const encendida = useTienda((s) => s.inst?.pantalla.encendida ?? true);
  const temperatura = useTienda((s) => s.inst?.pantalla.temperatura ?? 0);
  const unidad = useTienda((s) => s.inst?.pantalla.unidad ?? 'C');
  const bateriaPct = useTienda((s) => s.inst?.pantalla.bateriaPct ?? 0);
  const bluetooth = useTienda((s) => s.inst?.pantalla.bluetooth ?? false);
  const brillo = useTienda((s) => s.inst?.pantalla.brillo ?? 'medio');
  const faseAct = useTienda((s) => s.inst?.pantalla.actualizacion?.fase ?? null);
  const pctAct = useTienda((s) => Math.round((s.inst?.pantalla.actualizacion?.fraccion ?? 0) * 100));

  return (
    <figure className="pantalla-ampliada" data-brillo={brillo} data-encendida={encendida}>
      <figcaption className="pantalla-titulo">Pantalla del termo</figcaption>
      <div
        className="pantalla-vidrio cifras"
        role="img"
        aria-label={
          encendida && faseAct
            ? `Pantalla del termo: ${faseAct === 'instalando' ? 'instalando la actualización' : `actualizando, ${pctAct} %`}.`
            : encendida
            ? `Pantalla del termo: ${temperatura} grados ${unidad === 'C' ? 'Celsius' : 'Fahrenheit'}, batería ${bateriaPct} %, Bluetooth ${bluetooth ? 'conectado' : 'sin conexión'}.`
            : 'Pantalla del termo apagada.'
        }
      >
        {encendida && (
          <>
            {faseAct ? (
              <span className="pantalla-act">
                <span className="pantalla-act-texto">{faseAct === 'instalando' ? 'Instalando' : 'Actualizando'}</span>
                <span className="pantalla-act-barra" aria-hidden>
                  <span style={{ width: `${pctAct}%` }} />
                </span>
                <span className="pantalla-act-pct">{pctAct}%</span>
              </span>
            ) : (
              <span className="pantalla-temp">
                {temperatura}
                <span className="pantalla-unidad">°{unidad}</span>
              </span>
            )}
            <span className="pantalla-lado">
              <span className="pantalla-bateria" aria-hidden>
                <span style={{ width: `${Math.max(0, Math.min(100, bateriaPct))}%` }} />
              </span>
              <span className="pantalla-pct">{bateriaPct}%</span>
              <span className={`pantalla-bt ${bluetooth ? '' : 'pantalla-bt-sin'}`}>
                <IconoBluetooth />
              </span>
            </span>
          </>
        )}
      </div>
    </figure>
  );
}
