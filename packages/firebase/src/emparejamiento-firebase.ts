/**
 * Emparejamiento por código sobre Firestore.
 *
 *   emparejamientos/{codigo}   lo crea la app; el termo lo reclama
 *   canales/{uid_termoId}      lo crea la app cuando el termo ya reclamó
 *
 * Las reglas garantizan que un código vigente no se pisa, que solo se
 * reclama una vez y antes de vencer, y que el canal une exactamente a la
 * persona con el termo que escribió su código.
 */
import {
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';
import {
  ErrorEmparejamiento,
  esCodigoValido,
  generarCodigo,
  idCanal,
  VIGENCIA_CODIGO_MS,
  type Emparejamiento,
} from 'smartsip-core';

export const COLECCION_EMPAREJAMIENTOS = 'emparejamientos';
export const COLECCION_CANALES = 'canales';

const codigoDe = (e: unknown) => (e as { code?: unknown } | null)?.code;

function deEmparejamiento(codigo: string, d: DocumentData): Emparejamiento {
  const expira = d['expiraEn'];
  return {
    codigo,
    uid: String(d['uid'] ?? ''),
    estado: d['estado'] === 'emparejado' ? 'emparejado' : 'esperando',
    expiraEnMs: expira instanceof Timestamp ? expira.toMillis() : 0,
    termoId: typeof d['termoId'] === 'string' ? d['termoId'] : null,
    termoUid: typeof d['termoUid'] === 'string' ? d['termoUid'] : null,
  };
}

export class EmparejamientoFirebase {
  readonly #db: Firestore;

  constructor(db: Firestore) {
    this.#db = db;
  }

  #ref(codigo: string) {
    return doc(this.#db, COLECCION_EMPAREJAMIENTOS, codigo);
  }

  /** App: pide un código nuevo. Si el sorteado está en uso, sortea otro. */
  async crearCodigo(uid: string, ahoraMs: number = Date.now()): Promise<Emparejamiento> {
    for (let intento = 0; intento < 6; intento++) {
      const codigo = generarCodigo();
      const expiraEnMs = ahoraMs + VIGENCIA_CODIGO_MS;
      try {
        await setDoc(this.#ref(codigo), {
          uid,
          estado: 'esperando',
          creadoEn: serverTimestamp(),
          expiraEn: Timestamp.fromMillis(expiraEnMs),
        });
        return { codigo, uid, estado: 'esperando', expiraEnMs, termoId: null, termoUid: null };
      } catch (error) {
        if (codigoDe(error) !== 'permission-denied') throw error; // ocupado por otra persona: otro número
      }
    }
    throw new ErrorEmparejamiento('sin-conexion');
  }

  /** App: escucha el código hasta que el termo lo reclame. */
  escuchar(
    codigo: string,
    oyente: (e: Emparejamiento | null) => void,
    alError?: (error: unknown) => void,
  ): () => void {
    return onSnapshot(
      this.#ref(codigo),
      (snap) => oyente(snap.exists() ? deEmparejamiento(codigo, snap.data()) : null),
      (error) => alError?.(error),
    );
  }

  /** App: retira un código que ya no se usará. */
  async cancelar(codigo: string): Promise<void> {
    await deleteDoc(this.#ref(codigo)).catch(() => undefined);
  }

  /** Termo: escribe el código que muestra la app y queda unido a esa cuenta. */
  async reclamar(codigo: string, termoId: string, termoUid: string, ahoraMs: number = Date.now()): Promise<Emparejamiento> {
    if (!esCodigoValido(codigo)) throw new ErrorEmparejamiento('invalido');
    let snap;
    try {
      snap = await getDoc(this.#ref(codigo));
    } catch (error) {
      if (codigoDe(error) === 'unavailable') throw new ErrorEmparejamiento('sin-conexion');
      throw error;
    }
    if (!snap.exists()) throw new ErrorEmparejamiento('no-existe');
    const actual = deEmparejamiento(codigo, snap.data());
    if (actual.estado === 'emparejado') throw new ErrorEmparejamiento('usado');
    if (ahoraMs >= actual.expiraEnMs) throw new ErrorEmparejamiento('vencido');
    try {
      await updateDoc(this.#ref(codigo), { estado: 'emparejado', termoId, termoUid, emparejadoEn: serverTimestamp() });
    } catch (error) {
      // Las reglas lo rechazan si venció o si otro termo lo reclamó antes.
      if (codigoDe(error) === 'permission-denied') throw new ErrorEmparejamiento('vencido');
      throw error;
    }
    return { ...actual, estado: 'emparejado', termoId, termoUid };
  }

  /** App: abre el canal con el termo que reclamó el código. */
  async abrirCanal(e: Emparejamiento): Promise<string> {
    if (e.estado !== 'emparejado' || !e.termoId || !e.termoUid) throw new ErrorEmparejamiento('no-existe');
    const id = idCanal(e.uid, e.termoId);
    await setDoc(doc(this.#db, COLECCION_CANALES, id), {
      uid: e.uid,
      termoUid: e.termoUid,
      termoId: e.termoId,
      codigo: e.codigo,
      creadoEn: serverTimestamp(),
    });
    return id;
  }
}
