/**
 * Simulación por consola: una hora de SmartSip acelerada ×60 (un minuto real).
 *
 *   pnpm sim                 una hora en un minuto
 *   pnpm sim --instantaneo   sin esperar
 *   pnpm sim --x10           otra aceleración (x1, x10 o x60)
 */
import {
  autonomiaDias,
  calcularMeta,
  explicarCambio,
  formatoLitros,
  Motor,
  RegistroConsumo,
  RelojSimulado,
  TermoSimulado,
  textoAutonomia,
  type Aceleracion,
  type EventoNivel,
  type MensajeApp,
  type MensajeTermo,
} from '../src/index.ts';

const MIN = 60_000;
const HORA = 60 * MIN;
const INICIO = Date.UTC(2026, 10, 9, 13, 0, 0); // lunes 9 de noviembre, 08:00 en Barranquilla
const FIN = INICIO + HORA;

const args = process.argv.slice(2);
const instantaneo = args.includes('--instantaneo');
const aceleracion: Aceleracion = args.includes('--x1') ? 1 : args.includes('--x10') ? 10 : 60;

// ─── Formato de consola ─────────────────────────────────────────────────────

const hora = (ms: number) => new Date(ms - 5 * HORA).toISOString().slice(11, 16);
const decimal = (n: number, d = 1) => n.toFixed(d).replace('.', ',');
const der = (s: string, n: number) => s.padStart(n);
const izq = (s: string, n: number) => s.padEnd(n);

function describirTermo(m: MensajeTermo): string {
  const evento = (e: EventoNivel) => {
    switch (e.tipo) {
      case 'sorbo':
        return `sorbo #${e.id} de ${e.ml} ml (quedan ${e.nivelMl} ml)`;
      case 'llenado':
        return `llenado #${e.id} de ${e.ml} ml (quedan ${e.nivelMl} ml)`;
      case 'descensoGrande':
        return `descenso grande #${e.id} de ${e.ml} ml (quedan ${e.nivelMl} ml)`;
    }
  };
  switch (m.tipo) {
    case 'lote':
      return `lote con ${m.eventos.length} eventos guardados sin conexión: ${m.eventos.map((e) => `#${e.id}`).join(', ')}`;
    case 'bateriaBaja':
      return `batería baja (${Math.round(m.bateria * 100)} %)`;
    case 'estado':
      return `estado ${decimal(m.temperaturaC)} °C, ${m.nivelMl} ml`;
    case 'hola':
      return `hola: termo ${m.termoId}, firmware ${m.firmware}, último evento #${m.ultimoId}`;
    case 'firmwareProgreso':
      return `firmware ${m.version}: ${m.recibidos} de ${m.bloques} bloques`;
    case 'firmwareListo':
      return `firmware ${m.version} listo para instalar`;
    case 'firmwareError':
      return `firmware ${m.version}: error (${m.motivo})`;
    default:
      return evento(m);
  }
}

function describirApp(m: MensajeApp): string {
  switch (m.tipo) {
    case 'confirmar':
      return `confirma hasta #${m.hastaId}`;
    case 'preferencias':
      return 'preferencias';
    case 'firmwareInicio':
      return `firmware ${m.version}: empieza (${m.bloques} bloques)`;
    case 'firmwareBloque':
      return `firmware ${m.version}: bloque ${m.n}`;
  }
}

// ─── Montaje ────────────────────────────────────────────────────────────────

const reloj = new RelojSimulado(INICIO);
const motor = new Motor(reloj);
motor.fijarAceleracion(aceleracion);

const termo = new TermoSimulado({ reloj, nivelMl: 393, temperaturaC: 85, ambienteC: 31 });
motor.agregar(termo);

const consumo = new RegistroConsumo();
const perfil = { pesoKg: 69, actividad: 'baja' } as const;
const metaHabitual = calcularMeta(perfil, { temperaturaC: 25 });
const meta = calcularMeta(perfil, { temperaturaC: 33 });

const linea = (texto: string) => console.log(`        ${texto}`);

// La app: aplica lo que llega, confirma y pregunta por los descensos grandes.
termo.alEnviar((m) => {
  if (m.tipo === 'estado') return; // la telemetría llega cada 10 s; la tabla ya la muestra
  linea(`${hora(reloj.ahora())}  termo → app  ${describirTermo(m)}`);
  const ack = consumo.procesar(m);
  if (ack) {
    linea(`${hora(reloj.ahora())}  app → termo  ${describirApp(ack)}`);
    termo.recibir(ack);
  }
  const eventos = m.tipo === 'lote' ? m.eventos : m.tipo === 'descensoGrande' ? [m] : [];
  for (const e of eventos) {
    if (e.tipo !== 'descensoGrande') continue;
    linea(`${hora(reloj.ahora())}  app          «¿Lo bebiste o lo vaciaste?» (${e.ml} ml)`);
    motor.programar(reloj.ahora() + MIN, () => {
      consumo.resolver(e.id, 'vaciado');
      linea(`${hora(reloj.ahora())}  persona      «Lo vacié». No suma al consumo.`);
    });
  }
});

