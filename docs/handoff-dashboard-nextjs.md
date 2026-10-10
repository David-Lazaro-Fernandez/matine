# Handoff: dashboard de Streamlit a Next.js con Fluent UI

Preparado el 2026-10-10 para continuar en otra sesión. Lee antes `AGENTS.md` (reglas del repo) y
`docs/plan-dashboard-nextjs.md` (el plan completo: arquitectura, fases, olas en paralelo y decisiones).

## Objetivo

Cambiar solo la presentación: `app.py` + `ui/` + `views/` (Streamlit) pasan a `dashboard/` (Next.js en exportación
estática + Fluent UI v9). Los clientes son corporativos y esperan una aplicación con aspecto empresarial. Es una
migración 1:1: mismas páginas, mismas tres capas, mismos textos. La infraestructura no cambia: mismo servidor, Caddy,
mismo dominio, `stable` y `make deploy`.

## Estado

Todo está en la rama **`dashboard-nextjs`**, sin push. Sale de `independientes-demo` y lleva 23 commits. `make check` y
`pnpm run build` pasan.

| Fase | Estado | Dónde |
| --- | --- | --- |
| 0. Spike: Next.js + Fluent + tema + etiquetas | Hecha | `dashboard/`, `scripts/export_labels.py`, `make labels` |
| 1. Lógica de pandas de las vistas a `analytics/` | Hecha | `capture_status`, `movie_gaps`, `week_publication`, `presale_by_chain`, `price_summary`, `occupancy_total`, `occupancy_readable` |
| 2a. API interna y sesión por cookie | Hecha | `api/internal.py`, `api/session.py`, `api/pages/` (con `/api/datos` de referencia) |
| Gráficas en Vega-Lite | Hechas todas | `dashboard/components/**` sobre `components/vega-chart.tsx` |
| 2b. Un endpoint por página | Falta | `api/pages/<pagina>.py` |
| 3. Cascarón: navegación por rol, acceso, filtros, componentes compartidos | Falta | `dashboard/app/`, `dashboard/components/` |
| 4–6. Páginas | Falta | Datos, Mapa, Usuarios, Operaciones → Dulcería, Independientes, Recomendador → Cartelera |
| 7. Corte | Falta | Servicio, Caddy, borrar Streamlit, docs |

## Decisiones tomadas

- **Gráficas en Vega-Lite (`vega-embed`), no Fluent Charts ni Chart.js.** Altair genera specs de Vega-Lite y cada
  gráfica se traduce casi 1:1. Fluent Charts no tiene dumbbell y su heatmap pierde el signo. Fluent sigue para el resto
  de la UI. Detalle en el plan §3.
- **Node con `pnpm`, nunca `npm`; registro siempre `registry.npmjs.org`, nunca Shadowbox** (`AGENTS.md` §7).
  `dashboard/.npmrc` fija el registro y `make lint` falla si `pnpm-lock.yaml` apunta a otro.
- **Una API interna aparte de la pública.** `api.internal:app` exige sesión, no tiene CORS y va en `127.0.0.1:8501`
  detrás de Caddy, en el mismo dominio que los archivos estáticos. La cookie `ac_session` es HttpOnly y SameSite=Strict,
  y la sesión se valida en cada petición.
- **Un endpoint por página.** Cada página es un módulo en `api/pages/` con `router = APIRouter()`. `api/internal.py`
  los registra solo y les exige sesión. Los datos pasan por `pages.read(key, compute)`, con caché de 60 s. Así las ramas
  por página no tocan el mismo archivo.
- **Las gráficas reciben las filas de `analytics/` tal cual**, con sus llaves snake_case, para que el endpoint las
  entregue sin transformar.
- **Ningún texto ni hex escrito a mano en `dashboard/`.** Salen de `dashboard/lib/labels.generated.ts`, generado desde
  `analytics/labels.py` con `make labels`. `make check` falla si no coincide.

## Decisiones abiertas

1. **Dónde se hace `next build`.** El build pide ~1.6 GB con dos gráficas (medido en Mac) y el servidor tiene 2 GB. Se
   recomienda construir en GitHub Actions y que `deploy/update.sh` descargue `out/`. Falta que el usuario lo confirme.
2. **Pruebas de frontend.** La recomendación es solo `pnpm run build` en CI al principio.

## Siguiente paso: ola 2

Dos frentes en paralelo (plan §4, "Paralelismo"):

