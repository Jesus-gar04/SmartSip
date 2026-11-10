import { describe, expect, it } from 'vitest';
import {
  aporte,
  aRegistro,
  claveEvento,
  ErrorCuenta,
  horaLocal,
  MENSAJES_CUENTA,
  metaCumplida,
  rellenarDias,
  resumenVacio,
  sumarAporte,
  sumarDias,
  temperaturaPromedio,
  type RegistroEvento,
} from '../src/index.ts';

const T0 = Date.UTC(2026, 10, 9, 13, 0, 0); // 08:00 en Barranquilla
const base = { id: 7, ml: 40, enMs: T0, nivelMl: 353 };

describe('registros', () => {
  it('la clave se ordena sola y no choca entre termos', () => {
    expect(claveEvento('SS-0001', 7)).toBe('SS-0001_0000000007');
    expect(claveEvento('SS-0001', 10) > claveEvento('SS-0001', 9)).toBe(true);
  });

  it('calcula la hora local', () => {
    expect(horaLocal(T0, -300)).toBe(8);
    expect(horaLocal(T0, 0)).toBe(13);
  });

  it('convierte un evento en registro con día, hora y estado', () => {
    expect(aRegistro('SS-0001', { tipo: 'sorbo', ...base }, 61.26, -300)).toEqual({
      clave: 'SS-0001_0000000007',
      termoId: 'SS-0001',
      tipo: 'sorbo',
      ...base,
      dia: '2026-11-09',
      hora: 8,
      temperaturaC: 61.3,
      estado: 'registrado',
    });
    expect(aRegistro('SS-0001', { tipo: 'descensoGrande', ...base }, null, -300).estado).toBe('pendiente');
  });

  it('solo suma al día lo que se bebió', () => {
    const r = (tipo: RegistroEvento['tipo'], estado: RegistroEvento['estado'], temperaturaC: number | null = 60) => ({
      ...aRegistro('SS-0001', { tipo, ...base }, temperaturaC, -300),
      estado,
    });
    expect(aporte(r('sorbo', 'registrado'))).toMatchObject({ totalMl: 40, sorbos: 1, tempSumaC: 60, tempMuestras: 1 });
    expect(aporte(r('sorbo', 'registrado', null))).toMatchObject({ totalMl: 40, tempSumaC: 0, tempMuestras: 0 });
    expect(aporte(r('descensoGrande', 'bebido'))).toMatchObject({ totalMl: 40, sorbos: 1 });
    expect(aporte(r('descensoGrande', 'pendiente'))).toBeNull();
    expect(aporte(r('descensoGrande', 'vaciado'))).toBeNull();
    expect(aporte(r('llenado', 'registrado'))).toMatchObject({ totalMl: 0, llenados: 1, llenadoMl: 40 });
  });

  it('suma aportes al resumen y calcula promedios', () => {
    const vacio = resumenVacio('2026-11-09');
    expect(temperaturaPromedio(vacio)).toBeNull();
    const a = aporte(aRegistro('SS-0001', { tipo: 'sorbo', ...base }, 60, -300));
    const b = aporte(aRegistro('SS-0001', { tipo: 'sorbo', ...base, id: 8 }, 40, -300));
    if (!a || !b) throw new Error('debería sumar');
    const r = sumarAporte(sumarAporte(vacio, a), b);
    expect(r).toMatchObject({ totalMl: 80, sorbos: 2 });
    expect(r.porHora[8]).toBe(80);
    expect(temperaturaPromedio(r)).toBe(50);
    expect(metaCumplida(r)).toBe(false);
    expect(metaCumplida({ ...r, metaMl: 80 })).toBe(true);
  });

  it('suma días y completa rangos', () => {
    expect(sumarDias('2026-11-30', 1)).toBe('2026-12-01');
    expect(sumarDias('2026-01-01', -1)).toBe('2025-12-31');
    expect(() => sumarDias('ayer', 1)).toThrow(RangeError);
    const semana = rellenarDias('2026-11-09', '2026-11-15', [{ ...resumenVacio('2026-11-11'), totalMl: 900 }]);
    expect(semana).toHaveLength(7);
    expect(semana.map((d) => d.totalMl)).toEqual([0, 0, 900, 0, 0, 0, 0]);
  });
});

describe('cuenta', () => {
  it('los errores llevan el mensaje con la voz de SmartSip y su causa', () => {
    const causa = new Error('auth/email-already-in-use');
    const e = new ErrorCuenta('correo-en-uso', causa);
    expect(e.message).toBe(MENSAJES_CUENTA['correo-en-uso']);
    expect(e.codigo).toBe('correo-en-uso');
    expect(e.cause).toBe(causa);
    expect(new ErrorCuenta('desconocido').cause).toBeUndefined();
  });
});
