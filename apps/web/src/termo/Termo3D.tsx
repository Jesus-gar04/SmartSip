/**
 * El termo SmartSip en 3D: acero de doble pared en beige, con correa y logo,
 * 20 cm de alto por 5 cm de diámetro (1 unidad = 1 cm). Pocos polígonos y
 * render a demanda: solo se dibuja cuando algo cambia o se mueve.
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  LatheGeometry,
  SRGBColorSpace,
  Vector2,
  type Group,
  type Mesh,
  type MeshStandardMaterial,
} from 'three';
import type { PantallaTermo } from 'smartsip-core';
import { colorCorrea, colorTermo, duracion, paleta } from 'smartsip-tokens';
import { ALTO_PANTALLA, ANCHO_PANTALLA, dibujarLogo, dibujarPantalla } from './pantalla-canvas.ts';
import { pasoResorte, type ControlTermo } from './control.ts';

export interface PropsTermo3D {
  readonly control: ControlTermo;
  readonly nivelMl: number;
  readonly capacidadMl: number;
  readonly pantalla: PantallaTermo;
  readonly reducido: boolean;
  /** Abierta: la tapa se desenrosca y sube, y deja ver la boca del termo. */
  readonly tapaCerrada: boolean;
  /** Se llama con la función que pide un cuadro nuevo. */
  readonly alListo?: (invalidar: () => void) => void;
}

const ALTO_CUERPO = 17.4;
const RADIO = 2.5;
const FONDO_INTERIOR = 0.45;
const ALTO_UTIL = 16.6;
/** Cuánto sube la tapa al abrirse (cm) y cuánto gira al desenroscarse (rad). */
const SUBIDA_TAPA = 2.4;
const GIRO_TAPA = Math.PI * 2; // una vuelta completa: la correa termina donde estaba

function perfilCuerpo(): Vector2[] {
  return [
    new Vector2(0, 0),
    new Vector2(2.05, 0),
    new Vector2(2.38, 0.08),
    new Vector2(RADIO, 0.42),
    new Vector2(RADIO, ALTO_CUERPO - 0.15),
    new Vector2(RADIO - 0.04, ALTO_CUERPO),
    new Vector2(0, ALTO_CUERPO),
  ];
}

function perfilTapa(): Vector2[] {
  return [
    new Vector2(0, 17.52),
    new Vector2(2.44, 17.52),
    new Vector2(2.44, 19.55),
    new Vector2(2.3, 19.95),
    new Vector2(0, 20),
  ];
}

function useTexturaCanvas(ancho: number, alto: number) {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = ancho;
    canvas.height = alto;
    const textura = new CanvasTexture(canvas);
    textura.colorSpace = SRGBColorSpace;
    textura.anisotropy = 4;
    return { canvas, textura, ctx: canvas.getContext('2d') as CanvasRenderingContext2D };
  }, [ancho, alto]);
}

