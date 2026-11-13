/**
 * Datos de prueba para el teléfono del simulador: un perfil y, en modo
 * memoria, tres semanas de sorbos para que Semana muestre sus siete termos
 * llenos desde el primer momento. Siempre el mismo historial (azar con
 * semilla), con días buenos y flojos y una mejora de semana a semana.
 */
import {
  aRegistro,
  calcularMeta,
  claveDia,
  ESPECIFICACIONES,
  sumarDias,
  type EventoNivel,
  type Perfil,
  type Repositorio,
} from 'smartsip-core';

const HORA = 3_600_000;
const MIN = 60_000;

export function perfilDePrueba(termoId: string, desfaseMin: number): Perfil {
  return { nombre: 'Ana', pesoKg: 62, actividad: 'media', unidad: 'C', brillo: 'medio', desfaseMin, termoId };
}

function azarConSemilla(semilla: number) {
  let s = semilla >>> 0;
  const azar = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => Math.sqrt(-2 * Math.log(azar() || 1e-9)) * Math.cos(2 * Math.PI * azar());
  return { azar, normal };
}

const acotar = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
/** Cuándo suele beber Ana: al llegar a clase, al almuerzo, en la tarde y al entrenar. */
const PICOS = [
  { hora: 8, peso: 2 },
  { hora: 10.5, peso: 2 },
  { hora: 13, peso: 3 },
  { hora: 16, peso: 2 },
  { hora: 19.5, peso: 2 },
];
const PESO_PICOS = PICOS.reduce((s, p) => s + p.peso, 0);

/**
 * Escribe `dias` días anteriores a hoy. Devuelve el último id usado: el termo
 * simulado sigue contando desde ahí para no pisar el historial.
 */
export async function sembrarHistorial(
  repo: Repositorio,
  o: { termoId: string; desfaseMin: number; ahoraMs: number; perfil: Perfil; dias?: number },
): Promise<number> {
  const { azar, normal } = azarConSemilla(20261110);
  const dias = o.dias ?? 21;
  const hoy = claveDia(o.ahoraMs, o.desfaseMin);
  let id = 0;

  for (let k = dias; k >= 1; k--) {
    const fecha = sumarDias(hoy, -k);
    const medianoche = Date.parse(`${fecha}T00:00:00Z`) - o.desfaseMin * MIN;
    const finde = [0, 6].includes(new Date(`${fecha}T12:00:00Z`).getUTCDay());
    const clima = Math.round(29 + azar() * 5.5);
    const metaMl = calcularMeta(o.perfil, { temperaturaC: clima }).totalMl;
    const semana = Math.floor((dias - k) / 7);
    let factor = acotar(0.86 + 0.07 * semana + normal() * 0.15, 0.4, 1.3);
    if (finde) factor *= 0.85;

    const sorbos: Array<{ enMs: number; ml: number }> = [];
    let total = 0;
    while (total < metaMl * factor && sorbos.length < 80) {
      let r = azar() * PESO_PICOS;
      const pico = PICOS.find((p) => (r -= p.peso) <= 0) ?? PICOS[0];
      const hora = acotar((pico?.hora ?? 12) + normal() * 1.2, 6.5, 22.5);
      const ml = Math.round(25 + azar() * 45);
      sorbos.push({ enMs: Math.round(medianoche + hora * HORA), ml });
      total += ml;
    }
    sorbos.sort((a, b) => a.enMs - b.enMs);

    let nivel = 0;
    const registrar = (evento: EventoNivel, temperaturaC: number | null) =>
      repo.registrar(aRegistro(o.termoId, evento, temperaturaC, o.desfaseMin));
    for (const s of sorbos) {
      if (nivel < s.ml) {
        const ml = ESPECIFICACIONES.capacidadMl - nivel;
        nivel = ESPECIFICACIONES.capacidadMl;
        await registrar({ tipo: 'llenado', id: ++id, enMs: s.enMs - Math.round(3 + azar() * 9) * MIN, ml, nivelMl: nivel }, null);
      }
      nivel -= s.ml;
      const temperatura = Math.round((8 + azar() * 20) * 10) / 10;
      await registrar({ tipo: 'sorbo', id: ++id, enMs: s.enMs, ml: s.ml, nivelMl: nivel }, temperatura);
    }
    await repo.fijarMetaDelDia(fecha, metaMl, clima);
  }
  return id;
}
