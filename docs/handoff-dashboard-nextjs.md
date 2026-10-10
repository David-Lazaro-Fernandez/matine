# Handoff: dashboard de Streamlit a Next.js con Fluent UI

Actualizado el 2026-10-10, al cerrar la ola 3 y el rediseño. Lee antes `AGENTS.md` (reglas del repo) y
`docs/plan-dashboard-nextjs.md` (el plan completo: arquitectura, fases, olas en paralelo y decisiones).

## Objetivo

Cambiar solo la presentación: `app.py` + `ui/` + `views/` (Streamlit) pasan a `dashboard/` (Next.js en exportación
estática + Fluent UI v9). Los clientes son corporativos y esperan una aplicación con aspecto empresarial. Es una
migración 1:1: mismas páginas, mismas tres capas, mismos textos. La infraestructura no cambia: mismo servidor, Caddy,
mismo dominio, `stable` y `make deploy`.

## Estado

Todo está en la rama **`dashboard-nextjs`**, sin push. Sale de `independientes-demo`. `make check` y `pnpm run build`
pasaron por última vez al cerrar la ola 2; la ola 3 y el rediseño no se han compilado. El usuario los revisó en
`pnpm dev` y se ven bien.

| Fase | Estado | Dónde |
| --- | --- | --- |
| 0. Spike: Next.js + Fluent + tema + etiquetas | Hecha | `dashboard/`, `scripts/export_labels.py`, `make labels` |
| 1. Lógica de pandas de las vistas a `analytics/` | Hecha | `capture_status`, `movie_gaps`, `week_publication`, `presale_by_chain`, `price_summary`, `occupancy_total`, `occupancy_readable` |
| 2a. API interna y sesión por cookie | Hecha | `api/internal.py`, `api/session.py` (acceso y usuarios) |
| 2b. Un endpoint por página | Hecha | `api/pages/<pagina>.py`, más `/api/plazas`; pruebas en `tests/test_internal_api.py` |
| Gráficas en Vega-Lite | Hechas todas | `dashboard/components/**` sobre `components/vega-chart.tsx` |
| 3. Cascarón | Hecha, falta probar la cookie en navegador | `components/shell.tsx`, `components/filters.tsx`, `components/common.tsx`, `lib/api.ts`, `lib/format.ts` |
| 4–6. Páginas | Hechas (2026-10-10), sin build ni pruebas | Las ocho, más Dulcería en dos vistas; commit `7936088` |
| Diseño empresarial | Hecho (2026-10-10), sin commit | Tema Fluent, riel de módulos, `shadow16`, `Entrada`, esqueletos (`DESIGN.md`) |
| Velocidad de Cartelera | Falta | `docs/handoff-cartelera-velocidad.md` |
| 7. Corte | Falta | Servicio, Caddy, borrar Streamlit, docs |

### Endpoints (`api/pages/`)

Todos siguen `api/pages/datos.py`: `router`, `TypedDict` de respuesta, parámetros con `Literal`/`Query` y
`read(key, compute)` con caché de 60 s. Las filas salen de `analytics/` tal cual, en snake_case, y la respuesta lleva
llaves, no frases (salvo las de `findings.py` y `conclusions`).

| Endpoint | Parámetros | Notas |
| --- | --- | --- |
| `GET /api/plazas` | — | Lista del selector de zona (`analytics.plazas`), sin la opción nacional |
| `GET /api/datos` | `dataset`, filtros de `DATASETS` | El patrón de referencia |
| `GET /api/mapa` | `plaza`, `chains`, `cinema_ids` | `sites[].cinema_ids` apunta a las filas de `cinemas`, sin repetirlas |
| `GET /api/dulceria` | `plaza`, `platform`, `chain`, `product` | En sala y a domicilio |
| `GET /api/operaciones` | `job_days`, `run_days`, `unit_days`, `log`, `lines` | Solo admin. Lo de `snapshots.db` va con caché; lo de `data/` en vivo |
| `GET /api/independientes` | `plaza`, `d0`, `d1` | Solo Cineteca (`chain="cineteca"`). Plaza distinta de CDMX: `supported=false` |
| `GET /api/recomendador` | `lat`, `lng`, `d0`, grupo, `budget`, `snacks`, `h0`, `h1`, `radius_km`, `sort`, `title_norm`, `formats` | Sin ubicación devuelve solo los límites del formulario |
| `GET /api/recomendador/geocodificar` | `q` | Nominatim con `lru_cache` propia; 502 si no responde |
| `GET /api/cartelera` | `plaza`, `d0`, `d1`, `h0`, `h1` | Las tres capas con los controles en su valor por defecto |
| `GET /api/cartelera/curva`, `/cambios`, `/historia` | ver el módulo | Controles dentro de una sección, sin recalcular las tres capas |

