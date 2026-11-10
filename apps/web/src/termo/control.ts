/**
 * Gestos sobre el termo, compartidos por el 3D y la ilustración 2.5D:
 * - arrastrar gira el termo; a los 3 s un resorte lo devuelve a su pose;
 * - tocar sin arrastrar muestra el nivel de agua por un momento.
 */
import { gesto } from 'smartsip-tokens';

export const VISTA_NIVEL_MS = 2500;
export const POSE = { y: -0.22, x: 0.04 } as const;
const UMBRAL_TOQUE_PX = 6;

export interface ControlTermo {
  rotY: number;
  rotX: number;
  velY: number;
  velX: number;
  arrastrando: boolean;
  ultimoGestoMs: number;
  nivelHastaMs: number;
}

export function crearControl(): ControlTermo {
  return { rotY: POSE.y, rotX: POSE.x, velY: 0, velX: 0, arrastrando: false, ultimoGestoMs: 0, nivelHastaMs: 0 };
}

/** Engancha los gestos a un elemento. Devuelve cómo soltarlos. */
export function engancharGestos(
  el: HTMLElement,
  c: ControlTermo,
  alCambiar: () => void,
): () => void {
  let inicio: { x: number; y: number; rotY: number; rotX: number; id: number } | null = null;
  let movido = false;

  const abajo = (e: PointerEvent) => {
    inicio = { x: e.clientX, y: e.clientY, rotY: c.rotY, rotX: c.rotX, id: e.pointerId };
    movido = false;
    c.arrastrando = true;
    c.velX = 0;
    c.velY = 0;
    el.setPointerCapture(e.pointerId);
  };
  const mover = (e: PointerEvent) => {
    if (!inicio || e.pointerId !== inicio.id) return;
    const dx = e.clientX - inicio.x;
    const dy = e.clientY - inicio.y;
    if (!movido && Math.hypot(dx, dy) < UMBRAL_TOQUE_PX) return;
    movido = true;
    c.rotY = inicio.rotY + dx * 0.012;
    c.rotX = Math.max(-0.45, Math.min(0.45, inicio.rotX + dy * 0.006));
    c.ultimoGestoMs = performance.now();
    alCambiar();
  };
  const arriba = (e: PointerEvent) => {
    if (!inicio || e.pointerId !== inicio.id) return;
    if (!movido) mostrarNivel(c);
    c.arrastrando = false;
    c.ultimoGestoMs = performance.now();
    inicio = null;
    alCambiar();
  };
  const teclado = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      mostrarNivel(c);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      c.rotY += e.key === 'ArrowLeft' ? -0.3 : 0.3;
      c.ultimoGestoMs = performance.now();
    } else return;
    alCambiar();
  };

  el.addEventListener('pointerdown', abajo);
  el.addEventListener('pointermove', mover);
  el.addEventListener('pointerup', arriba);
  el.addEventListener('pointercancel', arriba);
  el.addEventListener('keydown', teclado);
  return () => {
    el.removeEventListener('pointerdown', abajo);
    el.removeEventListener('pointermove', mover);
    el.removeEventListener('pointerup', arriba);
    el.removeEventListener('pointercancel', arriba);
    el.removeEventListener('keydown', teclado);
  };
}

export function mostrarNivel(c: ControlTermo): void {
  c.nivelHastaMs = performance.now() + VISTA_NIVEL_MS;
}

/**
 * Un paso del resorte que devuelve el termo a su pose. Amortiguamiento
 * crítico: llega sin rebotar. Devuelve `true` mientras siga moviéndose.
 */
export function pasoResorte(c: ControlTermo, dtS: number, ahoraMs: number, reducido: boolean): boolean {
  if (c.arrastrando || ahoraMs - c.ultimoGestoMs < gesto.retornoPoseMs) {
    return !c.arrastrando && (c.rotY !== POSE.y || c.rotX !== POSE.x);
  }
  if (reducido) {
    c.rotY = POSE.y;
    c.rotX = POSE.x;
    return false;
  }
  const k = 38;
  const amort = 2 * Math.sqrt(k);
  // Un cuadro lento no debe hacer saltar el resorte.
  const dt = Math.min(dtS, 1 / 30);
  const paso = (pos: number, vel: number, meta: number): [number, number] => {
    const a = -k * (pos - meta) - amort * vel;
    const v = vel + a * dt;
    return [pos + v * dt, v];
  };
  [c.rotY, c.velY] = paso(c.rotY, c.velY, POSE.y);
  [c.rotX, c.velX] = paso(c.rotX, c.velX, POSE.x);
  const quieto =
    Math.abs(c.rotY - POSE.y) < 1e-4 && Math.abs(c.rotX - POSE.x) < 1e-4 && Math.abs(c.velY) + Math.abs(c.velX) < 1e-3;
  if (quieto) {
    c.rotY = POSE.y;
    c.rotX = POSE.x;
    c.velY = 0;
    c.velX = 0;
  }
  return !quieto;
}
