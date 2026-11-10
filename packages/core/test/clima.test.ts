import { describe, expect, it } from 'vitest';
import { BARRANQUILLA, ErrorClima, leerOpenMeteo, redondearLugar, urlOpenMeteo } from '../src/index.ts';

const respuesta = {
  utc_offset_seconds: -18000,
  current: { time: '2026-11-09T16:30', temperature_2m: 31.4 },
  daily: { time: ['2026-11-09'], temperature_2m_max: [33.1] },
};

describe('clima', () => {
  it('redondea el lugar a unos 1 km antes de consultarlo', () => {
    expect(redondearLugar({ lat: 10.987654, lng: -74.788912 })).toEqual({ lat: 10.99, lng: -74.79 });
    const url = new URL(urlOpenMeteo({ lat: 10.987654, lng: -74.788912 }));
    expect(url.origin).toBe('https://api.open-meteo.com');
    expect(url.searchParams.get('latitude')).toBe('10.99');
    expect(url.searchParams.get('longitude')).toBe('-74.79');
    expect(url.searchParams.get('current')).toBe('temperature_2m');
    expect(url.searchParams.get('daily')).toBe('temperature_2m_max');
  });

  it('lee la temperatura actual, la máxima del día y la hora en UTC', () => {
    expect(leerOpenMeteo(respuesta, BARRANQUILLA)).toEqual({
      temperaturaC: 31.4,
      maximaHoyC: 33.1,
      lugar: { lat: 10.96, lng: -74.8 },
      medidoEnMs: Date.UTC(2026, 10, 9, 21, 30),
      fuente: 'open-meteo',
    });
  });

  it('tolera que falte la máxima o la hora', () => {
    const c = leerOpenMeteo({ current: { temperature_2m: 28 } }, BARRANQUILLA);
    expect(c.maximaHoyC).toBeNull();
    expect(c.medidoEnMs).toBe(0);
  });

  it.each([null, {}, { current: {} }, { current: { temperature_2m: 'calor' } }, { current: { temperature_2m: 99 } }])(
    'rechaza respuestas inválidas: %j',
    (json) => {
      expect(() => leerOpenMeteo(json, BARRANQUILLA)).toThrow(ErrorClima);
    },
  );
});
