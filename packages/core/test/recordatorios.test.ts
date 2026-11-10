import { describe, expect, it } from 'vitest';
import {
  anotarEnvio,
  avisoBateriaBaja,
  avisoMetaCumplida,
  avisoRitmo,
  avisoValido,
  curvaDeRitmo,
  curvaPareja,
  decidirAviso,
  enSilencio,
  fraccionEsperada,
  llevasHoy,
  memoriaVacia,
  RECORDATORIO_POR_DEFECTO,
  resumenVacio,
  type Ritmo,
  type ResumenDia,
} from '../src/index.ts';

const DESFASE = -300; // Colombia
/** Las cifras llevan un espacio irrompible antes de la unidad; aquí se lee como uno normal. */
const plano = (t: string) => t.replace(/[  ]/g, ' ');
/** Instante de 2026-11-10 a la hora local dada (Colombia). */
const a = (horaLocal: number, minutos = 0) => Date.UTC(2026, 10, 10, horaLocal + 5, minutos);

const dia = (fecha: string, porHora: Record<number, number>): ResumenDia => {
  const vacio = resumenVacio(fecha);
  const horas = vacio.porHora.map((_, h) => porHora[h] ?? 0);
  return { ...vacio, porHora: horas, totalMl: horas.reduce((s, v) => s + v, 0) };
};

const ritmo = (cambios: Partial<Ritmo> = {}): Ritmo => ({
  fecha: '2026-11-10',
  desfaseMin: DESFASE,
  metaMl: 2400,
  curva: curvaPareja(),
  deHabito: false,
  ajustes: RECORDATORIO_POR_DEFECTO,
  totalMlApp: 0,
  ...cambios,
});

describe('el ritmo', () => {
  it('sin historial reparte la meta de 7:00 a 22:00', () => {
    const c = curvaPareja();
    expect(c).toHaveLength(25);
    expect(c[7]).toBe(0);
    expect(c[22]).toBe(1);
    expect(fraccionEsperada(c, 14.5)).toBeCloseTo(0.5, 5);
  });

  it('con pocos días no inventa un ritmo', () => {
    expect(curvaDeRitmo([dia('2026-11-08', { 8: 500 }), dia('2026-11-09', { 8: 500 })])).toBeNull();
  });

  it('aprende a qué hora sueles beber, y cada día pesa lo mismo', () => {
    // Bebe la mitad del día por la mañana (8 h) y la otra mitad por la tarde (15 h).
    const dias = [
      dia('2026-11-07', { 8: 1000, 15: 1000 }),
      dia('2026-11-08', { 8: 200, 15: 200 }),
      dia('2026-11-09', { 8: 1200, 15: 1200 }),
      resumenVacio('2026-11-06'),
    ];
    const c = curvaDeRitmo(dias);
    expect(c).not.toBeNull();
    expect(c?.[0]).toBe(0);
    expect(c?.[8]).toBe(0);
    expect(c?.[9]).toBe(0.5);
    expect(c?.[16]).toBe(1);
    expect(fraccionEsperada(c ?? [], 8.5)).toBeCloseTo(0.25, 5);
  });

  it('el silencio puede cruzar la medianoche', () => {
    expect(enSilencio(23, RECORDATORIO_POR_DEFECTO)).toBe(true);
    expect(enSilencio(6.9, RECORDATORIO_POR_DEFECTO)).toBe(true);
    expect(enSilencio(7, RECORDATORIO_POR_DEFECTO)).toBe(false);
    expect(enSilencio(13, { ...RECORDATORIO_POR_DEFECTO, silencioDesde: 12, silencioHasta: 14 })).toBe(true);
    expect(enSilencio(13, { ...RECORDATORIO_POR_DEFECTO, silencioDesde: 9, silencioHasta: 9 })).toBe(false);
  });
});

