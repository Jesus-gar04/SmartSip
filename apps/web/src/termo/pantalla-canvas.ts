/**
 * Dibuja la pantalla frontal del termo: temperatura, batería y Bluetooth.
 * La usa el modelo 3D como textura; la ilustración 2.5D dibuja lo mismo en SVG.
 */
import type { PantallaTermo } from 'smartsip-core';
import { paleta, tipografia } from 'smartsip-tokens';

export const ANCHO_PANTALLA = 512;
export const ALTO_PANTALLA = 256;

const ALFA_BRILLO = { bajo: 0.55, medio: 0.8, alto: 1 } as const;

export function dibujarPantalla(ctx: CanvasRenderingContext2D, p: PantallaTermo): void {
  const w = ANCHO_PANTALLA;
  const h = ALTO_PANTALLA;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = p.encendida ? paleta.tinta : '#141514';
  ctx.fillRect(0, 0, w, h);
  if (!p.encendida) return;

  const alfa = ALFA_BRILLO[p.brillo];
  const fuente = tipografia.familia.sans;
  ctx.fillStyle = paleta.papel;
  ctx.strokeStyle = paleta.papel;
  ctx.globalAlpha = alfa;
  ctx.textBaseline = 'alphabetic';

  const x0 = 40;
  if (p.actualizacion) {
    // A4: en lugar de la temperatura, la barra de la actualización.
    ctx.textAlign = 'left';
    ctx.font = `700 34px ${fuente}`;
    ctx.fillText(p.actualizacion.fase === 'instalando' ? 'INSTALANDO' : 'ACTUALIZANDO', x0, 96);
    ctx.lineWidth = 5;
    ctx.strokeRect(x0, 124, 272, 44);
    ctx.fillRect(x0 + 8, 132, 256 * p.actualizacion.fraccion, 28);
    ctx.font = `400 34px ${fuente}`;
    ctx.fillText(`${Math.round(p.actualizacion.fraccion * 100)}%`, x0, 216);
  } else {
    // Temperatura: cifra grande y la unidad pequeña sobre la misma línea base.
    const cifra = String(p.temperatura);
    ctx.font = `700 150px ${fuente}`;
    ctx.textAlign = 'left';
    const anchoCifra = ctx.measureText(cifra).width;
    const base = 190;
    ctx.fillText(cifra, x0, base);
    ctx.font = `400 56px ${fuente}`;
    ctx.fillText(`°${p.unidad}`, x0 + anchoCifra + 8, base);
  }

  // Batería: contorno, nivel y porcentaje.
  const bx = 360;
  const by = 56;
  const bw = 96;
  const bh = 44;
  ctx.lineWidth = 5;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillRect(bx + bw, by + 13, 8, 18);
  const nivel = Math.max(0, Math.min(1, p.bateriaPct / 100));
  ctx.fillRect(bx + 8, by + 8, (bw - 16) * nivel, bh - 16);
  ctx.font = `400 40px ${fuente}`;
  ctx.textAlign = 'right';
  ctx.fillText(`${p.bateriaPct}%`, bx + bw + 8, 160);

  // Bluetooth: el símbolo entero si hay enlace; tenue si no.
  ctx.globalAlpha = p.bluetooth ? alfa : alfa * 0.25;
  const cx = 404;
  const cy = 206;
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 14, cy - 14);
  ctx.lineTo(cx + 14, cy + 12);
  ctx.lineTo(cx, cy + 26);
  ctx.lineTo(cx, cy - 26);
  ctx.lineTo(cx + 14, cy - 12);
  ctx.lineTo(cx - 14, cy + 14);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/**
 * Logo sobre el cuerpo, como va grabado en el termo: la gota con la S y la
 * palabra, en un solo color (tinta tenue). Sin imagen, solo la palabra.
 */
export function dibujarLogo(ctx: CanvasRenderingContext2D, ancho: number, alto: number, logo?: HTMLImageElement): void {
  ctx.clearRect(0, 0, ancho, alto);
  ctx.globalAlpha = 0.8;
  if (logo) {
    // Logo horizontal: viewBox de 161,37 × 44,88.
    const h = alto * 0.86;
    const w = h * (161.37 / 44.88);
    ctx.drawImage(logo, (ancho - w) / 2, (alto - h) / 2, w, h);
  } else {
    ctx.fillStyle = paleta.tinta;
    ctx.font = `700 ${Math.round(alto * 0.62)}px ${tipografia.familia.display}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SmartSip', ancho / 2, alto / 2);
  }
  ctx.globalAlpha = 1;
}
