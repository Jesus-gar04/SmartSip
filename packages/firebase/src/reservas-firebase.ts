/**
 * Reservas de la preventa sobre Firestore.
 *
 *   preventa/actual      { reservados }  contador público de cupos
 *   reservas/{numero}    la reserva, solo la lee quien la hizo
 *
 * Quien reserva entra como anónimo (sin contraseña: llega desde un QR). La
 * reserva y el contador se escriben juntos en una transacción; si dos
 * personas reservan a la vez, Firestore repite la de quien llegó después con
 * el contador nuevo. Las reglas impiden pasarse de los cupos.
 */
import { signInAnonymously } from 'firebase/auth';
import { doc, getDoc, onSnapshot, runTransaction, serverTimestamp, type DocumentData } from 'firebase/firestore';
import {
  codigoReserva,
  CUPOS_PREVENTA,
  cuposRestantes,
  ErrorReserva,
  type DatosReserva,
  type Entrega,
  type Reserva,
} from 'smartsip-core';
import type { ServiciosFirebase } from './iniciar.ts';

export const COLECCION_RESERVAS = 'reservas';
export const COLECCION_PREVENTA = 'preventa';

const codigoDe = (e: unknown) => (e as { code?: unknown } | null)?.code;

function deReserva(numero: number, d: DocumentData): Reserva {
  return {
    numero,
    codigo: codigoReserva(numero),
    nombre: String(d['nombre'] ?? ''),
    celular: String(d['celular'] ?? ''),
    correo: String(d['correo'] ?? ''),
    cantidad: Number(d['cantidad'] ?? 1),
    entrega: (d['entrega'] ?? 'domicilio') as Entrega,
    lugar: String(d['lugar'] ?? ''),
  };
}

export class ReservasFirebase {
  readonly #s: Pick<ServiciosFirebase, 'auth' | 'db'>;
  readonly #total: number;

  constructor(servicios: Pick<ServiciosFirebase, 'auth' | 'db'>, total: number = CUPOS_PREVENTA) {
    this.#s = servicios;
    this.#total = total;
  }

  get #preventa() {
    return doc(this.#s.db, COLECCION_PREVENTA, 'actual');
  }

  /** Sesión anónima: basta para reservar y para volver a ver la reserva propia. */
  async sesion(): Promise<string> {
    await this.#s.auth.authStateReady();
    const actual = this.#s.auth.currentUser;
    if (actual) return actual.uid;
    try {
      const { user } = await signInAnonymously(this.#s.auth);
      return user.uid;
    } catch {
      throw new ErrorReserva('sin-conexion');
    }
  }

  /** Escucha cuántos cupos van apartados. Sin documento todavía, van 0. */
  escucharCupos(alCambiar: (reservados: number) => void, alFallar?: () => void): () => void {
    return onSnapshot(
      this.#preventa,
      { includeMetadataChanges: true },
      (snap) => {
        // Sin conexión, "no existe en la caché" no quiere decir "van 0": se espera al servidor.
        if (!snap.exists() && snap.metadata.fromCache) return;
        alCambiar(snap.exists() ? Number(snap.data()['reservados'] ?? 0) : 0);
      },
      () => alFallar?.(),
    );
  }

  async reservar(datos: DatosReserva): Promise<Reserva> {
    const uid = await this.sesion();
    // Si otra persona reservó entre la lectura y la escritura, las reglas ven
    // un número que ya no es el siguiente y rechazan: se vuelve a leer el
    // contador y se intenta otra vez.
    for (let intento = 1; ; intento++) {
      try {
        return await this.#transaccion(uid, datos);
      } catch (error) {
        if (error instanceof ErrorReserva) throw error;
        const codigo = codigoDe(error);
        if (codigo === 'permission-denied' && intento < 5) continue;
        throw new ErrorReserva(codigo === 'unavailable' || codigo === 'deadline-exceeded' ? 'sin-conexion' : 'rechazada');
      }
    }
  }

  #transaccion(uid: string, datos: DatosReserva): Promise<Reserva> {
    return runTransaction(this.#s.db, async (tx) => {
      const snap = await tx.get(this.#preventa);
      const antes = snap.exists() ? Number(snap.data()['reservados'] ?? 0) : 0;
      const restantes = cuposRestantes(antes, this.#total);
      if (restantes <= 0) throw new ErrorReserva('agotado');
      if (datos.cantidad > restantes) throw new ErrorReserva('pocos');
      const numero = antes + 1;
      tx.set(this.#preventa, { reservados: antes + datos.cantidad });
      tx.set(doc(this.#s.db, COLECCION_RESERVAS, String(numero)), {
        ...datos,
        acepta: true,
        uid,
        creadoEn: serverTimestamp(),
      });
      return { ...datos, numero, codigo: codigoReserva(numero) };
    });
  }

  /** La reserva propia, para mostrarla al volver. Si no es suya o no existe, null. */
  async leer(numero: number): Promise<Reserva | null> {
    await this.sesion();
    try {
      const snap = await getDoc(doc(this.#s.db, COLECCION_RESERVAS, String(numero)));
      return snap.exists() ? deReserva(numero, snap.data()) : null;
    } catch {
      return null;
    }
  }
}
