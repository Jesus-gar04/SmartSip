import { describe, expect, it } from 'vitest';
import { claveDia, RegistroConsumo, type EventoNivel } from '../src/index.ts';

// 9 de noviembre de 2026, 08:00 en Barranquilla (13:00 UTC).
const T0 = Date.UTC(2026, 10, 9, 13, 0, 0);
const MIN = 60_000;

const sorbo = (id: number, ml: number, enMs = T0 + id * MIN): EventoNivel => ({
  tipo: 'sorbo',
  id,
  ml,
  enMs,
  nivelMl: 0,
});

describe('claveDia', () => {
  it('usa la hora de Colombia por defecto', () => {
    expect(claveDia(T0)).toBe('2026-11-09');
    // 23:59 en Barranquilla todavía es el mismo día, aunque en UTC ya sea el siguiente.
    expect(claveDia(Date.UTC(2026, 10, 10, 4, 59))).toBe('2026-11-09');
    expect(claveDia(Date.UTC(2026, 10, 10, 5, 0))).toBe('2026-11-10');
    expect(claveDia(Date.UTC(2026, 10, 10, 4, 59), 0)).toBe('2026-11-10');
  });
});

describe('RegistroConsumo', () => {
  it('suma sorbos y descarta repetidos', () => {
    const r = new RegistroConsumo();
    expect(r.aplicar(sorbo(1, 40))).toBe(true);
    expect(r.aplicar(sorbo(1, 40))).toBe(false);
    expect(r.aplicarLote([sorbo(1, 40), sorbo(2, 60), sorbo(3, 30)])).toBe(2);
    expect(r.totalDelDia(T0)).toBe(130);
    expect(r.tomas()).toHaveLength(3);
  });

  it('el llenado no suma al consumo', () => {
    const r = new RegistroConsumo();
    r.aplicar({ tipo: 'llenado', id: 1, ml: 393, enMs: T0, nivelMl: 393 });
    expect(r.totalDelDia(T0)).toBe(0);
    expect(r.confirmacion()).toEqual({ tipo: 'confirmar', hastaId: 1 });
  });

  it('un descenso grande espera respuesta y solo suma si se bebió', () => {
    const r = new RegistroConsumo();
    r.aplicar({ tipo: 'descensoGrande', id: 1, ml: 200, enMs: T0, nivelMl: 193 });
    r.aplicar({ tipo: 'descensoGrande', id: 2, ml: 193, enMs: T0 + MIN, nivelMl: 0 });
    expect(r.totalDelDia(T0)).toBe(0);
    expect(r.dudosos().map((e) => e.id)).toEqual([1, 2]);

    r.resolver(1, 'bebido');
    r.resolver(2, 'vaciado');
    expect(r.dudosos()).toEqual([]);
    expect(r.totalDelDia(T0)).toBe(200);
    expect(r.tomas()[0]?.confirmadaPorPersona).toBe(true);
    expect(() => r.resolver(2, 'bebido')).toThrow(/No hay un descenso pendiente/);
  });

  it('separa los días según la hora local', () => {
    const r = new RegistroConsumo();
    r.aplicar(sorbo(1, 100, Date.UTC(2026, 10, 10, 4, 30))); // 23:30 del 9
    r.aplicar(sorbo(2, 50, Date.UTC(2026, 10, 10, 5, 30))); // 00:30 del 10
    expect(r.totalDelDia(T0)).toBe(100);
    expect(r.totalDelDia(Date.UTC(2026, 10, 10, 15, 0))).toBe(50);
  });

  it('procesar devuelve la confirmación que hay que mandar al termo', () => {
    const r = new RegistroConsumo();
    expect(r.procesar(sorbo(1, 40))).toEqual({ tipo: 'confirmar', hastaId: 1 });
    expect(
      r.procesar({ tipo: 'lote', enMs: T0, eventos: [sorbo(1, 40), sorbo(2, 30)], descartados: 0 }),
    ).toEqual({ tipo: 'confirmar', hastaId: 2 });
    expect(r.procesar({ tipo: 'bateriaBaja', enMs: T0, bateria: 0.14 })).toBeNull();
    expect(
      r.procesar({
        tipo: 'estado',
        enMs: T0,
        temperaturaC: 60,
        nivelMl: 300,
        bateria: 1,
        cargando: false,
        tapaCerrada: true,
        brillo: 'medio',
      }),
    ).toBeNull();
    expect(r.totalDelDia(T0)).toBe(70);
  });
});
