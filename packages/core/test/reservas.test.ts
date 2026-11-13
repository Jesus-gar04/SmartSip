import { describe, expect, it } from 'vitest';
import {
  BORRADOR_VACIO,
  codigoReserva,
  cuposRestantes,
  formatoCelular,
  formatoPesos,
  normalizarCelular,
  textoCupos,
  validarReserva,
  type BorradorReserva,
} from '../src/index.ts';

const completo: BorradorReserva = {
  nombre: '  Ana   María  ',
  celular: '+57 300 123 4567',
  correo: ' Ana@Correo.COM ',
  cantidad: 2,
  entrega: 'universidad',
  lugar: ' Uninorte ',
  acepta: true,
};

describe('reservas de la preventa', () => {
  it('limpia y acepta una reserva completa', () => {
    const r = validarReserva(completo);
    expect(r).toEqual({
      ok: true,
      datos: { nombre: 'Ana María', celular: '3001234567', correo: 'ana@correo.com', cantidad: 2, entrega: 'universidad', lugar: 'Uninorte' },
    });
  });

  it('dice qué falta en cada campo', () => {
    const r = validarReserva(BORRADOR_VACIO);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errores).sort()).toEqual(['acepta', 'celular', 'correo', 'entrega', 'nombre']);
  });

  it('pide el lugar según la entrega elegida', () => {
    const casa = validarReserva({ ...completo, entrega: 'domicilio', lugar: '' });
    expect(casa.ok || casa.errores.lugar).toMatch(/barrio y la ciudad/);
    const gym = validarReserva({ ...completo, entrega: 'gimnasio', lugar: ' ' });
    expect(gym.ok || gym.errores.lugar).toMatch(/gimnasio/);
  });

  it('limita la cantidad de termos por reserva', () => {
    for (const cantidad of [0, 3, 1.5]) {
      const r = validarReserva({ ...completo, cantidad });
      expect(r.ok || r.errores.cantidad).toMatch(/de 1 a 2/);
    }
  });

  it('normaliza celulares de Colombia', () => {
    expect(normalizarCelular('300-123-4567')).toBe('3001234567');
    expect(normalizarCelular('573001234567')).toBe('3001234567');
    expect(normalizarCelular('(300) 123 4567')).toBe('3001234567');
    expect(normalizarCelular('6051234567')).toBeNull();
    expect(normalizarCelular('30012345')).toBeNull();
    expect(formatoCelular('3001234567')).toBe('300 123 4567');
  });

  it('formatea códigos, precios y cupos', () => {
    expect(codigoReserva(7)).toBe('SS-0007');
    expect(codigoReserva(12345)).toBe('SS-12345');
    expect(formatoPesos(109_900)).toBe('$109.900');
    expect(formatoPesos(1_000_000)).toBe('$1.000.000');
    expect(cuposRestantes(48)).toBe(2);
    expect(cuposRestantes(60)).toBe(0);
    expect(textoCupos(23)).toBe('Quedan 23 termos de 50 en la preventa.');
    expect(textoCupos(1)).toBe('Queda 1 termo de 50 en la preventa.');
    expect(textoCupos(0)).toMatch(/Se apartaron los 50/);
  });
});
