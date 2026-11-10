import { describe, expect, it } from 'vitest';
import {
  ActualizadorFirmware,
  BusEnMemoria,
  bloqueFirmware,
  compararVersiones,
  crearPaquete,
  FIRMWARE_DISPONIBLE,
  FIRMWARE_SIMULADO,
  fraccionActualizacion,
  hayActualizacion,
  Motor,
  RelojSimulado,
  RepositorioEnMemoria,
  Sincronizador,
  TermoSimulado,
  textoVersion,
  type EstadoActualizacion,
  type MensajeApp,
  type MensajeTermo,
  type Transporte,
} from '../src/index.ts';

const T0 = Date.UTC(2026, 10, 10, 13, 0, 0);
const paquete = crearPaquete('sim-1.1.0', 'Mejoras.', 8 * 1024); // 8 bloques: pruebas rápidas

function montar(opciones: { bateria?: number } = {}) {
  const reloj = new RelojSimulado(T0);
  const motor = new Motor(reloj);
  const termo = new TermoSimulado({ reloj, nivelMl: 200, temperaturaC: 40, bateria: opciones.bateria ?? 0.8 });
  motor.agregar(termo);
  const bus = new BusEnMemoria(termo, reloj);
  bus.abrir();
  const act = new ActualizadorFirmware(bus, paquete);
  const estados: EstadoActualizacion[] = [];
  act.alCambiar((e) => estados.push(e));
  return { reloj, motor, termo, bus, act, estados };
}

describe('el paquete de firmware', () => {
  it('compara versiones y dice si hay una nueva', () => {
    expect(compararVersiones('sim-1.0.0', 'sim-1.1.0')).toBeLessThan(0);
    expect(compararVersiones('sim-1.10.0', 'sim-1.9.3')).toBeGreaterThan(0);
    expect(compararVersiones('sim-1.1', 'sim-1.1.0')).toBe(0);
    expect(hayActualizacion(FIRMWARE_SIMULADO)).toBe(true);
    expect(hayActualizacion(FIRMWARE_DISPONIBLE.version)).toBe(false);
    expect(hayActualizacion(null)).toBe(false);
    expect(textoVersion('sim-1.1.0')).toBe('1.1.0');
  });

  it('los bloques son siempre los mismos para la misma versión', () => {
    expect(bloqueFirmware('sim-1.1.0', 3, 16)).toBe(bloqueFirmware('sim-1.1.0', 3, 16));
    expect(bloqueFirmware('sim-1.1.0', 3, 16)).not.toBe(bloqueFirmware('sim-1.1.0', 4, 16));
    expect(bloqueFirmware('sim-1.1.0', 0, 16)).toHaveLength(32);
    expect(FIRMWARE_DISPONIBLE.bloques).toBe(24);
    expect(crearPaquete('sim-1.1.0', '', 8 * 1024).suma).toBe(paquete.suma);
  });
});

