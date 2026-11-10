import { describe, expect, it } from 'vitest';
import {
  ESPECIFICACIONES,
  Motor,
  RegistroConsumo,
  RelojSimulado,
  TermoSimulado,
  type MensajeTermo,
  type OpcionesTermo,
} from '../src/index.ts';

const T0 = Date.UTC(2026, 10, 9, 13, 0, 0);
const SEG = 1000;
const MIN = 60 * SEG;
const HORA = 60 * MIN;

/** Termo, motor y una app mínima que confirma lo que recibe. */
function montar(opciones: Omit<OpcionesTermo, 'reloj'> = {}, { confirmar = true } = {}) {
  const reloj = new RelojSimulado(T0);
  const motor = new Motor(reloj);
  const termo = new TermoSimulado({ reloj, ...opciones });
  motor.agregar(termo);
  const mensajes: MensajeTermo[] = [];
  const consumo = new RegistroConsumo();
  termo.alEnviar((m) => {
    mensajes.push(m);
    const ack = consumo.procesar(m);
    if (ack && confirmar) termo.recibir(ack);
  });
  const tipos = () => mensajes.filter((m) => m.tipo !== 'estado' && m.tipo !== 'hola').map((m) => m.tipo);
  return { reloj, motor, termo, mensajes, consumo, tipos };
}

describe('TermoSimulado: controles físicos', () => {
  it('arranca con la capacidad de SmartSip', () => {
    const { termo } = montar();
    expect(termo.capacidadMl).toBe(ESPECIFICACIONES.capacidadMl);
    expect(termo.estado()).toMatchObject({ nivelMl: 0, tapaCerrada: true, encendido: true, conectado: true });
  });

  it('llenar no pasa de la capacidad y mezcla temperaturas', () => {
    const { termo } = montar({ nivelMl: 193, temperaturaC: 80 });
    expect(termo.llenar(500, 20)).toBe(200);
    expect(termo.estado().nivelMl).toBe(393);
    expect(termo.estado().temperaturaC).toBeCloseTo((193 * 80 + 200 * 20) / 393, 10);
    expect(termo.llenar(10, 20)).toBe(0);
    expect(termo.llenar(-10, 20)).toBe(0);
  });

  it('beber y vaciar devuelven lo que había', () => {
    const { termo } = montar({ nivelMl: 100 });
    expect(termo.beber(30)).toBe(30);
    expect(termo.beber(-5)).toBe(0);
    expect(termo.vaciar()).toBe(70);
    expect(termo.beber(10)).toBe(0);
  });
});

describe('TermoSimulado: física térmica (T3)', () => {
  it('cerrado y lleno pasa de 95 °C a unos 63 °C en 12 h', () => {
    const { termo, motor } = montar({ nivelMl: 393, temperaturaC: 95, ambienteC: 25 });
    motor.avanzar(12 * HORA);
    expect(termo.estado().temperaturaC).toBeCloseTo(63.4, 1);
  });

  it('con la tapa abierta se enfría mucho más rápido', () => {
    const cerrado = montar({ nivelMl: 393, temperaturaC: 85, ambienteC: 31 });
    const abierto = montar({ nivelMl: 393, temperaturaC: 85, ambienteC: 31 });
    abierto.termo.abrirTapa();
    cerrado.motor.avanzar(HORA);
    abierto.motor.avanzar(HORA);
    expect(85 - abierto.termo.estado().temperaturaC).toBeGreaterThan(5 * (85 - cerrado.termo.estado().temperaturaC));
    abierto.termo.cerrarTapa();
    expect(abierto.termo.estado().tapaCerrada).toBe(true);
  });

  it('el agua fría se calienta hacia el ambiente', () => {
    const { termo, motor } = montar({ nivelMl: 393, temperaturaC: 5, ambienteC: 25 });
    termo.fijarAmbiente(31);
    motor.avanzar(HORA);
    const t = termo.estado().temperaturaC;
    expect(t).toBeGreaterThan(5);
    expect(t).toBeLessThan(31);
  });

  it('la pantalla y el mensaje de estado muestran el mismo valor', () => {
    const { termo, mensajes, motor } = montar({ nivelMl: 393, temperaturaC: 63.44 });
    motor.avanzar(10 * SEG);
    const estado = mensajes.find((m) => m.tipo === 'estado');
    expect(estado).toBeDefined();
    if (estado?.tipo !== 'estado') return;
    expect(Math.round(estado.temperaturaC)).toBe(termo.pantalla().temperatura);
  });
});

