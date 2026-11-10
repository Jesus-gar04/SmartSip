/** Lectura de apps/web/.env.local para los scripts de consola. */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { configDesdeEntorno, type ConfigFirebase } from '../src/index.ts';

export const RUTA_ENV = fileURLToPath(new URL('../../../apps/web/.env.local', import.meta.url));

export function leerEnv(ruta: string = RUTA_ENV): Record<string, string> {
  if (!existsSync(ruta)) return {};
  const salida: Record<string, string> = {};
  for (const linea of readFileSync(ruta, 'utf8').split(/\r?\n/)) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) continue;
    const i = limpia.indexOf('=');
    if (i > 0) salida[limpia.slice(0, i).trim()] = limpia.slice(i + 1).trim();
  }
  return salida;
}

export function configDelProyecto(): ConfigFirebase {
  return configDesdeEntorno({ ...leerEnv(), ...process.env });
}

export const CONFIG_EMULADOR: ConfigFirebase = {
  apiKey: 'demo-key',
  authDomain: 'demo-smartsip.firebaseapp.com',
  projectId: 'demo-smartsip',
  appId: 'demo-app',
};
