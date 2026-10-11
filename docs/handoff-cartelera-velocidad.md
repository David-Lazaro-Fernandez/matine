# Handoff: Cartelera rápida (carga por partes y optimización de consultas)

Escrito el 2026-10-10. Lee antes `AGENTS.md`, `DESIGN.md` (secciones "Carga" y "Jerarquía en tres capas") y
`docs/handoff-dashboard-nextjs.md` (estado de la migración). Rama: `dashboard-nextjs`.

## Objetivo

Que quien abre la Cartelera vea datos lo antes posible. Hoy la página espera a que el servidor calcule las tres capas
completas antes de pintar nada más que el esqueleto. Primero se muestra lo de arriba; lo de abajo se pide cuando el
usuario se acerca a él. Después se optimizan las consultas que siguen siendo lentas.

Los resultados no cambian: mismas cifras, mismos textos, mismo orden. Solo cambia cuándo llegan.

## Cómo está hoy

- **Un solo endpoint.** `GET /api/cartelera` (`api/pages/cartelera.py`, función `cartelera`) llama en serie a unas 30
  funciones de `analytics/`: encabezado, `kpis`, `findings`, `conclusions`, `general_summary` (por franja), `movie_gaps`,
  `heatmap_day_slot`, `mix`, `presale_*`, `offered_seats`, `concentration`, eventos, precios, aforo y ocupación.
- **Tiempos medidos** (2026-10-09, base real): en frío ~7.5 s con CDMX y ~9.5 s nacional, con respuestas de 157 y
  245 KB. Con caché, 2 ms. `analytics.findings` sola se lleva ~4.6 s.
- **Caché.** `read(key, compute)` de `api/pages/__init__.py`: en la memoria del proceso, 60 s (`TTL`), hasta 32 llaves.
  La llave es `("cartelera", today, d0, d1, hours, plaza)`; cualquier cambio de filtro es un cálculo en frío.
- **Ya hay sub-endpoints** para controles dentro de una sección: `/api/cartelera/curva`, `/cambios` e `/historia`. La
  historia ya se pide solo al abrir su apéndice. Ese es el patrón a extender.
- **Frontend.** `dashboard/app/page.tsx` pide `/api/cartelera` una vez y pinta `SkeletonCapas` hasta que llega todo.

## Plan

### 1. Medir antes de mover nada

Escribe un script fuera del repo (o en `scripts/` si vale la pena conservarlo) que cronometre cada llamada de `compute`
contra `data/snapshots.db` real, con CDMX y nacional, para la semana en curso y para un solo día. Con esa tabla se decide
qué va primero y qué conviene optimizar. No adivines: el orden del plan puede cambiar con los números.

### 2. Dividir el endpoint por capa y sección

Una petición por bloque visible, cada una con su llave de `read()`:

| Endpoint | Contenido | Cuándo se pide |
| --- | --- | --- |
| `GET /api/cartelera` | encabezado, cobertura, captura, `kpis` | al entrar |
| `GET /api/cartelera/hallazgos` | `findings` y `conclusions` | al entrar, en paralelo |
| `GET /api/cartelera/seccion/{slug}` | los datos de una sección de evidencia (`resumen`, `peliculas`, `horarios`, `formatos`, `preventa`) | al acercarse a la sección |
| `GET /api/cartelera/apendice/{slug}` | KPIs, cambios, precios, butacas | al abrir el apéndice |

- Revisa si `conclusions` se puede calcular por sección. Si es una sola pasada, deja que vaya con los hallazgos.
- Los parámetros son los mismos de hoy (`plaza`, `d0`, `d1`, `h0`, `h1`) y las mismas validaciones (422).
- Sigue el patrón de `api/pages/datos.py`: `TypedDict` de respuesta, `Literal` para `slug` y llaves, no frases.
- Las pruebas de `tests/test_internal_api.py` que cubren `/api/cartelera` se ajustan a la nueva forma.

### 3. Carga diferida en el frontend

- Encabezado y capa 1 llegan primero. Cada sección de capa 2 pinta su `SkeletonSeccion` y pide su endpoint cuando entra
  cerca de la pantalla (`IntersectionObserver` con un margen de unos 600 px, para que llegue antes de verse).
- Los apéndices de capa 3 piden al abrirse, como ya hace la historia.
- Cambiar un filtro vuelve a pedir solo lo visible; lo demás, cuando se acerque.
- El estado sigue en la URL. Los enlaces "1 2 3" a las capas deben seguir funcionando: al saltar a una capa, sus
  secciones se piden al entrar en pantalla.
- Un error en una sección se muestra en esa sección, no tumba la página.
- Si el patrón sirve, extráelo a un hook o componente en `components/common.tsx` (por ejemplo `useLazySection`) para
  usarlo después en Independientes y en Mapa nacional.

### 4. Optimizar las consultas

Empieza por lo que el paso 1 diga que es más lento; hoy es `analytics.findings`.

- `EXPLAIN QUERY PLAN` sobre las consultas lentas.
- **Índices.** Son cambio de esquema: van en `scraper/store.py` con `CREATE INDEX IF NOT EXISTS`, aditivos. Lo escribe
  la captura, el único escritor de `snapshots.db`; `analytics/` abre en `mode=ro` y no puede crearlos.
- **`title_key`** es una función de Python registrada en SQLite por `analytics.connect()`. Se evalúa por renglón y puede
  pesar en las agrupaciones por película. Mide antes de cambiarla.
- **Cálculos repetidos.** Varias funciones recorren la misma ventana (`_window`). Si `findings` y `conclusions` repiten
  el trabajo de `kpis`, `movie_gaps` o `mix`, comparte el resultado sin cambiar la firma pública de `analytics/`
  (`AGENTS.md` §3).
