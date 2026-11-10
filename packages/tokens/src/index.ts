/**
 * Tokens de diseño de SmartSip, según el manual de marca (docs/marca).
 * Una sola fuente para la web: el CSS solo usa variables generadas de aquí.
 *
 * La regla de los dos mundos: papel arriba (lo seco) y agua abajo (lo vivo),
 * separados por la ola. El azul es el agua y es SmartSip.
 */

// ─── Color ──────────────────────────────────────────────────────────────────

/** Los colores de la marca (manual §2). No se añaden otros. */
export const paleta = {
  azul: '#1F6FB2',
  azulHondo: '#17578C',
  azulClaroNoche: '#6AA8DC',
  bruma: '#A2BCD1',
  brumaNoche: '#2C4458',
  espuma: '#8FB7D8',
  gota: '#4FB3FF',
  papel: '#F2EBE4',
  tinta: '#241D18',
  textoSuave: '#3A332C',
  textoSuaveNoche: '#CFC6BC',
  tierra: '#8C7259',
  tierraNoche: '#B09A84',
  cacao: '#6B5643',
  blanco: '#FFFFFF',
  superficieNoche: '#2F2721',
} as const;

export type Esquema = 'dia' | 'noche';

/** Roles de color: el CSS usa estos nombres, nunca los hex. */
export interface Colores {
  /** Fondo de todo lo que no es agua. Nunca blanco puro. */
  readonly papel: string;
  /** Titulares, cifras y texto principal. */
  readonly tinta: string;
  /** Texto de cuerpo y descripciones. */
  readonly textoSuave: string;
  /** Separadores finos sobre papel: la tinta con poca opacidad. */
  readonly linea: string;
  /** El agua, el nivel del día, el botón principal y la palabra clave. */
  readonly agua: string;
  /** Azul presionado y enlaces pequeños sobre papel. */
  readonly aguaHonda: string;
  /** Azul como texto o ícono. */
  readonly aguaTexto: string;
  /** Capa trasera de la ola. Nunca lleva texto. */
  readonly bruma: string;
  /** Líneas y bordes finos sobre el agua. */
  readonly espuma: string;
  /** La gota viva: notificación y sorbo recién registrado. */
  readonly gota: string;
  /** Texto e íconos sobre el agua. */
  readonly sobreAgua: string;
  /** Tarjetas flotantes, como la notificación. */
  readonly superficie: string;
  /** Acentos cálidos grandes; nunca en el logo. */
  readonly tierra: string;
  /** Solo la firma manuscrita. */
  readonly cacao: string;
  /** Sellos (CONECTADO, META CUMPLIDA). */
  readonly sello: string;
  readonly selloTexto: string;
}

const alfa = (hex: string, a: number) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

export const colores: Readonly<Record<Esquema, Colores>> = {
  dia: {
    papel: paleta.papel,
    tinta: paleta.tinta,
    textoSuave: paleta.textoSuave,
    linea: alfa(paleta.tinta, 0.14),
    agua: paleta.azul,
    aguaHonda: paleta.azulHondo,
    aguaTexto: paleta.azul,
    bruma: paleta.bruma,
    espuma: paleta.espuma,
    gota: paleta.gota,
    sobreAgua: paleta.blanco,
    superficie: paleta.blanco,
    tierra: paleta.tierra,
    cacao: paleta.cacao,
    sello: paleta.tinta,
    selloTexto: paleta.papel,
  },
  noche: {
    papel: paleta.tinta,
    tinta: paleta.papel,
    textoSuave: paleta.textoSuaveNoche,
    linea: alfa(paleta.papel, 0.16),
    agua: paleta.azul,
    aguaHonda: paleta.azulHondo,
    aguaTexto: paleta.azulClaroNoche,
    bruma: paleta.brumaNoche,
    espuma: paleta.espuma,
    gota: paleta.gota,
    sobreAgua: paleta.blanco,
    superficie: paleta.superficieNoche,
    tierra: paleta.tierraNoche,
    cacao: paleta.tierraNoche,
    sello: paleta.papel,
    selloTexto: paleta.tinta,
  },
};

/** El termo es beige: es el objeto real, no un color de la interfaz. */
export const colorTermo = '#C9B9A6';

/** La correa del termo, de cuero pardo: también es del objeto, no de la interfaz. */
export const colorCorrea = '#4D4238';

// ─── Tipografía ─────────────────────────────────────────────────────────────

