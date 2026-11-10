/**
 * Genera los íconos PNG de la PWA a partir del ícono oficial del manual
 * (public/marca/smartsip-icono-app.svg): la gota con la S en blanco sobre azul.
 *
 *   pnpm --filter smartsip-web iconos
 *
 * - icono-192 / icono-512: con las esquinas del manual, para Android y escritorio.
 * - icono-maskable-512: a sangre (sin esquinas); el sistema recorta la forma.
 *   El símbolo ocupa ~62 % del alto y cae dentro de la zona segura (círculo del 80 %).
 * - apple-touch-icon-180: a sangre; iOS redondea solo.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const raiz = fileURLToPath(new URL('../public/', import.meta.url));
const original = readFileSync(`${raiz}marca/smartsip-icono-app.svg`, 'utf8');
const aSangre = original.replace(/rx="[^"]*"/, 'rx="0"');

const salidas: Array<[archivo: string, svg: string, lado: number]> = [
  ['icono-192.png', original, 192],
  ['icono-512.png', original, 512],
  ['icono-maskable-512.png', aSangre, 512],
  ['apple-touch-icon-180.png', aSangre, 180],
];

mkdirSync(`${raiz}iconos`, { recursive: true });
for (const [archivo, svg, lado] of salidas) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: lado } }).render().asPng();
  writeFileSync(`${raiz}iconos/${archivo}`, png);
  console.log(`✓ iconos/${archivo} (${lado}×${lado}, ${png.length} bytes)`);
}
