/**
 * Avisos al celular sobre el canal de la persona con su termo:
 *
 *   canales/{id}/ritmo/actual          meta, ritmo y ajustes; lo escribe la app
 *   canales/{id}/dispositivos/{hash}   suscripciones Web Push de sus celulares
 *
 * Con la app cerrada, los sorbos esperan en el canal: solo el termo sabe
 * cuánto llevas. Por eso es él quien decide el recordatorio con lo que la app
 * le dejó aquí, y la función `/api/avisar` solo entrega el push.
 */
import { deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, type DocumentData, type Firestore } from 'firebase/firestore';
import { curvaPareja, RECORDATORIO_POR_DEFECTO, type AjustesRecordatorio, type Ritmo } from 'smartsip-core';
import { COLECCION_CANALES } from './emparejamiento-firebase.ts';

export interface SuscripcionPush {
  readonly endpoint: string;
  readonly keys: { readonly p256dh: string; readonly auth: string };
}

/** Id del documento de una suscripción: los primeros 32 hex del SHA-256 del endpoint. */
export async function idDispositivo(endpoint: string): Promise<string> {
  const huella = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return [...new Uint8Array(huella)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

function deAjustes(v: unknown): AjustesRecordatorio {
  const r = (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>;
  const p = RECORDATORIO_POR_DEFECTO;
  return {
    activos: typeof r['activos'] === 'boolean' ? r['activos'] : p.activos,
    silencioDesde: typeof r['silencioDesde'] === 'number' ? r['silencioDesde'] : p.silencioDesde,
    silencioHasta: typeof r['silencioHasta'] === 'number' ? r['silencioHasta'] : p.silencioHasta,
    tono: r['tono'] === 'directo' ? 'directo' : 'sereno',
  };
}

export function deRitmo(d: DocumentData): Ritmo {
  const curva = Array.isArray(d['curva']) && d['curva'].length === 25 ? (d['curva'] as number[]) : curvaPareja();
  return {
    fecha: String(d['fecha'] ?? ''),
    desfaseMin: typeof d['desfaseMin'] === 'number' ? d['desfaseMin'] : -300,
    metaMl: typeof d['metaMl'] === 'number' ? d['metaMl'] : 2400,
    curva,
    deHabito: d['deHabito'] === true,
    ajustes: deAjustes(d['ajustes']),
    totalMlApp: typeof d['totalMlApp'] === 'number' ? d['totalMlApp'] : 0,
  };
}

export class AvisosFirebase {
  readonly #db: Firestore;
  readonly #canalId: string;

  constructor(db: Firestore, canalId: string) {
    this.#db = db;
    this.#canalId = canalId;
  }

  #ritmo() {
    return doc(this.#db, COLECCION_CANALES, this.#canalId, 'ritmo', 'actual');
  }

  /** App: deja al termo lo que necesita para decidir solo. */
  async publicarRitmo(r: Ritmo): Promise<void> {
    await setDoc(this.#ritmo(), {
      fecha: r.fecha,
      desfaseMin: r.desfaseMin,
      metaMl: Math.round(r.metaMl),
      curva: [...r.curva],
      deHabito: r.deHabito,
      ajustes: { ...r.ajustes },
      totalMlApp: Math.round(r.totalMlApp),
      actualizadoEn: serverTimestamp(),
    });
  }

  /** Termo: escucha el ritmo; `null` mientras la app no haya escrito ninguno. */
  escucharRitmo(oyente: (r: Ritmo | null) => void, alError?: (e: unknown) => void): () => void {
    return onSnapshot(
      this.#ritmo(),
      (snap) => oyente(snap.exists() ? deRitmo(snap.data()) : null),
      (e) => alError?.(e),
    );
  }

  /** App: guarda la suscripción de este celular. */
  async guardarDispositivo(s: SuscripcionPush): Promise<string> {
    const id = await idDispositivo(s.endpoint);
    await setDoc(doc(this.#db, COLECCION_CANALES, this.#canalId, 'dispositivos', id), {
      endpoint: s.endpoint,
      p256dh: s.keys.p256dh,
      auth: s.keys.auth,
      creadoEn: serverTimestamp(),
    });
    return id;
  }

  async quitarDispositivo(endpoint: string): Promise<void> {
    const id = await idDispositivo(endpoint);
    await deleteDoc(doc(this.#db, COLECCION_CANALES, this.#canalId, 'dispositivos', id)).catch(() => undefined);
  }
}