**Convención de zona:** sin `plaza` en la consulta = nacional. El frontend manda `plaza=cdmx` por defecto
(`usePlaza()` devuelve `null` para nacional y `query()` de `lib/api.ts` omite el parámetro).

**Franja:** va como `h0`/`h1` (enteros de `HOUR_MARKS`), no como `franja=`, porque las llaves de `HOUR_PRESETS` son
texto en español y el rango libre necesita dos horas.

### Cascarón (`dashboard/`)

- `components/shell.tsx`: `NavDrawer` en escritorio, `TabList` abajo en celular (≤ 768 px). Las páginas salen del rol de
  `GET /api/yo`, con las reglas de `app.py`. Sin sesión solo existen `/entrar/`, `/olvide/` y `/restablecer/`.
- Las ocho rutas de módulo existen con solo su título. El spike pasó de `/` a `/preview/`.
- `components/filters.tsx`: `PlazaSelector` (de `/api/plazas`, más Nacional) y `PeriodSelector` (hoy, mañana, resto de la
  semana de cine, siguiente semana, fechas libres). El estado vive en la URL (`?plaza=`, `?periodo=`, `?d0=`, `?d1=`).
- `components/common.tsx`: `Capa`, `Seccion`, `Pregunta`, `Leerla`, `Apendice`, `Leyenda`, `Hallazgo`, `Table` (sobre
  `DataGrid`, misma firma que `table()` de Python), `AccessCard` y `AppLink`.
- `lib/api.ts`: `api<T>(path, body?)`, credenciales same-origin, 401 manda a `/entrar/`, `ApiError(status, detail)`.
  Tipos escritos a mano.
- `lib/format.ts`: `date_es`, `range_es`, `time_12`, `n`, `pp`, `fixed`, `addDays`, `cinemaWeek`. Prueba de paridad en
  `tests/test_format_parity.py` (importa el `.ts` con `node --experimental-strip-types`; se omite con Node < 22.6).
- `next.config.mjs`: en `pnpm dev`, `/api` va a `127.0.0.1:8501`. En producción sigue `output: 'export'`.
- `labels.py` sumó `DATE_TEXT`, `PERIOD_TEXT`, `LAYER_TEXT` y `PAGE_LABEL`. `ui/common.py`, `app.py` y
  `views/cartelera.py` ya los usan.

## Decisiones tomadas

- **Diseño empresarial** (2026-10-10, `DESIGN.md`): tema `webLightTheme` tal cual, el rojo solo en datos de Cinemex,
  riel de módulos con panel (`components/shell.tsx`, `MODULE_LABEL`, `NAV_LABEL`). Dulcería se divide en `/dulceria/` (en
  sala) y `/dulceria/domicilio/`, sobre `components/dulceria/dulceria-page.tsx`. Encabezado y pie compartidos:
  `PageHeader` y `PageFooter` en `common.tsx`.
- **Gráficas en Vega-Lite (`vega-embed`), no Fluent Charts ni Chart.js.** Altair genera specs de Vega-Lite y cada
  gráfica se traduce casi 1:1. Fluent Charts no tiene dumbbell y su heatmap pierde el signo. Fluent sigue para el resto
  de la UI. Detalle en el plan §3.
- **Node con `pnpm`, nunca `npm`; registro siempre `registry.npmjs.org`, nunca Shadowbox** (`AGENTS.md` §7).
  `dashboard/.npmrc` fija el registro y `make lint` falla si `pnpm-lock.yaml` apunta a otro.
- **Una API interna aparte de la pública.** `api.internal:app` exige sesión, no tiene CORS y va en `127.0.0.1:8501`
  detrás de Caddy, en el mismo dominio que los archivos estáticos. La cookie `ac_session` es HttpOnly y SameSite=Strict,
  y la sesión se valida en cada petición.
