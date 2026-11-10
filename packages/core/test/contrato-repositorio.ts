/**
 * Pruebas de contrato del Repositorio. Corren contra la implementación en
 * memoria (aquí) y contra Firestore en el emulador (smartsip-firebase), para
 * garantizar que las dos se comportan igual.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  aRegistro,
  ErrorRepositorio,
  type EventoNivel,
  type Perfil,
  type RegistroEvento,
  type Repositorio,
  type ResumenDia,
} from '../src/index.ts';

export interface Montaje {
  readonly repo: Repositorio;
  readonly limpiar?: () => Promise<void>;
}

// 9 de noviembre de 2026, 08:00 en Barranquilla.
export const T0 = Date.UTC(2026, 10, 9, 13, 0, 0);
const MIN = 60_000;
const DESFASE = -300;

export function registro(
  tipo: EventoNivel['tipo'],
  id: number,
  ml: number,
  { termoId = 'SS-TEST-0001', enMs = T0 + id * MIN, temperaturaC = 60 as number | null } = {},
): RegistroEvento {
  return aRegistro(termoId, { tipo, id, ml, enMs, nivelMl: 393 - ml }, temperaturaC, DESFASE);
}

const perfil: Perfil = {
  nombre: 'Ana',
  pesoKg: 69,
  actividad: 'baja',
  unidad: 'C',
  brillo: 'medio',
  desfaseMin: DESFASE,
  termoId: null,
};

async function dia(repo: Repositorio, fecha: string): Promise<ResumenDia | undefined> {
  return (await repo.dias(fecha, fecha))[0];
}

export function contratoRepositorio(nombre: string, montar: () => Promise<Montaje>): void {
  describe(`Repositorio (${nombre})`, () => {
    async function conRepo(prueba: (repo: Repositorio) => Promise<void>): Promise<void> {
      const { repo, limpiar } = await montar();
      try {
        await prueba(repo);
      } finally {
        await limpiar?.();
      }
    }

    it('guarda y lee el perfil', () =>
      conRepo(async (repo) => {
        expect(await repo.leerPerfil()).toBeNull();
        await repo.guardarPerfil(perfil);
        expect(await repo.leerPerfil()).toEqual(perfil);
        await repo.guardarPerfil({ ...perfil, nombre: null, actividad: 'alta', termoId: 'SS-TEST-0001' });
        expect(await repo.leerPerfil()).toEqual({ ...perfil, nombre: null, actividad: 'alta', termoId: 'SS-TEST-0001' });
      }));

    it('guarda el termo por partes, sin borrar lo anterior', () =>
      conRepo(async (repo) => {
        expect(await repo.leerTermo('SS-TEST-0001')).toBeNull();
        await repo.guardarTermo({ termoId: 'SS-TEST-0001', firmware: 'sim-1.0.0', capacidadMl: 393 });
        await repo.guardarTermo({ termoId: 'SS-TEST-0001', bateria: 0.8, temperaturaC: 61.2 });
        await repo.guardarTermo({
          termoId: 'SS-TEST-0001',
          ultimoVisto: { enMs: T0, lugar: { lat: 10.98, lng: -74.8, precisionM: 12 } },
        });
        expect(await repo.leerTermo('SS-TEST-0001')).toEqual({
          termoId: 'SS-TEST-0001',
          nombre: null,
          capacidadMl: 393,
          firmware: 'sim-1.0.0',
          bateria: 0.8,
          temperaturaC: 61.2,
          ultimoVisto: { enMs: T0, lugar: { lat: 10.98, lng: -74.8, precisionM: 12 } },
        });
        await repo.guardarTermo({ termoId: 'SS-TEST-0001', ultimoVisto: { enMs: T0 + MIN, lugar: null } });
        expect((await repo.leerTermo('SS-TEST-0001'))?.ultimoVisto).toEqual({ enMs: T0 + MIN, lugar: null });
      }));

    it('un sorbo suma a su día y a su hora', () =>
      conRepo(async (repo) => {
        await repo.registrar(registro('sorbo', 1, 40, { temperaturaC: 60 }));
        await repo.registrar(registro('sorbo', 2, 60, { temperaturaC: null }));
        const d = await dia(repo, '2026-11-09');
        expect(d).toMatchObject({ fecha: '2026-11-09', totalMl: 100, sorbos: 2, tempSumaC: 60, tempMuestras: 1 });
        expect(d?.porHora[8]).toBe(100);
        expect(d?.porHora.reduce((a, b) => a + b, 0)).toBe(100);
        expect(d?.porHora).toHaveLength(24);
      }));

    it('registrar dos veces el mismo evento no suma dos veces', () =>
      conRepo(async (repo) => {
        const r = registro('sorbo', 1, 40);
        await repo.registrar(r);
        await repo.registrar(r);
        expect((await dia(repo, '2026-11-09'))?.totalMl).toBe(40);
        expect(await repo.eventosDelDia('2026-11-09')).toHaveLength(1);
      }));

    it('el llenado cuenta como llenado, no como agua bebida', () =>
      conRepo(async (repo) => {
        await repo.registrar(registro('llenado', 1, 393));
        expect(await dia(repo, '2026-11-09')).toMatchObject({ totalMl: 0, sorbos: 0, llenados: 1, llenadoMl: 393 });
      }));

    it('un descenso grande queda pendiente y se resuelve una sola vez', () =>
      conRepo(async (repo) => {
        const bebido = registro('descensoGrande', 1, 200);
        const vaciado = registro('descensoGrande', 2, 193);
        await repo.registrar(bebido);
        await repo.registrar(vaciado);
        expect((await repo.pendientes()).map((p) => p.id)).toEqual([1, 2]);
        expect(await dia(repo, '2026-11-09')).toBeUndefined();

        await repo.resolverDescenso(bebido, 'bebido');
        await repo.resolverDescenso(vaciado, 'vaciado');
        expect(await repo.pendientes()).toEqual([]);
        expect(await dia(repo, '2026-11-09')).toMatchObject({ totalMl: 200, sorbos: 1 });

        const error = await repo.resolverDescenso(bebido, 'bebido').catch((e: unknown) => e);
        expect(error).toBeInstanceOf(ErrorRepositorio);
        expect((error as ErrorRepositorio).codigo).toBe('ya-resuelto');
        expect((await dia(repo, '2026-11-09'))?.totalMl).toBe(200);
      }));

    it('no resuelve lo que no existe ni lo que no es un descenso', () =>
      conRepo(async (repo) => {
        const fantasma = await repo.resolverDescenso(registro('descensoGrande', 9, 200), 'bebido').catch((e: unknown) => e);
        expect((fantasma as ErrorRepositorio).codigo).toBe('no-existe');
        const s = registro('sorbo', 1, 40);
        await repo.registrar(s);
        const noEs = await repo.resolverDescenso(s, 'bebido').catch((e: unknown) => e);
        expect((noEs as ErrorRepositorio).codigo).toBe('no-pendiente');
      }));

    it('sabe el último id guardado de cada termo', () =>
      conRepo(async (repo) => {
        expect(await repo.ultimoIdDeTermo('SS-TEST-0001')).toBe(0);
        await repo.registrar(registro('sorbo', 3, 40));
        await repo.registrar(registro('sorbo', 12, 40));
        await repo.registrar(registro('sorbo', 50, 40, { termoId: 'SS-TEST-0002' }));
        expect(await repo.ultimoIdDeTermo('SS-TEST-0001')).toBe(12);
        expect(await repo.ultimoIdDeTermo('SS-TEST-0002')).toBe(50);
      }));

    it('lista los eventos de un día en orden y los días de un rango', () =>
      conRepo(async (repo) => {
        await repo.registrar(registro('sorbo', 2, 60));
        await repo.registrar(registro('sorbo', 1, 40));
        await repo.registrar(registro('sorbo', 3, 30, { enMs: Date.UTC(2026, 10, 10, 15) })); // día 10
        await repo.registrar(registro('sorbo', 4, 20, { enMs: Date.UTC(2026, 10, 12, 15) })); // día 12
        expect((await repo.eventosDelDia('2026-11-09')).map((e) => e.id)).toEqual([1, 2]);
        expect((await repo.dias('2026-11-09', '2026-11-11')).map((d) => [d.fecha, d.totalMl])).toEqual([
          ['2026-11-09', 100],
          ['2026-11-10', 30],
        ]);
        expect(await repo.dias('2026-11-01', '2026-11-08')).toEqual([]);
      }));

    it('la meta del día se guarda sin borrar lo sumado', () =>
      conRepo(async (repo) => {
        await repo.registrar(registro('sorbo', 1, 40));
        await repo.fijarMetaDelDia('2026-11-09', 2600, 33);
        await repo.registrar(registro('sorbo', 2, 60));
        expect(await dia(repo, '2026-11-09')).toMatchObject({ totalMl: 100, metaMl: 2600, climaC: 33 });
        await repo.fijarMetaDelDia('2026-11-11', 2400, null);
        expect(await dia(repo, '2026-11-11')).toMatchObject({ totalMl: 0, metaMl: 2400, climaC: null });
      }));

    it('avisa en vivo los cambios del día y de los pendientes', () =>
      conRepo(async (repo) => {
        const totales: number[] = [];
        const pendientes: number[] = [];
        const salirDia = repo.escucharDia('2026-11-09', (r) => totales.push(r.totalMl));
        const salirPend = repo.escucharPendientes((p) => pendientes.push(p.length));
        await vi.waitFor(() => expect(totales).toContain(0));
        await repo.registrar(registro('sorbo', 1, 40));
        await vi.waitFor(() => expect(totales.at(-1)).toBe(40));
        const d = registro('descensoGrande', 2, 200);
        await repo.registrar(d);
        await vi.waitFor(() => expect(pendientes.at(-1)).toBe(1));
        await repo.resolverDescenso(d, 'bebido');
        await vi.waitFor(() => expect(totales.at(-1)).toBe(240));
        await vi.waitFor(() => expect(pendientes.at(-1)).toBe(0));
        salirDia();
        salirPend();
      }));
  });
}
