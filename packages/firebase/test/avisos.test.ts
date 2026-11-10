import { afterEach, describe, expect, it, vi } from 'vitest';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { curvaPareja, RECORDATORIO_POR_DEFECTO, type Ritmo } from 'smartsip-core';
import { AvisosFirebase, EmparejamientoFirebase, idDispositivo, RepositorioFirestore, type ServiciosFirebase } from '../src/index.ts';
import { usuarioDePrueba } from './apoyo.ts';

const abiertos: ServiciosFirebase[] = [];
const cerrar: Array<() => void> = [];
afterEach(async () => {
  while (cerrar.length) cerrar.pop()?.();
  while (abiertos.length) await abiertos.pop()?.cerrar();
});

async function montar() {
  const app = await usuarioDePrueba();
  const termo = await usuarioDePrueba();
  const extrano = await usuarioDePrueba();
  abiertos.push(app.servicios, termo.servicios, extrano.servicios);
  const codigo = await new EmparejamientoFirebase(app.servicios.db).crearCodigo(app.uid);
  const reclamado = await new EmparejamientoFirebase(termo.servicios.db).reclamar(codigo.codigo, 'SS-SIM-0001', termo.uid);
  const canalId = await new EmparejamientoFirebase(app.servicios.db).abrirCanal(reclamado);
  return { app, termo, extrano, canalId };
}

const ritmo: Ritmo = {
  fecha: '2026-11-10',
  desfaseMin: -300,
  metaMl: 2400,
  curva: curvaPareja(),
  deHabito: false,
  ajustes: { ...RECORDATORIO_POR_DEFECTO, tono: 'directo' },
  totalMlApp: 650,
};

const suscripcion = { endpoint: 'https://push.example.com/abc', keys: { p256dh: 'BKx', auth: 'aut' } };

describe('avisos sobre el canal (emulador)', () => {
  it('la app deja el ritmo y el termo lo escucha', async () => {
    const { app, termo, canalId } = await montar();
    await new AvisosFirebase(app.servicios.db, canalId).publicarRitmo(ritmo);
    let visto: Ritmo | null = null;
    cerrar.push(new AvisosFirebase(termo.servicios.db, canalId).escucharRitmo((r) => (visto = r)));
    await vi.waitFor(() => expect(visto).toEqual(ritmo), { timeout: 10_000 });
  });

  it('el termo no puede escribir el ritmo, ni un extraño leerlo', async () => {
    const { app, termo, extrano, canalId } = await montar();
    await new AvisosFirebase(app.servicios.db, canalId).publicarRitmo(ritmo);
    await expect(new AvisosFirebase(termo.servicios.db, canalId).publicarRitmo(ritmo)).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(getDoc(doc(extrano.servicios.db, 'canales', canalId, 'ritmo', 'actual'))).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('las suscripciones las guarda la app y las lee el termo', async () => {
    const { app, termo, extrano, canalId } = await montar();
    const id = await new AvisosFirebase(app.servicios.db, canalId).guardarDispositivo(suscripcion);
    expect(id).toBe(await idDispositivo(suscripcion.endpoint));
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    const leido = await getDoc(doc(termo.servicios.db, 'canales', canalId, 'dispositivos', id));
    expect(leido.data()?.['endpoint']).toBe(suscripcion.endpoint);
    await expect(getDoc(doc(extrano.servicios.db, 'canales', canalId, 'dispositivos', id))).rejects.toMatchObject({
      code: 'permission-denied',
    });
    // Un endpoint que no es https no entra.
    await expect(
      setDoc(doc(app.servicios.db, 'canales', canalId, 'dispositivos', id), {
        endpoint: 'http://malo',
        p256dh: 'x',
        auth: 'y',
        creadoEn: serverTimestamp(),
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
    await new AvisosFirebase(app.servicios.db, canalId).quitarDispositivo(suscripcion.endpoint);
    expect((await getDoc(doc(app.servicios.db, 'canales', canalId, 'dispositivos', id))).exists()).toBe(false);
  });

  it('el perfil guarda los ajustes del recordatorio', async () => {
    const { app } = await montar();
    const repo = new RepositorioFirestore(app.servicios.db, app.uid);
    const perfil = {
      nombre: 'Ana',
      pesoKg: 60,
      actividad: 'media' as const,
      unidad: 'F' as const,
      brillo: 'alto' as const,
      desfaseMin: -300,
      termoId: 'SS-SIM-0001',
      recordatorio: { activos: false, silencioDesde: 21, silencioHasta: 6, tono: 'directo' as const },
    };
    await repo.guardarPerfil(perfil);
    expect(await repo.leerPerfil()).toEqual(perfil);
    await expect(repo.guardarPerfil({ ...perfil, recordatorio: { ...perfil.recordatorio, silencioDesde: 30 } })).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });
});
