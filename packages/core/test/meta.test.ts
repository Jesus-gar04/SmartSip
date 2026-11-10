import { describe, expect, it } from 'vitest';
import {
  calcularMeta,
  explicarCambio,
  formatoLitros,
  formatoTemperatura,
  REGLAS_META,
  type PerfilMeta,
} from '../src/index.ts';

const NBSP = ' ';
const persona: PerfilMeta = { pesoKg: 69, actividad: 'baja' };

describe('calcularMeta', () => {
  it('reproduce los ejemplos de SPEC.md: 2,4 L y 2,6 L a 33 °C', () => {
    expect(calcularMeta(persona, { temperaturaC: 25 }).totalMl).toBe(2400);
    const calor = calcularMeta(persona, { temperaturaC: 33 });
    expect(calor.totalMl).toBe(2600);
    expect(calor.climaMl).toBe(200);
  });

  it.each([
    [27, 0],
    [29.9, 0],
    [30, 100],
    [32.9, 100],
    [33, 200],
    [36, 300],
    [15, 0],
  ])('a %d °C el clima suma %d ml', (t, ml) => {
    expect(calcularMeta(persona, { temperaturaC: t }).climaMl).toBe(ml);
  });

  it('la actividad suma 0, 350 o 700 ml', () => {
    const clima = { temperaturaC: 25 };
    expect(calcularMeta({ ...persona, actividad: 'media' }, clima).actividadMl).toBe(350);
    expect(calcularMeta({ ...persona, actividad: 'alta' }, clima).totalMl).toBe(3100);
  });

  it('se acota entre 1,5 y 4,0 L', () => {
    expect(calcularMeta({ pesoKg: 30, actividad: 'baja' }, { temperaturaC: 20 }).totalMl).toBe(1500);
    expect(calcularMeta({ pesoKg: 120, actividad: 'alta' }, { temperaturaC: 40 }).totalMl).toBe(4000);
  });

  it('rechaza un peso inválido', () => {
    expect(() => calcularMeta({ pesoKg: 0, actividad: 'baja' }, { temperaturaC: 25 })).toThrow(RangeError);
    expect(() => calcularMeta({ pesoKg: Number.NaN, actividad: 'baja' }, { temperaturaC: 25 })).toThrow();
  });

  it('acepta reglas propias', () => {
    const reglas = { ...REGLAS_META, mlPorKg: 30 };
    expect(calcularMeta(persona, { temperaturaC: 25 }, reglas).totalMl).toBe(2100);
  });
});

describe('explicarCambio', () => {
  const base = calcularMeta(persona, { temperaturaC: 25 });

  it('no dice nada si la meta no cambió', () => {
    expect(explicarCambio(base, calcularMeta(persona, { temperaturaC: 28 }))).toBeNull();
  });

  it('explica el calor con la frase de SPEC.md', () => {
    const calor = calcularMeta(persona, { temperaturaC: 33 });
    expect(explicarCambio(base, calor)).toBe(`Hoy hace 33${NBSP}°C, así que subimos tu meta a 2,6${NBSP}L.`);
    expect(explicarCambio(calor, base)).toBe(`Hoy el día está más fresco (25${NBSP}°C): tu meta vuelve a 2,4${NBSP}L.`);
  });

  it('explica cambios de actividad y de peso', () => {
    const activa = calcularMeta({ ...persona, actividad: 'alta' }, { temperaturaC: 25 });
    expect(explicarCambio(base, activa)).toBe(`Con tu nueva rutina, tu meta queda en 3,1${NBSP}L.`);
    const masPeso = calcularMeta({ ...persona, pesoKg: 80 }, { temperaturaC: 25 });
    expect(explicarCambio(base, masPeso)).toBe(`Con tu peso actualizado (80${NBSP}kg), tu meta queda en 2,8${NBSP}L.`);
  });
});

describe('formato', () => {
  it('litros con coma decimal y espacio irrompible', () => {
    expect(formatoLitros(2415)).toBe(`2,4${NBSP}L`);
    expect(formatoLitros(1200)).toBe(`1,2${NBSP}L`);
    expect(formatoLitros(393, 2)).toBe(`0,39${NBSP}L`);
  });

  it('temperatura entera en °C o °F', () => {
    expect(formatoTemperatura(63.4)).toBe(`63${NBSP}°C`);
    expect(formatoTemperatura(63.4, 'F')).toBe(`146${NBSP}°F`);
  });
});
