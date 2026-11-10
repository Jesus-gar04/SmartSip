/**
 * El termo simulado se empareja con la app de una persona escribiendo el
 * código que la app muestra. Entra a Firebase como su propio usuario anónimo
 * ("termo"), distinto del de la app aunque estén en el mismo navegador.
 */
import { idCanal, limpiarCodigo } from 'smartsip-core';
import { servicios } from '../app/servicios.ts';

export const TERMO_ID = 'SS-SIM-0001';
const CLAVE = 'smartsip:termo:emparejamiento';

export interface EmparejamientoTermo {
  readonly canalId: string;
  readonly uidApp: string;
  readonly codigo: string;
}

export function leerEmparejamiento(): EmparejamientoTermo | null {
  try {
    const crudo = localStorage.getItem(CLAVE);
    return crudo ? (JSON.parse(crudo) as EmparejamientoTermo) : null;
  } catch {
    return null;
  }
}

export async function emparejarTermo(codigo: string): Promise<EmparejamientoTermo> {
  const { fb, servicios: s } = await servicios('termo');
  const cuenta = new fb.CuentaFirebase(s.auth);
  const yo = await cuenta.entrarAnonimo();
  const e = await new fb.EmparejamientoFirebase(s.db).reclamar(limpiarCodigo(codigo), TERMO_ID, yo.uid);
  const resultado: EmparejamientoTermo = { canalId: idCanal(e.uid, TERMO_ID), uidApp: e.uid, codigo: e.codigo };
  try {
    localStorage.setItem(CLAVE, JSON.stringify(resultado));
  } catch {
    /* sin almacenamiento: dura mientras la pestaña esté abierta */
  }
  return resultado;
}

export function olvidarEmparejamiento(): void {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    /* nada */
  }
}
