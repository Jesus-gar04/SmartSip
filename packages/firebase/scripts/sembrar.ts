/**
 * Crea los usuarios de prueba con cuatro semanas de historial.
 *
 *   SMARTSIP_CLAVE_DEMO=... pnpm firebase:sembrar     tu proyecto real
 *   pnpm firebase:sembrar --emulador                  la Emulator Suite local
 *
 * - Cada persona tiene un hábito distinto (ver personas.ts).
 * - El historial se genera con una semilla fija: siempre sale igual.
 * - Si la cuenta ya tiene perfil, no se toca (correrlo dos veces es seguro).
 * - Todo pasa por las reglas de seguridad, como cualquier cliente.
 */
import { doc, getDoc, writeBatch, type DocumentData, type DocumentReference, type Firestore } from 'firebase/firestore';
import {
  aporte,
  aRegistro,
  calcularMeta,
  claveDia,
  ErrorCuenta,
  ESPECIFICACIONES,
  resumenVacio,
  sumarAporte,
  sumarDias,
  type EventoNivel,
  type RegistroEvento,
  type ResumenDia,
} from 'smartsip-core';
import { aDocDia, aDocEvento, aDocPerfil, aDocTermo, COLECCION } from '../src/documentos.ts';
import { CuentaFirebase, EMULADOR_LOCAL, iniciarFirebase } from '../src/index.ts';
import { CONFIG_EMULADOR, configDelProyecto } from './entorno.ts';
import { PERSONAS, type Persona } from './personas.ts';

const DIAS = 28;
const HORA = 3_600_000;
const MIN = 60_000;
const BARRANQUILLA = { lat: 10.9878, lng: -74.7889 };

const emulador = process.argv.includes('--emulador');
const clave = process.env['SMARTSIP_CLAVE_DEMO'] ?? (emulador ? 'smartsip-demo' : '');
// 6 caracteres es el mínimo de Firebase Auth.
if (clave.length < 6) {
  console.error('Define la contraseña de las cuentas de prueba (6 caracteres o más):');
  console.error('  PowerShell:  $env:SMARTSIP_CLAVE_DEMO="..."; pnpm firebase:sembrar');
  process.exit(1);
}

// ─── Azar reproducible ──────────────────────────────────────────────────────

function generador(semilla: number) {
  let s = semilla >>> 0;
  const azar = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const entre = (a: number, b: number) => a + (b - a) * azar();
  const normal = () => Math.sqrt(-2 * Math.log(azar() || 1e-9)) * Math.cos(2 * Math.PI * azar());
  return { azar, entre, normal };
}

const acotar = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

// ─── Historial ──────────────────────────────────────────────────────────────

interface Historial {
  readonly registros: RegistroEvento[];
  readonly dias: ResumenDia[];
  readonly ultimaTemperatura: number;
}

