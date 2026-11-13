import { doc, getDoc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { afterEach, describe, expect, it } from 'vitest';
import { ErrorReserva, type DatosReserva } from 'smartsip-core';
import { COLECCION_PREVENTA, COLECCION_RESERVAS, ReservasFirebase, type ServiciosFirebase } from '../src/index.ts';
import { firebaseDePrueba, usuarioDePrueba } from './apoyo.ts';

// Todas las pruebas comparten el contador del emulador: cada una mira cuánto
// sube, no el valor absoluto.

const abiertos: ServiciosFirebase[] = [];
afterEach(async () => {
  while (abiertos.length) await abiertos.pop()?.cerrar();
});

const datos: DatosReserva = {
  nombre: 'Ana María',
  celular: '3001234567',
  correo: 'ana@correo.com',
  cantidad: 1,
  entrega: 'universidad',
  lugar: 'Uninorte',
};

async function visitante(total?: number) {
  const s = firebaseDePrueba();
  abiertos.push(s);
  return { servicios: s, reservas: new ReservasFirebase(s, total) };
}

async function contador(s: ServiciosFirebase): Promise<number> {
  const snap = await getDoc(doc(s.db, COLECCION_PREVENTA, 'actual'));
  return snap.exists() ? Number(snap.data()['reservados']) : 0;
}

describe('reservas de la preventa (emulador)', () => {
  it('reserva, sube el contador y solo quien reservó puede leerla', async () => {
    const ana = await visitante();
    const antes = await contador(ana.servicios);
    const r = await ana.reservas.reservar({ ...datos, cantidad: 2 });
    expect(r.numero).toBe(antes + 1);
    expect(r.codigo).toMatch(/^SS-\d{4,}$/);
    expect(await contador(ana.servicios)).toBe(antes + 2);
    expect(await ana.reservas.leer(r.numero)).toMatchObject({ nombre: 'Ana María', cantidad: 2 });

    const otro = await visitante();
    expect(await otro.reservas.leer(r.numero)).toBeNull();
  });

  it('dos reservas a la vez se quedan con números distintos', async () => {
    const a = await visitante();
    const b = await visitante();
    const [ra, rb] = await Promise.all([a.reservas.reservar(datos), b.reservas.reservar(datos)]);
    expect(ra.numero).not.toBe(rb.numero);
  });

  it('el contador avisa en vivo', async () => {
    const a = await visitante();
    const vistos: number[] = [];
    const salir = a.reservas.escucharCupos((n) => vistos.push(n));
    await a.reservas.reservar(datos);
    await expect.poll(() => vistos.length >= 2).toBe(true);
    salir();
    expect(vistos.at(-1)).toBe((vistos.at(0) ?? 0) + 1);
  });

  it('no deja apartar más de lo que queda', async () => {
    const a = await visitante();
    const ocupados = await contador(a.servicios);
    // Con un total igual a lo ocupado, el adaptador ya ve la preventa agotada.
    const lleno = new ReservasFirebase(a.servicios, ocupados);
    await expect(lleno.reservar(datos)).rejects.toMatchObject({ codigo: 'agotado' });
    const casi = new ReservasFirebase(a.servicios, ocupados + 1);
    await expect(casi.reservar({ ...datos, cantidad: 2 })).rejects.toBeInstanceOf(ErrorReserva);
  });

  it('las reglas rechazan saltarse el contador o los datos', async () => {
    const { servicios, uid } = await usuarioDePrueba();
    abiertos.push(servicios);
    const db = servicios.db;
    const antes = await contador(servicios);
    const preventa = doc(db, COLECCION_PREVENTA, 'actual');
    const valida = { ...datos, acepta: true, uid, creadoEn: serverTimestamp() };

    // Reserva sin subir el contador.
    await expect(setDoc(doc(db, COLECCION_RESERVAS, String(antes + 1)), valida)).rejects.toMatchObject({ code: 'permission-denied' });

    // Subir el contador sin reserva.
    await expect(setDoc(preventa, { reservados: antes + 1 })).rejects.toMatchObject({ code: 'permission-denied' });

    // Número que no es el siguiente.
    const saltada = writeBatch(db);
    saltada.set(preventa, { reservados: antes + 1 });
    saltada.set(doc(db, COLECCION_RESERVAS, String(antes + 5)), valida);
    await expect(saltada.commit()).rejects.toMatchObject({ code: 'permission-denied' });

    // Datos de más o fuera de forma.
    for (const malo of [{ ...valida, celular: '6051234567' }, { ...valida, cantidad: 3 }, { ...valida, acepta: false }, { ...valida, extra: 1 }]) {
      const lote = writeBatch(db);
      lote.set(preventa, { reservados: antes + Number(malo.cantidad) });
      lote.set(doc(db, COLECCION_RESERVAS, String(antes + 1)), malo);
      await expect(lote.commit()).rejects.toMatchObject({ code: 'permission-denied' });
    }

    // Más allá de los 50 cupos.
    const pasada = writeBatch(db);
    pasada.set(preventa, { reservados: 51 });
    pasada.set(doc(db, COLECCION_RESERVAS, String(antes + 1)), { ...valida, cantidad: 51 - antes });
    await expect(pasada.commit()).rejects.toMatchObject({ code: 'permission-denied' });

    // Bien hecha, pasa.
    const buena = writeBatch(db);
    buena.set(preventa, { reservados: antes + 1 });
    buena.set(doc(db, COLECCION_RESERVAS, String(antes + 1)), valida);
    await buena.commit();
    expect(await contador(servicios)).toBe(antes + 1);
  });
});
