import { describe, expect, it } from 'vitest';
import { BusEnMemoria, RelojSimulado, TermoSimulado, type EstadoEnlace, type Trafico } from '../src/index.ts';

const T0 = Date.UTC(2026, 10, 9, 13, 0, 0);

function montar(bluetooth = true) {
  const reloj = new RelojSimulado(T0);
  const termo = new TermoSimulado({ reloj, nivelMl: 393, temperaturaC: 70, bluetooth, termoId: 'SS-0042' });
  const bus = new BusEnMemoria(termo, reloj);
  const recibidos: string[] = [];
  const enlaces: EstadoEnlace[] = [];
  const trafico: Trafico[] = [];
  bus.alRecibir((m) => recibidos.push(m.tipo));
  bus.alCambiarEnlace((e) => enlaces.push(e));
  bus.alPasar((t) => trafico.push(t));
  return { reloj, termo, bus, recibidos, enlaces, trafico };
}

describe('BusEnMemoria', () => {
  it('al abrir con el termo conectado, el termo se presenta', () => {
    const { bus, recibidos, enlaces } = montar();
    expect(bus.enlace).toBe('desconectado');
    bus.abrir();
    bus.abrir(); // no duplica
    expect(bus.enlace).toBe('conectado');
    expect(enlaces).toEqual(['conectado']);
    expect(recibidos).toEqual(['hola', 'estado']);
  });

  it('el hola dice quién es el termo', () => {
    const reloj = new RelojSimulado(T0);
    const termo = new TermoSimulado({ reloj, termoId: 'SS-0042', firmware: '2.1.0', ultimoId: 17 });
    const bus = new BusEnMemoria(termo, reloj);
    const mensajes: unknown[] = [];
    bus.alRecibir((m) => mensajes.push(m));
    bus.abrir();
    expect(mensajes[0]).toEqual({
      tipo: 'hola',
      enMs: T0,
      version: 1,
      termoId: 'SS-0042',
      firmware: '2.1.0',
      capacidadMl: 393,
      ultimoId: 17,
    });
  });

  it('al abrir sin conexión no pasa nada hasta que vuelve el Bluetooth', () => {
    const { bus, termo, recibidos, enlaces } = montar(false);
    bus.abrir();
    expect(enlaces).toEqual([]);
    expect(bus.enviar({ tipo: 'confirmar', hastaId: 1 })).toBe(false);
    termo.restablecerBluetooth();
    expect(enlaces).toEqual(['conectado']);
    expect(recibidos).toEqual(['hola', 'estado']);
    termo.cortarBluetooth();
    expect(enlaces).toEqual(['conectado', 'desconectado']);
  });

  it('registra el tráfico en ambas direcciones, con la hora', () => {
    const { bus, trafico } = montar();
    bus.abrir();
    expect(bus.enviar({ tipo: 'preferencias', unidad: 'F' })).toBe(true);
    expect(trafico.map((t) => [t.direccion, t.mensaje.tipo, t.enMs])).toEqual([
      ['termoAApp', 'hola', T0],
      ['termoAApp', 'estado', T0],
      ['appATermo', 'preferencias', T0],
    ]);
  });

  it('el mensaje de la app llega al termo', () => {
    const { bus, termo } = montar();
    bus.abrir();
    bus.enviar({ tipo: 'preferencias', unidad: 'F' });
    expect(termo.estado().unidad).toBe('F');
  });

  it('al cerrar avisa la desconexión y deja de entregar', () => {
    const { bus, termo, recibidos, enlaces } = montar();
    bus.cerrar(); // cerrado: no hace nada
    bus.abrir();
    bus.cerrar();
    expect(enlaces).toEqual(['conectado', 'desconectado']);
    expect(bus.enlace).toBe('desconectado');
    const antes = recibidos.length;
    termo.cortarBluetooth();
    termo.restablecerBluetooth();
    expect(recibidos.length).toBe(antes);
  });

  it('cerrar sin conexión no avisa nada', () => {
    const { bus, enlaces } = montar(false);
    bus.abrir();
    bus.cerrar();
    expect(enlaces).toEqual([]);
  });

  it('se puede dejar de escuchar', () => {
    const { bus } = montar();
    const vistos: string[] = [];
    const a = bus.alRecibir((m) => vistos.push(m.tipo));
    const b = bus.alCambiarEnlace((e) => vistos.push(e));
    const c = bus.alPasar((t) => vistos.push(t.direccion));
    a();
    b();
    c();
    bus.abrir();
    expect(vistos).toEqual([]);
  });

  it('rechaza números de serie inválidos', () => {
    const reloj = new RelojSimulado(T0);
    expect(() => new TermoSimulado({ reloj, termoId: 'con espacio' })).toThrow(RangeError);
    expect(() => new TermoSimulado({ reloj, termoId: 'a/b' })).toThrow(RangeError);
  });
});
