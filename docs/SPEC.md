# SmartSip — Identidad, Producto y Hoja de Ruta

Documento maestro del simulador del termo SmartSip y de su app. Es un proyecto de Emprendimiento e Innovación de cinco estudiantes de Ingeniería Industrial de la Universidad Libre de Barranquilla. Fase 1: app web en React. Fase 2: React Native con Expo, probada en iPhone con Expo Go.

## 1. La idea que sostiene la marca

SmartSip es **un termo de verdad, que además piensa.** Según la encuesta, el 61,4 % compraría por conservación de temperatura y resistencia, y solo el 19,8 % por las funciones inteligentes. Por eso la app acompaña al termo, nunca le roba protagonismo. Tiene una sola tarea: que te hidrates sin tener que pensarlo.

Lema: **"Hidrata hoy, vive mejor."** Propuesta de valor: **"Hidrátate de forma inteligente."**

Tres palabras que filtran cada decisión: **Sereno. Preciso. Cotidiano.**

- Sereno: nada grita. Ni colores saturados ni notificaciones ansiosas.
- Preciso: cada número está alineado y cada animación dura lo que tiene que durar.
- Cotidiano: se siente como un objeto de uso diario, igual que el termo. No es un panel de control ni una demo tecnológica.

## 2. Sistema visual