- **Un endpoint por página**, con sub-endpoints solo para controles dentro de una sección. `api/internal.py` registra
  solo cada módulo de `api/pages/`.
- **Las gráficas reciben las filas de `analytics/` tal cual.** El reacomodo de presentación (melt, etiquetas, tooltip)
  se hace en el componente.
- **Ningún texto ni hex escrito a mano en `dashboard/`.** Salen de `dashboard/lib/labels.generated.ts`, generado desde
  `analytics/labels.py` con `make labels`. `make check` falla si no coincide.
- **`next build` en GitHub Actions** (2026-10-10). El workflow construye `out/` y `deploy/update.sh` lo descarga. Se
  arma en el corte. Si CI instala Node ≥ 22.6, la prueba de paridad de formato deja de omitirse.
- **Pruebas de frontend** (2026-10-10): Mocha, Sinon para los stubs de `lib/api.ts`, React Testing Library para los
  componentes y Playwright para los recorridos en navegador. Por ahora no se escriben.
- **La ola 3 va rápido: sin pruebas ni `pnpm run build` por página.** El usuario prueba y reporta los errores.
- **ruff no revisa `.claude/`** (`pyproject.toml`): los worktrees de agentes tienen código a medias.

## Siguiente paso

1. **Velocidad de Cartelera.** Carga por partes y optimización de consultas. Tiene su propio handoff:
   `docs/handoff-cartelera-velocidad.md`.
2. **Compilar y probar.** La ola 3 y el rediseño se hicieron sin `pnpm run build` ni `make check`, a pedido del usuario.
   Lo probable que falle: `tests/test_internal_api.py` (cambió `/api/mapa`, los textos de 401 y `first_snapshot` en
   Dulcería) y tipos en `PageHeader` y las celdas con varias clases de `Table`.
3. **Fuente.** Segoe UI solo existe en Windows; en Mac se ve San Francisco. Pendiente que el usuario elija: dejarlo así o
   servir Selawik (OFL, métricas de Segoe). Las etiquetas de las gráficas usan tamaños fuera de la rampa de Fluent.
4. **`common.tsx`.** `Table` sin orden por columna ni casillas; Datos necesita el `DataGrid` virtualizado.
5. **Corte (fase 7).** Servicio, Caddy, build en GitHub Actions, borrar Streamlit y `/preview/`, reglas de `AGENTS.md`.

## Pendientes conocidos

### Por página

- **Datos:** necesita el `DataGrid` virtualizado (marcado con `ponytail:` en `common.tsx`).
- **Dulcería:** el melt de la gráfica de domicilio y la etiqueta VIP van en el frontend, como ya hacen
  `components/dulceria/`. El filtro "mediana no nula" de la vista sobra: `delivery_compare` ya omite cubetas sin dato.
- **Independientes:** "Solo en la Cineteca" es `overlap` filtrado a `status == "indep_only"` en el frontend. La vista
  ordena ocupación por título por `sold_pct`; `analytics/` la devuelve por `demand_index`. Solo importa cuando
  `OCCUPANCY_CONFIRMED` sea verdadero.
- **Recomendador:** el mapa necesita el clic (en Streamlit era folium). Los marcadores se deduplican por
  `(chain, cinema_id)` en el frontend. Nada limita Nominatim a 1 petición por segundo entre usuarios; si importa, un lock
  con pausa de 1 s en `_geocode`. La prueba es delgada: la captura grabada no trae precios.
- **Cartelera:**
  - Los campos que esperan `movies-dumbbell.tsx` y `day-slot-heatmap.tsx` (`delta`, `winner`, `tooltip`, `day`,
    `slot_label`, `label`) se arman en `app/page.tsx` desde `movie_gaps` y `heatmap_day_slot`.
  - `hour_mark`, `hours_label`, `range_short` y `plaza_title` tienen su equivalente en `app/page.tsx`. Si otra página
    los necesita, pasan a `lib/format.ts`.
  - En frío tarda ~7.5 s con CDMX y ~9.5 s nacional; `findings` se lleva 4.6 s. El plan está en
    `docs/handoff-cartelera-velocidad.md`.
  - `SHOWN_MOVIES`, `TOTAL_MOVIES` y `FIRST_SNAPSHOT` están copiados de `ui/common.py` en `api/pages/cartelera.py`,
    porque `api/` no puede importar `ui/`. La copia de `ui/` se borra en el corte.
  - Los textos de la página viven en `CARTELERA_TEXT` y los del filtro de franja en `HOURS_TEXT`.
    Los títulos de tooltip de Altair en `views/cartelera.py` siguen escritos a mano: se borran en el corte.