describe('TermoSimulado: nivel (T1, T2, T4)', () => {
  it('un sorbo llega a la app y queda confirmado', () => {
    const { termo, motor, consumo, tipos } = montar({ nivelMl: 393 });
    termo.beber(40);
    motor.avanzar(3 * SEG);
    expect(tipos()).toEqual(['sorbo']);
    expect(consumo.totalDelDia(T0)).toBe(40);
    expect(termo.estado().pendientes).toBe(0);
  });

  it('el llenado no suma al consumo', () => {
    const { termo, motor, consumo, tipos } = montar({ nivelMl: 0 });
    termo.llenar(393, 10);
    motor.avanzar(3 * SEG);
    expect(tipos()).toEqual(['llenado']);
    expect(consumo.totalDelDia(T0)).toBe(0);
  });

  it('vaciar de golpe es un descenso grande que espera respuesta', () => {
    const { termo, motor, consumo, tipos } = montar({ nivelMl: 393 });
    termo.vaciar();
    motor.avanzar(3 * SEG);
    expect(tipos()).toEqual(['descensoGrande']);
    expect(consumo.dudosos()).toHaveLength(1);
    expect(consumo.totalDelDia(T0)).toBe(0);
  });

  it('sin confirmación, los eventos quedan pendientes', () => {
    const { termo, motor } = montar({ nivelMl: 393 }, { confirmar: false });
    termo.beber(40);
    motor.avanzar(3 * SEG);
    expect(termo.estado().pendientes).toBe(1);
  });
});

describe('TermoSimulado: desconexión (T6)', () => {
  it('guarda los sorbos sin conexión y los manda en lote al reconectar', () => {
    const { termo, motor, consumo, mensajes } = montar({ nivelMl: 393 });
    termo.cortarBluetooth();
    expect(termo.estado().conectado).toBe(false);
    termo.beber(40);
    motor.avanzar(5 * MIN);
    termo.beber(60);
    motor.avanzar(5 * MIN);
    expect(mensajes).toEqual([]);
    expect(termo.estado().pendientes).toBe(2);
    expect(termo.pantalla().bluetooth).toBe(false);

    termo.restablecerBluetooth();
    const lote = mensajes.find((m) => m.tipo === 'lote');
    expect(lote?.tipo === 'lote' && lote.eventos.map((e) => e.ml)).toEqual([40, 60]);
    expect(mensajes.at(-1)?.tipo).toBe('estado');
    expect(consumo.totalDelDia(T0)).toBe(100);
    expect(termo.estado().pendientes).toBe(0);
  });

  it('reenviar lo ya recibido no duplica el consumo', () => {
    const { termo, motor, consumo } = montar({ nivelMl: 393 }, { confirmar: false });
    termo.beber(40);
    motor.avanzar(3 * SEG); // llega, pero la app no confirma
    termo.cortarBluetooth();
    termo.restablecerBluetooth(); // se reenvía en el lote
    expect(consumo.totalDelDia(T0)).toBe(40);
  });

  it('sin conexión no recibe mensajes de la app', () => {
    const { termo } = montar();
    termo.cortarBluetooth();
    termo.recibir({ tipo: 'preferencias', unidad: 'F' });
    expect(termo.estado().unidad).toBe('C');
  });

  it('desuscribirse deja de recibir mensajes', () => {
    const { termo, motor } = montar({ nivelMl: 393 });
    const otros: MensajeTermo[] = [];
    const salir = termo.alEnviar((m) => otros.push(m));
    salir();
    termo.beber(40);
    motor.avanzar(3 * SEG);
    expect(otros).toEqual([]);
  });
});