function generarHistorial(p: Persona, semilla: number, ahoraMs: number): Historial {
  const { azar, entre, normal } = generador(semilla);
  const h = p.habito;
  const desfase = p.perfil.desfaseMin;
  const hoy = claveDia(ahoraMs, desfase);
  const registros: RegistroEvento[] = [];
  const dias: ResumenDia[] = [];
  const pesoTotal = h.picos.reduce((s, x) => s + x.peso, 0);
  let id = 0;
  let ultimaTemperatura = h.temperaturaAgua[0];

  // Se vuelve a sortear la hora si cae fuera de su día: acotarla amontonaría
  // sorbos justo al despertar o al dormir.
  const horaDeSorbo = () => {
    let r = azar() * pesoTotal;
    const pico = h.picos.find((x) => (r -= x.peso) <= 0) ?? h.picos[0];
    for (let i = 0; i < 20; i++) {
      const hora = (pico?.hora ?? 12) + normal() * 1.3;
      if (hora >= h.despierta && hora < h.duerme) return hora;
    }
    return pico?.hora ?? 12;
  };

  for (let k = DIAS - 1; k >= 0; k--) {
    const fecha = sumarDias(hoy, -k);
    const medianoche = Date.parse(`${fecha}T00:00:00Z`) - desfase * MIN;
    const finde = [0, 6].includes(new Date(`${fecha}T12:00:00Z`).getUTCDay());
    const clima = Math.round(entre(29, 34.5));
    const meta = calcularMeta({ pesoKg: p.perfil.pesoKg, actividad: p.perfil.actividad }, { temperaturaC: clima });
    const semana = Math.floor((DIAS - 1 - k) / 7);
    let factor = acotar(h.cumplimiento + h.mejoraSemanal * semana + normal() * h.variacion, 0.25, 1.45);
    if (finde) factor *= h.finDeSemana;
    if (k === 0) {
      const horaActual = (ahoraMs - medianoche) / HORA;
      factor *= acotar((horaActual - h.despierta) / (h.duerme - h.despierta), 0, 1);
    }

    // Sorbos del día, en orden.
    const objetivo = meta.totalMl * factor;
    const sorbos: Array<{ enMs: number; ml: number }> = [];
    let total = 0;
    for (let intentos = 0; total < objetivo && intentos < 400; intentos++) {
      const enMs = Math.round(medianoche + horaDeSorbo() * HORA);
      if (enMs > ahoraMs) continue;
      const ml = Math.round(entre(h.mlSorbo[0], h.mlSorbo[1]));
      sorbos.push({ enMs, ml });
      total += ml;
    }
    sorbos.sort((a, b) => a.enMs - b.enMs);

    // El termo se llena cuando no alcanza para el siguiente sorbo.
    let nivel = 0;
    let resumen: ResumenDia = { ...resumenVacio(fecha), metaMl: meta.totalMl, climaC: clima };
    const agregar = (evento: EventoNivel, temperaturaC: number | null) => {
      const r = aRegistro(p.termoId, evento, temperaturaC, desfase);
      registros.push(r);
      const a = aporte(r);
      if (a) resumen = sumarAporte(resumen, a);
    };
    for (const s of sorbos) {
      if (nivel < s.ml) {
        const ml = ESPECIFICACIONES.capacidadMl - nivel;
        nivel = ESPECIFICACIONES.capacidadMl;
        const enMs = s.enMs - Math.round(entre(3, 12)) * MIN;
        agregar({ tipo: 'llenado', id: ++id, enMs, ml, nivelMl: nivel }, null);
      }
      nivel -= s.ml;
      ultimaTemperatura = Math.round(entre(h.temperaturaAgua[0], h.temperaturaAgua[1]) * 10) / 10;
      agregar({ tipo: 'sorbo', id: ++id, enMs: s.enMs, ml: s.ml, nivelMl: nivel }, ultimaTemperatura);
    }

    // Luisa tiene hoy un "¿Lo bebiste o lo vaciaste?" sin responder, para la demo.
    if (k === 0 && p.termoId === 'SS-0003' && nivel > 150) {
      const enMs = Math.min(ahoraMs - 20 * MIN, (sorbos.at(-1)?.enMs ?? ahoraMs) + 30 * MIN);
      agregar({ tipo: 'descensoGrande', id: ++id, enMs, ml: Math.round(nivel), nivelMl: 0 }, null);
    }
    if (resumen.sorbos > 0 || resumen.llenados > 0 || resumen.metaMl !== null) dias.push(resumen);
  }
  return { registros, dias, ultimaTemperatura };
}

// ─── Escritura ──────────────────────────────────────────────────────────────

async function escribirEnLotes(db: Firestore, escrituras: Array<[DocumentReference, DocumentData]>): Promise<void> {
  for (let i = 0; i < escrituras.length; i += 450) {
    const lote = writeBatch(db);
    for (const [ref, datos] of escrituras.slice(i, i + 450)) lote.set(ref, datos);
    await lote.commit();
  }
}

