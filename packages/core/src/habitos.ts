/**
 * Hábitos (U3): lo que dicen los días guardados, contado en frases con la voz
 * de SmartSip (docs/voz.md). Sin gráficas por mostrar gráficas: cada frase
 * dice algo que sirve.
 */
import type { ResumenDia } from './registros.ts';
import { cantidad } from './voz.ts';

export interface Habitos {
  readonly diasConDatos: number;
  readonly diasCumplidos: number;
  /** Días seguidos con la meta cumplida, contando hacia atrás desde el último. */
  readonly racha: number;
  readonly promedioMl: number;
  /** Mililitros sumados por hora del día, del 0 al 23. */
  readonly porHora: readonly number[];
  /** Ventana de dos horas en que más bebes, o `null` sin datos. */
  readonly horaPico: number | null;
  readonly temperaturaPromedioC: number | null;
  readonly frases: readonly string[];
}

const metaDe = (d: ResumenDia, metaPorDefecto: number) => d.metaMl ?? metaPorDefecto;
export const cumplio = (d: ResumenDia, metaPorDefecto: number) => d.totalMl > 0 && d.totalMl >= metaDe(d, metaPorDefecto);

/** "6 y las 8 de la mañana", "3 y las 5 de la tarde"… */
export function franjaHoraria(inicio: number): string {
  const fin = (inicio + 2) % 24;
  const h12 = (h: number) => (h % 12 === 0 ? 12 : h % 12);
  const parte = (h: number) => (h < 12 ? (h < 5 ? 'de la madrugada' : 'de la mañana') : h < 19 ? 'de la tarde' : 'de la noche');
  return `${h12(inicio)} y las ${h12(fin)} ${parte(fin === 0 ? 23 : fin)}`;
}

/** Los días deben venir en orden, del más antiguo al más reciente. */
export function calcularHabitos(dias: readonly ResumenDia[], metaPorDefecto: number, esFinde: (fecha: string) => boolean): Habitos {
  const conDatos = dias.filter((d) => d.totalMl > 0);
  const porHora = Array.from({ length: 24 }, (_, h) => dias.reduce((s, d) => s + (d.porHora[h] ?? 0), 0));
  const cumplidos = conDatos.filter((d) => cumplio(d, metaPorDefecto));

  let racha = 0;
  for (let i = dias.length - 1; i >= 0; i--) {
    const d = dias[i];
    if (!d) break;
    if (cumplio(d, metaPorDefecto)) racha++;
    else if (i === dias.length - 1 && d.totalMl < metaDe(d, metaPorDefecto)) continue; // hoy aún puede cumplirse
    else break;
  }

  let horaPico: number | null = null;
  let mejor = 0;
  for (let h = 0; h < 24; h++) {
    const ventana = (porHora[h] ?? 0) + (porHora[(h + 1) % 24] ?? 0);
    if (ventana > mejor) {
      mejor = ventana;
      horaPico = h;
    }
  }

  const muestras = dias.reduce((s, d) => s + d.tempMuestras, 0);
  const temperaturaPromedioC = muestras > 0 ? dias.reduce((s, d) => s + d.tempSumaC, 0) / muestras : null;
  const promedioMl = conDatos.length > 0 ? conDatos.reduce((s, d) => s + d.totalMl, 0) / conDatos.length : 0;

  const frases: string[] = [];
  if (conDatos.length === 0) {
    frases.push('Cuando el termo registre tus primeros sorbos, aquí verás cómo bebes a lo largo de la semana.');
  } else {
    frases.push(`Cumpliste tu meta ${cumplidos.length} de los últimos ${conDatos.length} días con datos.`);
    if (racha >= 2) frases.push(`Llevas ${racha} días seguidos cumpliendo tu meta.`);
    if (horaPico !== null) frases.push(`Bebes más entre las ${franjaHoraria(horaPico)}.`);
    frases.push(`En promedio tomas ${cantidad(promedioMl)} al día.`);
    if (temperaturaPromedioC !== null) {
      const t = Math.round(temperaturaPromedioC);
      frases.push(
        t <= 15
          ? `Te gusta el agua fría: en promedio, a ${t} °C.`
          : t >= 40
            ? `Prefieres beber caliente: en promedio, a ${t} °C.`
            : `Sueles beber el agua a unos ${t} °C.`,
      );
    }
    const finde = conDatos.filter((d) => esFinde(d.fecha));
    const semana = conDatos.filter((d) => !esFinde(d.fecha));
    if (finde.length > 0 && semana.length > 0) {
      const pf = finde.reduce((s, d) => s + d.totalMl, 0) / finde.length;
      const ps = semana.reduce((s, d) => s + d.totalMl, 0) / semana.length;
      if (pf < ps * 0.8) frases.push('Los fines de semana tomas menos agua que entre semana.');
      else if (pf > ps * 1.2) frases.push('Los fines de semana tomas más agua que entre semana.');
    }
  }

  return {
    diasConDatos: conDatos.length,
    diasCumplidos: cumplidos.length,
    racha,
    promedioMl,
    porHora,
    horaPico,
    temperaturaPromedioC,
    frases,
  };
}
