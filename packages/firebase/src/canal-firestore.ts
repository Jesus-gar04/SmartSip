/**
 * El puente entre el termo y la app cuando están en dispositivos distintos:
 * los mensajes del protocolo viajan por `canales/{id}/mensajes`.
 *
 * - `TransporteFirestore` es el lado de la app: implementa la misma interfaz
 *   `Transporte` que el bus en memoria y que tendría Bluetooth. La app no nota
 *   la diferencia.
 * - `PuenteTermoFirestore` es el lado del termo: reenvía lo que el termo dice
 *   y le entrega lo que la app responde.
 *
 * Cada lado lee solo los mensajes del otro, los procesa en orden (`seq`) y los
 * borra: el canal queda casi vacío y cuesta pocas lecturas. Si un borrado se
 * pierde y el mensaje llega dos veces, no pasa nada: el sincronizador descarta
 * eventos repetidos y confirmar dos veces es inocuo.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import type {
  EstadoEnlace,
  MensajeApp,
  MensajeTermo,
  Reloj,
  TermoSimulado,
  Transporte,
} from 'smartsip-core';
import { COLECCION_CANALES } from './emparejamiento-firebase.ts';

type Lado = 'app' | 'termo';
/** Además del protocolo, el termo avisa si su Bluetooth "ve" al teléfono. */
type Control =
  | { readonly tipo: 'enlace'; readonly conectado: boolean }
  // La app, al abrir, le pide al termo que diga cómo está (por si se recargó).
  | { readonly tipo: 'presentate' };
type Cuerpo = MensajeTermo | MensajeApp | Control;

const relojReal: Reloj = { ahora: () => Date.now() };
const REINTENTO_MS = 3000;

/** Firestore no acepta `undefined`: se quitan los campos vacíos. */
const limpio = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

class Canal {
  readonly #db: Firestore;
  readonly #id: string;
  readonly #yo: Lado;
  readonly #reloj: Reloj;
  // Creciente aunque se recargue la página: arranca en la hora actual.
  #seq = Date.now() * 1000;

  constructor(db: Firestore, canalId: string, yo: Lado, reloj: Reloj) {
    this.#db = db;
    this.#id = canalId;
    this.#yo = yo;
    this.#reloj = reloj;
  }

  #mensajes() {
    return collection(this.#db, COLECCION_CANALES, this.#id, 'mensajes');
  }

  enviar(cuerpo: Cuerpo): Promise<unknown> {
    return addDoc(this.#mensajes(), {
      de: this.#yo,
      seq: ++this.#seq,
      cuerpo: limpio(cuerpo),
      enMs: this.#reloj.ahora(),
      creadoEn: serverTimestamp(),
    });
  }

  /**
   * Escucha los mensajes del otro lado, en orden, y los borra al procesarlos.
   * Si Firestore corta el oyente (por ejemplo, el termo empezó a escuchar
   * antes de que la app creara el canal), vuelve a intentarlo solo.
   */
  escuchar(oyente: (cuerpo: Cuerpo) => void, alError?: (e: unknown) => void): () => void {
    let activo = true;
    let soltar: (() => void) | null = null;
    let reintento: ReturnType<typeof setTimeout> | undefined;
    const suscribir = () => {
      soltar = this.#suscribir(oyente, (e) => {
        alError?.(e);
        soltar = null;
        if (activo) reintento = setTimeout(suscribir, REINTENTO_MS);
      });
    };
    suscribir();
    return () => {
      activo = false;
      clearTimeout(reintento);
      soltar?.();
    };
  }

  #suscribir(oyente: (cuerpo: Cuerpo) => void, alError: (e: unknown) => void): () => void {
    const otro: Lado = this.#yo === 'app' ? 'termo' : 'app';
    const vistos = new Set<string>();
    return onSnapshot(
      query(this.#mensajes(), where('de', '==', otro)),
      (snap) => {
        const nuevos = snap
          .docChanges()
          .filter((c) => c.type === 'added' && !vistos.has(c.doc.id))
          .map((c) => c.doc)
          .sort((a: QueryDocumentSnapshot, b: QueryDocumentSnapshot) => Number(a.get('seq')) - Number(b.get('seq')));
        for (const d of nuevos) {
          vistos.add(d.id);
          oyente(d.get('cuerpo') as Cuerpo);
          void deleteDoc(d.ref).catch(() => undefined);
        }
      },
      alError,
    );
  }
}