- **Cada optimización conserva el resultado.** Guarda la salida de cada función antes del cambio (JSON con CDMX y
  nacional) y compárala después: tiene que ser idéntica, orden incluido.

### Fuera de alcance sin discutirlo antes

- Tablas precalculadas o una caché en disco: serían un escritor nuevo sobre `snapshots.db` o un archivo nuevo
  (`AGENTS.md` §1, "un solo escritor").
- Calentar la caché después de cada captura con un trabajo programado: va en `jobs/registry.py` y hay que ubicarlo en
  el calendario.
- Más workers de uvicorn: el servidor tiene 2 GB.

## Reglas que aplican

- `analytics/` es solo stdlib y corre con `/usr/bin/python3`. Sin pandas.
- Cada función de `analytics/` mantiene su firma y su `ORDER BY` explícito.
- Ningún texto ni hex a mano en `dashboard/`; los esqueletos son los de `components/common.tsx`.
- Comentarios según `.claude/rules/comments.md`.
- Antes de dar algo por bueno: los tiempos nuevos, medidos con la base real, junto a los de arriba.

## Cómo se verifica

- Tiempos antes y después por endpoint, CDMX y nacional, en frío.
- Tiempo hasta ver la capa 1 en el navegador (`pnpm dev` y `uvicorn api.internal:app --port 8501`).
- Salida de `analytics/` idéntica antes y después de cada optimización.
- `make check` con `AC_DATA_DIR="$PWD/data"` y `cd dashboard && pnpm run build` al final.

## Resultado (2026-10-10)

Hecho en la rama `dashboard-nextjs`. Salida de `analytics/` y de los endpoints idéntica antes y después, orden incluido:
código viejo sobre una copia de la base sin índices contra código nuevo sobre la misma copia con índices, en el mismo
minuto, con CDMX, nacional y hoy desde las 6 PM, más Dulcería e Independientes.

- **Endpoints** como en la tabla del plan. Las conclusiones van con su sección: `analytics.conclusions(sections=…)`.
  Los apéndices se piden al acercarse y no al abrirse, porque su resumen va en el encabezado cerrado.
- **Frontend.** `useApi`, `useLazyApi` y `Diferido` en `components/common.tsx` (600 px de margen).
- **`idx_current_window`** sobre `current_showtime` (`scraper/store.py`, en `migrate`): cubre las columnas de las
  consultas de ventana. La base real lo recibe en la siguiente captura.
- **`plaza_cinema_where`** acota también `chain`, así `event` usa sus índices con plaza.
- **`recent_events`** lee `event` por `id` descendente y para en `limit`.
- **`findings`** comparte `movies_by_chain` y `presale_compare` entre sus reglas.

Tiempos en frío por HTTP (segundos; encabezado y hallazgos en paralelo, luego las secciones en paralelo):

| Endpoint | CDMX antes | CDMX ahora | Nacional antes | Nacional ahora |
| --- | --- | --- | --- | --- |
| `/cartelera` (todo) | ~7.5 | — | ~9.5 | — |
| `/cartelera` (encabezado) | — | 0.07 | — | 0.23 |
| `/cartelera/hallazgos` | — | 0.9 | — | 2.3 |
| la sección más lenta | — | 0.46 | — | 1.6 (`resumen`) |
| el apéndice más lento | — | 0.3 (1.8 con disco frío, `cambios`) | — | 0.37 |

Pendiente, si hace falta: hallazgos nacional (unas diez lecturas de la ventana de ~150 ms cada una y
`programming_moves`) y `resumen` nacional, que calcula `general_summary` dos veces más la de su conclusión.

## Servidor y precálculo (2026-10-11)

En el servidor (2 vCPU, 1.8 GB de RAM) los hallazgos nacionales tardan ~10 s aun con `idx_current_window`. La causa es
disco: `event` pesa 1.3 GB de los 1.6 GB de la base y no cabe en caché. La lectura de `event` de `programming_moves`
tarda 1.2 s en frío y 0.17 s en caliente. Además, `findings` recorre ~12 veces la misma ventana de ~103k funciones.

Respuesta: `api.precalc` guarda en `data/precalc.db` las 48 respuestas por defecto (4 zonas × encabezado, hallazgos,
5 secciones y 5 apéndices) al final de `snapshot` y de `seats`. Medido en la Mac: 12 s para calcularlas, 0.7 MB, idénticas
al cálculo en vivo; `read()` las sirve en ~1 ms. Siguen pendientes, para los filtros que no se precalculan: una sola pasada
sobre la ventana en `findings` y leer menos de `event` en `programming_moves`.

### Prueba de carga (2026-10-11)

Usuarios simultáneos abriendo la Cartelera nacional como el navegador (encabezado y hallazgos, luego 5 secciones,
luego 5 apéndices), API local sobre una copia de la base, en frío. En el servidor, `api.precalc` tarda 53 s en frío y
31 s en caliente, con un pico de 220 MB, y sirve cada respuesta en menos de 1 ms.

| Página completa | 1 usuario | 5 | 10 | 5, desde las 6 PM |
| --- | --- | --- | --- | --- |
| Sin precálculo, antes | 5.9 s | 106 s | 271 s | 93 s |
| Sin precálculo, con candado por llave y 2 cálculos a la vez | 5.1 s | 3.1 s | 3.7 s | 2.5 s |
| Con precálculo | 0.04 s | 0.08 s | 0.12 s | (no aplica) |

Sin candado, cada usuario repetía los mismos cálculos en paralelo y se estorbaban. Con filtros distintos el tiempo crece
en línea recta: 4 zonas a la vez, 5.4 s; 8 filtros distintos, 10 s.