describe('actualizar el termo (A4)', () => {
  it('pasa bloque a bloque, se reinicia y vuelve con la versión nueva', () => {
    const { motor, termo, act, estados } = montar();
    expect(act.iniciar()).toBe(true);
    expect(termo.estado().actualizacion).toEqual({ fase: 'recibiendo', fraccion: 0 });
    motor.avanzar(500);
    // A 150 ms por bloque, en medio segundo van unos tres.
    const aMitad = act.estado.recibidos;
    expect(aMitad).toBeGreaterThan(1);
    expect(aMitad).toBeLessThan(paquete.bloques);
    expect(termo.pantalla().actualizacion?.fase).toBe('recibiendo');
    motor.avanzar(2000);
    expect(act.estado.fase).toBe('instalando');
    expect(termo.pantalla().actualizacion).toEqual({ fase: 'instalando', fraccion: 1 });
    expect(termo.conectado).toBe(false); // se reinicia sin Bluetooth
    motor.avanzar(4500);
    expect(termo.firmware).toBe('sim-1.1.0');
    expect(termo.conectado).toBe(true);
    expect(termo.estado().actualizacion).toBeNull();
    expect(act.estado.fase).toBe('lista');
    expect(fraccionActualizacion(act.estado)).toBe(1);
    // La barra avanza de a un bloque, sin saltos hacia atrás.
    const recibidos = estados.map((e) => e.recibidos);
    expect(recibidos).toEqual([...recibidos].sort((a, b) => a - b));
  });

  it('si después el termo vuelve con otra versión, se puede actualizar de nuevo', () => {
    // Un transporte de prueba: lo que "dice el termo" se inyecta a mano.
    const oyentes: Array<(m: MensajeTermo) => void> = [];
    const transporte: Transporte = {
      enlace: 'conectado',
      enviar: () => true,
      alRecibir: (o) => {
        oyentes.push(o);
        return () => undefined;
      },
      alCambiarEnlace: () => () => undefined,
    };
    const decir = (m: MensajeTermo) => oyentes.forEach((o) => o(m));
    const hola = (firmware: string): MensajeTermo => ({
      tipo: 'hola',
      enMs: T0,
      version: 1,
      termoId: 'SS-SIM-0001',
      firmware,
      capacidadMl: 393,
      ultimoId: 0,
    });
    const act = new ActualizadorFirmware(transporte, paquete);
    decir(hola('sim-1.1.0'));
    expect(act.estado.fase).toBe('libre'); // sin actualización en curso, un saludo no cambia nada
    act.iniciar();
    decir(hola('sim-1.1.0'));
    expect(act.estado.fase).toBe('lista');
    decir(hola(FIRMWARE_SIMULADO)); // lo restauraron, o es otro termo
    expect(act.estado.fase).toBe('libre');
  });

  it('si el termo se aleja a mitad, sigue desde donde iba al volver', () => {
    const { motor, termo, act } = montar();
    act.iniciar();
    motor.avanzar(500);
    termo.cortarBluetooth();
    const guardados = act.estado.recibidos;
    expect(act.estado.fase).toBe('en-pausa');
    motor.avanzar(2000);
    termo.restablecerBluetooth(); // saluda; la app retoma sola
    expect(act.estado.fase).toBe('enviando');
    expect(act.estado.recibidos).toBeGreaterThanOrEqual(guardados);
    motor.avanzar(2000);
    expect(act.estado.fase).toBe('instalando');
    motor.avanzar(4500);
    expect(termo.firmware).toBe('sim-1.1.0');
  });

  it('con poca batería no empieza, salvo que esté cargando', () => {
    const { termo, act } = montar({ bateria: 0.2 });
    act.iniciar();
    expect(act.estado).toMatchObject({ fase: 'error', error: 'bateria' });
    termo.conectarCargador();
    act.iniciar();
    expect(act.estado.fase).toBe('enviando');
  });

  it('un paquete dañado no se instala', () => {
    const reloj = new RelojSimulado(T0);
    const motor = new Motor(reloj);
    const termo = new TermoSimulado({ reloj });
    motor.agregar(termo);
    const bus = new BusEnMemoria(termo, reloj);
    bus.abrir();
    // Un transporte que daña el último bloque en el camino.
    const danino: Transporte = {
      get enlace() {
        return bus.enlace;
      },
      enviar: (m: MensajeApp) =>
        bus.enviar(m.tipo === 'firmwareBloque' && m.n === paquete.bloques - 1 ? { ...m, datos: `${m.datos.slice(1)}0` } : m),
      alRecibir: (o) => bus.alRecibir(o),
      alCambiarEnlace: (o) => bus.alCambiarEnlace(o),
    };
    const act = new ActualizadorFirmware(danino, paquete);
    act.iniciar();
    motor.avanzar(3000);
    expect(act.estado).toMatchObject({ fase: 'error', error: 'suma' });
    expect(termo.firmware).toBe(FIRMWARE_SIMULADO);
    expect(termo.conectado).toBe(true);
  });

  it('ignora bloques repetidos o fuera de orden y dice desde dónde seguir', () => {
    const { termo, bus } = montar();
    const progreso: number[] = [];
    bus.alRecibir((m) => m.tipo === 'firmwareProgreso' && progreso.push(m.recibidos));
    bus.enviar({ tipo: 'firmwareInicio', version: paquete.version, tamanoBytes: paquete.tamanoBytes, bloques: paquete.bloques, suma: paquete.suma });
    bus.enviar({ tipo: 'firmwareBloque', version: paquete.version, n: 3, datos: 'ff' });
    bus.enviar({ tipo: 'firmwareBloque', version: 'sim-9.9.9', n: 0, datos: 'ff' });
    expect(progreso).toEqual([0, 0]);
    expect(termo.estado().actualizacion).toEqual({ fase: 'recibiendo', fraccion: 0 });
  });

  it('la cuenta guarda la versión nueva cuando el termo vuelve', async () => {
    const { reloj, motor, termo, bus, act } = montar();
    const repo = new RepositorioEnMemoria();
    const sinc = new Sincronizador({ transporte: bus, repositorio: repo, reloj, desfaseMin: -300 });
    sinc.iniciar();
    termo.saludar();
    await sinc.esperar();
    expect((await repo.leerTermo(termo.termoId))?.firmware).toBe(FIRMWARE_SIMULADO);
    act.iniciar();
    motor.avanzar(8000);
    await sinc.esperar();
    expect((await repo.leerTermo(termo.termoId))?.firmware).toBe('sim-1.1.0');
  });
});
