# SmartSip

**Manual de marca y de la app.** Todo sale del flyer de preventa, que es la pieza fuente: sus colores, sus letras y sus formas. Si algo de este manual contradice al flyer, manda el flyer.

## 1. La esencia

SmartSip es el termo que **mide lo que tomas y te avisa antes de que llegue la sed**. No vende tecnología: vende la tranquilidad de no tener que contar.

Toda la marca cabe en una pregunta y su respuesta:

> **¿Cuánta agua tomaste hoy?** — *SmartSip sí lo sabe.*

La pregunta es directa y en negrita, como la hace un amigo. La respuesta va escrita a mano, porque es la voz cálida de la marca. Ese contraste, letra pesada contra letra manuscrita, es lo primero que se recuerda.

| Pieza | Texto | Dónde |
|---|---|---|
| Pregunta | ¿Cuánta agua tomaste hoy? | Portada de la app, campañas |
| Respuesta | SmartSip sí lo sabe. | Debajo de la pregunta, siempre manuscrita |
| Firma | Be smart. Sip better. | Cierre de piezas, pantalla de bienvenida |
| Promesa | Mide lo que tomas y te avisa antes de que llegue la sed. | Descripciones, tiendas de apps |

**Personalidad:** directa, cercana, tranquila. Habla como alguien que te cuida, no como un médico ni como un entrenador.

## 2. El color: el azul manda

