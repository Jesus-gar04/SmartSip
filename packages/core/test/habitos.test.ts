import { describe, expect, it } from 'vitest';
import { calcularHabitos, cumplio, franjaHoraria, resumenVacio, type ResumenDia } from '../src/index.ts';

const dia = (fecha: string, totalMl: number, hora = 8, temp: number | null = 10, metaMl: number | null = 2000): ResumenDia => ({
  ...resumenVacio(fecha),
  totalMl,
  sorbos: totalMl > 0 ? 10 : 0,
  porHora: resumenVacio(fecha).porHora.map((_, h) => (h === hora ? totalMl : 0)),
  tempSumaC: temp === null ? 0 : temp * 10,
  tempMuestras: temp === null || totalMl === 0 ? 0 : 10,
  metaMl,
});

const esFinde = (f: string) => ['2026-11-07', '2026-11-08'].includes(f);

describe('hábitos', () => {
  it('dice la franja en que más bebes como se diría', () => {
    expect(franjaHoraria(6)).toBe('6 y las 8 de la mañana');
    expect(franjaHoraria(15)).toBe('3 y las 5 de la tarde');
    expect(franjaHoraria(21)).toBe('9 y las 11 de la noche');
    expect(franjaHoraria(22)).toBe('10 y las 12 de la noche');
  });

  it('sin datos, invita a empezar', () => {
    const h = calcularHabitos([resumenVacio('2026-11-09')], 2000, esFinde);
    expect(h.diasConDatos).toBe(0);
    expect(h.frases).toEqual(['Cuando el termo registre tus primeros sorbos, aquí verás cómo bebes a lo largo de la semana.']);
  });

  it('cuenta metas, racha, hora pico, temperatura y fines de semana', () => {
    const dias = [
      dia('2026-11-03', 2100),
      dia('2026-11-04', 1500),
      dia('2026-11-05', 2200),
      dia('2026-11-06', 2300),
      dia('2026-11-07', 900, 18),
      dia('2026-11-08', 800, 18),
      dia('2026-11-09', 2050),
    ];
    const h = calcularHabitos(dias, 2000, esFinde);
    expect(h).toMatchObject({ diasConDatos: 7, diasCumplidos: 4, racha: 1, horaPico: 7 });
    expect(h.frases).toContain('Cumpliste tu meta 4 de los últimos 7 días con datos.');
    expect(h.frases).toContain('Bebes más entre las 7 y las 9 de la mañana.');
    expect(h.frases).toContain('Te gusta el agua fría: en promedio, a 10 °C.');
    expect(h.frases).toContain('Los fines de semana tomas menos agua que entre semana.');
  });

  it('la racha no se rompe porque hoy todavía no se haya cumplido', () => {
    const dias = [dia('2026-11-06', 2100), dia('2026-11-07', 2100), dia('2026-11-08', 2100), dia('2026-11-09', 300, 8, 65)];
    const h = calcularHabitos(dias, 2000, () => false);
    expect(h.racha).toBe(3);
    expect(h.frases).toContain('Llevas 3 días seguidos cumpliendo tu meta.');
    expect(cumplio(dia('x', 2000, 8, 10, null), 2000)).toBe(true);
  });

  it('distingue a quien bebe caliente', () => {
    const h = calcularHabitos([dia('2026-11-09', 1000, 7, 65)], 2000, () => false);
    expect(h.frases).toContain('Prefieres beber caliente: en promedio, a 65 °C.');
    expect(calcularHabitos([dia('2026-11-09', 1000, 7, 25)], 2000, () => false).frases).toContain('Sueles beber el agua a unos 25 °C.');
  });
});
