import { describe, expect, it } from 'vitest';
import {
  BusEnMemoria,
  ErrorSincronizador,
  Motor,
  RelojSimulado,
  RepositorioEnMemoria,
  Sincronizador,
  TermoSimulado,
  type AvisoSincronizador,
  type CambiosTermo,
  type Lugar,
  type MensajeApp,
  type OpcionesTermo,
  type RegistroEvento,
  type Transporte,
} from '../src/index.ts';

const T0 = Date.UTC(2026, 10, 9, 13, 0, 0);
const SEG = 1000;
const MIN = 60 * SEG;
const HORA = 60 * MIN;
const AQUI: Lugar = { lat: 10.98, lng: -74.8, precisionM: 15 };

/** Repositorio en memoria que además anota cada escritura del termo. */
class RepoEspia extends RepositorioEnMemoria {
  escriturasTermo: CambiosTermo[] = [];
  fallarRegistro = false;
  override async guardarTermo(cambios: CambiosTermo): Promise<void> {
    this.escriturasTermo.push(cambios);
    return super.guardarTermo(cambios);
  }
  override async registrar(registro: RegistroEvento): Promise<void> {
    if (this.fallarRegistro) throw new Error('sin cuota');
    return super.registrar(registro);
  }
}

/** Transporte que deja pasar todo menos las confirmaciones, como si se perdieran. */
function sinConfirmar(t: Transporte): Transporte {
  return {
    get enlace() {
      return t.enlace;
    },
    enviar: (m: MensajeApp) => (m.tipo === 'confirmar' ? true : t.enviar(m)),
    alRecibir: (o) => t.alRecibir(o),
    alCambiarEnlace: (o) => t.alCambiarEnlace(o),
  };
}

function montar(opcionesTermo: Partial<OpcionesTermo> = {}, extra: { ubicacion?: () => Promise<Lugar | null> } = {}) {
  const reloj = new RelojSimulado(T0);
  const motor = new Motor(reloj);
  const termo = new TermoSimulado({ reloj, nivelMl: 393, temperaturaC: 70, termoId: 'SS-0042', ...opcionesTermo });
  motor.agregar(termo);
  const bus = new BusEnMemoria(termo, reloj);
  const repo = new RepoEspia();
  const avisos: AvisoSincronizador[] = [];
  const crear = (transporte: Transporte = bus) => {
    const s = new Sincronizador({ transporte, repositorio: repo, reloj, desfaseMin: -300, ...extra });
    s.alAviso((a) => avisos.push(a));
    s.iniciar();
    return s;
  };
  return { reloj, motor, termo, bus, repo, avisos, crear };
}

