import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, increment, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { EMULADOR_LOCAL } from '../src/index.ts';
import { PROYECTO_PRUEBAS } from './apoyo.ts';

let entorno: RulesTestEnvironment;

beforeAll(async () => {
  entorno = await initializeTestEnvironment({
    projectId: PROYECTO_PRUEBAS,
    firestore: {
      rules: readFileSync(fileURLToPath(new URL('../../../firebase/firestore.rules', import.meta.url)), 'utf8'),
      host: EMULADOR_LOCAL.host,
      port: EMULADOR_LOCAL.puertoFirestore,
    },
  });
});

beforeEach(() => entorno.clearFirestore());
afterAll(() => entorno.cleanup());

const ana = () => entorno.authenticatedContext('ana').firestore();
const beto = () => entorno.authenticatedContext('beto').firestore();
const nadie = () => entorno.unauthenticatedContext().firestore();

const perfil = { nombre: 'Ana', pesoKg: 69, actividad: 'baja', unidad: 'C', brillo: 'medio', desfaseMin: -300 };
const EN = Timestamp.fromMillis(Date.UTC(2026, 10, 9, 13));
const evento = (extra: Record<string, unknown> = {}) => ({
  termoId: 'SS-0001',
  id: 7,
  tipo: 'sorbo',
  ml: 40,
  nivelMl: 353,
  en: EN,
  dia: '2026-11-09',
  hora: 8,
  temperaturaC: 61.5,
  estado: 'registrado',
  ...extra,
});
const CLAVE = 'SS-0001_0000000007';

describe('reglas: acceso', () => {
  it('cada quien lee y escribe solo lo suyo', async () => {
    await assertSucceeds(setDoc(doc(ana(), 'users/ana'), perfil));
    await assertSucceeds(getDoc(doc(ana(), 'users/ana')));
    await assertFails(getDoc(doc(beto(), 'users/ana')));
    await assertFails(setDoc(doc(beto(), 'users/ana'), perfil));
    await assertFails(getDoc(doc(nadie(), 'users/ana')));
    await assertSucceeds(setDoc(doc(ana(), 'users/ana/eventos', CLAVE), evento()));
    await assertFails(getDoc(doc(beto(), 'users/ana/eventos', CLAVE)));
    await assertFails(setDoc(doc(beto(), 'users/ana/eventos', 'SS-0001_0000000008'), evento({ id: 8 })));
  });

  it('fuera de users/{uid} no hay nada', async () => {
    await assertFails(setDoc(doc(ana(), 'publico/x'), { a: 1 }));
    await assertFails(getDoc(doc(ana(), 'publico/x')));
  });
});

describe('reglas: perfil', () => {
  it('valida cada campo', async () => {
    await assertSucceeds(setDoc(doc(ana(), 'users/ana'), { ...perfil, nombre: null, actualizadoEn: serverTimestamp() }));
    await assertFails(setDoc(doc(ana(), 'users/ana'), { ...perfil, pesoKg: 5 }));
    await assertFails(setDoc(doc(ana(), 'users/ana'), { ...perfil, actividad: 'extrema' }));
    await assertFails(setDoc(doc(ana(), 'users/ana'), { ...perfil, esAdmin: true }));
    await assertFails(setDoc(doc(ana(), 'users/ana'), { ...perfil, desfaseMin: -300.5 }));
    await assertFails(setDoc(doc(ana(), 'users/ana'), { ...perfil, actualizadoEn: Timestamp.fromMillis(0) }));
    const { pesoKg: _p, ...sinPeso } = perfil;
    await assertFails(setDoc(doc(ana(), 'users/ana'), sinPeso));
    await assertFails(setDoc(doc(ana(), 'users/ana'), { ...perfil, nombre: 'x'.repeat(61) }));
  });
});

describe('reglas: termo', () => {
  it('acepta datos parciales válidos y rechaza lo raro', async () => {
    const ruta = 'users/ana/termos/SS-0001';
    await assertSucceeds(setDoc(doc(ana(), ruta), { firmware: 'sim-1.0.0', capacidadMl: 393 }));
    await assertSucceeds(setDoc(doc(ana(), ruta), { bateria: 0.8, temperaturaC: 61.2 }, { merge: true }));
    await assertSucceeds(
      setDoc(doc(ana(), ruta), { ultimoVisto: { en: EN, lugar: { lat: 10.98, lng: -74.8, precisionM: 12 } } }, { merge: true }),
    );
    await assertSucceeds(setDoc(doc(ana(), ruta), { ultimoVisto: { en: EN, lugar: null } }, { merge: true }));
    await assertFails(setDoc(doc(ana(), ruta), { bateria: 1.5 }, { merge: true }));
    await assertFails(setDoc(doc(ana(), ruta), { ultimoVisto: { en: EN, lugar: { lat: 200, lng: 0, precisionM: 1 } } }, { merge: true }));
    await assertFails(setDoc(doc(ana(), 'users/ana/termos/con espacio'), { capacidadMl: 393 }));
    await assertSucceeds(updateDoc(doc(ana(), ruta), { nombre: 'Termo de la oficina' }));
  });
});

