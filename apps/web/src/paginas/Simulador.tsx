import { useEffect } from 'react';
import { useMantenerPantalla } from '../util/pantalla-encendida.ts';
import { useTienda } from '../estado/tienda.ts';
import { FranjaMensajes, LineaMensajes } from '../linea/LineaMensajes.tsx';
import { PanelControles } from '../panel/PanelControles.tsx';
import { cambiarModo, iniciarSimulador, modoInicial } from '../simulacion/arranque.ts';
import { PantallaApp } from '../telefono/PantallaApp.tsx';
import { Escenario } from '../termo/Escenario.tsx';
import { Segmentado } from '../ui/controles.tsx';
import { fechaLarga, hora } from '../util/formato.ts';

let iniciado = false;

/** /simulador: el termo, su consola y la línea de mensajes con la app. */

export function PaginaSimulador() {
  useMantenerPantalla();
  const fase = useTienda((s) => s.fase);
  const modo = useTienda((s) => s.modo);
  const error = useTienda((s) => s.error);
  const pestana = useTienda((s) => s.pestana);
  // El selector debe devolver siempre lo mismo para el mismo estado: nada de Date.now() aquí.
  const enMs = useTienda((s) => s.inst?.enMs ?? null);
  const aceleracion = useTienda((s) => s.inst?.aceleracion ?? 1);
  const conectado = useTienda((s) => s.inst?.enlace === 'conectado');
  const climaC = useTienda((s) => (s.clima ? Math.round(s.clima.clima.temperaturaC) : null));
  // Emparejado, la app de verdad está en otro dispositivo: el teléfono dibujado sobra.
  const remoto = useTienda((s) => s.remoto);

  useEffect(() => {
    if (iniciado) return; // StrictMode monta dos veces en desarrollo
    iniciado = true;
    void iniciarSimulador(modoInicial());
  }, []);

  return (
    <div className="pagina">
      <header className="cabecera">
        <div className="marca">
          <img className="logo logo-dia" src="/marca/smartsip-logo-horizontal-tinta.svg" alt="SmartSip" />
          <img className="logo logo-noche" src="/marca/smartsip-logo-horizontal-blanco.svg" alt="SmartSip" />
          <span className="sello sello-suelto">Simulador</span>
        </div>
        <p className="reloj" aria-live="off">
          {enMs !== null && (
            <>
              <span className="reloj-hora cifras">{hora(enMs, true)}</span>
              <span className="reloj-fecha">
                {fechaLarga(enMs)}
                {aceleracion > 1 && <strong> · tiempo ×{aceleracion}</strong>}
              </span>
            </>
          )}
        </p>
        <span className="sello cabecera-sello" role="status">
          {conectado ? 'Conectado' : 'Sin conexión'}
          {climaC !== null && ` · ${climaC} °C`}
        </span>
        <Segmentado
          etiqueta="Dónde se guardan los datos"
          valor={modo}
          alCambiar={(m) => m !== modo && cambiarModo(m)}
          opciones={[
            { valor: 'memoria', etiqueta: 'En memoria' },
            { valor: 'firebase', etiqueta: 'Firebase' },
          ]}
        />
      </header>

      {fase === 'cargando' && (
        <p className="aviso" role="status">
          {modo === 'firebase' ? 'Conectando con Firebase…' : 'Preparando el termo…'}
        </p>
      )}
      {error && (
        <p className="aviso" role="alert">
          {error}
        </p>
      )}

      {!remoto && (
        <nav className="pestanas" aria-label="Vista">
          <Segmentado
            etiqueta="Vista"
            valor={pestana}
            alCambiar={(p) => useTienda.setState({ pestana: p })}
            opciones={[
              { valor: 'termo', etiqueta: 'Termo' },
              { valor: 'app', etiqueta: 'App' },
            ]}
          />
        </nav>
      )}

      <main className="escenario" data-pestana={remoto ? 'termo' : pestana} data-remoto={remoto}>
        <section className="col col-termo" aria-label="El termo">
          <Escenario />
          <PanelControles />
        </section>
        <LineaMensajes />
        {!remoto && (
          <section className="col col-app" aria-label="La app">
            <div className="telefono">
              <PantallaApp marco />
            </div>
          </section>
        )}
      </main>

      <FranjaMensajes />
    </div>
  );
}
