# La app

La app no es un panel de datos. **La pantalla es el termo.**

## La idea que la hace inolvidable

En la pantalla principal, el agua sube **de verdad**. La ola de `azul` empieza al fondo cada mañana y, con cada sorbo que registra el termo, sube por la pantalla. Cuando cumples la meta, el agua llega arriba y la pantalla entera es azul.

Nadie necesita leer un número para saber cómo va: **lo ve de lejos**. Esa es la identidad: una app que se reconoce a tres metros de distancia por cuánta agua tiene.

## La pantalla principal, de arriba abajo

1. **Logotipo horizontal** pequeño a la izquierda; a la derecha, el **sello** del estado del termo (CONECTADO · 25 °C).
2. **La pregunta**, en estilo `pregunta`: "¿Cuánta **agua** tomaste hoy?"
3. **La respuesta**, en estilo `firma`, en `cacao`: "SmartSip sí lo sabe."
4. **El agua**, que ocupa desde abajo el porcentaje del día. Dentro, en blanco, la `cifra`: **1,2 L** y debajo "de 2,4 L".
5. Si el agua aún no llega a la cifra, la cifra flota justo encima de la ola, en `tinta`, y se vuelve blanca cuando el agua la alcanza.

## Los momentos de la app

| Momento | Lo que pasa | Duración |
|---|---|---|
| **Sorbo** | La ola sube, de una a tres burbujas suben por el agua y la cifra rueda hasta su nuevo valor. Háptica leve. | 600 ms |
| **Recordatorio** | Llega la notificación del flyer: cuadro de `tinta` con la `gota`, título en negrita y una línea de ayuda. | — |
| **Meta cumplida** | El agua llega arriba y aparece la firma: "Hidrataste lo de hoy." Sin confeti, una sola vez al día. | 900 ms |
| **Nuevo día** | La ola baja suavemente a cero a la hora de despertar. | 1,2 s |
| **Sin termo** | No hay agua: queda una línea de ola en `bruma` y la firma "Esperando el primer sorbo." | — |

## Otras pantallas

- **Tu semana:** siete columnas de agua, una por día, cada una con su propia ola a su altura. No es una gráfica de barras: son siete termos.
- **El termo:** la foto o el 3D del termo con la temperatura de su pantalla, la batería en días ("Te queda para unos 4 días") y el último lugar donde se vio.
- **Ajustes:** sobre papel, sin agua. Aquí no se celebra nada.

## Movimiento

- La ola siempre se mueve, muy lento (un ciclo cada 6 s), como el agua quieta dentro del termo. Con "Reducir movimiento" se queda quieta.
- Todo usa resortes suaves. Nada rebota más de una vez.
- Las burbujas son el único elemento que puede aparecer sin que el usuario lo pida, y solo después de un sorbo real.

## El ícono de la app

El símbolo de la gota con la S, en blanco, sobre un cuadrado `azul`, ocupando el 60 % del alto. Sin la palabra. En la pantalla de inicio del iPhone tiene que reconocerse entre cuarenta apps sin leer el nombre.

## Cómo se construye

Toda pantalla nueva debe pasar estas cinco preguntas:

1. ¿Hay papel arriba y agua abajo, separados por la ola?
2. ¿El azul es el único color con presencia?
3. ¿Hay como máximo una palabra azul en el titular?
4. ¿Hay como máximo una línea manuscrita?
5. ¿Se entiende de lejos, sin leer, cuánta agua llevas?
