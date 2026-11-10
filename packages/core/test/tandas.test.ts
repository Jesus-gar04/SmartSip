import { describe, expect, it } from 'vitest';
import { agruparEnTandas, duracionCorta, franjaDe, type RegistroEvento } from '../src/index.ts';

const MIN = 60_000;
let id = 0;
const ev = (
  tipo: RegistroEvento['tipo'],
  ml: number,
  nivelMl: number,
  min: number,
  extra: Partial<RegistroEvento> = {},
): RegistroEvento => ({
  clave: `t-${++id}`,
  termoId: 't',
  id,
  tipo,
  ml,
  nivelMl,
  enMs: min * MIN,
  dia: '2026-11-05',
  hora: Math.floor(min / 60),
  temperaturaC: 12,
  estado: 'registrado',
  ...extra,
});

describe('agruparEnTandas', () => {
  it('abre una tanda con cada llenado y suma lo que tomaste en ella', () => {
    const tandas = agruparEnTandas([
      ev('llenado', 393, 393, 5 * 60 + 6),
      ev('sorbo', 92, 301, 5 * 60 + 12, { temperaturaC: 14 }),
      ev('sorbo', 63, 238, 5 * 60 + 26, { temperaturaC: 13 }),
      ev('llenado', 155, 393, 7 * 60),
      ev('sorbo', 50, 343, 7 * 60 + 30, { temperaturaC: null }),
      ev('descensoGrande', 200, 143, 8 * 60, { estado: 'vaciado' }),
    ]);
    expect(tandas).toHaveLength(2);
    const [a, b] = tandas;
    expect(a).toMatchObject({ bebidoMl: 155, sorbos: 2, nivelInicialMl: 393, nivelFinalMl: 238, tempMinC: 13, tempMaxC: 14, franja: 'madrugada' });
    expect(a?.finMs).toBe((5 * 60 + 26) * MIN);
    expect(b).toMatchObject({ bebidoMl: 50, sorbos: 1, vaciadoMl: 200, nivelFinalMl: 143, tempMinC: null, franja: 'mañana' });
  });

  it('el agua que quedaba de ayer forma su propia tanda, sin llenado', () => {
    const [t] = agruparEnTandas([ev('sorbo', 40, 160, 8 * 60), ev('descensoGrande', 180, 0, 9 * 60, { estado: 'bebido' })]);
    expect(t).toMatchObject({ llenado: null, nivelInicialMl: 200, bebidoMl: 220, sorbos: 1 });
  });

  it('un llenado sin sorbos después sigue siendo una tanda', () => {
    const tandas = agruparEnTandas([ev('llenado', 393, 393, 20 * 60)]);
    expect(tandas).toHaveLength(1);
    expect(tandas[0]).toMatchObject({ bebidoMl: 0, sorbos: 0, franja: 'noche' });
  });

  it('sin eventos no hay tandas', () => {
    expect(agruparEnTandas([])).toEqual([]);
  });
});

describe('franjaDe y duracionCorta', () => {
  it('reparte las horas en cuatro franjas', () => {
    expect([0, 5, 6, 11, 12, 18, 19, 23].map(franjaDe)).toEqual(['madrugada', 'madrugada', 'mañana', 'mañana', 'tarde', 'tarde', 'noche', 'noche']);
  });

  it('dice la duración como la diría una persona', () => {
    expect(duracionCorta(20_000)).toBe('1 min');
    expect(duracionCorta(49 * MIN)).toBe('49 min');
    expect(duracionCorta(60 * MIN)).toBe('1 h');
    expect(duracionCorta(125 * MIN)).toBe('2 h 05 min');
  });
});