// ─── Tabla: una fila cada 5 minutos simulados ──────────────────────────────

const columnas = (c: readonly string[]) =>
  [
    izq(c[0] ?? '', 6),
    der(c[1] ?? '', 8),
    der(c[2] ?? '', 7),
    izq(c[3] ?? '', 8),
    der(c[4] ?? '', 8),
    izq(c[5] ?? '', 3),
    der(c[6] ?? '', 4),
    der(c[7] ?? '', 8),
    `   ${c[8] ?? ''}`,
  ].join('  ');

function fila(): void {
  const e = termo.estado();
  const p = termo.pantalla();
  console.log(
    columnas([
      hora(reloj.ahora()),
      `${decimal(e.temperaturaC)} °C`,
      `${Math.round(e.nivelMl)} ml`,
      e.tapaCerrada ? 'cerrada' : 'abierta',
      `${decimal(e.bateria * 100)} %`,
      e.conectado ? 'sí' : 'no',
      `${e.pendientes}`,
      `${consumo.totalDelDia(reloj.ahora())} ml`,
      `${p.temperatura}°${p.unidad} · ${p.bateriaPct} % · ${p.bluetooth ? 'BT' : '--'}`,
    ]),
  );
}
// Se programan antes que el guion: a la misma hora, la fila sale primero.
for (let m = 0; m <= 60; m += 5) motor.programar(INICIO + m * MIN, fila);

// ─── Guion: lo que pasa con el termo durante la hora ───────────────────────

const en = (minuto: number, texto: string, accion: () => void) =>
  motor.programar(INICIO + minuto * MIN, () => {
    linea(`${hora(reloj.ahora())}  ·            ${texto}`);
    accion();
  });

en(5, 'bebe 40 ml', () => termo.beber(40));
en(12, 'bebe 60 ml', () => termo.beber(60));
en(20, 'abre la tapa', () => termo.abrirTapa());
en(25, 'bebe 50 ml', () => termo.beber(50));
en(30, 'cierra la tapa', () => termo.cerrarTapa());
en(32, 'se corta el Bluetooth (el teléfono quedó en otra sala)', () => termo.cortarBluetooth());
en(36, 'bebe 30 ml sin conexión', () => termo.beber(30));
en(42, 'bebe 45 ml sin conexión', () => termo.beber(45));
en(48, 'vuelve el Bluetooth', () => termo.restablecerBluetooth());
en(52, 'vacía lo que queda en el lavaplatos', () => termo.vaciar());
en(55, 'lo llena con 393 ml de agua fría a 5 °C', () => termo.llenar(393, 5));
en(58, 'bebe 50 ml', () => termo.beber(50));

// ─── Ejecución ──────────────────────────────────────────────────────────────

console.log('');
console.log(`SmartSip · una hora de simulación a ×${aceleracion}${instantaneo ? ' (instantánea)' : ''}`);
console.log('Lunes 9 de noviembre de 2026, Barranquilla. Ambiente 31 °C, termo lleno con agua a 85 °C.');
console.log(`Meta del día: ${formatoLitros(meta.totalMl)}. ${explicarCambio(metaHabitual, meta) ?? ''}`);
console.log('');
console.log(columnas(['hora', 'temp.', 'nivel', 'tapa', 'batería', 'bt', 'cola', 'consumo', 'pantalla del termo']));
console.log('─'.repeat(96));

function cerrar(): void {
  const e = termo.estado();
  const bebido = consumo.totalDelDia(reloj.ahora());
  console.log('─'.repeat(96));
  console.log(`Llevas ${formatoLitros(bebido, 2)} de ${formatoLitros(meta.totalMl)}.`);
  console.log(`Sorbos registrados: ${consumo.tomas().length}. Preguntas sin responder: ${consumo.dudosos().length}.`);
  console.log(`Temperatura final: ${decimal(e.temperaturaC)} °C. ${textoAutonomia(autonomiaDias(e.bateria, e.brillo))}`);
  console.log('');
}

if (instantaneo) {
  motor.avanzar(FIN - reloj.ahora());
  cerrar();
} else {
  motor.avanzar(0); // la fila de las 08:00
  let anterior = performance.now();
  const temporizador = setInterval(() => {
    const ahora = performance.now();
    const restante = FIN - reloj.ahora();
    motor.avanzar(Math.min((ahora - anterior) * aceleracion, restante));
    anterior = ahora;
    if (reloj.ahora() >= FIN) {
      clearInterval(temporizador);
      cerrar();
    }
  }, 100);
}