> **Actualización (10 de noviembre de 2026):** la identidad visual la define ahora el manual de marca en [docs/marca/](marca/README.md) (`tokens.json`, `app.md` y componentes). Donde esta sección o la §4 lo contradigan (color principal azul #1F6FB2, tipografías Bricolage Grotesque, Inter y Caveat, esquinas de 14/22/32 px, sellos), **manda el manual**. Lo demás de este documento sigue vigente.

La app hereda la identidad que ya tiene la revista: crema y pardo, palo seco, sin adornos. App, revista y portada deben verse como una sola marca.

### Color

| Rol | Nombre | Hex | Uso en la app |
| --- | --- | --- | --- |
| Fondo | Papel | #F2EBE4 | Fondo principal, nunca blanco puro |
| Texto | Tinta | #262726 | Texto, números y modo oscuro como fondo |
| Principal | Pardo | #4D4238 | Botón principal, avisos |
| Progreso | Tierra | #8C7259 | Agua bebida, meta del día |
| Superficie | Beige | #C9B9A6 | Tarjetas, el cuerpo del termo 3D |

Regla: **un solo color activo por pantalla, el Tierra del progreso.** Todo lo demás es papel y tinta. El modo oscuro invierte Papel y Tinta y conserva el Tierra.

### Tipografía

- Palo seco tipo Helvetica, la misma de la revista (TeX Gyre Heros) autoalojada en la web; en iOS, Helvetica Neue, que ya viene instalada.
- Cifras tabulares siempre, para que los números no bailen al cambiar.
- Los litros del día se muestran grandes, con la unidad más pequeña y alineada a la línea base.

### Forma

- Esquinas contenidas: 10 px en tarjetas, 6 px en botones. Nada de píldoras ni chips redondeados.
- Retícula de 4 px. Márgenes laterales de 24 px.
- Sin sombras ni degradados; la profundidad la da el termo 3D.

## 3. El termo como protagonista 3D

El centro de la pantalla principal es el termo SmartSip en 3D: acero de doble pared en beige, con correa y logo, de 20 cm de alto y 5 cm de diámetro (unos 393 ml).

- **Pantalla espejo**: la pantalla frontal del modelo muestra en vivo lo mismo que la del termo: temperatura, batería y Bluetooth.
- **Vista de nivel**: al tocar el termo, el acero se vuelve translúcido por un momento y deja ver el agua que queda, medida por el sensor de nivel.
- Rotación libre con el dedo; un resorte suave lo devuelve a su pose a los 3 segundos.
- Rendimiento: un solo modelo de pocos polígonos, objetivo de 60 fps y respaldo automático a ilustración 2.5D en iPhones antiguos.
- Tecnología: React Three Fiber en web y la misma escena con expo-gl en móvil.

## 4. Movimiento

Principio: **el movimiento explica, no adorna.**

- Duraciones: 160 ms para microrespuestas, 280 ms para transiciones, 600 ms solo para el momento de "meta cumplida".
- Curvas de resorte, nunca lineales. Sin rebotes exagerados.
- Respeto total a "Reducir movimiento" de iOS: todo se sustituye por fundidos.

## 5. Los detalles pequeños que hacen la diferencia

1. **El termo se llena con tu día**: el progreso diario no es un anillo genérico. Es la silueta del termo llenándose de abajo arriba en tono Tierra.
2. **Número que se asienta**: al registrar un sorbo, la cifra rueda y se asienta con una micro-sacudida de 2 px.
3. **Háptica medida**: un toque casi imperceptible por cada sorbo y uno más claro, una sola vez, al cumplir la meta.
4. **Meta cumplida sin confeti**: la silueta se completa y aparece "Hidrataste lo de hoy." Nada más.
5. **Meta que explica su cambio**: si el día está caluroso, la meta sube y lo dice en una línea: "Hoy hace 33 °C, subimos tu meta a 2,6 L."
6. **Recordatorio que lee el ritmo**: no avisa a hora fija, sino cuando vas atrasado frente a tu ritmo habitual.
7. **Estados vacíos con carácter**: sin termo conectado se ve su silueta en línea fina y la frase "Esperando el primer sorbo".
8. **Batería honesta**: en lugar de un porcentaje, "Te queda para unos 4 días".
9. **Encontrar mi termo**: si se perdió la conexión, muestra el último lugar y la hora en que estuvo cerca.
10. **Microcopia con voz propia**: cálida y breve. Ejemplo: "Llevas 1,2 L de 2,4 L. Vas bien para esta hora."

## 6. Lo que SmartSip nunca hará

- Degradados oscuros, turquesa con naranja o chips redondeados: el primer diseño de la revista se rechazó por eso.
- Gradientes morados, iconos de destellos o tarjetas con brillo de plantilla.
- Muro de pago para lo básico: la app básica va incluida con el termo.
- Notificaciones cada pocos minutos o mensajes de culpa por no tomar agua.
- Gráficas por mostrar gráficas, o más de una acción principal por pantalla.

## 7. Arquitectura: un núcleo, dos pantallas

La decisión clave: **toda la lógica vive en un núcleo compartido en TypeScript que no sabe nada de pantallas.** Así la migración de web a React Native cambia solo la capa visual.

- **Núcleo `smartsip-core`**: modelo del termo, física térmica simulada, cálculo de la meta, recordatorios, cola de sorbos sin conexión y protocolo de mensajes. Sin React, sin DOM.
- **Termo simulado**: un objeto que emite eventos como si fuera el hardware real (temperatura, nivel, batería, sorbo detectado).
- **Canal de comunicación**: una interfaz `Transporte` con dos implementaciones. En el simulador, un bus de eventos en memoria. Con el termo real, Bluetooth de baja energía. La app no nota la diferencia.
- **Estado**: Zustand, que funciona igual en web y en React Native.
- **Interfaz web**: React + Vite + React Three Fiber + Framer Motion.
- **Interfaz móvil**: Expo + React Native Reanimated + expo-three + expo-haptics.

### Física térmica simulada

Para que el simulador sea creíble, el enfriamiento sigue la ley de enfriamiento de Newton, con un coeficiente que depende del aislamiento, la tapa y el nivel de líquido:

```latex
T(t) = T_{amb} + (T_0 - T_{amb}) \cdot e^{-k t}
```

El panel del simulador permite acelerar el tiempo ×1, ×10 y ×60 para ver en segundos lo que pasa en una hora.

### Pantalla del simulador web

Dos columnas. A la izquierda, **el termo**: su modelo 3D y un panel de controles físicos (llenar, beber, vaciar, tapa, cargar batería, desconectar y aceleración del tiempo). La temperatura ambiente y el clima del día no se ingresan a mano: se toman del clima local real (Open-Meteo; Barranquilla por defecto o la ubicación del dispositivo). A la derecha, **un iPhone dibujado con la app dentro**. Entre ambos, una línea fina muestra los mensajes que viajan en cada dirección, con un pulso en tono Tierra. Es la herramienta de prueba y también la mejor demo para la sustentación.

## 8. Casos de uso

Todos parten de lo que el termo sí tiene: sensor de nivel, sensor de temperatura en la tapa, pantalla frontal, batería y Bluetooth.

### Del termo hacia la app

| ID | Caso | Lo que detecta el termo | Lo que ve el usuario |
| --- | --- | --- | --- |
| T1 | Llenado | El nivel sube | El termo 3D se llena; no se suma al consumo |
| T2 | Sorbo | El nivel baja poco | Suma al consumo del día; la silueta avanza |
| T3 | Temperatura | El sensor de la tapa reporta | La pantalla del termo y la app muestran el mismo valor |
| T4 | Vaciado | El nivel baja de golpe | La app pregunta "¿Lo bebiste o lo vaciaste?" |
| T5 | Batería baja | Menos del 15 % | Aviso honesto en días restantes |
| T6 | Desconexión | Se corta el Bluetooth | Último lugar visto; el termo guarda los sorbos y los envía al reconectar |

### De la app hacia el termo

| ID | Caso | Lo que pide la app | Lo que hace el termo |
| --- | --- | --- | --- |
| A1 | Recordatorio | Avisa que vas atrasado | Nada: el aviso llega solo al celular |
| A2 | Encontrar mi termo | Pide señal | Nada: no vibra ni suena; la app muestra el último lugar visto |
| A3 | Preferencias | °C o °F, brillo de la pantalla | Ajusta su pantalla |
| A4 | Actualización | Envía firmware simulado | Barra de progreso en ambos lados |

### Solo en la app

- **U1 Primer uso**: emparejamiento en tres pasos, con el termo 3D apareciendo desde su silueta.
- **U2 Meta diaria**: se calcula con peso, actividad y clima, y explica cada cambio.
- **U3 Historial**: la semana como siete termos llenos a distinta altura, no como gráfica de barras.
- **U4 Recordatorios**: ritmo, horario de silencio y tono de los mensajes.
- **U5 Ajustes**: unidades, háptica, reducir movimiento y modo oscuro.

## 9. Hoja de ruta

Seis fases, de la 0 a la 5. Cada una termina con algo que se puede probar en el iPhone.

1. **Fase 0 — Cimientos (1 semana)**. Repositorio con `smartsip-core`, tokens de diseño (colores, tipografía, radios, duraciones) en un solo archivo compartido. Criterio de salida: el núcleo simula enfriamiento con pruebas automáticas.
2. **Fase 1 — Simulador del termo (2 semanas)**. Modelo 3D, pantalla espejo y vista de nivel, panel de controles físicos, aceleración del tiempo. Criterio: casos T1 a T6 funcionando.
3. **Fase 2 — App web dentro del simulador (3 semanas)**. Pantalla principal, meta diaria, recordatorios, historial, primer uso. Línea de mensajes entre termo y app. Criterio: casos A1 a A4 y U1 a U5. Se publica en Vercel y se prueba en Safari del iPhone, añadida a la pantalla de inicio.
4. **Fase 3 — Pulido (1 semana)**. Los diez detalles de la sección 5, modo oscuro, reducir movimiento, accesibilidad VoiceOver. Criterio: prueba con 5 personas sin explicarles nada.
5. **Fase 4 — Migración a Expo (3 semanas)**. Se reutiliza `smartsip-core` y los tokens tal cual. Se reescriben solo las pantallas con componentes nativos. Se prueba en el iPhone con Expo Go escaneando el código QR. Criterio: misma experiencia que la web, con háptica real.

> **Actualización (10 de noviembre de 2026):** la fase 4 queda **descartada**. No habrá app de Expo: la app es una **PWA** publicada en Vercel, que se instala desde Safari o Chrome con "Añadir a pantalla de inicio" y funciona sin conexión. Lo que SPEC dice de React Native, Expo, Reanimated y expo-haptics ya no aplica; la háptica se usa donde el navegador la ofrezca.

6. **Fase 5 — Hardware real (después)**. Se cambia el transporte simulado por Bluetooth. Esto exige salir de Expo Go a una *development build*, que se compila en la nube con EAS sin necesidad de Mac.

> **Actualización (10 de noviembre de 2026):** la fase 5 queda **descartada**: no habrá termo físico por ahora. En su lugar, el simulador se publica en una ruta del mismo despliegue (por ejemplo `/simulador`) y hace de termo remoto: se empareja con la cuenta de una persona y habla con su app por un transporte sobre Firestore, que implementa la misma interfaz `Transporte`. Así el celular con la app y el computador con el simulador pueden ser dispositivos distintos, y la app de Expo funciona en Expo Go sin *development build*.


## 10. Autoauditoría con los seis sombreros

Orden usado: blanco, rojo, verde, amarillo, negro, azul. Se rehízo con el contexto real del proyecto.

- **Blanco (hechos)**: SmartSip es un termo de acero de doble pared de unos 393 ml, con sensor de nivel, sensor de temperatura en la tapa y pantalla frontal. Su app mide consumo, calcula la meta y recuerda. Expo Go permite probar en iPhone sin Mac, pero no admite Bluetooth propio: por eso el hardware real va en la fase 5.
- **Rojo (intuición)**: la primera revista se rechazó por parecer de IA. La app tiene que sentirse hermana de la portada beige, no de otra marca.
- **Verde (ideas)**: el simulador puede ser la demo en vivo de la sustentación. El historial de siete termos puede convertirse en imagen para TikTok e Instagram, que suman el 66,3 % de la promoción preferida.
- **Amarillo (valor)**: el 41,6 % pide videos que muestren cómo funciona. El simulador permite grabarlos sin tener el hardware. El núcleo compartido ahorra cerca de la mitad del trabajo de migración.
- **Negro (riesgos)**:
  - La página 3 de la revista dice que la suscripción sostiene el negocio; la encuesta y la app básica incluida dicen lo contrario. Hay que alinear la revista.
  - El sensor de nivel solo sabe que el agua bajó: distinguir un sorbo de vaciar el termo necesita una regla clara (caso T4).
  - El 3D puede gastar batería y fallar en iPhones antiguos: hay respaldo 2.5D.
  - Las semanas de la hoja de ruta suponen dedicación completa; con clases, conviene duplicarlas.
- **Azul (control)**: el próximo paso es la fase 0. Confirmado: los avisos llegan solo al celular, el termo no vibra y guarda los sorbos sin conexión. Las pantallas de la revista eran ilustrativas, así que la app se diseña desde cero.