describe('reglas: eventos', () => {
  it('un evento se crea una sola vez y no se borra', async () => {
    const ref = doc(ana(), 'users/ana/eventos', CLAVE);
    await assertSucceeds(setDoc(ref, evento()));
    await assertFails(setDoc(ref, evento())); // reenviarlo no sobrescribe
    await assertFails(setDoc(ref, evento({ ml: 400 })));
    await assertFails(updateDoc(ref, { ml: 1 }));
  });

  it('la clave tiene que coincidir con el termo y el id', async () => {
    await assertFails(setDoc(doc(ana(), 'users/ana/eventos', 'SS-0001_0000000008'), evento()));
    await assertFails(setDoc(doc(ana(), 'users/ana/eventos', 'SS-0002_0000000007'), evento()));
    await assertFails(setDoc(doc(ana(), 'users/ana/eventos', 'otra'), evento()));
  });

  it('valida tipo, estado y rangos', async () => {
    const crear = (extra: Record<string, unknown>) => setDoc(doc(ana(), 'users/ana/eventos', CLAVE), evento(extra));
    await assertFails(crear({ tipo: 'derrame' }));
    await assertFails(crear({ estado: 'bebido' }));
    await assertFails(crear({ tipo: 'descensoGrande', estado: 'registrado' }));
    await assertFails(crear({ ml: -5 }));
    await assertFails(crear({ hora: 24 }));
    await assertFails(crear({ dia: '9/11/2026' }));
    await assertFails(crear({ en: 'ayer' }));
    await assertFails(crear({ extra: true }));
    await assertSucceeds(crear({ temperaturaC: null }));
  });

  it('un descenso grande se resuelve una sola vez', async () => {
    const ref = doc(ana(), 'users/ana/eventos', CLAVE);
    await assertSucceeds(setDoc(ref, evento({ tipo: 'descensoGrande', estado: 'pendiente', ml: 200 })));
    await assertFails(updateDoc(ref, { estado: 'bebido' })); // falta la marca de tiempo
    await assertFails(updateDoc(ref, { estado: 'bebido', resueltoEn: serverTimestamp(), ml: 1 }));
    await assertSucceeds(updateDoc(ref, { estado: 'bebido', resueltoEn: serverTimestamp() }));
    await assertFails(updateDoc(ref, { estado: 'vaciado', resueltoEn: serverTimestamp() }));
  });

  it('un sorbo no se puede "resolver"', async () => {
    const ref = doc(ana(), 'users/ana/eventos', CLAVE);
    await assertSucceeds(setDoc(ref, evento()));
    await assertFails(updateDoc(ref, { estado: 'vaciado', resueltoEn: serverTimestamp() }));
  });
});

describe('reglas: días', () => {
  const ruta = 'users/ana/dias/2026-11-09';
  const suma = (ml: number) => ({
    fecha: '2026-11-09',
    totalMl: increment(ml),
    sorbos: increment(1),
    porHora: { '08': increment(ml) },
    actualizadoEn: serverTimestamp(),
  });

  it('los totales crecen con incrementos y nunca bajan', async () => {
    await assertSucceeds(setDoc(doc(ana(), ruta), suma(40), { merge: true }));
    await assertSucceeds(setDoc(doc(ana(), ruta), suma(60), { merge: true }));
    await assertFails(setDoc(doc(ana(), ruta), { fecha: '2026-11-09', totalMl: 10 }, { merge: true }));
    await assertSucceeds(setDoc(doc(ana(), ruta), { fecha: '2026-11-09', metaMl: 2600, climaC: 33 }, { merge: true }));
  });

  it('valida la fecha, las horas y los rangos', async () => {
    await assertFails(setDoc(doc(ana(), ruta), { ...suma(40), fecha: '2026-11-10' }, { merge: true }));
    await assertFails(setDoc(doc(ana(), 'users/ana/dias/hoy'), { fecha: 'hoy', totalMl: 1 }));
    await assertFails(setDoc(doc(ana(), ruta), { fecha: '2026-11-09', porHora: { '24': 10 } }));
    await assertFails(setDoc(doc(ana(), ruta), { fecha: '2026-11-09', metaMl: 50 }));
    await assertFails(setDoc(doc(ana(), ruta), { fecha: '2026-11-09', secreto: 1 }));
  });
});
