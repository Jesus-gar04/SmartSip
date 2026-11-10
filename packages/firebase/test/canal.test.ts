import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ActualizadorFirmware,
  claveDia,
  crearPaquete,
  Motor,
  RelojSimulado,
  Sincronizador,
  TermoSimulado,
  type EstadoEnlace,
} from 'smartsip-core';
import {
  EmparejamientoFirebase,
  PuenteTermoFirestore,
  RepositorioFirestore,
  TransporteFirestore,
  type ServiciosFirebase,
} from '../src/index.ts';
import { usuarioDePrueba } from './apoyo.ts';

const abiertos: ServiciosFirebase[] = [];
const cerrar: Array<() => void> = [];
afterEach(async () => {
  while (cerrar.length) cerrar.pop()?.();
  while (abiertos.length) await abiertos.pop()?.cerrar();
});

/** La app de una persona y un termo en otro dispositivo, ya emparejados. */
async function montar() {
  const app = await usuarioDePrueba();
  const termoU = await usuarioDePrueba();
  abiertos.push(app.servicios, termoU.servicios);
  const codigo = await new EmparejamientoFirebase(app.servicios.db).crearCodigo(app.uid);
  const reclamado = await new EmparejamientoFirebase(termoU.servicios.db).reclamar(codigo.codigo, 'SS-SIM-0001', termoU.uid);
  const canalId = await new EmparejamientoFirebase(app.servicios.db).abrirCanal(reclamado);

  // El termo, con su reloj, en "su" dispositivo.
  const reloj = new RelojSimulado(Date.now());
  const motor = new Motor(reloj);
  const termo = new TermoSimulado({ reloj, nivelMl: 393, temperaturaC: 60, termoId: 'SS-SIM-0001' });
  motor.agregar(termo);
  const puente = new PuenteTermoFirestore(termoU.servicios.db, canalId, termo, reloj);

  // La app: transporte por Firestore, sincronizador y repositorio de la persona.
  const repo = new RepositorioFirestore(app.servicios.db, app.uid);
  const transporte = new TransporteFirestore(app.servicios.db, canalId);
  const sinc = new Sincronizador({ transporte, repositorio: repo, reloj, desfaseMin: -300 });
  const enlaces: EstadoEnlace[] = [];
  transporte.alCambiarEnlace((e) => enlaces.push(e));
  sinc.iniciar();
  transporte.abrir();
  puente.abrir();
  cerrar.push(() => puente.cerrar(), () => transporte.cerrar(), () => sinc.detener());
  return { reloj, motor, termo, repo, transporte, enlaces, sinc };
}

describe('puente termo ↔ app por Firestore (emulador)', () => {
  it('un sorbo en el termo llega a la cuenta de la persona y el termo libera su cola', async () => {
    const { reloj, motor, termo, repo, transporte } = await montar();
    await vi.waitFor(() => expect(transporte.enlace).toBe('conectado'), { timeout: 10_000 });
    termo.beber(40);
    motor.avanzar(3000);
    const hoy = claveDia(reloj.ahora());
    await vi.waitFor(async () => expect((await repo.dias(hoy, hoy))[0]?.totalMl).toBe(40), { timeout: 10_000 });
    await vi.waitFor(() => expect(termo.estado().pendientes).toBe(0), { timeout: 10_000 });
  });

  it('sin Bluetooth el termo guarda; al volver, lo guardado llega en lote', async () => {
    const { reloj, motor, termo, repo, transporte, enlaces } = await montar();
    await vi.waitFor(() => expect(transporte.enlace).toBe('conectado'), { timeout: 10_000 });
    termo.cortarBluetooth();
    await vi.waitFor(() => expect(enlaces.at(-1)).toBe('desconectado'), { timeout: 10_000 });
    termo.beber(30);
    motor.avanzar(3000);
    expect(termo.estado().pendientes).toBe(1);
    termo.restablecerBluetooth();
    const hoy = claveDia(reloj.ahora());
    await vi.waitFor(async () => expect((await repo.dias(hoy, hoy))[0]?.totalMl).toBe(30), { timeout: 10_000 });
    await vi.waitFor(() => expect(termo.estado().pendientes).toBe(0), { timeout: 10_000 });
  });

  it('el firmware viaja por el canal bloque a bloque y el termo vuelve con la versión nueva (A4)', async () => {
    const { motor, termo, repo, transporte, sinc } = await montar();
    await vi.waitFor(() => expect(transporte.enlace).toBe('conectado'), { timeout: 10_000 });
    const paquete = crearPaquete('sim-1.1.0', 'Prueba.', 3 * 1024);
    const act = new ActualizadorFirmware(transporte, paquete);
    cerrar.push(() => act.detener());
    act.iniciar();
    // El termo escribe cada bloque en 150 ms de su tiempo; aquí se le da cuerda mientras llegan.
    await vi.waitFor(
      () => {
        motor.avanzar(500);
        expect(act.estado.fase).toBe('instalando');
      },
      { timeout: 20_000, interval: 100 },
    );
    motor.avanzar(5000);
    await vi.waitFor(() => expect(act.estado.fase).toBe('lista'), { timeout: 10_000 });
    expect(termo.firmware).toBe('sim-1.1.0');
    await sinc.esperar();
    await vi.waitFor(async () => expect((await repo.leerTermo('SS-SIM-0001'))?.firmware).toBe('sim-1.1.0'), { timeout: 10_000 });
  });
});
