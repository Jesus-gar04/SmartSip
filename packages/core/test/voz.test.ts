import { describe, expect, it } from 'vitest';
import { cantidad, esperadoA, fraseDelDia, saludo } from '../src/index.ts';

const NBSP = ' ';

describe('voz', () => {
  it('saluda según la hora y con el primer nombre', () => {
    expect(saludo(8, 'Carolina Torres')).toBe('Buenos días, Carolina');
    expect(saludo(15, null)).toBe('Buenas tardes');
    expect(saludo(21, '  ')).toBe('Buenas noches');
    expect(saludo(3, 'Ana')).toBe('Buenas noches, Ana');
  });

  it('dice las cantidades como se dicen', () => {
    expect(cantidad(40)).toBe(`40${NBSP}ml`);
    expect(cantidad(2600)).toBe(`2,6${NBSP}L`);
  });

  it('espera que la meta se reparta entre las 7 y las 22', () => {
    expect(esperadoA(6, 2400)).toBe(0);
    expect(esperadoA(14.5, 2400)).toBe(1200);
    expect(esperadoA(23, 2400)).toBe(2400);
  });

  it('cada situación tiene su frase, con una sola palabra en azul', () => {
    expect(fraseDelDia(0, 2400, 8)).toMatchObject({ antes: '¿Empezamos con un ', azul: 'sorbo', detalle: `Tu meta de hoy es 2,4${NBSP}L.` });
    expect(fraseDelDia(0, 2400, 15).detalle).toBe(`Aún no hay agua registrada hoy. Tu meta es 2,4${NBSP}L.`);
    expect(fraseDelDia(1300, 2400, 14.5)).toMatchObject({ azul: 'ritmo', detalle: `Llevas 1,3${NBSP}L de 2,4${NBSP}L.` });
    expect(fraseDelDia(400, 2400, 16)).toMatchObject({
      azul: 'agua',
      detalle: `Llevas 400${NBSP}ml de 2,4${NBSP}L. Un par de sorbos y te pones al día.`,
    });
    expect(fraseDelDia(2500, 2400, 20)).toMatchObject({ antes: 'Hidrataste lo de ', azul: 'hoy', cumplida: true });
  });
});
