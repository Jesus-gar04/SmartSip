import { describe, expect, it } from 'vitest';
import { CAPACIDAD_COLA, ColaSinConexion, RegistroRecibidos } from '../src/index.ts';

const ev = (id: number) => ({ id });

describe('ColaSinConexion', () => {
  it('guarda en orden hasta que se confirma', () => {
    const cola = new ColaSinConexion<{ id: number }>();
    expect(cola.capacidad).toBe(CAPACIDAD_COLA);
    for (let i = 1; i <= 5; i++) cola.encolar(ev(i));
    expect(cola.pendientes().map((e) => e.id)).toEqual([1, 2, 3, 4, 5]);
    expect(cola.confirmarHasta(3)).toBe(3);
    expect(cola.pendientes().map((e) => e.id)).toEqual([4, 5]);
    expect(cola.confirmarHasta(3)).toBe(0);
    expect(cola.tamano).toBe(2);
  });

  it('pendientes devuelve una copia', () => {
    const cola = new ColaSinConexion<{ id: number }>(3);
    cola.encolar(ev(1));
    const copia = cola.pendientes() as Array<{ id: number }>;
    copia.push(ev(99));
    expect(cola.tamano).toBe(1);
  });

  it('si se llena, conserva los más recientes y cuenta los perdidos', () => {
    const cola = new ColaSinConexion<{ id: number }>(3);
    for (let i = 1; i <= 5; i++) cola.encolar(ev(i));
    expect(cola.pendientes().map((e) => e.id)).toEqual([3, 4, 5]);
    expect(cola.descartados).toBe(2);
  });

  it('rechaza capacidades inválidas', () => {
    expect(() => new ColaSinConexion(0)).toThrow(RangeError);
    expect(() => new ColaSinConexion(2.5)).toThrow(RangeError);
  });
});

describe('RegistroRecibidos', () => {
  it('deja pasar cada id una sola vez', () => {
    const r = new RegistroRecibidos();
    expect(r.ultimoId).toBe(0);
    expect(r.aceptar(1)).toBe(true);
    expect(r.aceptar(2)).toBe(true);
    expect(r.aceptar(2)).toBe(false);
    expect(r.aceptar(1)).toBe(false);
    expect(r.aceptar(7)).toBe(true); // los huecos por eventos perdidos no bloquean
    expect(r.ultimoId).toBe(7);
  });
});
