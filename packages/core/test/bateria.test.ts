import { describe, expect, it } from 'vitest';
import { autonomiaDias, cargaTras, consumoPorHora, REGLAS_BATERIA, textoAutonomia } from '../src/index.ts';

const HORA = 3_600_000;

describe('batería', () => {
  it('una carga completa dura 7 días con brillo medio', () => {
    expect(autonomiaDias(1, 'medio')).toBeCloseTo(7, 10);
    expect(autonomiaDias(1, 'alto')).toBeLessThan(7);
    expect(autonomiaDias(1, 'bajo')).toBeGreaterThan(7);
    expect(consumoPorHora('medio')).toBeCloseTo(1 / 168, 10);
  });

  it('se descarga con el tiempo y se carga en 2 h', () => {
    expect(cargaTras(1, 'medio', false, 24 * HORA)).toBeCloseTo(1 - 1 / 7, 10);
    expect(cargaTras(0.2, 'medio', true, HORA)).toBeCloseTo(0.7, 10);
    expect(cargaTras(0.9, 'medio', true, 2 * HORA)).toBe(1);
    expect(cargaTras(0.001, 'alto', false, 10 * HORA)).toBe(0);
  });

  it('acepta reglas propias', () => {
    const reglas = { ...REGLAS_BATERIA, autonomiaDiasBrilloMedio: 1 };
    expect(autonomiaDias(0.5, 'medio', reglas)).toBeCloseTo(0.5, 10);
  });

  it.each([
    [0, 'El termo se quedó sin batería. Conéctalo para seguir contando tus sorbos.'],
    [0.05, 'A la batería del termo le queda muy poco. Conviene cargarlo ya.'],
    [0.5, 'A la batería del termo le quedan unas 12 horas.'],
    [1.2, 'La batería del termo te alcanza para un día más.'],
    [4.3, 'La batería del termo te alcanza para unos 4 días.'],
    [7, 'La batería del termo te alcanza para unos 7 días.'],
  ])('%d días → "%s"', (dias, texto) => {
    expect(textoAutonomia(dias)).toBe(texto);
  });
});
