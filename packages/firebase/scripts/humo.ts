/**
 * Prueba de humo contra un proyecto de Firebase real (o el emulador).
 *
 *   pnpm firebase:humo              tu proyecto (apps/web/.env.local)
 *   pnpm firebase:humo --emulador   la Emulator Suite local
 *
 * Entra como anónimo, conecta un termo simulado, bebe dos sorbos (uno sin
 * conexión) y comprueba que lleguen a Firestore por la ruta real de la app:
 * termo → bus → sincronizador → repositorio.
 */
import {
  BusEnMemoria,
  claveDia,
  Motor,
  RelojSimulado,
  Sincronizador,
  TermoSimulado,
} from 'smartsip-core';
import { CuentaFirebase, EMULADOR_LOCAL, iniciarFirebase, RepositorioFirestore } from '../src/index.ts';
import { CONFIG_EMULADOR, configDelProyecto } from './entorno.ts';

const emulador = process.argv.includes('--emulador');
const config = emulador ? CONFIG_EMULADOR : configDelProyecto();
const servicios = iniciarFirebase(config, { cache: 'memoria', ...(emulador ? { emulador: EMULADOR_LOCAL } : {}) });
const cuenta = new CuentaFirebase(servicios.auth);

let fallo = false;
try {
  console.log(`Proyecto: ${config.projectId}${emulador ? ' (emulador)' : ''}`);
  const usuario = await cuenta.entrarAnonimo();
  console.log(`✓ Sesión anónima: ${usuario.uid}`);

  const repo = new RepositorioFirestore(servicios.db, usuario.uid);
  const reloj = new RelojSimulado(Date.now());
  const motor = new Motor(reloj);
  const termo = new TermoSimulado({ reloj, termoId: 'SS-HUMO-0001', nivelMl: 393, temperaturaC: 60, ambienteC: 30 });
  motor.agregar(termo);
  const bus = new BusEnMemoria(termo, reloj);
  const sinc = new Sincronizador({ transporte: bus, repositorio: repo, reloj, desfaseMin: -300 });
  sinc.alAviso((a) => {
    if (a.tipo === 'error') {
      fallo = true;
      console.error('✗', a.error);
    }
  });
  sinc.iniciar();
  bus.abrir();
  await sinc.esperar();

  termo.beber(40);
  motor.avanzar(3000);
  await sinc.esperar();
  termo.cortarBluetooth();
  termo.beber(25);
  motor.avanzar(3000);
  termo.restablecerBluetooth();
  await sinc.esperar();

  const hoy = claveDia(reloj.ahora());
  const [dia] = await repo.dias(hoy, hoy);
  const eventos = await repo.eventosDelDia(hoy);
  const datosTermo = await repo.leerTermo('SS-HUMO-0001');
  console.log(`✓ Eventos guardados hoy (${hoy}): ${eventos.map((e) => `${e.tipo} ${e.ml} ml`).join(', ')}`);
  console.log(`✓ Resumen del día: ${dia?.totalMl ?? 0} ml en ${dia?.sorbos ?? 0} sorbos`);
  console.log(`✓ Termo: firmware ${datosTermo?.firmware}, último visto ${datosTermo?.ultimoVisto ? 'sí' : 'no'}`);
  if (termo.estado().pendientes !== 0) throw new Error('El termo quedó con eventos sin confirmar.');
  if ((dia?.totalMl ?? 0) < 65) throw new Error('El día no sumó los 65 ml esperados.');
  console.log(fallo ? '✗ Hubo errores.' : '✓ Todo llegó a Firestore.');
} catch (error) {
  fallo = true;
  console.error('✗', error instanceof Error ? error.message : error);
} finally {
  cuenta.destruir();
  await servicios.cerrar();
}
process.exitCode = fallo ? 1 : 0;
