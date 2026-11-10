import { describe, expect, it } from 'vitest';
import {
  colores,
  duracion,
  espacio,
  margenLateral,
  paleta,
  radio,
  resorte,
  reticula,
  tipografia,
  tokens,
  trazo,
  type Esquema,
} from '../src/index.ts';

/** Color #RRGGBB o rgba(r, g, b, a) sobre un fondo, en RGB. */
function rgb(color: string, fondo?: [number, number, number]): [number, number, number] {
  if (color.startsWith('#')) {
    const n = Number.parseInt(color.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const [r, g, b, a] = color
    .replace(/rgba\(|\)/g, '')
    .split(',')
    .map((x) => Number(x.trim())) as [number, number, number, number];
  if (!fondo) throw new Error('rgba necesita fondo');
  return [r * a + fondo[0] * (1 - a), g * a + fondo[1] * (1 - a), b * a + fondo[2] * (1 - a)];
}

function luminancia([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Contraste WCAG 2.x entre un color y su fondo. */
function contraste(a: string, b: string): number {
  const fondo = rgb(b);
  const la = luminancia(rgb(a, fondo));
  const lb = luminancia(fondo);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const esquemas: Esquema[] = ['dia', 'noche'];

describe('color (manual §2)', () => {
  it('conserva los colores exactos del manual', () => {
    expect(paleta.azul).toBe('#1F6FB2');
    expect(paleta.papel).toBe('#F2EBE4');
    expect(paleta.tinta).toBe('#241D18');
    expect(paleta.tierra).toBe('#8C7259');
    expect(paleta.cacao).toBe('#6B5643');
    expect(paleta.bruma).toBe('#A2BCD1');
    expect(paleta.gota).toBe('#4FB3FF');
  });

  it('nunca usa blanco puro ni negro puro como fondo', () => {
    for (const e of esquemas) {
      expect(colores[e].papel.toUpperCase()).not.toBe('#FFFFFF');
      expect(colores[e].papel).not.toBe('#000000');
    }
  });

  it('el agua es el mismo azul de día y de noche; Noche invierte papel y tinta', () => {
    expect(colores.dia.agua).toBe(paleta.azul);
    expect(colores.noche.agua).toBe(paleta.azul);
    expect(colores.noche.papel).toBe(colores.dia.tinta);
    expect(colores.noche.tinta).toBe(colores.dia.papel);
  });

  it('solo usa colores de la paleta (o la tinta y el papel con opacidad)', () => {
    const permitidos = new Set<string>(Object.values(paleta));
    for (const e of esquemas) {
      for (const valor of Object.values(colores[e])) {
        if (valor.startsWith('rgba')) {
          const m = valor.match(/rgba\((\d+), (\d+), (\d+)/);
          const hex = `#${[m?.[1], m?.[2], m?.[3]].map((x) => Number(x).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
          expect([paleta.tinta, paleta.papel]).toContain(hex);
        } else {
          expect(permitidos.has(valor)).toBe(true);
        }
      }
    }
  });
});

describe('contraste (WCAG)', () => {
  it.each(esquemas)('texto legible en %s', (e) => {
    const c = colores[e];
    expect(contraste(c.tinta, c.papel)).toBeGreaterThanOrEqual(7);
    expect(contraste(c.textoSuave, c.papel)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(c.tinta, c.superficie)).toBeGreaterThanOrEqual(7);
    expect(contraste(c.sobreAgua, c.agua)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(c.selloTexto, c.sello)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(c.cacao, c.papel)).toBeGreaterThanOrEqual(4.5);
  });

  it('el azul como texto: grande de día, legible siempre de noche', () => {
    expect(contraste(colores.dia.aguaTexto, colores.dia.papel)).toBeGreaterThanOrEqual(3);
    expect(contraste(colores.dia.aguaHonda, colores.dia.papel)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(colores.noche.aguaTexto, colores.noche.papel)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('tipografía (manual §4)', () => {
  it('tres voces: display, sans y firma', () => {
    expect(tipografia.familia.display.startsWith('"Bricolage Grotesque"')).toBe(true);
    expect(tipografia.familia.sans.startsWith('Inter')).toBe(true);
    expect(tipografia.familia.firma.startsWith('Caveat')).toBe(true);
    expect(tipografia.cifras.css).toBe('tabular-nums');
  });

  it('la pregunta y la cifra son ExtraBold y apretadas', () => {
    expect(tipografia.escala.pregunta).toMatchObject({ tamano: 56, peso: 800, alturaLinea: 0.92 });
    expect(tipografia.escala.cifra).toMatchObject({ tamano: 64, peso: 800 });
    expect(tipografia.escala.sello.tracking).toBe(0.18);
  });
});

describe('forma (manual §5)', () => {
  it('esquinas de 14, 22 y 32 px; píldora solo para sellos', () => {
    expect(radio).toMatchObject({ boton: 14, tarjeta: 22, foto: 32, sello: 999 });
    expect(trazo).toBe(2);
  });

  it('todo espaciado cae en la retícula de 4 px y el margen lateral es 24 px', () => {
    for (const v of Object.values(espacio)) expect(v % reticula).toBe(0);
    expect(margenLateral).toBe(24);
  });
});

describe('movimiento', () => {
  it('el sorbo dura 600 ms, la meta 900 ms y la ola se mece cada 6 s', () => {
    expect(duracion).toMatchObject({ micro: 160, transicion: 280, sorbo: 600, meta: 900, nuevoDia: 1200, cicloOla: 6000 });
  });

  it('los resortes usan esas duraciones y nada rebota más de una vez', () => {
    for (const [nombre, r] of Object.entries(resorte)) {
      expect(r.duracionMs).toBe(duracion[nombre as keyof typeof duracion]);
      expect(r.amortiguamiento).toBeGreaterThanOrEqual(0.75);
      expect(r.amortiguamiento).toBeLessThanOrEqual(1);
    }
  });

  it('el objeto agrupado expone todo', () => {
    expect(tokens.paleta).toBe(paleta);
    expect(tokens.radio).toBe(radio);
  });
});
