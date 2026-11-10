/**
 * Traduce los tokens del manual de marca a variables CSS. Es la única fuente
 * de color, tipografía y medidas de la web: el CSS solo usa `var(--…)`.
 * Tema Día por defecto; Noche cuando el sistema está en modo oscuro o la
 * persona lo elige en Ajustes.
 */
import {
  colores,
  duracion,
  espacio,
  fundido,
  lineaFina,
  margenLateral,
  radio,
  tipografia,
  trazo,
  type Colores,
} from 'smartsip-tokens';

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

function variablesColor(c: Colores): string {
  return Object.entries(c)
    .map(([k, v]) => `--${kebab(k)}: ${v};`)
    .join('\n  ');
}

function variablesFijas(): string {
  const l: string[] = [
    `--fuente-display: ${tipografia.familia.display};`,
    `--fuente-sans: ${tipografia.familia.sans};`,
    `--fuente-firma: ${tipografia.familia.firma};`,
    `--peso-regular: 400;`,
    `--peso-medio: 600;`,
    `--peso-negrita: 700;`,
    `--margen: ${margenLateral}px;`,
    `--linea-fina: ${lineaFina}px;`,
    `--trazo: ${trazo}px;`,
    `--curva: cubic-bezier(0.2, 0.9, 0.25, 1);`,
    `--curva-fundido: cubic-bezier(${fundido.curva.join(', ')});`,
  ];
  for (const [k, v] of Object.entries(radio)) l.push(`--radio-${kebab(k)}: ${v}px;`);
  for (const [k, v] of Object.entries(duracion)) l.push(`--dur-${kebab(k)}: ${v}ms;`);
  for (const [k, v] of Object.entries(espacio)) l.push(`--e${k}: ${v}px;`);
  for (const [nombre, e] of Object.entries(tipografia.escala)) {
    const n = kebab(nombre);
    l.push(`--f-${n}: var(--fuente-${e.familia});`);
    l.push(`--t-${n}: ${e.tamano}px;`);
    // Menos de 4 es un factor (0,92); si no, píxeles.
    l.push(`--l-${n}: ${e.alturaLinea < 4 ? e.alturaLinea : `${e.alturaLinea}px`};`);
    l.push(`--p-${n}: ${e.peso};`);
    l.push(`--k-${n}: ${e.tracking}em;`);
  }
  return l.join('\n  ');
}

export type PreferenciaTema = 'sistema' | 'dia' | 'noche';

/**
 * Día por defecto; Noche si el sistema está en modo oscuro, salvo que la
 * persona haya elegido uno en Ajustes (`<html data-tema="dia|noche">`).
 */
export function hojaDeTema(): string {
  return `:root {
  color-scheme: light;
  --fondo-aviso: #241d18;
  ${variablesFijas()}
  ${variablesColor(colores.dia)}
}
@media (prefers-color-scheme: dark) {
  :root:not([data-tema="dia"]) {
  color-scheme: dark;
  --fondo-aviso: #000;
  ${variablesColor(colores.noche)}
  }
}
:root[data-tema="noche"] {
  color-scheme: dark;
  --fondo-aviso: #000;
  ${variablesColor(colores.noche)}
}`;
}

const CLAVE_TEMA = 'smartsip:tema';

export function temaGuardado(): PreferenciaTema {
  try {
    const v = localStorage.getItem(CLAVE_TEMA);
    return v === 'dia' || v === 'noche' ? v : 'sistema';
  } catch {
    return 'sistema';
  }
}

/** Aplica y recuerda el tema en este dispositivo. */
export function fijarTema(t: PreferenciaTema): void {
  if (t === 'sistema') delete document.documentElement.dataset['tema'];
  else document.documentElement.dataset['tema'] = t;
  try {
    if (t === 'sistema') localStorage.removeItem(CLAVE_TEMA);
    else localStorage.setItem(CLAVE_TEMA, t);
  } catch {
    /* sin almacenamiento: vale mientras la página esté abierta */
  }
}

/** Inserta las variables antes del primer render, para que no haya parpadeo. */
export function aplicarTema(): void {
  const estilo = document.createElement('style');
  estilo.dataset['smartsip'] = 'tema';
  estilo.textContent = hojaDeTema();
  document.head.prepend(estilo);
  const t = temaGuardado();
  if (t !== 'sistema') document.documentElement.dataset['tema'] = t;
}
