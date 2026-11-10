import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorEmparejamiento, type Emparejamiento } from 'smartsip-core';
import { COLECCION_CANALES, EmparejamientoFirebase, type ServiciosFirebase } from '../src/index.ts';
import { usuarioDePrueba } from './apoyo.ts';

const abiertos: ServiciosFirebase[] = [];
afterEach(async () => {
  while (abiertos.length) await abiertos.pop()?.cerrar();
});

async function persona() {
  const u = await usuarioDePrueba();
  abiertos.push(u.servicios);
  return { ...u, servicio: new EmparejamientoFirebase(u.servicios.db) };
}

async function codigoDeError(p: Promise<unknown>): Promise<string> {
  const e = await p.catch((x: unknown) => x);
  expect(e).toBeInstanceOf(ErrorEmparejamiento);
  return (e as ErrorEmparejamiento).codigo;
}

describe('emparejamiento por código (emulador)', () => {
  it('la app muestra un código, el termo lo escribe y la app abre el canal', async () => {
    const app = await persona();
    const termo = await persona();
    const e = await app.servicio.crearCodigo(app.uid);
    expect(e.codigo).toMatch(/^\d{6}$/);

    const vistos: Array<Emparejamiento | null> = [];
    const salir = app.servicio.escuchar(e.codigo, (x) => vistos.push(x));
    await vi.waitFor(() => expect(vistos.at(-1)?.estado).toBe('esperando'));

    await termo.servicio.reclamar(e.codigo, 'SS-SIM-0001', termo.uid);
    await vi.waitFor(() => expect(vistos.at(-1)).toMatchObject({ estado: 'emparejado', termoId: 'SS-SIM-0001', termoUid: termo.uid }));
    salir();

    const reclamado = vistos.at(-1);
    if (!reclamado) throw new Error('sin emparejamiento');
    const canal = await app.servicio.abrirCanal(reclamado);
    expect(canal).toBe(`${app.uid}_SS-SIM-0001`);
    // El termo puede leer su canal; un tercero no.
    const leido = await getDoc(doc(termo.servicios.db, COLECCION_CANALES, canal));
    expect(leido.data()).toMatchObject({ uid: app.uid, termoUid: termo.uid });
    const otro = await persona();
    await expect(getDoc(doc(otro.servicios.db, COLECCION_CANALES, canal))).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('un código se usa una sola vez', async () => {
    const app = await persona();
    const t1 = await persona();
    const t2 = await persona();
    const e = await app.servicio.crearCodigo(app.uid);
    await t1.servicio.reclamar(e.codigo, 'SS-SIM-0001', t1.uid);
    expect(await codigoDeError(t2.servicio.reclamar(e.codigo, 'SS-SIM-0002', t2.uid))).toBe('usado');
  });

  it('rechaza códigos que no existen, mal escritos o vencidos', async () => {
    const app = await persona();
    const termo = await persona();
    expect(await codigoDeError(termo.servicio.reclamar('12a', 'SS-SIM-0001', termo.uid))).toBe('invalido');
    // Un código que nadie creó (muy improbable que choque con uno real).
    expect(await codigoDeError(termo.servicio.reclamar('000000', 'SS-SIM-0001', termo.uid))).toBe('no-existe');
    // Vencido: el reloj del termo ya pasó la hora de vencimiento.
    const e = await app.servicio.crearCodigo(app.uid);
    expect(await codigoDeError(termo.servicio.reclamar(e.codigo, 'SS-SIM-0001', termo.uid, e.expiraEnMs + 1))).toBe('vencido');
  });

  it('nadie abre un canal con un termo que no reclamó su código', async () => {
    const app = await persona();
    const intruso = await persona();
    const e = await app.servicio.crearCodigo(app.uid);
    // Sin reclamar: la app no puede abrir el canal.
    await expect(
      setDoc(doc(app.servicios.db, COLECCION_CANALES, `${app.uid}_SS-SIM-0001`), {
        uid: app.uid,
        termoUid: intruso.uid,
        termoId: 'SS-SIM-0001',
        codigo: e.codigo,
        creadoEn: Timestamp.now(),
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
    // Ni otra persona puede pisar un código vigente.
    await expect(
      setDoc(doc(intruso.servicios.db, 'emparejamientos', e.codigo), {
        uid: intruso.uid,
        estado: 'esperando',
        creadoEn: Timestamp.now(),
        expiraEn: Timestamp.fromMillis(Date.now() + 60_000),
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('la app puede retirar su código', async () => {
    const app = await persona();
    const termo = await persona();
    const e = await app.servicio.crearCodigo(app.uid);
    await app.servicio.cancelar(e.codigo);
    expect(await codigoDeError(termo.servicio.reclamar(e.codigo, 'SS-SIM-0001', termo.uid))).toBe('no-existe');
  });
});