function Modelo({ control, nivelMl, capacidadMl, pantalla, reducido, tapaCerrada, alListo }: PropsTermo3D) {
  const tapa = useRef<Group>(null);
  // Animación de la tapa: de dónde viene, a dónde va y cuándo empezó (0 = cerrada, 1 = abierta).
  const aperturaRef = useRef({ desde: tapaCerrada ? 0 : 1, hasta: tapaCerrada ? 0 : 1, inicioMs: 0 });
  useEffect(() => {
    const a = aperturaRef.current;
    const meta = tapaCerrada ? 0 : 1;
    if (a.hasta === meta) return;
    const g = tapa.current;
    a.desde = g ? g.position.y / SUBIDA_TAPA : a.hasta; // parte de donde esté, aunque vaya a medio camino
    a.hasta = meta;
    a.inicioMs = performance.now();
  }, [tapaCerrada]);
  const grupo = useRef<Group>(null);
  const cuerpo = useRef<MeshStandardMaterial>(null);
  const agua = useRef<Mesh>(null);
  const aguaMat = useRef<MeshStandardMaterial>(null);
  const { invalidate } = useThree();

  const geoCuerpo = useMemo(() => new LatheGeometry(perfilCuerpo(), 64), []);
  const geoTapa = useMemo(() => new LatheGeometry(perfilTapa(), 64), []);
  // Pantalla y logo: franjas curvas pegadas al cuerpo, centradas al frente (+Z).
  const geoPantalla = useMemo(() => new CylinderGeometry(RADIO + 0.012, RADIO + 0.012, 1.55, 24, 1, true, -0.62, 1.24), []);
  const geoLogo = useMemo(() => new CylinderGeometry(RADIO + 0.008, RADIO + 0.008, 0.9, 24, 1, true, -0.75, 1.5), []);
  const geoAgua = useMemo(() => new CylinderGeometry(2.22, 2.22, 1, 48), []);

  const tPantalla = useTexturaCanvas(ANCHO_PANTALLA, ALTO_PANTALLA);
  const tLogo = useTexturaCanvas(512, 96);

  useEffect(() => {
    alListo?.(invalidate);
  }, [alListo, invalidate]);

  useEffect(() => {
    const pintar = (logo?: HTMLImageElement) => {
      dibujarLogo(tLogo.ctx, 512, 96, logo);
      tLogo.textura.needsUpdate = true;
      invalidate();
    };
    pintar();
    const logo = new Image();
    logo.onload = () => pintar(logo);
    logo.src = '/marca/smartsip-logo-horizontal-tinta.svg';
  }, [tLogo, invalidate]);

  useEffect(() => {
    dibujarPantalla(tPantalla.ctx, pantalla);
    tPantalla.textura.needsUpdate = true;
    invalidate();
  }, [tPantalla, pantalla, invalidate]);

  const fraccion = Math.max(0, Math.min(1, nivelMl / capacidadMl));
  useEffect(() => invalidate(), [fraccion, tapaCerrada, invalidate]);

  useFrame((_, dt) => {
    const ahora = performance.now();
    let seguir = pasoResorte(control, dt, ahora, reducido);
    const g = grupo.current;
    if (g) {
      g.rotation.y = control.rotY;
      g.rotation.x = control.rotX;
    }

    // Vista de nivel: el acero se vuelve translúcido por un momento.
    const viendo = ahora < control.nivelHastaMs;
    const metaCuerpo = viendo ? 0.16 : 1;
    const metaAgua = viendo ? 0.92 : 0;
    const k = reducido ? 1 : Math.min(1, dt * 9);
    const mc = cuerpo.current;
    const ma = aguaMat.current;
    if (mc && ma) {
      mc.opacity += (metaCuerpo - mc.opacity) * k;
      ma.opacity += (metaAgua - ma.opacity) * k;
      if (Math.abs(mc.opacity - metaCuerpo) < 0.004) mc.opacity = metaCuerpo;
      if (Math.abs(ma.opacity - metaAgua) < 0.004) ma.opacity = metaAgua;
      mc.depthWrite = mc.opacity > 0.99;
      if (agua.current) agua.current.visible = ma.opacity > 0.01 && fraccion > 0;
      seguir ||= viendo || mc.opacity !== metaCuerpo || ma.opacity !== metaAgua;
    }
    // Tapa de rosca: al abrir se desenrosca (gira) y sube; al cerrar, al revés.
    const t = tapa.current;
    const a = aperturaRef.current;
    if (t) {
      const avance = reducido ? 1 : Math.min(1, (ahora - a.inicioMs) / duracion.sorbo);
      const suave = 1 - (1 - avance) ** 3; // sale rápido y se posa suave
      const p = a.desde + (a.hasta - a.desde) * suave;
      t.position.y = p * SUBIDA_TAPA;
      t.rotation.y = p * GIRO_TAPA;
      if (avance < 1) seguir = true;
    }
    if (seguir) invalidate();
  });

  const altoAgua = Math.max(0.001, ALTO_UTIL * fraccion);

  return (
    <group ref={grupo} position={[0, -10, 0]}>
      <mesh geometry={geoCuerpo} renderOrder={2}>
        <meshStandardMaterial ref={cuerpo} color={colorTermo} roughness={0.78} metalness={0.06} transparent />
      </mesh>
      <mesh geometry={geoLogo} position={[0, 4.2, 0]} renderOrder={3}>
        <meshStandardMaterial map={tLogo.textura} transparent roughness={0.8} depthWrite={false} />
      </mesh>
      <mesh geometry={geoPantalla} position={[0, 12.3, 0]} renderOrder={3}>
        <meshBasicMaterial map={tPantalla.textura} toneMapped={false} />
      </mesh>
      {/* Junta entre cuerpo y tapa. */}
      <mesh position={[0, ALTO_CUERPO + 0.06, 0]}>
        <cylinderGeometry args={[2.43, 2.43, 0.12, 48]} />
        <meshStandardMaterial color={paleta.tinta} roughness={0.9} />
      </mesh>
      {/* La boca del termo: queda a la vista cuando la tapa sube. */}
      <mesh position={[0, ALTO_CUERPO + 0.09, 0]}>
        <cylinderGeometry args={[1.75, 1.75, 0.04, 48]} />
        <meshStandardMaterial color={paleta.tinta} roughness={0.95} />
      </mesh>
      {/* Tapa de rosca con su correa: suben y giran juntas. */}
      <group ref={tapa}>
        <mesh geometry={geoTapa}>
          <meshStandardMaterial color={colorTermo} roughness={0.7} metalness={0.06} />
        </mesh>
        <mesh position={[2.75, 18.7, 0]} rotation={[0, 0, -0.15]}>
          <torusGeometry args={[1.05, 0.17, 10, 40]} />
          <meshStandardMaterial color={colorCorrea} roughness={0.92} />
        </mesh>
      </group>
      {/* Agua, visible solo en la vista de nivel. */}
      <mesh ref={agua} geometry={geoAgua} position={[0, FONDO_INTERIOR + altoAgua / 2, 0]} scale={[1, altoAgua, 1]} visible={false} renderOrder={1}>
        <meshStandardMaterial ref={aguaMat} color={paleta.azul} roughness={0.5} transparent opacity={0} side={DoubleSide} />
      </mesh>
    </group>
  );
}

export default function Termo3D(props: PropsTermo3D) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ position: [0, 1.5, 54], fov: 28, near: 1, far: 200 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      aria-hidden
    >
      <ambientLight intensity={1.05} />
      <directionalLight position={[10, 18, 16]} intensity={1.35} />
      <directionalLight position={[-12, 4, 6]} intensity={0.35} />
      <Modelo {...props} />
    </Canvas>
  );
}
