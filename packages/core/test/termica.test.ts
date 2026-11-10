import { describe, expect, it } from 'vitest';
import {
  celsiusAFahrenheit,
  coeficienteEnfriamiento,
  fahrenheitACelsius,
  mezclar,
  REGLAS_TERMICAS,
  temperaturaTras,
  tiempoHasta,
} from '../src/index.ts';

const HORA = 3_600_000;

describe('coeficienteEnfriamiento', () => {
  it('cerrado y lleno usa el k base', () => {
    expect(coeficienteEnfriamiento({ tapaCerrada: true, fraccionLlenado: 1 })).toBe(0.05);
  });

  it('la tapa abierta enfría diez veces más rápido', () => {
    const k = coeficienteEnfriamiento({ tapaCerrada: false, fraccionLlenado: 1 });
    expect(k).toBeCloseTo(0.5, 10);
  });

  it('con menos agua se enfría más rápido, con un límite', () => {
    expect(coeficienteEnfriamiento({ tapaCerrada: true, fraccionLlenado: 0.5 })).toBeCloseTo(0.1, 10);
    const vacio = coeficienteEnfriamiento({ tapaCerrada: true, fraccionLlenado: 0 });
    expect(vacio).toBeCloseTo(0.05 / REGLAS_TERMICAS.fraccionMinima, 10);
    expect(coeficienteEnfriamiento({ tapaCerrada: true, fraccionLlenado: -1 })).toBe(vacio);
    expect(coeficienteEnfriamiento({ tapaCerrada: true, fraccionLlenado: 2 })).toBe(0.05);
  });

  it('un peor aislamiento multiplica k', () => {
    expect(
      coeficienteEnfriamiento({ tapaCerrada: true, fraccionLlenado: 1, factorAislamiento: 3 }),
    ).toBeCloseTo(0.15, 10);
  });

  it('acepta reglas propias', () => {
    const reglas = { ...REGLAS_TERMICAS, kCerradoLlenoPorHora: 1 };
    expect(coeficienteEnfriamiento({ tapaCerrada: true, fraccionLlenado: 1 }, reglas)).toBe(1);
  });
});

describe('ley de Newton', () => {
  it('de 95 °C a unos 63 °C en 12 h con 25 °C de ambiente', () => {
    expect(temperaturaTras(95, 25, 0.05, 12 * HORA)).toBeCloseTo(63.4, 1);
  });

  it('el agua fría se calienta hacia el ambiente y nunca lo cruza', () => {
    const t = temperaturaTras(5, 31, 0.05, 1000 * HORA);
    expect(t).toBeLessThanOrEqual(31);
    expect(t).toBeCloseTo(31, 6);
    expect(temperaturaTras(5, 31, 0.05, HORA)).toBeGreaterThan(5);
  });

  it('sin tiempo no cambia', () => {
    expect(temperaturaTras(80, 25, 0.05, 0)).toBe(80);
  });

  it('es exacta: dos pasos dan lo mismo que uno', () => {
    const uno = temperaturaTras(90, 30, 0.2, 2 * HORA);
    const dos = temperaturaTras(temperaturaTras(90, 30, 0.2, HORA), 30, 0.2, HORA);
    expect(dos).toBeCloseTo(uno, 10);
  });

  it('tiempoHasta es la inversa de temperaturaTras', () => {
    const ms = tiempoHasta(95, 63.4, 25, 0.05);
    expect(temperaturaTras(95, 25, 0.05, ms)).toBeCloseTo(63.4, 8);
    expect(tiempoHasta(70, 70, 25, 0.05)).toBe(0);
    expect(tiempoHasta(70, 20, 25, 0.05)).toBe(Number.POSITIVE_INFINITY); // cruzar el ambiente
    expect(tiempoHasta(70, 80, 25, 0.05)).toBe(Number.POSITIVE_INFINITY); // alejarse del ambiente
  });
});

describe('mezcla y unidades', () => {
  it('mezclar promedia por volumen', () => {
    expect(mezclar(100, 80, 100, 20)).toBe(50);
    expect(mezclar(300, 90, 100, 10)).toBe(70);
    expect(mezclar(0, 90, 200, 10)).toBe(10);
    expect(mezclar(0, 90, 0, 10)).toBe(10);
  });

  it('convierte entre °C y °F', () => {
    expect(celsiusAFahrenheit(100)).toBe(212);
    expect(fahrenheitACelsius(32)).toBe(0);
    expect(fahrenheitACelsius(celsiusAFahrenheit(37))).toBeCloseTo(37, 10);
  });
});