export const tipografia = {
  familia: {
    /** La voz que pregunta: titulares y cifras. */
    display: '"Bricolage Grotesque", "Helvetica Neue", Arial, sans-serif',
    /** La voz que informa. */
    sans: 'Inter, "Helvetica Neue", Arial, sans-serif',
    /** La voz que acompaña: una sola línea por pantalla. */
    firma: 'Caveat, "Bradley Hand", cursive',
  },
  /** Cifras tabulares siempre, para que los números no bailen. */
  cifras: { css: 'tabular-nums' },
  /** Escala en px (manual §4). La altura de línea es en px o un factor. */
  escala: {
    pregunta: { familia: 'display', tamano: 56, alturaLinea: 0.92, peso: 800, tracking: -0.02 },
    cifra: { familia: 'display', tamano: 64, alturaLinea: 1, peso: 800, tracking: -0.03 },
    unidadCifra: { familia: 'display', tamano: 24, alturaLinea: 1, peso: 700, tracking: 0 },
    titulo: { familia: 'display', tamano: 28, alturaLinea: 32, peso: 700, tracking: -0.01 },
    funcion: { familia: 'display', tamano: 17, alturaLinea: 21, peso: 700, tracking: 0 },
    cuerpo: { familia: 'sans', tamano: 16, alturaLinea: 24, peso: 400, tracking: 0 },
    aviso: { familia: 'sans', tamano: 15, alturaLinea: 20, peso: 600, tracking: 0 },
    etiqueta: { familia: 'sans', tamano: 13, alturaLinea: 18, peso: 400, tracking: 0 },
    sello: { familia: 'sans', tamano: 12, alturaLinea: 16, peso: 700, tracking: 0.18 },
    firma: { familia: 'firma', tamano: 26, alturaLinea: 30, peso: 700, tracking: 0 },
  },
} as const;

export type EstiloTexto = keyof typeof tipografia.escala;

// ─── Forma y espacio ────────────────────────────────────────────────────────

/** Retícula base: todo espaciado es múltiplo de 4 px. */
export const reticula = 4;

export const espacio = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

/** Margen lateral de toda pantalla. */
export const margenLateral = espacio[6];

/** Esquinas generosas pero no infladas (manual §5). */
export const radio = {
  ninguno: 0,
  boton: 14,
  tarjeta: 22,
  foto: 32,
  /** Solo sellos y etiquetas. */
  sello: 999,
} as const;

/** Trazo de íconos de línea, círculos de función y burbujas. */
export const trazo = 2;

/** Línea fina de separadores. */
export const lineaFina = 1;

// ─── Movimiento ─────────────────────────────────────────────────────────────

/** Duraciones (manual "Los momentos de la app" y SPEC §4). */
export const duracion = {
  micro: 160,
  transicion: 280,
  /** La ola sube, las burbujas suben y la cifra rueda. */
  sorbo: 600,
  /** El agua llega arriba y aparece la firma. Una vez al día. */
  meta: 900,
  /** La ola baja a cero a la hora de despertar. */
  nuevoDia: 1200,
  /** La ola se mece: un ciclo cada 6 s. */
  cicloOla: 6000,
} as const;

export type NombreDuracion = keyof typeof duracion;

/**
 * Resorte por duración percibida y razón de amortiguamiento (1 = sin rebote).
 * Framer Motion: `{ type: 'spring', duration, bounce: 1 - amortiguamiento }`.
 * Nada rebota más de una vez.
 */
export interface Resorte {
  readonly duracionMs: number;
  readonly amortiguamiento: number;
}

export const resorte = {
  micro: { duracionMs: duracion.micro, amortiguamiento: 0.9 },
  transicion: { duracionMs: duracion.transicion, amortiguamiento: 0.85 },
  sorbo: { duracionMs: duracion.sorbo, amortiguamiento: 0.8 },
  meta: { duracionMs: duracion.meta, amortiguamiento: 0.85 },
  nuevoDia: { duracionMs: duracion.nuevoDia, amortiguamiento: 1 },
} as const satisfies Record<string, Resorte>;

export type NombreResorte = keyof typeof resorte;

/** Con "Reducir movimiento", todo se sustituye por un fundido y la ola queda quieta. */
export const fundido = {
  duracionMs: duracion.micro,
  curva: [0.2, 0, 0, 1] as const,
} as const;

export const gesto = {
  /** La cifra rueda y se asienta con una micro-sacudida de 2 px. */
  sacudidaCifraPx: 2,
  /** Tras girar el termo con el dedo, un resorte lo devuelve a su pose. */
  retornoPoseMs: 3000,
} as const;

// ─── Agrupado ───────────────────────────────────────────────────────────────

export const tokens = {
  paleta,
  colores,
  colorTermo,
  colorCorrea,
  tipografia,
  reticula,
  espacio,
  margenLateral,
  radio,
  trazo,
  lineaFina,
  duracion,
  resorte,
  fundido,
  gesto,
} as const;

export default tokens;
