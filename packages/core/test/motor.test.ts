import { describe, expect, it } from 'vitest';
import { ACELERACIONES, Motor, RelojSimulado, relojDelSistema, type Simulable } from '../src/index.ts';

function registrador(): Simulable & { pasos: Array<[number, number]> } {
  const pasos: Array<[number, number]> = [];
  return { pasos, paso: (dt, t) => pasos.push([dt, t]) };
}

describe('RelojSimulado', () => {
  it('avanza y no retrocede', () => {
    const r = new RelojSimulado(1000);
    r.avanzar(500);
    expect(r.ahora()).toBe(1500);
    expect(() => r.avanzar(-1)).toThrow(RangeError);
    expect(() => r.avanzar(Number.NaN)).toThrow(RangeError);
  });

  it('el reloj del sistema sigue la hora real', () => {
    const antes = Date.now();
    const t = relojDelSistema.ahora();
    expect(t).toBeGreaterThanOrEqual(antes);
    expect(t).toBeLessThanOrEqual(Date.now());
  });
});

describe('Motor', () => {
  it('ofrece ×1, ×10 y ×60', () => {
    expect(ACELERACIONES).toEqual([1, 10, 60]);
  });

  it('parte el tiempo en pasos no mayores que el máximo', () => {
    const motor = new Motor(new RelojSimulado(0), 1000);
    const s = registrador();
    motor.agregar(s);
    motor.avanzar(2500);
    expect(s.pasos).toEqual([
      [1000, 1000],
      [1000, 2000],
      [500, 2500],
    ]);
  });

  it('tic multiplica el tiempo real por la aceleración', () => {
    const reloj = new RelojSimulado(0);
    const motor = new Motor(reloj);
    expect(motor.aceleracion).toBe(1);
    motor.fijarAceleracion(60);
    expect(motor.aceleracion).toBe(60);
    motor.tic(1000);
    expect(reloj.ahora()).toBe(60_000);
  });

  it('ejecuta lo programado a su hora exacta, en orden', () => {
    const reloj = new RelojSimulado(0);
    const motor = new Motor(reloj, 1000);
    const vistos: string[] = [];
    motor.programar(1500, () => vistos.push(`b@${reloj.ahora()}`));
    motor.programar(700, () => vistos.push(`a@${reloj.ahora()}`));
    motor.programar(1500, () => vistos.push(`c@${reloj.ahora()}`));
    motor.programar(9000, () => vistos.push('tarde'));
    motor.avanzar(2000);
    expect(vistos).toEqual(['a@700', 'b@1500', 'c@1500']);
  });

  it('lo programado para ahora o antes corre de inmediato', () => {
    const reloj = new RelojSimulado(5000);
    const motor = new Motor(reloj);
    let corrio = false;
    motor.programar(4000, () => {
      corrio = true;
    });
    motor.avanzar(0);
    expect(corrio).toBe(true);
  });

  it('rechaza tiempos y pasos inválidos', () => {
    expect(() => new Motor(new RelojSimulado(0), 0)).toThrow(RangeError);
    const motor = new Motor(new RelojSimulado(0));
    expect(() => motor.avanzar(-5)).toThrow(RangeError);
    expect(() => motor.avanzar(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});
