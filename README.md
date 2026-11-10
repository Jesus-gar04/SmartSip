# SmartSip

Simulador del termo inteligente SmartSip y su app compañera. La especificación está en [docs/SPEC.md](docs/SPEC.md).

## Requisitos

- Node 24 o superior
- pnpm 12.5.1

## Comandos

```bash
pnpm install
pnpm test                 # pruebas de todo el monorepo, con cobertura (mínimo 90 %)
pnpm typecheck            # TypeScript estricto en tokens, núcleo y pruebas
pnpm sim                  # una hora de SmartSip acelerada ×60 (un minuto real)
pnpm sim --instantaneo    # la misma hora, sin esperar
pnpm dev                  # la app en http://localhost:5173 y el simulador en /simulador
pnpm build                # build de producción de la web (apps/web/dist)
```

El simulador web tiene dos modos de datos, que se eligen arriba a la derecha:

- **En memoria** (por defecto): todo vive en la pestaña y el tiempo se puede acelerar ×10 o ×60.
- **Firebase**: entra como usuario anónimo y guarda en el proyecto real, con el tiempo a ×1 para que las horas sean reales.

Parámetros útiles: `?datos=firebase|memoria`, `?termo=2d` (fuerza la ilustración 2.5D) y `?termo=3d`.

### Firebase

Las pruebas y los emuladores necesitan **Java 21 o superior** en el PATH.

```bash
pnpm test:firebase              # pruebas del adaptador y de las reglas, contra los emuladores
pnpm emuladores                 # deja corriendo Auth y Firestore locales (UI en http://127.0.0.1:4000)
pnpm firebase:probar-scripts    # prueba de humo y usuarios de prueba, contra los emuladores
pnpm firebase login             # una vez, en tu terminal
pnpm firebase:publicar-reglas   # publica reglas e índices en el proyecto real
pnpm firebase:humo              # prueba de humo contra el proyecto real
pnpm firebase:sembrar           # crea los usuarios de prueba en el proyecto real (pide SMARTSIP_CLAVE_DEMO)
```

La configuración del proyecto va en `apps/web/.env.local` (ver `apps/web/.env.example`). Las reglas de seguridad están en `firebase/firestore.rules` y los índices en `firebase/firestore.indexes.json`.

### Avisos al celular (Web Push)

El termo (el simulador en `/simulador`) decide cuándo avisar con `decidirAviso` del núcleo, y la función `apps/web/api/avisar.ts` entrega el push. Esa función lee el canal por la API REST de Firestore con el token de quien llama, así que no necesita cuenta de servicio.

- En local, `/api/avisar` lo sirve Vite (dev y preview). Para probar el service worker y los avisos contra los emuladores: `pnpm emuladores` y luego `pnpm --filter smartsip-web preview:emulador` (puerto 4173).
- En Vercel (proyecto con raíz `apps/web`), agrega estas variables de entorno: `VITE_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:` o `https:`), además de las `VITE_FIREBASE_*`. Las claves VAPID locales están en `apps/web/.env.local`.
- En iPhone, los avisos llegan solo con SmartSip agregada a la pantalla de inicio (iOS 16.4 o más reciente). El permiso se pide desde Ajustes → Avisos en este celular.

## Estructura

| Carpeta | Qué contiene |
| --- | --- |
| `packages/tokens` (`smartsip-tokens`) | Colores, tipografía, radios, espaciados y movimiento, para web y móvil. |
| `packages/core` (`smartsip-core`) | Toda la lógica, sin React ni DOM: física térmica, termo simulado, detección de sorbos, cola sin conexión, meta, protocolo, `Transporte`, `Repositorio`, cuentas y sincronizador. |
| `packages/firebase` (`smartsip-firebase`) | Implementaciones con Firestore y Firebase Auth, scripts de humo y de usuarios de prueba. |
| `firebase/` | Reglas de seguridad e índices de Firestore. |
| `apps/web` | Simulador en React (fase 1). |
| `apps/mobile` | App en Expo (fase 4). |

`packages/core/tsconfig.json` no incluye tipos de Node ni del DOM: si el núcleo usa `window`, `document` o `process`, no compila.