async function sembrar(p: Persona, indice: number, ahoraMs: number): Promise<void> {
  const servicios = iniciarFirebase(emulador ? CONFIG_EMULADOR : configDelProyecto(), {
    cache: 'memoria',
    nombre: `semilla-${indice}`,
    ...(emulador ? { emulador: EMULADOR_LOCAL } : {}),
  });
  const cuenta = new CuentaFirebase(servicios.auth);
  try {
    await cuenta.listo();
    let usuario;
    try {
      usuario = await cuenta.crearCuenta(p.correo, clave);
    } catch (error) {
      if (!(error instanceof ErrorCuenta) || error.codigo !== 'correo-en-uso') throw error;
      usuario = await cuenta.entrar(p.correo, clave);
    }
    const db = servicios.db;
    const usuarioRef = doc(db, COLECCION.usuarios, usuario.uid);
    if ((await getDoc(usuarioRef)).exists()) {
      console.log(`· ${p.nombre}: ya tenía datos, no se toca.`);
      return;
    }

    const { registros, dias, ultimaTemperatura } = generarHistorial(p, 1522 + indice * 97, ahoraMs);
    const escrituras: Array<[DocumentReference, DocumentData]> = [
      ...registros.map((r): [DocumentReference, DocumentData] => [
        doc(usuarioRef, COLECCION.eventos, r.clave),
        aDocEvento(r),
      ]),
      ...dias.map((d): [DocumentReference, DocumentData] => [doc(usuarioRef, COLECCION.dias, d.fecha), aDocDia(d)]),
    ];
    await escribirEnLotes(db, escrituras);

    const { azar } = generador(indice + 7);
    await escribirEnLotes(db, [
      [
        doc(usuarioRef, COLECCION.termos, p.termoId),
        aDocTermo({
          termoId: p.termoId,
          nombre: `Termo de ${p.nombre.split(' ')[0]}`,
          capacidadMl: ESPECIFICACIONES.capacidadMl,
          firmware: '1.0.0',
          bateria: Math.round((0.35 + azar() * 0.6) * 100) / 100,
          temperaturaC: ultimaTemperatura,
          ultimoVisto: {
            enMs: ahoraMs - Math.round(azar() * 90) * MIN,
            lugar: {
              lat: Math.round((BARRANQUILLA.lat + (azar() - 0.5) * 0.04) * 1e5) / 1e5,
              lng: Math.round((BARRANQUILLA.lng + (azar() - 0.5) * 0.04) * 1e5) / 1e5,
              precisionM: 10 + Math.round(azar() * 30),
            },
          },
        }),
      ],
      // El perfil al final: si algo falló antes, correrlo de nuevo vuelve a intentar.
      [usuarioRef, aDocPerfil({ nombre: p.nombre, ...p.perfil, termoId: null })],
    ]);

    const conMeta = dias.filter((d) => d.metaMl);
    const promedio = conMeta.reduce((s, d) => s + d.totalMl / (d.metaMl ?? 1), 0) / Math.max(1, conMeta.length);
    const porHora = dias.reduce((acc, d) => acc.map((v, i) => v + (d.porHora[i] ?? 0)), new Array<number>(24).fill(0));
    const horaPico = porHora.indexOf(Math.max(...porHora));
    console.log(
      `✓ ${p.nombre.padEnd(16)} ${String(registros.length).padStart(4)} eventos · ${dias.length} días · ` +
        `${Math.round(promedio * 100)} % de la meta en promedio · bebe más a las ${horaPico}:00`,
    );
  } finally {
    cuenta.destruir();
    await servicios.cerrar();
  }
}

console.log(`Sembrando ${PERSONAS.length} usuarios de prueba en ${emulador ? 'el emulador' : configDelProyecto().projectId}…`);
const ahora = Date.now();
let fallo = false;
for (const [i, p] of PERSONAS.entries()) {
  try {
    await sembrar(p, i, ahora);
  } catch (error) {
    fallo = true;
    console.error(`✗ ${p.nombre}:`, error instanceof Error ? error.message : error);
  }
}
process.exitCode = fallo ? 1 : 0;
