import { describe, expect, it } from 'vitest';
import {
  esCodigoValido,
  ErrorEmparejamiento,
  formatoCodigo,
  generarCodigo,
  idCanal,
  limpiarCodigo,
  MENSAJES_EMPAREJAMIENTO,
  vigente,
  type Emparejamiento,
} from '../src/index.ts';

const base: Emparejamiento = {
  codigo: '042137',
  uid: 'ana',
  estado: 'esperando',
  expiraEnMs: 1000,
  termoId: null,
  termoUid: null,
};

describe('emparejamiento', () => {
  it('genera códigos de seis dígitos, con ceros a la izquierda', () => {
    expect(generarCodigo(() => 0)).toBe('000000');
    expect(generarCodigo(() => 0.042137)).toBe('042137');
    expect(generarCodigo(() => 0.9999999)).toBe('999999');
    for (let i = 0; i < 50; i++) expect(esCodigoValido(generarCodigo())).toBe(true);
  });

  it('limpia, valida y da formato', () => {
    expect(limpiarCodigo(' 042-137 9')).toBe('042137');
    expect(esCodigoValido('042137')).toBe(true);
    expect(esCodigoValido('42137')).toBe(false);
    expect(esCodigoValido('04213a')).toBe(false);
    expect(formatoCodigo('042137')).toBe('042 137');
    expect(formatoCodigo('0421')).toBe('0421');
  });

  it('un código sirve mientras espera y no ha vencido', () => {
    expect(vigente(base, 999)).toBe(true);
    expect(vigente(base, 1000)).toBe(false);
    expect(vigente({ ...base, estado: 'emparejado' }, 0)).toBe(false);
  });

  it('el canal une a la persona con su termo', () => {
    expect(idCanal('ana', 'SS-0001')).toBe('ana_SS-0001');
  });

  it('los errores hablan con la voz de SmartSip', () => {
    const e = new ErrorEmparejamiento('vencido');
    expect(e.message).toBe(MENSAJES_EMPAREJAMIENTO.vencido);
    expect(e.codigo).toBe('vencido');
  });
});