/** Lado de la app. */
export class TransporteFirestore implements Transporte {
  readonly #canal: Canal;
  readonly #alRecibir = new Set<(m: MensajeTermo) => void>();
  readonly #alCambiarEnlace = new Set<(e: EstadoEnlace) => void>();
  #enlace: EstadoEnlace = 'desconectado';
  #salir: (() => void) | null = null;

  constructor(db: Firestore, canalId: string, reloj: Reloj = relojReal) {
    this.#canal = new Canal(db, canalId, 'app', reloj);
  }

  get enlace(): EstadoEnlace {
    return this.#enlace;
  }

  /** Empieza a escuchar al termo. */
  abrir(alError?: (e: unknown) => void): void {
    if (this.#salir) return;
    this.#salir = this.#canal.escuchar((cuerpo) => {
      if (cuerpo.tipo === 'enlace') {
        this.#fijarEnlace((cuerpo as Extract<Control, { tipo: 'enlace' }>).conectado ? 'conectado' : 'desconectado');
        return;
      }
      // Si llega algo del termo, es que hay enlace aunque el aviso se haya perdido.
      if (cuerpo.tipo === 'hola' || cuerpo.tipo === 'estado') this.#fijarEnlace('conectado');
      for (const o of this.#alRecibir) o(cuerpo as MensajeTermo);
    }, alError);
    void this.#canal.enviar({ tipo: 'presentate' }).catch((e: unknown) => alError?.(e));
  }

  cerrar(): void {
    this.#salir?.();
    this.#salir = null;
    this.#fijarEnlace('desconectado');
  }

  enviar(mensaje: MensajeApp): boolean {
    if (this.#enlace !== 'conectado') return false;
    void this.#canal.enviar(mensaje).catch(() => undefined);
    return true;
  }

  alRecibir(oyente: (m: MensajeTermo) => void): () => void {
    this.#alRecibir.add(oyente);
    return () => this.#alRecibir.delete(oyente);
  }

  alCambiarEnlace(oyente: (e: EstadoEnlace) => void): () => void {
    this.#alCambiarEnlace.add(oyente);
    return () => this.#alCambiarEnlace.delete(oyente);
  }

  #fijarEnlace(e: EstadoEnlace): void {
    if (e === this.#enlace) return;
    this.#enlace = e;
    for (const o of this.#alCambiarEnlace) o(e);
  }
}

/** Lado del termo (el simulador). */
export class PuenteTermoFirestore {
  readonly #canal: Canal;
  readonly #termo: TermoSimulado;
  #soltar: Array<() => void> = [];

  constructor(db: Firestore, canalId: string, termo: TermoSimulado, reloj: Reloj = relojReal) {
    this.#canal = new Canal(db, canalId, 'termo', reloj);
    this.#termo = termo;
  }

  /** Une el termo al canal: avisa su enlace y se presenta. */
  abrir(alError?: (e: unknown) => void, alRecibir?: (m: MensajeApp) => void): void {
    if (this.#soltar.length > 0) return;
    const enviar = (c: Cuerpo) => void this.#canal.enviar(c).catch((e: unknown) => alError?.(e));
    this.#soltar = [
      this.#termo.alEnviar((m) => enviar(m)),
      this.#termo.alCambiarConexion((conectado) => enviar({ tipo: 'enlace', conectado })),
      this.#canal.escuchar((cuerpo) => {
        if (cuerpo.tipo === 'presentate') {
          enviar({ tipo: 'enlace', conectado: this.#termo.conectado });
          this.#termo.saludar();
          return;
        }
        alRecibir?.(cuerpo as MensajeApp);
        this.#termo.recibir(cuerpo as MensajeApp);
      }, alError),
    ];
    enviar({ tipo: 'enlace', conectado: this.#termo.conectado });
    this.#termo.saludar();
  }

  cerrar(): void {
    for (const s of this.#soltar) s();
    this.#soltar = [];
  }
}
