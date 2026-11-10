import { describe, expect, it } from 'vitest';
import { esEventoNivel, VERSION_PROTOCOLO, type MensajeTermo } from '../src/index.ts';

describe('protocolo', () => {
  it('tiene versión', () => {
    expect(VERSION_PROTOCOLO).toBe(1);
  });

  it('distingue los eventos de nivel del resto de mensajes', () => {
    const base = { id: 1, enMs: 0, ml: 40, nivelMl: 353 };
    const mensajes: MensajeTermo[] = [
      { tipo: 'sorbo', ...base },
      { tipo: 'llenado', ...base },
      { tipo: 'descensoGrande', ...base },
      { tipo: 'bateriaBaja', enMs: 0, bateria: 0.1 },
      { tipo: 'lote', enMs: 0, eventos: [], descartados: 0 },
    ];
    expect(mensajes.map(esEventoNivel)).toEqual([true, true, true, false, false]);
  });
});