describe('la decisión', () => {
  const memoria = memoriaVacia('2026-11-10');

  it('avisa cuando vas atrasado de verdad', () => {
    // A las 14:30 se espera la mitad (1200 ml); lleva 600.
    const d = decidirAviso({ ritmo: ritmo(), totalMlTermo: 600, ahoraMs: a(14, 30), memoria });
    expect(d).toEqual({ tipo: 'ritmo', llevasMl: 600, esperadoMl: 1200, faltaMl: 600 });
  });

  it('un atraso pequeño no amerita aviso', () => {
    const d = decidirAviso({ ritmo: ritmo(), totalMlTermo: 1000, ahoraMs: a(14, 30), memoria });
    expect(d).toEqual({ tipo: 'nada', motivo: 'al-dia' });
  });

  it('nunca en el silencio ni con los recordatorios apagados', () => {
    expect(decidirAviso({ ritmo: ritmo(), totalMlTermo: 0, ahoraMs: a(23), memoria })).toEqual({ tipo: 'nada', motivo: 'silencio' });
    const apagados = ritmo({ ajustes: { ...RECORDATORIO_POR_DEFECTO, activos: false } });
    expect(decidirAviso({ ritmo: apagados, totalMlTermo: 0, ahoraMs: a(15), memoria })).toEqual({ tipo: 'nada', motivo: 'apagados' });
  });

  it('uno cada 90 minutos y no más de cuatro al día', () => {
    const d = decidirAviso({ ritmo: ritmo(), totalMlTermo: 0, ahoraMs: a(12), memoria });
    const despues = anotarEnvio(memoria, d, a(12));
    expect(despues.enviados).toBe(1);
    expect(decidirAviso({ ritmo: ritmo(), totalMlTermo: 0, ahoraMs: a(13), memoria: despues }).tipo).toBe('nada');
    expect(decidirAviso({ ritmo: ritmo(), totalMlTermo: 0, ahoraMs: a(13, 31), memoria: despues }).tipo).toBe('ritmo');
    const llena = { ...despues, enviados: 4, ultimoMs: a(8) };
    expect(decidirAviso({ ritmo: ritmo(), totalMlTermo: 0, ahoraMs: a(18), memoria: llena })).toEqual({ tipo: 'nada', motivo: 'suficientes' });
  });

  it('la memoria de ayer no cuenta', () => {
    const ayer = { ...memoriaVacia('2026-11-09'), enviados: 4, ultimoMs: a(11) };
    expect(decidirAviso({ ritmo: ritmo(), totalMlTermo: 0, ahoraMs: a(12), memoria: ayer }).tipo).toBe('ritmo');
  });

  it('avisa una sola vez que cumpliste la meta', () => {
    const d = decidirAviso({ ritmo: ritmo(), totalMlTermo: 2500, ahoraMs: a(16), memoria });
    expect(d).toEqual({ tipo: 'metaCumplida', llevasMl: 2500 });
    const despues = anotarEnvio(memoria, d, a(16));
    expect(decidirAviso({ ritmo: ritmo(), totalMlTermo: 2600, ahoraMs: a(17), memoria: despues })).toEqual({ tipo: 'nada', motivo: 'cumplida' });
  });

  it('suma lo que la app sabe si es de hoy (por ejemplo, un descenso que respondiste "lo bebí")', () => {
    expect(llevasHoy(ritmo({ totalMlApp: 900 }), 400, a(12))).toBe(900);
    expect(llevasHoy(ritmo({ fecha: '2026-11-09', totalMlApp: 900 }), 400, a(12))).toBe(400);
  });
});

describe('lo que dicen los avisos', () => {
  it('el recordatorio dice un hecho y una salida fácil, sin culpa', () => {
    const sereno = avisoRitmo(600, 1200, 2400, 'sereno', true);
    expect(sereno.titulo).toBe('Te falta un poco de agua para ir al día');
    expect(plano(sereno.cuerpo)).toBe('Llevas 600 ml; a esta hora sueles llevar 1,2 L. Un par de sorbos y te pones al día.');
    expect(avisoRitmo(600, 1200, 2400, 'sereno', false).cuerpo).toContain('convendría');
    const directo = avisoRitmo(600, 1200, 2400, 'directo', true);
    expect(plano(directo.titulo)).toBe('Te faltan 600 ml para ir al día');
    for (const t of [sereno, directo]) expect(`${t.titulo} ${t.cuerpo}`).not.toMatch(/!|deberías|no has/i);
  });

  it('la batería dice de qué habla', () => {
    expect(plano(avisoBateriaBaja(2.2).cuerpo)).toBe('La batería del termo te alcanza para unos 2 días. Cárgalo cuando puedas.');
    expect(avisoBateriaBaja(0.5).cuerpo).toMatch(/^A la batería del termo le quedan unas 12 horas/);
  });

  it('meta cumplida sin confeti', () => {
    expect(avisoMetaCumplida(2450, 2400).titulo).toBe('Hidrataste lo de hoy.');
  });

  it('valida y recorta lo que llega de afuera', () => {
    expect(avisoValido({ tipo: 'ritmo', titulo: 'Hola', cuerpo: 'x'.repeat(500) })?.cuerpo).toHaveLength(200);
    expect(avisoValido({ tipo: 'otro', titulo: 'Hola', cuerpo: 'x' })).toBeNull();
    expect(avisoValido({ tipo: 'prueba', titulo: ' ', cuerpo: 'x' })).toBeNull();
    expect(avisoValido(null)).toBeNull();
  });
});
