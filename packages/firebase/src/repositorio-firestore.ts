/**
 * Repositorio de SmartSip sobre Cloud Firestore.
 *
 * - Cada escritura de un evento es un lote atómico: el evento y su aporte al
 *   día se guardan juntos o no se guarda nada.
 * - La idempotencia la garantizan las reglas de seguridad: un evento solo se
 *   puede crear una vez. Si el lote se rechaza porque el evento ya existía,
 *   se trata como éxito, sin sumar dos veces.
 * - Todas las consultas tienen índice y límite. Ninguna lee una colección entera.
 */
import {
  collection,
  doc,
  FirestoreError,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type CollectionReference,
  type DocumentReference,
  type Firestore,
} from 'firebase/firestore';
import {
  aporte,
  ErrorRepositorio,
  LIMITES,
  resumenVacio,
  type CambiosTermo,
  type DatosTermo,
  type DecisionResolucion,
  type Perfil,
  type RegistroEvento,
  type Repositorio,
  type ResumenDia,
} from 'smartsip-core';
import {
  aDocEvento,
  aDocPerfil,
  aDocTermo,
  COLECCION,
  deDia,
  deEvento,
  dePerfil,
  deTermo,
  incrementosDia,
} from './documentos.ts';

/**
 * Rechazo de las reglas o documento inexistente. Se mira el código y no la
 * clase: el error puede venir de otra copia del SDK (por ejemplo, la del
 * kit de pruebas) y `instanceof` fallaría.
 */
function esRechazo(e: unknown): boolean {
  const codigo = (e as Partial<Pick<FirestoreError, 'code'>> | null)?.code;
  return codigo === 'permission-denied' || codigo === 'not-found';
}

export class RepositorioFirestore implements Repositorio {
  readonly #db: Firestore;
  readonly #uid: string;

  constructor(db: Firestore, uid: string) {
    this.#db = db;
    this.#uid = uid;
  }

  // ─── Referencias ──────────────────────────────────────────────────────────

  #usuario(): DocumentReference {
    return doc(this.#db, COLECCION.usuarios, this.#uid);
  }
  #termo(termoId: string): DocumentReference {
    return doc(this.#usuario(), COLECCION.termos, termoId);
  }
  #eventos(): CollectionReference {
    return collection(this.#usuario(), COLECCION.eventos);
  }
  #evento(clave: string): DocumentReference {
    return doc(this.#eventos(), clave);
  }
  #dias(): CollectionReference {
    return collection(this.#usuario(), COLECCION.dias);
  }
  #dia(fecha: string): DocumentReference {
    return doc(this.#dias(), fecha);
  }
  #consultaPendientes() {
    return query(this.#eventos(), where('estado', '==', 'pendiente'), orderBy('en'), limit(LIMITES.pendientes));
  }

  // ─── Perfil y termo ───────────────────────────────────────────────────────