describe('TermoSimulado: preferencias (A3)', () => {
  it('cambia la unidad y el brillo de la pantalla', () => {
    const { termo } = montar({ nivelMl: 393, temperaturaC: 60 });
    termo.recibir({ tipo: 'preferencias', unidad: 'F' });
    expect(termo.pantalla()).toMatchObject({ temperatura: 140, unidad: 'F', brillo: 'medio' });
    termo.recibir({ tipo: 'preferencias', brillo: 'alto' });
    expect(termo.pantalla()).toMatchObject({ unidad: 'F', brillo: 'alto' });
  });
});

describe('TermoSimulado: batería (T5)', () => {
  it('avisa una sola vez al bajar del 15 %', () => {
    const { motor, tipos } = montar({ bateria: 0.1505 });
    motor.avanzar(HORA);
    expect(tipos()).toEqual(['bateriaBaja']);
  });

  it('sin conexión, el aviso se manda al reconectar', () => {
    const { termo, motor, tipos } = montar({ bateria: 0.1505, bluetooth: false });
    motor.avanzar(HORA);
    expect(tipos()).toEqual([]);
    termo.restablecerBluetooth();
    expect(tipos()).toEqual(['bateriaBaja']);
  });

  it('vuelve a avisar solo tras recargar por encima del umbral', () => {
    const { termo, motor, tipos } = montar({ bateria: 0.1505 });
    motor.avanzar(HORA);
    termo.conectarCargador();
    motor.avanzar(30 * MIN); // sube a ~40 %
    termo.desconectarCargador();
    expect(termo.estado().bateria).toBeGreaterThan(0.2);
    termo.recibir({ tipo: 'preferencias', brillo: 'alto' });
    motor.avanzar(48 * HORA);
    expect(tipos()).toEqual(['bateriaBaja', 'bateriaBaja']);
  });

  it('sin batería se apaga: no mide ni se conecta; al cargar vuelve y manda lo pendiente', () => {
    const { termo, motor, mensajes } = montar({ nivelMl: 393, bateria: 0.002 });
    motor.avanzar(HORA);
    expect(termo.estado()).toMatchObject({ bateria: 0, encendido: false, conectado: false });
    expect(termo.pantalla().encendida).toBe(false);
    const antes = mensajes.length;
    termo.beber(40);
    motor.avanzar(MIN);
    expect(mensajes.length).toBe(antes);

    termo.conectarCargador();
    motor.avanzar(MIN);
    expect(termo.estado().conectado).toBe(true);
    motor.avanzar(5 * SEG);
    expect(mensajes.some((m) => m.tipo === 'sorbo' && m.ml === 40)).toBe(true);
  });
});

describe('TermoSimulado: atajo de batería del simulador', () => {
  it('fijar la batería por debajo del 15 % avisa en el acto', () => {
    const { termo, tipos } = montar();
    termo.fijarBateria(0.14);
    expect(termo.estado().bateria).toBe(0.14);
    expect(tipos()).toEqual(['bateriaBaja']);
    termo.fijarBateria(2);
    expect(termo.estado().bateria).toBe(1);
  });

  it('cambiar el tipo de agua cambia la temperatura sin mover el nivel', () => {
    const { termo } = montar({ nivelMl: 300, temperaturaC: 30 });
    termo.fijarTemperaturaAgua(85);
    expect(termo.estado()).toMatchObject({ nivelMl: 300, temperaturaC: 85 });
  });

  it('dejarla en cero apaga el termo', () => {
    const { termo } = montar();
    termo.fijarBateria(0);
    expect(termo.estado()).toMatchObject({ encendido: false, conectado: false });
  });
});

describe('TermoSimulado: telemetría', () => {
  it('manda estado cada 10 s mientras hay conexión, redondeado', () => {
    const { motor, mensajes } = montar({ nivelMl: 200.4, temperaturaC: 60.04 });
    motor.avanzar(30 * SEG);
    const estados = mensajes.filter((m) => m.tipo === 'estado');
    expect(estados).toHaveLength(3);
    expect(estados[0]).toMatchObject({ nivelMl: 200, cargando: false, tapaCerrada: true });
  });

  it('acepta un periodo propio', () => {
    const { motor, mensajes } = montar({ periodoEstadoMs: 5 * SEG });
    motor.avanzar(30 * SEG);
    expect(mensajes.filter((m) => m.tipo === 'estado')).toHaveLength(6);
  });
});
