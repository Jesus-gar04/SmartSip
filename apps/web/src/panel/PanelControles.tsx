/**
 * La consola del termo. Cada tarjeta dice qué simula y muestra su efecto en
 * vivo: nada de controles mudos. "Beber" es la única acción principal.
 * La temperatura ambiente no se escribe: viene del clima local.
 */
import { useRef, useState } from 'react';
import { autonomiaDias, REGLAS_BATERIA, REGLAS_NIVEL, textoAutonomia, type Aceleracion } from 'smartsip-core';
import { useTienda } from '../estado/tienda.ts';
import { acciones } from '../simulacion/arranque.ts';
import { Boton, Deslizador, Segmentado, Tarjeta } from '../ui/controles.tsx';
import {
  IconoBateria,
  IconoBluetooth,
  IconoGota,
  IconoRayo,
  IconoReloj,
  IconoTapa,
  IconoTermometro,
  IconoUbicacion,
} from '../ui/iconos.tsx';
import { hora } from '../util/formato.ts';
import { TarjetaAvisos } from './TarjetaAvisos.tsx';
import { TarjetaEmparejar } from './TarjetaEmparejar.tsx';
import { TarjetaFirmware } from './TarjetaFirmware.tsx';

const grados = (c: number) => `${Math.round(c)} °C`;
const decimal = (n: number) => n.toFixed(1).replace('.', ',');

/** Cuánto cambia la temperatura del agua por minuto (simulado), con una ventana de unos segundos. */
function useTendencia(temperaturaC: number, enMs: number): number | null {
  const muestra = useRef<{ t: number; c: number } | null>(null);
  const [tasa, setTasa] = useState<number | null>(null);
  const m = muestra.current;
  if (!m || enMs < m.t) {
    muestra.current = { t: enMs, c: temperaturaC };
  } else if (Math.abs(temperaturaC - m.c) > 5) {
    // Un salto así no es enfriamiento: es agua nueva. Se vuelve a medir desde aquí.
    muestra.current = { t: enMs, c: temperaturaC };
    if (tasa !== null) setTasa(null);
  } else if (enMs - m.t >= 5000) {
    const porMinuto = ((temperaturaC - m.c) / (enMs - m.t)) * 60_000;
    muestra.current = { t: enMs, c: temperaturaC };
    if (porMinuto !== tasa) setTasa(porMinuto);
  }
  return tasa;
}

function textoTendencia(porMinuto: number | null): string {
  if (porMinuto === null || Math.abs(porMinuto) < 0.05) return 'estable';
  return `${porMinuto > 0 ? 'subiendo' : 'bajando'} ${decimal(Math.abs(porMinuto))} °C por minuto`;
}

function ClimaDelLugar() {
  const clima = useTienda((s) => s.clima);
  const estado = useTienda((s) => s.climaEstado);
  const [buscando, setBuscando] = useState(false);
  const cambiar = async (accion: () => Promise<void>) => {
    setBuscando(true);
    await accion();
    setBuscando(false);
  };
  const temperatura = clima?.clima.temperaturaC;
  return (
    <Tarjeta
      icono={<IconoTermometro />}
      titulo="Clima"
      explica="La temperatura ambiente sale del clima real. Hacia ella va, poco a poco, el agua del termo."
      lectura={temperatura !== undefined ? <span className="lectura-grande">{grados(temperatura)}</span> : '—'}
    >
      {clima ? (
        <p className="consola-dato">
          {clima.nombre}
          {clima.clima.maximaHoyC !== null && ` · máxima ${grados(clima.clima.maximaHoyC)} hoy`}
          <span className="consola-fuente">
            Open-Meteo{clima.clima.medidoEnMs > 0 ? `, ${hora(clima.clima.medidoEnMs)}` : ''}
            {estado === 'error' ? ' · sin conexión, último dato' : ''}
          </span>
        </p>
      ) : (
        <p className="consola-dato" aria-live="polite">
          {estado === 'error' ? 'No se pudo leer el clima: el termo usa 30 °C.' : 'Leyendo el clima local…'}
        </p>
      )}
      {clima && (
        <Boton
          icono={<IconoUbicacion />}
          disabled={buscando}
          onClick={() =>
            void cambiar(clima.origen === 'predeterminado' ? acciones.usarMiUbicacion : acciones.usarLugarPredeterminado)
          }
        >
          {buscando ? 'Buscando…' : clima.origen === 'predeterminado' ? 'Usar mi ubicación' : 'Volver a Barranquilla'}
        </Boton>
      )}
    </Tarjeta>
  );
}