El azul `azul` (#1F6FB2) **es** SmartSip. Es el agua. No es un acento: ocupa superficies grandes, como en el flyer, donde llena toda la mitad inferior.

| Token | Hex | Papel en la marca |
|---|---|---|
| `azul` | #1F6FB2 | Agua, nivel del día, botón principal, la palabra clave |
| `papel` | #F2EBE4 | Todo lo que no es agua |
| `tinta` | #241D18 | Titulares, cifras, el sello |
| `tierra` | #8C7259 | Acentos cálidos en impresos; nunca en el logo |
| `cacao` | #6B5643 | Solo la firma manuscrita |
| `bruma` | #A2BCD1 | Capa trasera de la ola |
| `gota` | #4FB3FF | La gota viva de la notificación |

**La regla de los dos mundos.** Toda pantalla tiene dos zonas: el **papel** arriba (lo seco: preguntas, datos, ajustes) y el **agua** abajo (lo vivo: tu consumo). Nunca se mezclan en manchas. La frontera entre ambas es siempre la ola.

**Proporción:** papel 50–65 %, azul 30–45 %, tinta para el texto y `tierra`, `cacao` y `gota` juntos menos del 3 %.

**Lo que NO va:** naranja, turquesa, verde, morado, rojo decorativo, degradados de cualquier tipo, negro puro o blanco puro como fondo. Para errores reales se usa `tinta` con un ícono, no rojo.

### Contraste

- Blanco sobre `azul`: 5,3:1. Todo texto sobre agua es blanco.
- `azul` sobre `papel`: 4,47:1. Solo desde 24 px, o 18 px en negrita. Para texto azul más pequeño, `azul-hondo`.
- `tierra` sobre papel: 3,8:1. Solo en tamaños grandes.
- `bruma` y `espuma` nunca llevan texto.

## 3. El logotipo

El logotipo es el que va grabado en el termo: **una gota dibujada con una sola línea continua**, abierta a la derecha, que por dentro se enrosca y forma la **S**. Debajo va la palabra **SmartSip**. La gota es el agua y la S que se enrosca es el sorbo.

- **Principal: vertical**, con el símbolo centrado sobre la palabra (recurso *Logo*, `smartsip-logo-vertical-tinta.svg`).
- **Horizontal**, con el símbolo a la izquierda, para encabezados y espacios bajos.
- **Símbolo solo** para el ícono de la app, el favicon y el avatar: blanco sobre `azul`.
- **Siempre en un solo color:** `tinta` sobre papel y `blanco` sobre azul. Nunca dos colores, nunca la palabra en otra letra y nunca la gota rellena.
- Espacio libre alrededor: la altura de la «S» de la palabra. Tamaño mínimo de la versión vertical: 48 px de ancho.

**Pendiente:** los SVG son una reconstrucción hecha a partir de la foto del termo. El símbolo está calcado; la palabra está compuesta en Inter Bold, que es la letra más parecida. Si existe el archivo original del logo, debe reemplazar a estos.

## 4. Tipografía

Tres voces, cada una con un trabajo:

1. **Bricolage Grotesque** (`display`), en ExtraBold: la voz que pregunta. Titulares enormes, interlineado apretado (0,92), letras casi tocándose. Es la que hace que SmartSip se reconozca desde lejos.
2. **Inter** (`sans`): la voz que informa. Cuerpo, notificaciones, ajustes.
3. **Caveat** (`firma`), en negrita: la voz que acompaña. Una sola línea por pantalla, nunca más.

**Las tres reglas tipográficas:**

- **Una palabra azul.** Cada titular grande pinta de `azul` UNA palabra, la que importa: "¿Cuánta **agua** tomaste hoy?", "Vas **bien**", "Te faltan **400 ml**".
- **Rótulos de sello.** Los rótulos van en mayúsculas espaciadas (estilo `sello`): PRECIO DE PREVENTA, HOY, TU SEMANA.
- **La firma responde.** La manuscrita siempre va debajo de algo en negrita, como respuesta. Nunca sola, nunca como titular.

**Por confirmar:** Caveat sale del código fuente del flyer. Bricolage Grotesque e Inter se identificaron a ojo; hay que confirmarlas con el archivo original.

## 5. Las formas de la marca

**La ola.** La firma visual de SmartSip. Dos capas: `bruma` detrás y `azul` delante, desfasadas, con curvas suaves y largas. Nunca más de dos crestas a lo ancho de una pantalla. Es la superficie del agua dentro del termo.

**Las burbujas.** Círculos huecos con trazo blanco de 2 px, en tres tamaños, que suben por el agua. Nunca más de tres a la vez.

**El círculo de función.** Cada función se dibuja como un ícono de línea dentro de un círculo con trazo de 2 px, como en el flyer.

**El sello.** Una píldora de `tinta` con texto en mayúsculas espaciadas. Para estados especiales: PREVENTA, NUEVO, META CUMPLIDA.

**Las esquinas.** Generosas pero no infladas: 14 px en botones, 22 px en tarjetas y 32 px en fotos.

## 6. Iconografía

- Íconos de línea con trazo de 2 px, extremos redondeados, en una cuadrícula de 24 px.
- Sobre agua: blancos dentro de un círculo blanco. Sobre papel: `tinta`.
- Juego base del flyer: termómetro (temperatura), barras (sorbos), campana (recordatorio) y pin (ubicación). Todo ícono nuevo debe parecer de la misma familia.
- Nunca íconos rellenos, de colores, en 3D o emojis.

## 7. Fotografía

- El termo beige es el protagonista, con fondos cálidos y desenfocados, luz natural y sin escenarios de estudio.
- Las fotos van recortadas con esquinas de 32 px y pueden inclinarse levemente (–4° como máximo), como en el flyer.
- Sobre la foto puede flotar una notificación real de la app: es la forma de contar que el termo y el celular hablan.

## 8. Voz y microcopia

| Sí | No |
|---|---|
| Llevas 2 horas sin tomar agua | ¡¡Alerta de hidratación!! |
| Un sorbo ahora y llegas a tu meta. | Debes beber 250 ml inmediatamente. |
| Hidrataste lo de hoy. | ¡Felicidades, campeón! 🎉 |
| Te queda para unos 4 días | Batería: 37 % |

Tutea siempre, usa frases de una línea, nunca culpa, nunca exclamaciones dobles y nunca emojis.

## 9. Lo que SmartSip nunca hará

Degradados de ningún tipo, ni azul-morado ni de otros colores. Tarjetas con borde de color a la izquierda, íconos de destellos, emojis en la interfaz, más de un color de acento, texto sobre la ola de `bruma`, más de una línea manuscrita por pantalla, ni rojo para regañar.
