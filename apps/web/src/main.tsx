import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { aplicarTema } from './tema.ts';
// Fuentes del manual, autoalojadas, solo latín y solo los pesos que se usan.
import '@fontsource/bricolage-grotesque/latin-700.css';
import '@fontsource/bricolage-grotesque/latin-800.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/caveat/latin-700.css';
import './estilos.css';
import './estilos-simulador.css';
import './estilos-app.css';
import './estilos-principal.css';
import './estilos-escena.css';
import { escucharInstalacion } from './pwa/instalacion.ts';

aplicarTema();
escucharInstalacion();

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('Falta el elemento #raiz.');
createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