describe('Sincronizador', () => {
  it('al conectarse guarda quién es el termo', async () => {
    const { bus, repo, avisos, crear } = montar({ firmware: '2.1.0' });
    const sinc = crear();
    sinc.iniciar(); // no duplica
    bus.abrir();
    await sinc.esperar();
    expect(sinc.termoId).toBe('SS-0042');
    expect(await repo.leerTermo('SS-0042')).toMatchObject({ firmware: '2.1.0', capacidadMl: 393 });
    expect(avisos.map((a) => a.tipo)).toEqual(['enlace', 'termo']);
  });

  it('guarda cada sorbo con la temperatura del agua y lo confirma', async () => {
    const { bus, termo, motor, repo, avisos, crear } = montar();
    const sinc = crear();
    bus.abrir();
    await sinc.esperar();
    termo.beber(40);
    motor.avanzar(3 * SEG);
    await sinc.esperar();
    const [evento] = await repo.eventosDelDia('2026-11-09');
    expect(evento).toMatchObject({ tipo: 'sorbo', ml: 40, temperaturaC: 70, estado: 'registrado', hora: 8 });
    expect(termo.estado().pendientes).toBe(0);
    expect(avisos.some((a) => a.tipo === 'registro')).toBe(true);
  });

  it('lo guardado sin conexión llega en lote, sin temperatura, y libera la cola del termo', async () => {
    const { bus, termo, motor, repo, crear } = montar();
    const sinc = crear();
    bus.abrir();
    termo.cortarBluetooth();
    termo.beber(40);
    motor.avanzar(5 * MIN);
    termo.beber(60);
    motor.avanzar(5 * MIN);
    expect(termo.estado().pendientes).toBe(2);
    termo.restablecerBluetooth();
    await sinc.esperar();
    const eventos = await repo.eventosDelDia('2026-11-09');
    expect(eventos.map((e) => [e.ml, e.temperaturaC])).toEqual([
      [40, null],
      [60, null],
    ]);
    expect((await repo.dias('2026-11-09', '2026-11-09'))[0]?.totalMl).toBe(100);
    expect(termo.estado().pendientes).toBe(0);
  });

  it('si la app se reinicia y el termo reenvía, no se cuenta dos veces', async () => {
    const { bus, termo, motor, repo, crear } = montar();
    const primera = crear(sinConfirmar(bus));
    bus.abrir();
    termo.beber(40);
    motor.avanzar(3 * SEG);
    await primera.esperar();
    expect(termo.estado().pendientes).toBe(1); // la confirmación se perdió
    primera.detener();

    const segunda = crear(); // la app vuelve a abrir
    termo.cortarBluetooth();
    termo.restablecerBluetooth(); // el termo reenvía el sorbo en un lote
    await segunda.esperar();
    expect((await repo.dias('2026-11-09', '2026-11-09'))[0]?.totalMl).toBe(40);
    expect(termo.estado().pendientes).toBe(0);
  });

  it('un descenso grande queda pendiente y se resuelve desde la app', async () => {
    const { bus, termo, motor, repo, crear } = montar();
    const sinc = crear();
    bus.abrir();
    termo.vaciar();
    motor.avanzar(3 * SEG);
    await sinc.esperar();
    const [pendiente] = await repo.pendientes();
    if (!pendiente) throw new Error('debería haber un pendiente');
    await sinc.resolverDescenso(pendiente, 'vaciado');
    expect(await repo.pendientes()).toEqual([]);
    expect(await sinc.resolverDescenso(pendiente, 'bebido').catch((e: Error) => e.name)).toBe('ErrorRepositorio');
  });

  it('al perder la conexión guarda el último lugar y la hora', async () => {
    const { bus, termo, motor, repo, crear } = montar({}, { ubicacion: async () => AQUI });
    const sinc = crear();
    bus.abrir();
    motor.avanzar(10 * MIN);
    termo.cortarBluetooth();
    await sinc.esperar();
    expect((await repo.leerTermo('SS-0042'))?.ultimoVisto).toEqual({ enMs: T0 + 10 * MIN, lugar: AQUI });
  });

  it('sin permiso de ubicación guarda solo la hora', async () => {
    const { bus, termo, repo, crear } = montar({}, {
      ubicacion: async () => {
        throw new Error('permiso denegado');
      },
    });
    const sinc = crear();
    bus.abrir();
    termo.cortarBluetooth();
    await sinc.esperar();
    expect((await repo.leerTermo('SS-0042'))?.ultimoVisto).toEqual({ enMs: T0, lugar: null });
  });

  it('sin proveedor de ubicación también guarda la hora; antes del hola no guarda nada', async () => {
    const { bus, termo, repo, crear } = montar({ bluetooth: false });
    const sinc = crear();
    bus.abrir();
    termo.restablecerBluetooth();
    termo.cortarBluetooth();
    await sinc.esperar();
    expect((await repo.leerTermo('SS-0042'))?.ultimoVisto).toEqual({ enMs: T0, lugar: null });
  });

  it('guarda la telemetría con mesura: como mucho cada 15 minutos', async () => {
    const { bus, motor, repo, crear } = montar();
    const sinc = crear();
    bus.abrir();
    motor.avanzar(HORA);
    await sinc.esperar();
    const telemetria = repo.escriturasTermo.filter((c) => c.bateria !== undefined);
    expect(telemetria).toHaveLength(5); // al conectar y a los 15, 30, 45 y 60 min
  });

  it('avisa la batería baja', async () => {
    const { bus, motor, avisos, crear } = montar({ bateria: 0.1505 });
    const sinc = crear();
    bus.abrir();
    motor.avanzar(HORA);
    await sinc.esperar();
    expect(avisos.some((a) => a.tipo === 'bateriaBaja')).toBe(true);
  });

  it('si el repositorio falla, avisa el error y sigue', async () => {
    const { bus, termo, motor, repo, avisos, crear } = montar();
    const sinc = crear();
    bus.abrir();
    await sinc.esperar();
    repo.fallarRegistro = true;
    termo.beber(40);
    motor.avanzar(3 * SEG);
    await sinc.esperar();
    expect(avisos.some((a) => a.tipo === 'error')).toBe(true);
  });

  it('avisa si el termo dice ir más atrás de lo que ya está guardado', async () => {
    const { bus, repo, avisos, crear } = montar({ ultimoId: 0 });
    await repo.registrar({
      clave: 'SS-0042_0000000009',
      termoId: 'SS-0042',
      id: 9,
      tipo: 'sorbo',
      ml: 40,
      nivelMl: 353,
      enMs: T0,
      dia: '2026-11-09',
      hora: 8,
      temperaturaC: null,
      estado: 'registrado',
    });
    const sinc = crear();
    bus.abrir();
    await sinc.esperar();
    const error = avisos.find((a) => a.tipo === 'error');
    expect(error?.tipo === 'error' && error.error).toBeInstanceOf(ErrorSincronizador);
  });

  it('el mismo termo al reconectar no vuelve a consultar dónde quedamos', async () => {
    const { bus, termo, repo, crear } = montar();
    let consultas = 0;
    const original = repo.ultimoIdDeTermo.bind(repo);
    repo.ultimoIdDeTermo = async (id: string) => {
      consultas++;
      return original(id);
    };
    const sinc = crear();
    bus.abrir();
    await sinc.esperar();
    termo.cortarBluetooth();
    termo.restablecerBluetooth();
    await sinc.esperar();
    expect(consultas).toBe(1);
  });

  it('si leer dónde quedamos falla, sigue desde cero sin perder mensajes', async () => {
    const { bus, termo, motor, repo, avisos, crear } = montar();
    repo.ultimoIdDeTermo = async () => {
      throw new Error('sin red');
    };
    const sinc = crear();
    bus.abrir();
    await sinc.esperar();
    termo.beber(40);
    motor.avanzar(3 * SEG);
    await sinc.esperar();
    expect(avisos.some((a) => a.tipo === 'error')).toBe(true);
    expect(await repo.eventosDelDia('2026-11-09')).toHaveLength(1);
  });

  it('detenido, deja de escuchar', async () => {
    const { bus, termo, motor, repo, crear } = montar();
    const sinc = crear();
    sinc.detener();
    bus.abrir();
    termo.beber(40);
    motor.avanzar(3 * SEG);
    await sinc.esperar();
    expect(await repo.eventosDelDia('2026-11-09')).toEqual([]);
  });
});