### Generales

- **Vistas previas temporales.** `dashboard/app/preview/*` existe solo para comparar contra Altair. Se borra con sus
  scripts (`dashboard/scripts/spike_data.py`, `preview_*.py`) cuando existan las páginas reales. Sus datos van en
  `dashboard/.spike-data/`, fuera de git. Se generan con
  `AC_DATA_DIR="$PWD/data" .venv/bin/python dashboard/scripts/preview_<grupo>.py`.
- **"Hoy" en el navegador** usa la zona `America/Mexico_City` escrita en `components/filters.tsx` (copia de
  `config.PILOT_TIMEZONE`), no la del servidor.
- **Textos de error 401 y 403.** La API reusa `InvalidCredentials` y `SelfChange` de `AUTH_TEXT`. Faltan textos propios
  de "sesión vencida" y "solo administradores".
- **Sin límite por IP en `POST /api/login` y `/api/olvide`.** El bloqueo por cuenta de `auth/` sigue activo. Si se
  quiere, se copia `_rate_limit` de `api/main.py`.
- **En el corte:** `deploy/update.sh` debe revisar `/api/salud` en vez de `/_stcore/health`; la prueba de paridad debe
  tomar `n` y `pp` de otro lado cuando se borre `ui/common.py`; y cambian las reglas de `AGENTS.md` del plan §6 (tabla
  de capas, "`app.py` vive en la raíz", la cookie en `api/session.py`, §6 y §8 completos).
- **Corrección visible en Streamlit.** En Dulcería, un complejo VIP y uno tradicional del mismo centro comercial se
  apilaban en una barra. Ahora el VIP lleva "VIP" en su etiqueta, en las dos versiones.

## Cómo trabajar

- **Agentes en worktrees.** Un worktree nuevo sale de `origin/main`, no de `dashboard-nextjs`. Lo primero en cada uno es
  `git merge --ff-only dashboard-nextjs`.
- **Dependencias.** Los agentes no pueden instalar paquetes. El usuario corre `pnpm install` en
  `/Users/david.fernandez/absolut-cinema/dashboard`, y cada worktree enlaza ese `node_modules` con `ln -s` (sin
  commitearlo). Con el enlace, Turbopack falla en el worktree: ahí se construye con `pnpm exec next build --webpack`.
  El worktree tampoco tiene `.venv`: `make check VENV=/Users/david.fernandez/absolut-cinema/.venv/bin`.
- **Firma de commits.** En algunos worktrees de agente, git no encuentra la llave de firma y el commit falla. El
  coordinador hace el commit desde su sesión.
- **Fusión.** Después de cada merge en `dashboard-nextjs`: `make labels` si cambió `labels.py`, `make check` con
  `AC_DATA_DIR="$PWD/data"` para que corran las pruebas de vistas, y `cd dashboard && pnpm run build`. Las ramas que
  agregan pruebas al final de `tests/test_internal_api.py` chocan ahí; se resuelve juntándolas y usando el fixture
  `recorded` o el helper `_recorded`.
- **`tests/test_update_sh.py` falla a veces** con `git commit` exit 128 dentro de su repo temporal, cada vez una prueba
  distinta. Al correrlo solo pasa. No es de esta rama.
- **Nunca uses `git stash` sin etiqueta.** El stash se comparte con otras sesiones. `stash@{0}` es trabajo de otra
  sesión, ya copiado a `../absolut-cinema-plans` (rama `plans-subscriptions`). El usuario puede borrarlo.
- **Limpieza.** Los worktrees de la ola 2 ya se borraron. Los `.claude/worktrees/agent-*` que quedan son de la ola 1,
  ya fusionados, y se pueden quitar con `git worktree remove`. `mobile-keyboard-dock` no es de este trabajo.
- **`dashboard/AGENTS.md`** lo puede crear `next dev`. No se commitea.
