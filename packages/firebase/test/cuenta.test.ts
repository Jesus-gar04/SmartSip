import { FirebaseError } from 'firebase/app';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorCuenta, type Usuario } from 'smartsip-core';
import { CuentaFirebase, traducirErrorAuth, type ServiciosFirebase } from '../src/index.ts';
import { firebaseDePrueba } from './apoyo.ts';

const abiertos: ServiciosFirebase[] = [];
afterEach(async () => {
  while (abiertos.length) await abiertos.pop()?.cerrar();
});

function cuenta() {
  const servicios = firebaseDePrueba();
  abiertos.push(servicios);
  return new CuentaFirebase(servicios.auth);
}

const correo = () => `prueba-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@smartsip.test`;

async function codigoDe(promesa: Promise<unknown>): Promise<string> {
  const error = await promesa.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ErrorCuenta);
  return (error as ErrorCuenta).codigo;
}

describe('CuentaFirebase', () => {
  it('empieza sin usuario y entra como anónimo una sola vez', async () => {
    const c = cuenta();
    expect(await c.listo()).toBeNull();
    const u = await c.entrarAnonimo();
    expect(u).toMatchObject({ anonimo: true, email: null });
    expect((await c.entrarAnonimo()).uid).toBe(u.uid);
  });

  it('crear una cuenta desde anónimo conserva el uid', async () => {
    const c = cuenta();
    const anonimo = await c.entrarAnonimo();
    const vistos: Array<Usuario | null> = [];
    c.alCambiar((u) => vistos.push(u));
    const email = correo();
    const conCuenta = await c.crearCuenta(`  ${email.toUpperCase()} `, 'agua-1234');
    expect(conCuenta).toEqual({ uid: anonimo.uid, anonimo: false, email });
    await vi.waitFor(() => expect(vistos.at(-1)).toEqual(conCuenta));
  });

  it('crea una cuenta nueva si no había sesión, sale y vuelve a entrar', async () => {
    const c = cuenta();
    await c.listo();
    const email = correo();
    const creada = await c.crearCuenta(email, 'agua-1234');
    expect(creada.anonimo).toBe(false);
    await c.salir();
    expect(c.usuario).toBeNull();
    const otra = await c.entrar(email, 'agua-1234');
    expect(otra.uid).toBe(creada.uid);
  });

  it('traduce los errores a la voz de SmartSip', async () => {
    const c = cuenta();
    await c.listo();
    const email = correo();
    await c.crearCuenta(email, 'agua-1234');
    await c.salir();
    expect(await codigoDe(c.entrar(email, 'otra-clave'))).toBe('credenciales');
    expect(await codigoDe(c.crearCuenta(email, 'agua-1234'))).toBe('correo-en-uso');
    expect(await codigoDe(c.crearCuenta(correo(), '123'))).toBe('contrasena-debil');
    expect(await codigoDe(c.crearCuenta('no-es-correo', 'agua-1234'))).toBe('correo-invalido');
  });

  it('avisa los cambios de usuario y deja de avisar al destruirse', async () => {
    const c = cuenta();
    const vistos: Array<Usuario | null> = [];
    const salir = c.alCambiar((u) => vistos.push(u));
    await vi.waitFor(() => expect(vistos).toEqual([null]));
    const u = await c.entrarAnonimo();
    await vi.waitFor(() => expect(vistos.at(-1)?.uid).toBe(u.uid));
    // Un oyente que llega tarde recibe el usuario actual de inmediato.
    const tarde: Array<Usuario | null> = [];
    c.alCambiar((x) => tarde.push(x));
    expect(tarde).toEqual([u]);
    salir();
    c.destruir();
    await c.salir();
    expect(vistos.at(-1)?.uid).toBe(u.uid);
  });
});

describe('traducirErrorAuth', () => {
  it.each([
    ['auth/network-request-failed', 'sin-conexion'],
    ['auth/too-many-requests', 'demasiados-intentos'],
    ['auth/operation-not-allowed', 'no-permitido'],
    ['auth/admin-restricted-operation', 'no-permitido'],
    ['auth/algo-nuevo', 'desconocido'],
  ])('%s → %s', (codigo, esperado) => {
    expect(traducirErrorAuth(new FirebaseError(codigo, 'x')).codigo).toBe(esperado);
  });

  it('deja pasar un ErrorCuenta y envuelve lo desconocido', () => {
    const e = new ErrorCuenta('sin-sesion');
    expect(traducirErrorAuth(e)).toBe(e);
    expect(traducirErrorAuth(new Error('x')).codigo).toBe('desconocido');
  });
});