export function PanelControles() {
  const tiempoReal = useTienda((s) => s.modo === 'firebase' || s.remoto);
  const listo = useTienda((s) => s.fase === 'lista');
  const sorboMl = useTienda((s) => s.sorboMl);
  const agua = useTienda((s) => s.agua);
  const nivelMl = useTienda((s) => Math.round(s.inst?.termo.nivelMl ?? 0));
  const capacidadMl = useTienda((s) => s.inst?.termo.capacidadMl ?? 393);
  const temperaturaC = useTienda((s) => Math.round((s.inst?.termo.temperaturaC ?? 0) * 100) / 100);
  const enMs = useTienda((s) => s.inst?.enMs ?? 0);
  const tapaCerrada = useTienda((s) => s.inst?.termo.tapaCerrada ?? true);
  const cargando = useTienda((s) => s.inst?.termo.cargando ?? false);
  const bateria = useTienda((s) => Math.round((s.inst?.termo.bateria ?? 1) * 1000) / 1000);
  const brillo = useTienda((s) => s.inst?.termo.brillo ?? 'medio');
  const conectado = useTienda((s) => s.inst?.termo.conectado ?? false);
  const encendido = useTienda((s) => s.inst?.termo.encendido ?? true);
  const pendientes = useTienda((s) => s.inst?.termo.pendientes ?? 0);
  const aceleracion = useTienda((s) => s.inst?.aceleracion ?? 1);
  const [cerca, setCerca] = useState(true);
  const tendencia = useTendencia(temperaturaC, enMs);

  const lleno = nivelMl >= capacidadMl;
  const vacio = nivelMl <= 0;
  const grande = sorboMl > REGLAS_NIVEL.maxSorboMl;
  const pct = Math.round(bateria * 100);
  const minutosParaLlenar = Math.ceil((1 - bateria) * REGLAS_BATERIA.horasCargaCompleta * 60);

  return (
    // Mientras la simulación arranca, los controles no responden: mejor que se vea.
    <fieldset className="panel consola" aria-label="Controles físicos del termo" disabled={!listo} aria-busy={!listo}>
      <TarjetaEmparejar />
      <TarjetaAvisos />
      <TarjetaFirmware />

      <Tarjeta
        icono={<IconoGota />}
        titulo="Agua"
        explica="Llena, bebe o vacía el termo. El sensor de nivel cuenta un sorbo cuando el agua se queda quieta 2 segundos."
        lectura={
          <>
            <span className="lectura-grande">{nivelMl}</span>
            <span className="lectura-unidad">de {capacidadMl} ml</span>
          </>
        }
      >
        <Segmentado
          etiqueta="Tipo de agua"
          valor={agua}
          alCambiar={acciones.agua}
          opciones={[
            { valor: 'fria', etiqueta: 'Fría 6 °C' },
            { valor: 'ambiente', etiqueta: 'Del clima' },
            { valor: 'caliente', etiqueta: 'Caliente 85 °C' },
          ]}
        />
        <div className="fila">
          <Boton onClick={acciones.llenar} disabled={lleno}>
            Llenar
          </Boton>
          <Boton onClick={acciones.vaciar} disabled={vacio}>
            Vaciarlo
          </Boton>
        </div>
        <Deslizador etiqueta="Tamaño del sorbo" valor={sorboMl} min={10} max={250} paso={5} unidad="ml" alCambiar={acciones.sorbo} />
        <Boton principal icono={<IconoGota />} onClick={acciones.beber} disabled={vacio}>
          Beber {Math.min(sorboMl, nivelMl)} ml
        </Boton>
        <p className={`consola-nota ${grande ? 'consola-nota-aviso' : ''}`} aria-live="polite">
          {grande
            ? `Más de ${REGLAS_NIVEL.maxSorboMl} ml de golpe: la app preguntará si lo bebiste o lo vaciaste.`
            : 'Hasta 150 ml cuenta como sorbo; más, la app pregunta.'}
        </p>
      </Tarjeta>

      <Tarjeta
        icono={<IconoTapa />}
        titulo="Tapa"
        explica="Con la tapa abierta el agua se enfría o se calienta 10 veces más rápido. Míralo en la pantalla del termo."
        lectura={
          <>
            <span className="lectura-grande">{grados(temperaturaC)}</span>
            <span className="lectura-unidad">{textoTendencia(tendencia)}</span>
          </>
        }
      >
        <Boton icono={<IconoTapa />} activo={!tapaCerrada} onClick={() => acciones.tapa(tapaCerrada)}>
          {tapaCerrada ? 'Abrir la tapa' : 'Cerrar la tapa'}
        </Boton>
      </Tarjeta>

      <ClimaDelLugar />

      <Tarjeta
        icono={<IconoBateria />}
        titulo="Batería"
        explica="La batería del termo. Por debajo del 15 % la app avisa en días, no en porcentaje."
        lectura={
          <>
            <span className="lectura-grande">{pct} %</span>
            <span className="lectura-unidad">{encendido ? textoAutonomia(autonomiaDias(bateria, brillo)) : 'Apagado'}</span>
          </>
        }
      >
        <div className="fila">
          <Boton icono={<IconoRayo />} activo={cargando} onClick={() => acciones.cargador(!cargando)}>
            {cargando ? 'Desconectar cargador' : 'Conectar cargador'}
          </Boton>
          <Boton onClick={acciones.bateriaBaja} disabled={bateria <= 0.14}>
            Bajar al 14 %
          </Boton>
        </div>
        <p className="consola-nota" aria-live="polite">
          {cargando
            ? bateria >= 1
              ? 'Carga completa.'
              : `Cargando: lleno en unos ${minutosParaLlenar} min.`
            : 'Sin cargador, la batería baja poco a poco: dura unos 7 días.'}
        </p>
      </Tarjeta>

      <Tarjeta
        icono={<IconoBluetooth />}
        titulo="Conexión"
        explica="Simula que el teléfono se aleja del termo. El termo guarda los sorbos y los envía al volver."
        lectura={<span className="lectura-estado">{conectado ? 'Conectado' : encendido ? 'Lejos' : 'Apagado'}</span>}
      >
        <Boton
          icono={<IconoBluetooth />}
          activo={!cerca}
          onClick={() => {
            setCerca(!cerca);
            acciones.bluetooth(!cerca);
          }}
        >
          {cerca ? 'Alejar el teléfono' : 'Acercar el teléfono'}
        </Boton>
        <p className="consola-nota" aria-live="polite">
          {!encendido
            ? 'Sin batería el termo se apaga. Conecta el cargador.'
            : !conectado
              ? pendientes === 0
                ? 'Sin conexión. Bebe y verás cómo el termo guarda los sorbos.'
                : `El termo guarda ${pendientes === 1 ? '1 evento' : `${pendientes} eventos`} para enviarlos al volver.`
              : 'Cada sorbo llega a la app al momento.'}
        </p>
      </Tarjeta>

      <Tarjeta
        icono={<IconoReloj />}
        titulo="Tiempo"
        explica="Acelera el reloj para ver en un minuto lo que pasa en una hora: el agua se enfría y la batería baja."
        lectura={<span className="lectura-grande">×{aceleracion}</span>}
      >
        <Segmentado<Aceleracion>
          etiqueta="Velocidad del tiempo"
          valor={aceleracion}
          alCambiar={acciones.aceleracion}
          opciones={[
            { valor: 1, etiqueta: 'Real ×1' },
            { valor: 10, etiqueta: '×10', deshabilitada: tiempoReal },
            { valor: 60, etiqueta: '×60', deshabilitada: tiempoReal },
          ]}
        />
        {tiempoReal && (
          <p className="consola-nota">Con datos reales el tiempo va a ×1, para que los sorbos se guarden con su hora real.</p>
        )}
      </Tarjeta>
    </fieldset>
  );
}