  async leerPerfil(): Promise<Perfil | null> {
    const snap = await getDoc(this.#usuario());
    return snap.exists() ? dePerfil(snap.data()) : null;
  }

  async guardarPerfil(perfil: Perfil): Promise<void> {
    await setDoc(this.#usuario(), aDocPerfil(perfil));
  }

  async leerTermo(termoId: string): Promise<DatosTermo | null> {
    const snap = await getDoc(this.#termo(termoId));
    return snap.exists() ? deTermo(termoId, snap.data()) : null;
  }

  async guardarTermo(cambios: CambiosTermo): Promise<void> {
    await setDoc(this.#termo(cambios.termoId), aDocTermo(cambios), { merge: true });
  }

  async ultimoIdDeTermo(termoId: string): Promise<number> {
    const snap = await getDocs(
      query(this.#eventos(), where('termoId', '==', termoId), orderBy('id', 'desc'), limit(1)),
    );
    const primero = snap.docs[0];
    return primero ? deEvento(primero.id, primero.data()).id : 0;
  }

  // ─── Eventos ──────────────────────────────────────────────────────────────

  async registrar(registro: RegistroEvento): Promise<void> {
    const ref = this.#evento(registro.clave);
    const lote = writeBatch(this.#db);
    lote.set(ref, aDocEvento(registro));
    const a = aporte(registro);
    if (a) lote.set(this.#dia(a.fecha), incrementosDia(a), { merge: true });
    try {
      await lote.commit();
    } catch (error) {
      // Las reglas no dejan crear un evento dos veces: si ya existía, ya está sumado.
      if (esRechazo(error) && (await getDoc(ref)).exists()) return;
      throw error;
    }
  }

  async resolverDescenso(registro: RegistroEvento, decision: DecisionResolucion): Promise<void> {
    const ref = this.#evento(registro.clave);
    const lote = writeBatch(this.#db);
    lote.update(ref, { estado: decision, resueltoEn: serverTimestamp() });
    const a = aporte({ ...registro, estado: decision });
    if (a) lote.set(this.#dia(a.fecha), incrementosDia(a), { merge: true });
    try {
      await lote.commit();
    } catch (error) {
      if (!esRechazo(error)) throw error;
      throw await this.#porQueNoSeResolvio(ref, registro.clave, error);
    }
  }

  /** Lee el evento para explicar el rechazo con un error del dominio. */
  async #porQueNoSeResolvio(ref: DocumentReference, clave: string, causa: unknown): Promise<unknown> {
    const snap = await getDoc(ref);
    if (!snap.exists()) return new ErrorRepositorio('no-existe', `No existe el evento ${clave}.`);
    const actual = deEvento(snap.id, snap.data());
    if (actual.tipo !== 'descensoGrande') {
      return new ErrorRepositorio('no-pendiente', `El evento ${clave} no es un descenso grande.`);
    }
    if (actual.estado !== 'pendiente') {
      return new ErrorRepositorio('ya-resuelto', `El descenso ${clave} ya se respondió.`);
    }
    return causa;
  }

  async pendientes(): Promise<readonly RegistroEvento[]> {
    const snap = await getDocs(this.#consultaPendientes());
    return snap.docs.map((d) => deEvento(d.id, d.data()));
  }

  async eventosDelDia(fecha: string): Promise<readonly RegistroEvento[]> {
    const snap = await getDocs(
      query(this.#eventos(), where('dia', '==', fecha), orderBy('en'), limit(LIMITES.eventosDelDia)),
    );
    return snap.docs.map((d) => deEvento(d.id, d.data()));
  }

  // ─── Días ─────────────────────────────────────────────────────────────────

  async dias(desde: string, hasta: string): Promise<readonly ResumenDia[]> {
    const snap = await getDocs(
      query(
        this.#dias(),
        where('fecha', '>=', desde),
        where('fecha', '<=', hasta),
        orderBy('fecha'),
        limit(LIMITES.dias),
      ),
    );
    return snap.docs.map((d) => deDia(d.id, d.data()));
  }

  async fijarMetaDelDia(fecha: string, metaMl: number, climaC: number | null): Promise<void> {
    await setDoc(
      this.#dia(fecha),
      { fecha, metaMl, climaC, actualizadoEn: serverTimestamp() },
      { merge: true },
    );
  }

  // ─── En vivo ──────────────────────────────────────────────────────────────

  escucharDia(
    fecha: string,
    oyente: (resumen: ResumenDia) => void,
    alError?: (error: unknown) => void,
  ): () => void {
    return onSnapshot(
      this.#dia(fecha),
      (snap) => oyente(snap.exists() ? deDia(fecha, snap.data()) : resumenVacio(fecha)),
      (error) => alError?.(error),
    );
  }

  escucharPendientes(
    oyente: (pendientes: readonly RegistroEvento[]) => void,
    alError?: (error: unknown) => void,
  ): () => void {
    return onSnapshot(
      this.#consultaPendientes(),
      (snap) => oyente(snap.docs.map((d) => deEvento(d.id, d.data()))),
      (error) => alError?.(error),
    );
  }
}
