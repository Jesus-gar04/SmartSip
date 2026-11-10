/**
 * La función de Vercel `/api/avisar` contra el emulador de Firestore: solo
 * entrega a quien es parte del canal, y limpia suscripciones muertas. El
 * envío real del push se reemplaza por uno de mentira.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { doc, getDoc } from 'firebase/firestore';
import { manejarAvisar, type Entorno, type Suscripcion } from '../../../apps/web/api/avisar.ts';
import { AvisosFirebase, EmparejamientoFirebase, idDispositivo, type ServiciosFirebase } from '../src/index.ts';
import { PROYECTO_PRUEBAS, usuarioDePrueba } from './apoyo.ts';

const abiertos: ServiciosFirebase[] = [];
afterEach(async () => {
  while (abiertos.length) await abiertos.pop()?.cerrar();
});

const entorno: Entorno = {
  projectId: PROYECTO_PRUEBAS,
  emuladorFirestore: '127.0.0.1:8080',
  vapidPublica: 'publica',
  vapidPrivada: 'privada',
  vapidSujeto: 'mailto:pruebas@example.com',
};

const aviso = { tipo: 'ritmo', titulo: 'Te falta un poco de agua para ir al día', cuerpo: 'Llevas 600 ml.' };

async function montar() {
  const app = await usuarioDePrueba();
  const termo = await usuarioDePrueba();
  const extrano = await usuarioDePrueba();
  abiertos.push(app.servicios, termo.servicios, extrano.servicios);
  const codigo = await new EmparejamientoFirebase(app.servicios.db).crearCodigo(app.uid);
  const reclamado = await new EmparejamientoFirebase(termo.servicios.db).reclamar(codigo.codigo, 'SS-SIM-0001', termo.uid);
  const canalId = await new EmparejamientoFirebase(app.servicios.db).abrirCanal(reclamado);
  const avisos = new AvisosFirebase(app.servicios.db, canalId);
  await avisos.guardarDispositivo({ endpoint: 'https://push.example.com/vivo', keys: { p256dh: 'p1', auth: 'a1' } });
  await avisos.guardarDispositivo({ endpoint: 'https://push.example.com/muerto', keys: { p256dh: 'p2', auth: 'a2' } });
  const token = async (s: ServiciosFirebase) => (await s.auth.currentUser?.getIdToken()) ?? '';
  return { app, termo, extrano, canalId, token };
}

function llamar(token: string, cuerpo: unknown, enviados: Array<{ s: Suscripcion; carga: string }>) {
  const request = new Request('http://localhost/api/avisar', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  return manejarAvisar(request, entorno, {
    fetch,
    ahora: () => 1_000,
    enviar: async (s, carga) => {
      if (s.endpoint.endsWith('muerto')) throw Object.assign(new Error('Gone'), { statusCode: 410 });
      enviados.push({ s, carga });
    },
  });
}

describe('/api/avisar (emulador)', () => {
  it('el termo emparejado entrega el aviso y se borran las suscripciones muertas', async () => {
    const { app, termo, canalId, token } = await montar();
    const enviados: Array<{ s: Suscripcion; carga: string }> = [];
    const r = await llamar(await token(termo.servicios), { canalId, aviso }, enviados);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ enviados: 1, quitados: 1 });
    expect(enviados[0]?.s.endpoint).toBe('https://push.example.com/vivo');
    expect(JSON.parse(enviados[0]?.carga ?? '{}')).toEqual({ ...aviso, enMs: 1_000 });
    const muerto = await idDispositivo('https://push.example.com/muerto');
    expect((await getDoc(doc(app.servicios.db, 'canales', canalId, 'dispositivos', muerto))).exists()).toBe(false);
  });

  it('la app también puede probar sus avisos', async () => {
    const { app, canalId, token } = await montar();
    const r = await llamar(await token(app.servicios), { canalId, aviso: { ...aviso, tipo: 'prueba' } }, []);
    expect(r.status).toBe(200);
  });

  it('un extraño no puede mandar avisos a nadie', async () => {
    const { extrano, canalId, token } = await montar();
    const enviados: Array<{ s: Suscripcion; carga: string }> = [];
    const r = await llamar(await token(extrano.servicios), { canalId, aviso }, enviados);
    expect(r.status).toBe(403);
    expect(enviados).toHaveLength(0);
  });

  it('rechaza lo que no viene bien', async () => {
    const { termo, canalId, token } = await montar();
    const t = await token(termo.servicios);
    expect((await llamar(t, { canalId, aviso: { ...aviso, tipo: 'spam' } }, [])).status).toBe(400);
    expect((await llamar(t, { canalId: '../users/x', aviso }, [])).status).toBe(400);
    expect((await llamar('', { canalId, aviso }, [])).status).toBe(401);
    const get = await manejarAvisar(new Request('http://localhost/api/avisar'), entorno, {
      fetch,
      ahora: Date.now,
      enviar: async () => undefined,
    });
    expect(get.status).toBe(405);
    const sinClaves = await manejarAvisar(new Request('http://localhost/api/avisar', { method: 'POST' }), { ...entorno, vapidPrivada: '' }, {
      fetch,
      ahora: Date.now,
      enviar: async () => undefined,
    });
    expect(sinClaves.status).toBe(503);
  });
});
