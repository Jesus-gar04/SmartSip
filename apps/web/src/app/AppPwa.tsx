/**
 * La app (/): decide qué pantalla mostrar según el primer uso. La pantalla
 * Hoy completa (la ola que sube, la meta, el historial) llega en la parte 2E;
 * aquí queda su lugar con lo esencial y la salida de la cuenta.
 */
import { useEffect } from 'react';
import { app, useApp } from './estado.ts';
import { Principal } from './Principal.tsx';
import { Bienvenida, Emparejar, Entrar, Marco, PerfilInicial } from './PrimerUso.tsx';

let iniciada = false;

export function AppPwa() {
  const fase = useApp((s) => s.fase);
  const error = useApp((s) => s.error);

  useEffect(() => {
    if (iniciada) return;
    iniciada = true;
    void app.iniciar();
  }, []);

  switch (fase) {
    case 'cargando':
      return (
        <Marco>
          <p className="titulo-pantalla">Abriendo tu SmartSip…</p>
          <p className="texto-suave">Un momento: estamos buscando tu termo y tu día.</p>
        </Marco>
      );
    case 'bienvenida':
      return <Bienvenida />;
    case 'entrar':
      return <Entrar />;
    case 'perfil':
      return <PerfilInicial />;
    case 'emparejar':
      return <Emparejar />;
    case 'hoy':
      return <Principal />;
    case 'error':
      return (
        <Marco>
          <h1 className="titulo-pantalla">No pudimos abrir SmartSip</h1>
          <p className="texto-suave">{error}</p>
        </Marco>
      );
  }
}