- **Cascarón (fase 3):** `app/layout.tsx` con `NavDrawer` en escritorio y `TabList` abajo en celular, páginas según el
  rol de `GET /api/yo`, las pantallas de entrar, olvidé y restablecer, y los selectores de zona y periodo. También los
  componentes compartidos, que se cierran **antes** de las ramas por página: `capa`, `seccion`, `pregunta`, `leerla`,
  `apendice`, `leyenda`, `hallazgo`, la tabla con `DataGrid` y `lib/format.ts`.
- **Endpoints (fase 2b):** un módulo por página en `api/pages/`, siguiendo `api/pages/datos.py`, con su prueba en
  `tests/test_internal_api.py`.

Después, la ola 3: una rama por página. Cada página mueve sus gráficas desde `/preview/*` a su sección.

## Pendientes conocidos

- **Leyendas HTML.** El `leyenda()` que va arriba de varias gráficas no se portó. Va como componente compartido.
- **`dashboard/components/cartelera/format.ts` debe pasar a `lib/format.ts`**, con prueba de paridad contra los helpers
  de Python (`date_es`, `time_12`, `n`, `pp`). Su `fixed` ya copia el redondeo de Python.
- **Textos escritos a mano en `views/cartelera.py`** (avisos, textos de sección, encabezados de tabla). Pasan a
  `labels.py` antes de portar la cartelera (fase 6).
- **Vistas previas temporales.** `dashboard/app/page.tsx` y `dashboard/app/preview/*` existen solo para comparar contra
  Altair. Se borran con sus scripts (`dashboard/scripts/spike_data.py`, `preview_*.py`) cuando existan las páginas
  reales. Sus datos van en `dashboard/.spike-data/`, fuera de git. Se generan con
  `AC_DATA_DIR="$PWD/data" .venv/bin/python dashboard/scripts/preview_<grupo>.py`.
- **Corrección visible en Streamlit.** En Dulcería, un complejo VIP y uno tradicional del mismo centro comercial se
  apilaban en una barra. Ahora el VIP lleva "VIP" en su etiqueta, en las dos versiones.
- **Textos de error 401 y 403.** La API reusa `InvalidCredentials` y `SelfChange` de `AUTH_TEXT`. Faltan textos propios
  de "sesión vencida" y "solo administradores".
- **Sin límite por IP en `POST /api/login` y `/api/olvide`.** El bloqueo por cuenta de `auth/` sigue activo. Si se
  quiere, se copia `_rate_limit` de `api/main.py`.
- **`deploy/update.sh` revisa `/_stcore/health`.** En el corte debe revisar `/api/salud`.
- **Reglas de `AGENTS.md` que cambian en el corte** (plan §6): tabla de capas, "`app.py` vive en la raíz", la cookie en
  `api/session.py`, §6 y §8 completos.

## Cómo trabajar

- **Agentes en worktrees.** Un worktree nuevo sale de `origin/main`, no de `dashboard-nextjs`. Lo primero en cada uno es
  `git merge --ff-only dashboard-nextjs`.
- **Dependencias.** Los agentes no pueden instalar paquetes. El usuario corre `pnpm install` en
  `/Users/david.fernandez/absolut-cinema/dashboard`, y cada worktree enlaza ese `node_modules` con `ln -s` (sin
  commitearlo).
- **Firma de commits.** En algunos worktrees de agente, git no encuentra la llave de firma y el commit falla. El
  coordinador hace el commit desde su sesión.
- **Fusión.** Después de cada merge en `dashboard-nextjs`: `make labels` si cambió `labels.py`, `make check` con
  `AC_DATA_DIR="$PWD/data"` para que corran las pruebas de vistas, y `pnpm run build`.
- **`tests/test_update_sh.py` falla a veces** con `git commit` exit 128 dentro de su repo temporal, cada vez una prueba
  distinta. Al correrlo solo pasa. No es de esta rama.
- **Nunca uses `git stash` sin etiqueta.** El stash se comparte con otras sesiones. `stash@{0}` es trabajo de otra
  sesión, ya copiado a `../absolut-cinema-plans` (rama `plans-subscriptions`). El usuario puede borrarlo.
- **Limpieza.** Los worktrees `.claude/worktrees/agent-*` de este trabajo ya están fusionados y se pueden quitar con
  `git worktree remove`. `mobile-keyboard-dock` no es de este trabajo.
