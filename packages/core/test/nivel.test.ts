import { describe, expect, it } from 'vitest';
import { clasificarCambio, DetectorNivel, REGLAS_NIVEL } from '../src/index.ts';

describe('clasificarCambio', () => {
  it.each([
    [0, 'ruido'],
    [4, 'ruido'],
    [-4.9, 'ruido'],
    [10, 'ajuste'],
    [29, 'ajuste'],
    [30, 'llenado'],
    [300, 'llenado'],
    [-5, 'sorbo'],
    [-40, 'sorbo'],
    [-150, 'sorbo'],
    [-151, 'descensoGrande'],
    [-393, 'descensoGrande'],
  ] as const)('%d ml → %s', (delta, esperado) => {
    expect(clasificarCambio(delta)).toBe(esperado);
  });
});

/** Entrega la misma lectura cada 500 ms durante `ms` y devuelve los cambios. */
function mantener(d: DetectorNivel, nivel: number, desde: number, ms: number) {
  const cambios = [];
  for (let t = desde; t <= desde + ms; t += 500) {
    const c = d.lectura(nivel, t);
    if (c) cambios.push(c);
  }
  return cambios;
}

describe('DetectorNivel', () => {
  it('cuenta un sorbo solo cuando la lectura se mantiene 2 s', () => {
    const d = new DetectorNivel(393);
    expect(d.lectura(353, 0)).toBeNull();
    expect(d.lectura(353, 1500)).toBeNull();
    expect(d.lectura(353, 2000)).toEqual({ tipo: 'sorbo', ml: 40, nivelMl: 353, enMs: 2000 });
    // Una vez evaluada, la misma lectura no vuelve a contar.
    expect(d.lectura(353, 2500)).toBeNull();
    expect(d.referenciaMl).toBe(353);
  });

  it('ignora lecturas que saltan mientras el termo está inclinado', () => {
    const d = new DetectorNivel(393);
    const lecturas = [380, 300, 360, 250, 340, 310, 370];
    const cambios = lecturas.map((n, i) => d.lectura(n, i * 500)).filter(Boolean);
    expect(cambios).toEqual([]);
    expect(d.referenciaMl).toBe(393);
  });

  it('tolera variaciones pequeñas dentro de una lectura estable', () => {
    const d = new DetectorNivel(393);
    d.lectura(350, 0);
    d.lectura(351.5, 1000);
    expect(d.lectura(349, 2000)?.tipo).toBe('sorbo');
  });

  it('detecta llenado y descenso grande', () => {
    const d = new DetectorNivel(100);
    expect(mantener(d, 393, 0, 3000)).toEqual([{ tipo: 'llenado', ml: 293, nivelMl: 393, enMs: 2000 }]);
    expect(mantener(d, 0, 10_000, 3000)).toEqual([
      { tipo: 'descensoGrande', ml: 393, nivelMl: 0, enMs: 12_000 },
    ]);
  });

  it('el ruido no mueve la referencia, así que no se pierde agua por goteo', () => {
    const d = new DetectorNivel(393);
    expect(mantener(d, 390, 0, 3000)).toEqual([]);
    expect(d.referenciaMl).toBe(393);
    // Tres mililitros más se suman a los anteriores y forman un sorbo de 6 ml.
    expect(mantener(d, 387, 5000, 3000)).toEqual([{ tipo: 'sorbo', ml: 6, nivelMl: 387, enMs: 7000 }]);
  });

  it('una subida pequeña se toma como nueva referencia sin avisar', () => {
    const d = new DetectorNivel(300);
    expect(mantener(d, 315, 0, 3000)).toEqual([]);
    expect(d.referenciaMl).toBe(315);
    expect(mantener(d, 275, 5000, 3000)[0]).toMatchObject({ tipo: 'sorbo', ml: 40 });
  });

  it('acepta reglas propias', () => {
    const d = new DetectorNivel(393, { ...REGLAS_NIVEL, estableMs: 0, maxSorboMl: 20 });
    d.lectura(353, 0);
    expect(d.lectura(353, 0)?.tipo).toBe('descensoGrande');
  });
});
